import { useEffect, useCallback, useRef } from 'react';
import type { InvestigationLogs as InvestigationLogsType } from '@shared/types';

interface PollingOptions {
  /** Project ID */
  projectId: string;
  /** Issue number */
  issueNumber: number;
  /** Whether investigation is currently running */
  isInvestigating: boolean;
  /** Optional: Whether to fetch one last time on completion/failure */
  fetchOnComplete?: boolean;
  /** Callback when new logs are received */
  onLogs: (logs: InvestigationLogsType) => void;
}

type SubscriberCallback = (logs: InvestigationLogsType) => void;

interface PollerState {
  intervalId: ReturnType<typeof setInterval> | null;
  subscriberCount: number;
  lastLogs: InvestigationLogsType | null;
  subscribers: Set<SubscriberCallback>;
  ipcCleanup?: () => void;
}

/**
 * Shared hook for polling investigation logs.
 * Prevents duplicate polling intervals when multiple components
 * need to track the same investigation.
 *
 * Uses a registry to ensure only one poller runs per
 * (projectId, issueNumber) combination, while notifying all subscribers.
 */
const pollerRegistry = new Map<string, PollerState>();

function getPollerKey(projectId: string, issueNumber: number): string {
  return `${projectId}:${issueNumber}`;
}

export function useInvestigationPolling(options: PollingOptions): void {
  const {
    projectId,
    issueNumber,
    isInvestigating,
    fetchOnComplete = true,
    onLogs,
  } = options;

  // Store the callback in a ref to avoid recreating the subscriber on every render
  const onLogsRef = useRef(onLogs);
  onLogsRef.current = onLogs;

  // Create a stable subscriber function
  const subscriber = useRef<SubscriberCallback>((logs) => {
    onLogsRef.current(logs);
  }).current;

  const fetchLogs = useCallback(async () => {
    try {
      const result = await window.electronAPI.github.getInvestigationLogs(projectId, issueNumber);
      if (!result) return;

      const key = getPollerKey(projectId, issueNumber);
      const poller = pollerRegistry.get(key);
      if (poller) {
        poller.lastLogs = result;
        // Notify all subscribers
        for (const sub of poller.subscribers) {
          sub(result);
        }
      }
    } catch {
      // Silently ignore fetch errors
    }
  }, [projectId, issueNumber]);

  useEffect(() => {
    const key = getPollerKey(projectId, issueNumber);

    // Register subscriber
    if (!pollerRegistry.has(key)) {
      pollerRegistry.set(key, {
        intervalId: null,
        subscriberCount: 0,
        lastLogs: null,
        subscribers: new Set(),
      });
    }

    const poller = pollerRegistry.get(key)!;
    poller.subscriberCount++;
    poller.subscribers.add(subscriber);

    // Initial fetch with existing logs if available
    if (poller.lastLogs) {
      subscriber(poller.lastLogs);
    }

    // Start polling if investigating and no interval running
    if (isInvestigating && !poller.intervalId) {
      // Fetch immediately
      fetchLogs();

      // Set up interval
      poller.intervalId = setInterval(fetchLogs, 1500);

      // Set up IPC listener for push updates
      poller.ipcCleanup = window.electronAPI.github.onInvestigationLogsUpdated(
        (eventProjectId, data) => {
          if (eventProjectId === projectId && data.issueNumber === issueNumber) {
            fetchLogs();
          }
        },
      );
    } else if (!isInvestigating && fetchOnComplete) {
      // One final fetch when not investigating
      fetchLogs();
    }

    // Cleanup function
    return () => {
      const currentPoller = pollerRegistry.get(key);
      if (!currentPoller) return;

      // Remove this subscriber
      currentPoller.subscriberCount--;
      currentPoller.subscribers.delete(subscriber);

      // Clean up poller if no more subscribers
      if (currentPoller.subscriberCount <= 0) {
        if (currentPoller.intervalId) {
          clearInterval(currentPoller.intervalId);
        }
        if (currentPoller.ipcCleanup) {
          currentPoller.ipcCleanup();
        }
        pollerRegistry.delete(key);
      }
    };
  }, [isInvestigating, projectId, issueNumber, fetchOnComplete, fetchLogs, subscriber]);
}
