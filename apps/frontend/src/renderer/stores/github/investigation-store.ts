import { create } from 'zustand';
import type {
  GitHubInvestigationStatus,
  GitHubInvestigationResult,
  InvestigationProgress,
  InvestigationResult,
  InvestigationReport,
  InvestigationDismissReason,
  InvestigationSettings,
  InvestigationState
} from '@shared/types';

// ============================================
// Per-Issue Investigation State
// ============================================

/**
 * Investigation state for a single issue.
 * Keyed by `${projectId}:${issueNumber}` in the store.
 */
export interface IssueInvestigationState {
  issueNumber: number;
  projectId: string;
  isInvestigating: boolean;
  /** Real-time progress during investigation */
  progress: InvestigationProgress | null;
  /** Final investigation report */
  report: InvestigationReport | null;
  /** Previous report (kept during re-investigation for continuity) */
  previousReport: InvestigationReport | null;
  /** Error message if investigation failed */
  error: string | null;
  /** Pre-allocated spec ID for task creation */
  specId: string | null;
  /** Dismiss reason if issue was dismissed */
  dismissReason: InvestigationDismissReason | null;
  /** GitHub comment ID if results were posted */
  githubCommentId: number | null;
  /** Timestamp when investigation started */
  startedAt: string | null;
  /** Timestamp when investigation completed */
  completedAt: string | null;
}

// ============================================
// Store Interface
// ============================================

interface InvestigationStoreState {
  // Per-issue investigation state
  // Key: `${projectId}:${issueNumber}`
  investigations: Record<string, IssueInvestigationState>;

  // Settings (per project, keyed by projectId)
  settings: Record<string, InvestigationSettings>;

  // ---- Legacy state (backwards compat with useGitHubInvestigation hook) ----
  investigationStatus: GitHubInvestigationStatus;
  lastInvestigationResult: GitHubInvestigationResult | null;
  setInvestigationStatus: (status: GitHubInvestigationStatus) => void;
  setInvestigationResult: (result: GitHubInvestigationResult | null) => void;
  clearInvestigation: () => void;

  // ---- New system actions ----
  startInvestigation: (projectId: string, issueNumber: number) => void;
  setProgress: (projectId: string, progress: InvestigationProgress) => void;
  setResult: (projectId: string, result: InvestigationResult) => void;
  setError: (projectId: string, issueNumber: number, error: string) => void;
  dismiss: (projectId: string, issueNumber: number, reason: InvestigationDismissReason) => void;
  clearIssueInvestigation: (projectId: string, issueNumber: number) => void;
  setSettings: (projectId: string, settings: InvestigationSettings) => void;

  // ---- Selectors ----
  getInvestigationState: (projectId: string, issueNumber: number) => IssueInvestigationState | null;
  getDerivedState: (projectId: string, issueNumber: number) => InvestigationState;
  getActiveInvestigations: (projectId: string) => IssueInvestigationState[];
  getSettings: (projectId: string) => InvestigationSettings | null;
}

// ============================================
// Store Implementation
// ============================================

