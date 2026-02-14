/**
 * Window management types for multi-window pop-out support
 */

/**
 * Window type discriminator
 * - main: Primary application window with all projects
 * - project: Pop-out window showing all views for a single project
 * - view: Pop-out window showing a single view (terminal, PR, kanban, etc.)
 */
export type WindowType = 'main' | 'project' | 'view';

/**
 * Window configuration
 * Tracks the state and metadata for each BrowserWindow instance
 */
export interface WindowConfig {
  /** Unique window identifier (BrowserWindow.id) */
  windowId: number;

  /** Type of window content */
  type: WindowType;

  /** Project ID (for project and view windows) */
  projectId?: string;

  /** View identifier (for view windows) - e.g., 'terminals', 'github-prs', 'kanban' */
  view?: string;

  /** Window position and size (from getNormalBounds()) */
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /** Parent window ID (for child windows) */
  parentWindowId?: number;
}

/**
 * Global state change types for cross-window synchronization
 * Used to broadcast state changes from main process to all renderer processes
 */
export type GlobalStateType = 'auth' | 'settings' | 'projects';

/**
 * Global state change payload
 * Sent via IPC to synchronize state across all windows
 */
export interface GlobalState {
  /** Type of state that changed */
  type: GlobalStateType;

  /** State data payload (varies by type) */
  data: unknown;
}
