import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants/ipc';
import type { WindowConfig, GlobalState } from '../../shared/types';
import { WindowManager } from '../window-manager';

/**
 * Window Management IPC Handlers
 * Handles window operations for multi-window pop-out support
 *
 * Channels:
 * - window:pop-out-project - Pop out entire project into new window
 * - window:pop-out-view - Pop out specific view into new window
 * - window:merge-window - Merge pop-out window back to main
 * - window:get-windows - Get list of all open windows
 * - window:get-config - Get current window's configuration
 * - window:focus-window - Focus an existing window
 *
 * Events (Main → Renderer):
 * - window:config-changed - Notify when window config changes
 * - window:sync-state - Broadcast state changes to all windows
 */

/**
 * Register all window management IPC handlers
 */
export function registerWindowHandlers(): void {
  const windowManager = WindowManager.getInstance();

  /**
   * Pop out entire project into new window
   * @param projectId - ID of project to pop out
   * @returns Window ID and success status
   * @throws Error if project already popped out (with ALREADY_POPPED_OUT code)
   */
  ipcMain.handle(IPC_CHANNELS.WINDOW_POP_OUT_PROJECT, async (event, projectId: string) => {
    try {
      const sourceWindow = BrowserWindow.fromWebContents(event.sender);
      if (!sourceWindow) {
        throw new Error('Source window not found');
      }

      const result = await windowManager.popOutProject(projectId, sourceWindow);

      // Broadcast config change to all windows
      broadcastWindowConfigChange();

      return { success: true, ...result };
    } catch (error: unknown) {
      // Handle duplicate pop-out error specially
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ALREADY_POPPED_OUT'
      ) {
        // Return the existing window ID so renderer can focus it
        return {
          success: false,
          error: {
            code: 'ALREADY_POPPED_OUT',
            message:
              error && typeof error === 'object' && 'message' in error
                ? String(error.message)
                : 'Project already popped out',
            existingWindowId:
              error && typeof error === 'object' && 'existingWindowId' in error
                ? (error.existingWindowId as number)
                : undefined,
          },
        };
      }

      // Generic error handling
      console.error('[IPC] window:pop-out-project error:', error);
      return {
        success: false,
        error: {
          code: 'WINDOW_CREATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create window',
        },
      };
    }
  });

  /**
   * Pop out specific view into new window
   * @param projectId - ID of project containing the view
   * @param view - View identifier (e.g., 'terminals', 'github-prs', 'kanban')
   * @returns Window ID and success status
   * @throws Error if view already popped out (with ALREADY_POPPED_OUT code)
   */
  ipcMain.handle(
    IPC_CHANNELS.WINDOW_POP_OUT_VIEW,
    async (event, projectId: string, view: string) => {
      try {
        const sourceWindow = BrowserWindow.fromWebContents(event.sender);
        if (!sourceWindow) {
          throw new Error('Source window not found');
        }

        const result = await windowManager.popOutView(projectId, view, sourceWindow);

        // Broadcast config change to all windows
        broadcastWindowConfigChange();

        return { success: true, ...result };
      } catch (error: unknown) {
        // Handle duplicate pop-out error specially
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ALREADY_POPPED_OUT'
        ) {
          // Return the existing window ID so renderer can focus it
          return {
            success: false,
            error: {
              code: 'ALREADY_POPPED_OUT',
              message:
                error && typeof error === 'object' && 'message' in error
                  ? String(error.message)
                  : 'View already popped out',
              existingWindowId:
                error && typeof error === 'object' && 'existingWindowId' in error
                  ? (error.existingWindowId as number)
                  : undefined,
            },
          };
        }

        // Generic error handling
        console.error('[IPC] window:pop-out-view error:', error);
        return {
          success: false,
          error: {
            code: 'WINDOW_CREATION_FAILED',
            message: error instanceof Error ? error.message : 'Failed to create window',
          },
        };
      }
    }
  );

  /**
   * Merge pop-out window back to main window
   * @param windowId - ID of window to merge
   */
  ipcMain.handle(IPC_CHANNELS.WINDOW_MERGE_WINDOW, async (_event, windowId: number) => {
    try {
      await windowManager.mergeWindow(windowId);

      // Broadcast config change to all windows
      broadcastWindowConfigChange();

      return { success: true };
    } catch (error: unknown) {
      console.error('[IPC] window:merge-window error:', error);
      return {
        success: false,
        error: {
          code: 'MERGE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to merge window',
        },
      };
    }
  });

  /**
   * Get list of all open windows with configurations
   * @returns Array of window configurations
   */
  ipcMain.handle(IPC_CHANNELS.WINDOW_GET_WINDOWS, async () => {
    try {
      const windows = windowManager.getAllWindows();
      return { success: true, windows };
    } catch (error: unknown) {
      console.error('[IPC] window:get-windows error:', error);
      return {
        success: false,
        error: {
          code: 'GET_WINDOWS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get windows',
        },
      };
    }
  });

  /**
   * Get current window's configuration
   * @returns Window configuration for the requesting window
   */
  ipcMain.handle(IPC_CHANNELS.WINDOW_GET_CONFIG, async (event) => {
    try {
      const sourceWindow = BrowserWindow.fromWebContents(event.sender);
      if (!sourceWindow) {
        throw new Error('Source window not found');
      }

      const config = windowManager.getWindowConfig(sourceWindow.id);
      if (!config) {
        throw new Error('Window configuration not found');
      }

      return { success: true, config };
    } catch (error: unknown) {
      console.error('[IPC] window:get-config error:', error);
      return {
        success: false,
        error: {
          code: 'GET_CONFIG_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get window config',
        },
      };
    }
  });

  /**
   * Focus an existing window
   * @param windowId - ID of window to focus
   */
  ipcMain.handle(IPC_CHANNELS.WINDOW_FOCUS_WINDOW, async (_event, windowId: number) => {
    try {
      windowManager.focusWindow(windowId);
      return { success: true };
    } catch (error: unknown) {
      console.error('[IPC] window:focus-window error:', error);
      return {
        success: false,
        error: {
          code: 'FOCUS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to focus window',
        },
      };
    }
  });
}

/**
 * Broadcast window configuration changes to all windows
 * Sends window:config-changed event with current window list
 */
function broadcastWindowConfigChange(): void {
  const windowManager = WindowManager.getInstance();
  const windows = windowManager.getAllWindows();

  // Send to all windows
  const allWindows = BrowserWindow.getAllWindows();
  for (const window of allWindows) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.WINDOW_CONFIG_CHANGED, windows);
    }
  }
}

/**
 * Broadcast global state change to all windows
 * Used for cross-window synchronization of auth, settings, projects
 * @param state - Global state change to broadcast
 */
export function broadcastStateChange(state: GlobalState): void {
  const windowManager = WindowManager.getInstance();
  windowManager.broadcastStateChange(state);
}