export const useInvestigationStore = create<InvestigationStoreState>((set, get) => ({
  // Initial state
  investigations: {},
  settings: {},

  // Legacy state
  investigationStatus: { phase: 'idle', progress: 0, message: '' },
  lastInvestigationResult: null,

  // Legacy actions (backwards compat)
  setInvestigationStatus: (investigationStatus) => set({ investigationStatus }),
  setInvestigationResult: (lastInvestigationResult) => set({ lastInvestigationResult }),
  clearInvestigation: () => set({
    investigationStatus: { phase: 'idle', progress: 0, message: '' },
    lastInvestigationResult: null
  }),

  // ---- New system actions ----

  startInvestigation: (projectId: string, issueNumber: number) => set((state) => {
    const key = `${projectId}:${issueNumber}`;
    const existing = state.investigations[key];
    return {
      investigations: {
        ...state.investigations,
        [key]: {
          issueNumber,
          projectId,
          isInvestigating: true,
          progress: null,
          report: null,
          previousReport: existing?.report ?? null,
          error: null,
          specId: existing?.specId ?? null,
          dismissReason: null, // clear dismiss on re-investigation
          githubCommentId: existing?.githubCommentId ?? null,
          startedAt: new Date().toISOString(),
          completedAt: null
        }
      }
    };
  }),

  setProgress: (projectId: string, progress: InvestigationProgress) => set((state) => {
    const key = `${projectId}:${progress.issueNumber}`;
    const existing = state.investigations[key];
    return {
      investigations: {
        ...state.investigations,
        [key]: {
          issueNumber: progress.issueNumber,
          projectId,
          isInvestigating: true,
          progress,
          report: existing?.report ?? null,
          previousReport: existing?.previousReport ?? null,
          error: null,
          specId: existing?.specId ?? null,
          dismissReason: existing?.dismissReason ?? null,
          githubCommentId: existing?.githubCommentId ?? null,
          startedAt: existing?.startedAt ?? null,
          completedAt: null
        }
      }
    };
  }),

  setResult: (projectId: string, result: InvestigationResult) => set((state) => {
    const key = `${projectId}:${result.issueNumber}`;
    const existing = state.investigations[key];
    return {
      investigations: {
        ...state.investigations,
        [key]: {
          issueNumber: result.issueNumber,
          projectId,
          isInvestigating: false,
          progress: null,
          report: result.report,
          previousReport: existing?.previousReport ?? null,
          error: null,
          specId: result.specId ?? existing?.specId ?? null,
          dismissReason: existing?.dismissReason ?? null,
          githubCommentId: result.githubCommentId ?? existing?.githubCommentId ?? null,
          startedAt: existing?.startedAt ?? null,
          completedAt: result.completedAt
        }
      }
    };
  }),

  setError: (projectId: string, issueNumber: number, error: string) => set((state) => {
    const key = `${projectId}:${issueNumber}`;
    const existing = state.investigations[key];
    return {
      investigations: {
        ...state.investigations,
        [key]: {
          issueNumber,
          projectId,
          isInvestigating: false,
          progress: null,
          report: existing?.report ?? null,
          previousReport: existing?.previousReport ?? null,
          error,
          specId: existing?.specId ?? null,
          dismissReason: existing?.dismissReason ?? null,
          githubCommentId: existing?.githubCommentId ?? null,
          startedAt: existing?.startedAt ?? null,
          completedAt: null
        }
      }
    };
  }),

  dismiss: (projectId: string, issueNumber: number, reason: InvestigationDismissReason) => set((state) => {
    const key = `${projectId}:${issueNumber}`;
    const existing = state.investigations[key];
    if (!existing) return state;
    return {
      investigations: {
        ...state.investigations,
        [key]: {
          ...existing,
          dismissReason: reason
        }
      }
    };
  }),

  clearIssueInvestigation: (projectId: string, issueNumber: number) => set((state) => {
    const key = `${projectId}:${issueNumber}`;
    const { [key]: _, ...rest } = state.investigations;
    return { investigations: rest };
  }),

  setSettings: (projectId: string, settings: InvestigationSettings) => set((state) => ({
    settings: {
      ...state.settings,
      [projectId]: settings
    }
  })),

  // ---- Selectors ----

  getInvestigationState: (projectId: string, issueNumber: number) => {
    const { investigations } = get();
    const key = `${projectId}:${issueNumber}`;
    return investigations[key] ?? null;
  },

  /**
   * Compute the derived investigation state for an issue.
   * This is the 8-state machine from the design doc, fully derived
   * from investigation data (never manually set).
   */
  getDerivedState: (projectId: string, issueNumber: number): InvestigationState => {
    const { investigations } = get();
    const key = `${projectId}:${issueNumber}`;
    const inv = investigations[key];

    if (!inv) return 'new';
    if (inv.isInvestigating) return 'investigating';
    if (inv.error) return 'failed';
    if (inv.report?.likelyResolved) return 'resolved';
    if (inv.report && !inv.specId) return 'findings_ready';
    if (inv.specId) return 'task_created';
    return 'new';
  },

  getActiveInvestigations: (projectId: string) => {
    const { investigations } = get();
    return Object.values(investigations).filter(
      inv => inv.projectId === projectId && inv.isInvestigating
    );
  },

  getSettings: (projectId: string) => {
    const { settings } = get();
    return settings[projectId] ?? null;
  }
}));

