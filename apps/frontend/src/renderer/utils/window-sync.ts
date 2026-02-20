import { unstable_batchedUpdates } from 'react-dom';
import type { GlobalState } from '../../shared/types/window';

/**
 * Utility type for IPC event listener cleanup function
 */
type IpcListenerCleanup = () => void;

/**
 * Cross-window state synchronization utility
 *
 * Handles state synchronization across multiple windows in the Electron app.
 * When the main process broadcasts state changes via IPC, this utility updates
 * the appropriate Zustand stores in all renderer processes.
 *
 * DESIGN NOTE: This module uses a callback-based approach rather than directly
 * importing stores to avoid circular dependencies and ensure testability.
 * The callbacks are registered by the consumer (e.g., App.tsx) at initialization.
 *
 * Usage:
 * ```tsx
 * // In App.tsx
 * useEffect(() => {
 *   const cleanup = initializeWindowSync({
 *     onAuthSync: (data) => useAuthStore.getState().syncFromMain(data),
 *     onSettingsSync: (data) => useSettingsStore.getState().syncFromMain(data),
 *     onProjectsSync: (data) => useProjectStore.getState().syncFromMain(data),
 *   });
 *   return cleanup;
 * }, []);
 * ```
 */

/**
 * Sync callbacks for different state types
 */
export interface WindowSyncCallbacks {
  /** Called when auth state should sync (login, logout, profile change) */
  onAuthSync?: (data: unknown) => void;

  /** Called when auth failure occurs (401 errors requiring re-authentication) */
  onAuthFailure?: (info: unknown) => void;

  /** Called when settings state should sync (theme, language, preferences) */
  onSettingsSync?: (data: unknown) => void;

  /** Called when projects state should sync (add, remove, update) */
  onProjectsSync?: (data: unknown) => void;
}

/**
 * Module-level state for batching sync updates.
 *
 * DESIGN NOTE: Module-level variables are acceptable here because:
 * 1. There's only one main window that initializes sync
 * 2. Child windows each have their own renderer process with isolated module scope
 * 3. Batching at module level ensures all sync events within a frame are coalesced
 */
let syncCallbacks: WindowSyncCallbacks | null = null;
let batchQueue: GlobalState[] = [];
let batchTimeout: NodeJS.Timeout | null = null;
let cleanupListener: IpcListenerCleanup | null = null;
let cleanupAuthFailureListener: IpcListenerCleanup | null = null;

/**
 * Maximum sync events to buffer in the batch queue (OOM prevention)
 */
const MAX_BATCH_QUEUE_SIZE = 50;

/**
 * Flush all batched sync updates to stores
 */
function flushBatch(): void {
  if (batchQueue.length === 0 || !syncCallbacks) return;

  const flushStart = performance.now();
  const updateCount = batchQueue.length;

  // Batch all React updates together
  unstable_batchedUpdates(() => {
    batchQueue.forEach((state) => {
      switch (state.type) {
        case 'auth':
          syncCallbacks?.onAuthSync?.(state.data);
          break;
        case 'settings':
          syncCallbacks?.onSettingsSync?.(state.data);
          break;
        case 'projects':
          syncCallbacks?.onProjectsSync?.(state.data);
          break;
        default:
          console.warn('[Window Sync] Unknown state type:', state);
      }
    });
  });

  if (window.DEBUG) {
    const flushDuration = performance.now() - flushStart;
    console.warn(
      `[Window Sync] Flushed ${updateCount} sync updates in ${flushDuration.toFixed(2)}ms`
    );
  }

  batchQueue = [];
  batchTimeout = null;
}

/**
 * Queue a sync update for batched processing
 */
