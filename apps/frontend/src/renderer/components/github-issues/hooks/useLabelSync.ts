import { useCallback, useEffect, useRef } from 'react';
import { useProjectStore } from '../../../stores/project-store';
import { useLabelSyncStore } from '../../../stores/github/label-sync-store';
import { SYNC_DEBOUNCE_MS } from '@shared/constants/label-sync';
import type { LabelSyncConfig } from '@shared/types/label-sync';

export function useLabelSync() {
  const projectId = useProjectStore((s) => s.activeProjectId);

  // Reactive state selectors — only re-render when these specific values change
  const config = useLabelSyncStore((s) => s.config);
  const isLoaded = useLabelSyncStore((s) => s.isLoaded);
  const isSyncing = useLabelSyncStore((s) => s.isSyncing);
  const error = useLabelSyncStore((s) => s.error);
  const lastResult = useLabelSyncStore((s) => s.lastResult);

  const loadStatus = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await window.electronAPI.github.getLabelSyncStatus(projectId);
      useLabelSyncStore.getState().setConfig(result);
    } catch (error) {
      useLabelSyncStore.getState().setError(error instanceof Error ? error.message : 'Failed to load label sync status');
    }
  }, [projectId]);

  const enableSync = useCallback(async () => {
    if (!projectId) return;
    useLabelSyncStore.getState().setSyncing(true);
    try {
      const result = await window.electronAPI.github.enableLabelSync(projectId);
      const s = useLabelSyncStore.getState();
      s.setLastResult(result);
      s.setConfig({ enabled: true, lastSyncedAt: new Date().toISOString() });
    } catch (error) {
      useLabelSyncStore.getState().setError(error instanceof Error ? error.message : 'Failed to enable label sync');
    } finally {
      useLabelSyncStore.getState().setSyncing(false);
    }
  }, [projectId]);

  const disableSync = useCallback(async (cleanup: boolean) => {
    if (!projectId) return;
    useLabelSyncStore.getState().setSyncing(true);
    try {
      await window.electronAPI.github.disableLabelSync(projectId, cleanup);
      useLabelSyncStore.getState().setConfig({ enabled: false, lastSyncedAt: null });
    } catch (error) {
      useLabelSyncStore.getState().setError(error instanceof Error ? error.message : 'Failed to disable label sync');
    } finally {
      useLabelSyncStore.getState().setSyncing(false);
    }
  }, [projectId]);

  // Use per-issue debounce timers to avoid losing pending syncs for different issues
  const syncTimerRefsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Clean up all debounce timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of syncTimerRefsRef.current.values()) {
        clearTimeout(timer);
      }
      syncTimerRefsRef.current.clear();
    };
  }, []);

  const syncIssueLabel = useCallback((
    issueNumber: number,
    newState: string,
    oldState: string | null,
  ) => {
    if (!projectId || !useLabelSyncStore.getState().config.enabled) return;

    // Clear existing timer for this specific issue
    const existingTimer = syncTimerRefsRef.current.get(issueNumber);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer for this issue
    const timer = setTimeout(async () => {
      try {
        await window.electronAPI.github.syncIssueLabel(projectId, issueNumber, newState, oldState);
        syncTimerRefsRef.current.delete(issueNumber);
      } catch (err) {
        // Log error but don't disrupt workflow - label sync failures are non-blocking
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.warn(`[LabelSync] Failed to sync label for issue #${issueNumber}: ${errorMessage}`);
        useLabelSyncStore.getState().setError(`Issue #${issueNumber}: ${errorMessage}`);
        syncTimerRefsRef.current.delete(issueNumber);
      }
    }, SYNC_DEBOUNCE_MS);

    syncTimerRefsRef.current.set(issueNumber, timer);
  }, [projectId]);

  const bulkLabelSync = useCallback(async (issueNumbers: number[]) => {
    if (!projectId || !useLabelSyncStore.getState().config.enabled) return { synced: 0, errors: 0 };
    useLabelSyncStore.getState().setSyncing(true);
    try {
      const result = await window.electronAPI.github.bulkLabelSync(projectId, issueNumbers);
      return result;
    } catch (error) {
      useLabelSyncStore.getState().setError(error instanceof Error ? error.message : 'Bulk sync failed');
      return { synced: 0, errors: 0 };
    } finally {
      useLabelSyncStore.getState().setSyncing(false);
    }
  }, [projectId]);

  const saveConfig = useCallback(async (config: LabelSyncConfig) => {
    if (!projectId) return;
    try {
      await window.electronAPI.github.saveLabelSyncConfig(projectId, config);
      useLabelSyncStore.getState().setConfig(config);
    } catch (error) {
      useLabelSyncStore.getState().setError(error instanceof Error ? error.message : 'Failed to save config');
    }
  }, [projectId]);

  return {
    config,
    isLoaded,
    isSyncing,
    error,
    lastResult,
    loadStatus,
    enableSync,
    disableSync,
    syncIssueLabel,
    bulkLabelSync,
    saveConfig,
  };
}