// ============================================
// Global IPC Listeners
// ============================================

let investigationListenersInitialized = false;
let cleanupFunctions: (() => void)[] = [];

/**
 * Initialize global IPC listeners for investigation events.
 * Call this once at app startup to ensure events are captured
 * regardless of which component is mounted.
 */
export function initializeInvestigationListeners(): void {
  if (investigationListenersInitialized) return;

  // Check if the new investigation API is available
  if (!window.electronAPI?.github?.onInvestigationProgress) {
    console.warn('[InvestigationStore] Investigation API not available, skipping listener setup');
    return;
  }

  const store = useInvestigationStore.getState();

  // Listen for investigation progress events
  const cleanupProgress = window.electronAPI.github.onInvestigationProgress(
    (projectId: string, progress: InvestigationProgress) => {
      store.setProgress(projectId, progress);
    }
  );
  cleanupFunctions.push(cleanupProgress);

  // Listen for investigation completion events
  const cleanupComplete = window.electronAPI.github.onInvestigationComplete(
    (projectId: string, result: InvestigationResult) => {
      store.setResult(projectId, result);
    }
  );
  cleanupFunctions.push(cleanupComplete);

  // Listen for investigation error events
  const cleanupError = window.electronAPI.github.onInvestigationError(
    (projectId: string, error: string) => {
      // We need the issueNumber from the error; parse from active investigations
      const active = store.getActiveInvestigations(projectId);
      // If there's only one active, use that. Otherwise, this error is ambiguous.
      // The IPC handler should include issueNumber in a future iteration,
      // but for now we mark all active investigations as errored.
      for (const inv of active) {
        store.setError(projectId, inv.issueNumber, error);
      }
    }
  );
  cleanupFunctions.push(cleanupError);

  // Listen for GitHub auth changes - clear all investigation state
  if (window.electronAPI.github.onGitHubAuthChanged) {
    const cleanupAuthChanged = window.electronAPI.github.onGitHubAuthChanged(
      () => {
        useInvestigationStore.setState({ investigations: {}, settings: {} });
      }
    );
    cleanupFunctions.push(cleanupAuthChanged);
  }

  investigationListenersInitialized = true;
}

/**
 * Cleanup investigation listeners.
 * Call this during app unmount or hot-reload.
 */
export function cleanupInvestigationListeners(): void {
  for (const cleanup of cleanupFunctions) {
    try {
      cleanup();
    } catch {
      // Ignore cleanup errors
    }
  }
  cleanupFunctions = [];
  investigationListenersInitialized = false;
}

// ============================================
// Action helpers (called from outside the store)
// ============================================

/**
 * Start investigating a GitHub issue via the new investigation system.
 */
export function startIssueInvestigation(
  projectId: string,
  issueNumber: number
): void {
  const store = useInvestigationStore.getState();
  store.startInvestigation(projectId, issueNumber);
  window.electronAPI.github.startInvestigation(projectId, issueNumber);
}

/**
 * Cancel a running investigation.
 */
export function cancelIssueInvestigation(
  projectId: string,
  issueNumber: number
): void {
  const store = useInvestigationStore.getState();
  // Mark as not investigating immediately
  store.setError(projectId, issueNumber, 'Investigation cancelled');
  window.electronAPI.github.cancelInvestigation(projectId, issueNumber);
}

/**
 * Start investigating a GitHub issue (legacy function, kept for backwards compat).
 * Uses the old investigateGitHubIssue IPC channel.
 */
export function investigateGitHubIssue(
  projectId: string,
  issueNumber: number,
  selectedCommentIds?: number[]
): void {
  const store = useInvestigationStore.getState();
  store.setInvestigationStatus({
    phase: 'fetching',
    issueNumber,
    progress: 0,
    message: 'Starting investigation...'
  });
  store.setInvestigationResult(null);

  window.electronAPI.investigateGitHubIssue(projectId, issueNumber, selectedCommentIds);
}