function queueSyncUpdate(state: GlobalState): void {
  // Auth changes bypass batching - apply immediately for security
  // This ensures logout/login events propagate instantly across all windows
  if (state.type === 'auth' && syncCallbacks) {
    if (window.DEBUG) {
      console.warn('[Window Sync] Auth change detected, applying immediately');
    }
    // Flush any pending updates first to ensure correct ordering
    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
      flushBatch();
    }
    // Apply auth change immediately
    syncCallbacks.onAuthSync?.(state.data);
    return;
  }

  // Settings changes apply immediately for responsive UX
  // This ensures theme/language/preference changes sync within 500ms across all windows
  if (state.type === 'settings' && syncCallbacks) {
    if (window.DEBUG) {
      console.warn('[Window Sync] Settings change detected, applying immediately');
    }
    // Flush any pending updates first to ensure correct ordering
    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
      flushBatch();
    }
    // Apply settings change immediately
    syncCallbacks.onSettingsSync?.(state.data);
    return;
  }

  // Project changes apply immediately for responsive multi-window UX
  // This ensures project add/remove/update operations sync instantly across all windows
  if (state.type === 'projects' && syncCallbacks) {
    if (window.DEBUG) {
      console.warn('[Window Sync] Project change detected, applying immediately');
    }
    // Flush any pending updates first to ensure correct ordering
    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
      flushBatch();
    }
    // Apply project change immediately
    syncCallbacks.onProjectsSync?.(state.data);
    return;
  }

  // NOTE: All current state types (auth, settings, projects) are handled
  // immediately above. If new state types are added in the future that don't
  // require immediate sync, they will fall through to this batch queue.
  batchQueue.push(state);

  // Cap batch queue to prevent OOM when sync events arrive faster than flush interval
  if (batchQueue.length > MAX_BATCH_QUEUE_SIZE) {
    if (window.DEBUG) {
      console.warn(
        `[Window Sync] Batch queue exceeded ${MAX_BATCH_QUEUE_SIZE}, flushing early`
      );
    }
    // Force flush to prevent memory issues
    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
    }
    flushBatch();
    return;
  }

  // Schedule flush after 16ms (one frame at 60fps)
  if (!batchTimeout) {
    batchTimeout = setTimeout(flushBatch, 16);
  }
}

/**
 * Initialize cross-window state synchronization
 *
 * Sets up IPC listeners to receive state changes from the main process
 * and routes them to the appropriate Zustand stores via callbacks.
 *
 * @param callbacks - Handlers for different state types
 * @returns Cleanup function to remove listeners and clear state
 *
 * @example
 * ```tsx
 * const cleanup = initializeWindowSync({
 *   onAuthSync: (data) => handleAuthSync(data),
 *   onSettingsSync: (data) => handleSettingsSync(data),
 *   onProjectsSync: (data) => handleProjectsSync(data),
 * });
 * // Later, when component unmounts:
 * cleanup();
 * ```
 */
export function initializeWindowSync(callbacks: WindowSyncCallbacks): () => void {
  // Store callbacks for batch flushing
  syncCallbacks = callbacks;

  // Set up IPC listener for state sync events
  cleanupListener = window.electronAPI.window.onSyncState((state: GlobalState) => {
    queueSyncUpdate(state);
  });

  // Set up auth failure listener (401 errors requiring re-authentication)
  // Auth failures bypass batching and apply immediately for security
  cleanupAuthFailureListener = window.electronAPI.onAuthFailure((info: unknown) => {
    if (window.DEBUG) {
      console.warn('[Window Sync] Auth failure detected, applying immediately');
    }
    syncCallbacks?.onAuthFailure?.(info);
  });

  if (window.DEBUG) {
    console.warn('[Window Sync] Initialized cross-window state synchronization');
  }

  // Return cleanup function
  return () => {
    // Clean up IPC listeners
    if (cleanupListener) {
      cleanupListener();
      cleanupListener = null;
    }
    if (cleanupAuthFailureListener) {
      cleanupAuthFailureListener();
      cleanupAuthFailureListener = null;
    }

    // Clear batch state
    if (batchTimeout) {
      clearTimeout(batchTimeout);
      batchTimeout = null;
    }
    batchQueue = [];
    syncCallbacks = null;

    if (window.DEBUG) {
      console.warn('[Window Sync] Cleaned up state synchronization');
    }
  };
}

/**
 * Get current window configuration from main process
 *
 * Convenience wrapper around the IPC call to get this window's config.
 * Useful for determining window type (main/project/view) on initialization.
 *
 * @returns Promise resolving to this window's configuration
 *
 * @example
 * ```tsx
 * const config = await getWindowConfig();
 * if (config.type === 'view') {
 *   // Single-view mode - hide sidebar
 * }
 * ```
 */
export async function getWindowConfig() {
  return window.electronAPI.window.getConfig();
}

/**
 * Request immediate state sync from main process
 *
 * Forces the main process to broadcast current state to all windows.
 * Useful after initial window creation to ensure new windows have latest state.
 *
 * NOTE: This is a placeholder for future implementation.
 * The actual trigger will be added in phase 7 (state sync implementation).
 *
 * @param stateType - Optional: which state to sync ('auth' | 'settings' | 'projects')
 */
export async function requestStateSync(stateType?: 'auth' | 'settings' | 'projects') {
  // TODO: Implement IPC channel for requesting sync from main process
  // This will be added in phase 7 when state sync is fully implemented
  if (window.DEBUG) {
    console.warn('[Window Sync] requestStateSync not yet implemented:', stateType);
  }
}
