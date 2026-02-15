/**
 * Unit tests for WindowManager
 * Tests window lifecycle, pop-out management, persistence, and parent-child relationships
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import type { BrowserWindow } from 'electron';

// Test directories
let TEST_DIR: string;
let USER_DATA_PATH: string;

// Mock BrowserWindow instances
const mockWindows = new Map<number, any>();
let nextWindowId = 1;

// Mock screen module
const mockScreen = {
  getPrimaryDisplay: vi.fn(() => ({
    workAreaSize: { width: 1920, height: 1080 }
  })),
  getAllDisplays: vi.fn(() => [
    {
      bounds: { x: 0, y: 0, width: 1920, height: 1080 }
    }
  ])
};

// Create mock BrowserWindow class
class MockBrowserWindow {
  id: number;
  private options: any;
  private _isDestroyed = false;
  private _isMinimized = false;
  private eventHandlers = new Map<string, Function[]>();
  webContents: any;

  constructor(options: any) {
    this.id = nextWindowId++;
    this.options = options;
    mockWindows.set(this.id, this);

    this.webContents = {
      send: vi.fn(),
      setWindowOpenHandler: vi.fn()
    };
  }

  static fromId(id: number): MockBrowserWindow | null {
    return mockWindows.get(id) || null;
  }

  static getAllWindows(): MockBrowserWindow[] {
    return Array.from(mockWindows.values());
  }

  loadURL = vi.fn().mockResolvedValue(undefined);
  loadFile = vi.fn().mockResolvedValue(undefined);
  show = vi.fn();
  focus = vi.fn();
  close = vi.fn(() => {
    this.emit('closed');
    mockWindows.delete(this.id);
  });
  destroy = vi.fn(() => {
    this._isDestroyed = true;
    this.emit('closed');
    mockWindows.delete(this.id);
  });
  isDestroyed = vi.fn(() => this._isDestroyed);
  isMinimized = vi.fn(() => this._isMinimized);
  restore = vi.fn(() => {
    this._isMinimized = false;
  });
  getNormalBounds = vi.fn(() => ({
    x: 100,
    y: 100,
    width: 1400,
    height: 900
  }));

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  once(event: string, handler: Function): void {
    const wrappedHandler = (...args: any[]) => {
      handler(...args);
      this.removeListener(event, wrappedHandler);
    };
    this.on(event, wrappedHandler);
  }

  removeListener(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }
}

// Mock Electron before importing WindowManager
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return USER_DATA_PATH;
      return TEST_DIR;
    })
  },
  BrowserWindow: MockBrowserWindow,
  screen: mockScreen
}));

// Mock @electron-toolkit/utils
vi.mock('@electron-toolkit/utils', () => ({
  is: {
    dev: false
  }
}));

// Mock platform module
vi.mock('../platform', () => ({
  isMacOS: vi.fn(() => false)
}));

// Setup test directories
function setupTestDirs(): void {
  TEST_DIR = mkdtempSync(path.join(tmpdir(), 'window-manager-test-'));
  USER_DATA_PATH = path.join(TEST_DIR, 'userData');
  mkdirSync(USER_DATA_PATH, { recursive: true });
}

// Cleanup test directories
function cleanupTestDirs(): void {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

describe('WindowManager', () => {
  beforeEach(async () => {
    cleanupTestDirs();
    setupTestDirs();
    vi.resetModules();
    mockWindows.clear();
    nextWindowId = 1;
  });

  afterEach(() => {
    cleanupTestDirs();
    vi.clearAllMocks();
  });

  describe('singleton pattern', () => {
    it('should return the same instance on multiple calls', async () => {
      const { WindowManager } = await import('../window-manager');

      const instance1 = WindowManager.getInstance();
      const instance2 = WindowManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should use getWindowManager helper function', async () => {
      const { WindowManager, getWindowManager } = await import('../window-manager');

      const instance = getWindowManager();
      const directInstance = WindowManager.getInstance();

      expect(instance).toBe(directInstance);
    });
  });

  describe('registerMainWindow', () => {
    it('should register main window and track it', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const mainWindow = new BrowserWindow({ width: 800, height: 600 }) as unknown as BrowserWindow;
      manager.registerMainWindow(mainWindow);

      const config = manager.getWindowConfig(mainWindow.id);
      expect(config).toBeDefined();
      expect(config?.type).toBe('main');
      expect(config?.windowId).toBe(mainWindow.id);
    });

    it('should track window bounds on resize', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const mainWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      manager.registerMainWindow(mainWindow);

      // Simulate resize
      mainWindow.getNormalBounds = vi.fn(() => ({
        x: 100,
        y: 100,
        width: 1600,
        height: 1000
      }));
      mainWindow.emit('resize');

      const config = manager.getWindowConfig(mainWindow.id);
      expect(config?.bounds?.width).toBe(1600);
      expect(config?.bounds?.height).toBe(1000);
    });

    it('should track window bounds on move', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const mainWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      manager.registerMainWindow(mainWindow);

      // Simulate move
      mainWindow.getNormalBounds = vi.fn(() => ({
        x: 200,
        y: 200,
        width: 1400,
        height: 900
      }));
      mainWindow.emit('move');

      const config = manager.getWindowConfig(mainWindow.id);
      expect(config?.bounds?.x).toBe(200);
      expect(config?.bounds?.y).toBe(200);
    });

    it('should close child windows when main window closes', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const mainWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      manager.registerMainWindow(mainWindow);

      // Create a child window
      const childWindow = manager.createWindow(
        { type: 'project', projectId: 'test-project' },
        mainWindow
      ) as any;

      expect(mockWindows.size).toBe(2);

      // Close main window
      mainWindow.emit('closed');

      // Child should be destroyed
      expect(childWindow.destroy).toHaveBeenCalled();
    });

    it('should clean up window from tracking on close', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const mainWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      manager.registerMainWindow(mainWindow);

      const windowId = mainWindow.id;
      expect(manager.getWindowConfig(windowId)).toBeDefined();

      mainWindow.emit('closed');

      expect(manager.getWindowConfig(windowId)).toBeNull();
    });
  });

  describe('createWindow', () => {
    it('should create project window with correct configuration', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const window = manager.createWindow({
        type: 'project',
        projectId: 'test-project-123'
      });

      const config = manager.getWindowConfig(window.id);
      expect(config?.type).toBe('project');
      expect(config?.projectId).toBe('test-project-123');
    });

    it('should create view window with correct configuration', async () => {
      const { WindowManager } = await import('../window-manager');
      const manager = WindowManager.getInstance();

      const window = manager.createWindow({
        type: 'view',
        projectId: 'test-project-123',
        view: 'terminals'
      });

      const config = manager.getWindowConfig(window.id);
      expect(config?.type).toBe('view');
      expect(config?.projectId).toBe('test-project-123');
      expect(config?.view).toBe('terminals');
    });

    it('should set parent window if provided', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const parentWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      manager.registerMainWindow(parentWindow);

      const childWindow = manager.createWindow(
        { type: 'project', projectId: 'test' },
        parentWindow
      );

      const config = manager.getWindowConfig(childWindow.id);
      expect(config?.parentWindowId).toBe(parentWindow.id);
    });

    it('should load file with query params in production mode', async () => {
      const { WindowManager } = await import('../window-manager');
      const manager = WindowManager.getInstance();

      const window = manager.createWindow({
        type: 'view',
        projectId: 'test-project',
        view: 'github-prs'
      }) as any;

      expect(window.loadFile).toHaveBeenCalled();
      const [filePath, options] = window.loadFile.mock.calls[0];
      expect(options.query.type).toBe('view');
      expect(options.query.projectId).toBe('test-project');
      expect(options.query.view).toBe('github-prs');
    });

    it('should show window on ready-to-show', async () => {
      const { WindowManager } = await import('../window-manager');
      const manager = WindowManager.getInstance();

      const window = manager.createWindow({
        type: 'project',
        projectId: 'test'
      }) as any;

      expect(window.show).not.toHaveBeenCalled();

      // Trigger ready-to-show
      window.emit('ready-to-show');

      expect(window.show).toHaveBeenCalled();
    });

    it('should clean up window on close', async () => {
      const { WindowManager } = await import('../window-manager');
      const manager = WindowManager.getInstance();

      const window = manager.createWindow({
        type: 'project',
        projectId: 'test'
      }) as any;

      const windowId = window.id;
      expect(manager.getWindowConfig(windowId)).toBeDefined();

      window.emit('closed');

      expect(manager.getWindowConfig(windowId)).toBeNull();
    });
  });

  describe('popOutProject', () => {
    it('should create new window for project', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const sourceWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      const result = await manager.popOutProject('project-123', sourceWindow);

      expect(result.windowId).toBeDefined();
      const config = manager.getWindowConfig(result.windowId);
      expect(config?.type).toBe('project');
      expect(config?.projectId).toBe('project-123');
    });

    it('should throw error if project already popped out', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const sourceWindow = new BrowserWindow({ width: 800, height: 600 }) as any;

      // Pop out once
      const result1 = await manager.popOutProject('project-123', sourceWindow);

      // Try to pop out again
      await expect(
        manager.popOutProject('project-123', sourceWindow)
      ).rejects.toMatchObject({
        code: 'ALREADY_POPPED_OUT',
        existingWindowId: result1.windowId
      });
    });

    it('should focus existing window if already popped out', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const sourceWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      const result = await manager.popOutProject('project-123', sourceWindow);

      const existingWindow = BrowserWindow.fromId(result.windowId) as any;
      expect(existingWindow.focus).not.toHaveBeenCalled();

      // Try to pop out again
      try {
        await manager.popOutProject('project-123', sourceWindow);
      } catch (error) {
        // Expected error
      }

      expect(existingWindow.focus).toHaveBeenCalled();
    });
  });

  describe('popOutView', () => {
    it('should create new window for view', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const sourceWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      const result = await manager.popOutView('project-123', 'terminals', sourceWindow);

      expect(result.windowId).toBeDefined();
      const config = manager.getWindowConfig(result.windowId);
      expect(config?.type).toBe('view');
      expect(config?.projectId).toBe('project-123');
      expect(config?.view).toBe('terminals');
    });

    it('should throw error if view already popped out', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const sourceWindow = new BrowserWindow({ width: 800, height: 600 }) as any;

      // Pop out once
      const result1 = await manager.popOutView('project-123', 'kanban', sourceWindow);

      // Try to pop out again
      await expect(
        manager.popOutView('project-123', 'kanban', sourceWindow)
      ).rejects.toMatchObject({
        code: 'ALREADY_POPPED_OUT',
        existingWindowId: result1.windowId
      });
    });
  });

  describe('mergeWindow', () => {
    it('should close the window', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const sourceWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      const result = await manager.popOutProject('project-123', sourceWindow);

      const window = BrowserWindow.fromId(result.windowId) as any;
      expect(window.close).not.toHaveBeenCalled();

      await manager.mergeWindow(result.windowId);

      expect(window.close).toHaveBeenCalled();
    });

    it('should throw error if window not found', async () => {
      const { WindowManager } = await import('../window-manager');
      const manager = WindowManager.getInstance();

      await expect(manager.mergeWindow(999)).rejects.toThrow('Window 999 not found');
    });
  });

  describe('isProjectPoppedOut', () => {
    it('should return null if project not popped out', async () => {
      const { WindowManager } = await import('../window-manager');
      const manager = WindowManager.getInstance();

      const result = manager.isProjectPoppedOut('project-123');

      expect(result).toBeNull();
    });

    it('should return window ID if project is popped out', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const sourceWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      const popResult = await manager.popOutProject('project-123', sourceWindow);

      const result = manager.isProjectPoppedOut('project-123');

      expect(result).toBe(popResult.windowId);
    });
  });

  describe('isViewPoppedOut', () => {
    it('should return null if view not popped out', async () => {
      const { WindowManager } = await import('../window-manager');
      const manager = WindowManager.getInstance();

      const result = manager.isViewPoppedOut('project-123', 'terminals');

      expect(result).toBeNull();
    });

    it('should return window ID if view is popped out', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const sourceWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      const popResult = await manager.popOutView('project-123', 'github-prs', sourceWindow);

      const result = manager.isViewPoppedOut('project-123', 'github-prs');

      expect(result).toBe(popResult.windowId);
    });
  });

  describe('focusWindow', () => {
    it('should focus window if not minimized', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const window = new BrowserWindow({ width: 800, height: 600 }) as any;

      manager.focusWindow(window.id);

      expect(window.focus).toHaveBeenCalled();
    });

    it('should restore minimized window before focusing', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const window = new BrowserWindow({ width: 800, height: 600 }) as any;
      window._isMinimized = true;

      manager.focusWindow(window.id);

      expect(window.restore).toHaveBeenCalled();
      expect(window.focus).toHaveBeenCalled();
    });

    it('should handle non-existent window gracefully', async () => {
      const { WindowManager } = await import('../window-manager');
      const manager = WindowManager.getInstance();

      // Should not throw
      expect(() => manager.focusWindow(999)).not.toThrow();
    });
  });

  describe('window hierarchy', () => {
    it('should track parent-child relationships', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const parentWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      const childWindow = manager.createWindow(
        { type: 'project', projectId: 'test' },
        parentWindow
      );

      expect(manager.getParentWindowId(childWindow.id)).toBe(parentWindow.id);
    });

    it('should get child windows', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const parentWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      const child1 = manager.createWindow(
        { type: 'project', projectId: 'test1' },
        parentWindow
      );
      const child2 = manager.createWindow(
        { type: 'view', projectId: 'test2', view: 'terminals' },
        parentWindow
      );

      const children = manager.getChildWindows(parentWindow.id);

      expect(children).toHaveLength(2);
      expect(children.map(c => c.windowId)).toContain(child1.id);
      expect(children.map(c => c.windowId)).toContain(child2.id);
    });

    it('should check if window has children', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const parentWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      expect(manager.hasChildWindows(parentWindow.id)).toBe(false);

      manager.createWindow({ type: 'project', projectId: 'test' }, parentWindow);

      expect(manager.hasChildWindows(parentWindow.id)).toBe(true);
    });

    it('should get window hierarchy', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const parentWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      manager.registerMainWindow(parentWindow);

      const childWindow = manager.createWindow(
        { type: 'project', projectId: 'test' },
        parentWindow
      );

      const hierarchy = manager.getWindowHierarchy(childWindow.id);

      expect(hierarchy.window?.windowId).toBe(childWindow.id);
      expect(hierarchy.parent?.windowId).toBe(parentWindow.id);
      expect(hierarchy.children).toHaveLength(0);
    });
  });

  describe('closeWindowsForProject', () => {
    it('should close all windows for a project', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const sourceWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      const projectWindow = await manager.popOutProject('project-123', sourceWindow);
      const viewWindow = await manager.popOutView('project-123', 'terminals', sourceWindow);

      const projectWindowInstance = BrowserWindow.fromId(projectWindow.windowId) as any;
      const viewWindowInstance = BrowserWindow.fromId(viewWindow.windowId) as any;

      manager.closeWindowsForProject('project-123');

      expect(projectWindowInstance.destroy).toHaveBeenCalled();
      expect(viewWindowInstance.destroy).toHaveBeenCalled();
    });

    it('should not close main window for project', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const mainWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      manager.registerMainWindow(mainWindow);

      manager.closeWindowsForProject('project-123');

      expect(mainWindow.destroy).not.toHaveBeenCalled();
    });
  });

  describe('closeWindowForView', () => {
    it('should close specific view window', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const sourceWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      const viewWindow = await manager.popOutView('project-123', 'terminals', sourceWindow);

      const windowInstance = BrowserWindow.fromId(viewWindow.windowId) as any;

      manager.closeWindowForView('project-123', 'terminals');

      expect(windowInstance.destroy).toHaveBeenCalled();
    });

    it('should handle non-existent view gracefully', async () => {
      const { WindowManager } = await import('../window-manager');
      const manager = WindowManager.getInstance();

      // Should not throw
      expect(() => manager.closeWindowForView('project-123', 'nonexistent')).not.toThrow();
    });
  });

  describe('getAllWindows', () => {
    it('should return all tracked windows', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const mainWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      manager.registerMainWindow(mainWindow);

      const sourceWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      await manager.popOutProject('project-123', sourceWindow);
      await manager.popOutView('project-123', 'terminals', sourceWindow);

      const windows = manager.getAllWindows();

      expect(windows.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('bounds persistence', () => {
    it('should save window bounds to disk', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const mainWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      manager.registerMainWindow(mainWindow);

      // Trigger immediate save
      manager.saveWindowState();

      const boundsPath = path.join(USER_DATA_PATH, 'window-bounds.json');
      expect(existsSync(boundsPath)).toBe(true);

      const content = JSON.parse(readFileSync(boundsPath, 'utf-8'));
      expect(content.main).toBeDefined();
    });

    it('should restore window bounds from disk', async () => {
      // Create persisted bounds
      const boundsPath = path.join(USER_DATA_PATH, 'window-bounds.json');
      const boundsData = {
        'project-test-123': {
          x: 200,
          y: 300,
          width: 1200,
          height: 800
        }
      };
      writeFileSync(boundsPath, JSON.stringify(boundsData));

      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const sourceWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      const window = manager.createWindow({
        type: 'project',
        projectId: 'test-123'
      }, sourceWindow) as any;

      // Check that constructor options used the persisted bounds
      const constructorCall = MockBrowserWindow.prototype.constructor;
      expect(window.options.x).toBe(200);
      expect(window.options.y).toBe(300);
    });

    it('should handle corrupted bounds file gracefully', async () => {
      const boundsPath = path.join(USER_DATA_PATH, 'window-bounds.json');
      writeFileSync(boundsPath, 'corrupted json {{{');

      const { WindowManager } = await import('../window-manager');
      const manager = WindowManager.getInstance();

      // Should not throw
      expect(() => manager.restoreWindowState()).not.toThrow();
    });
  });

  describe('bounds validation', () => {
    it('should reject bounds that are off-screen', async () => {
      // Create persisted bounds that are off-screen
      const boundsPath = path.join(USER_DATA_PATH, 'window-bounds.json');
      const boundsData = {
        'project-test-123': {
          x: 5000,  // Way off screen
          y: 5000,
          width: 1200,
          height: 800
        }
      };
      writeFileSync(boundsPath, JSON.stringify(boundsData));

      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const sourceWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      const window = manager.createWindow({
        type: 'project',
        projectId: 'test-123'
      }, sourceWindow) as any;

      // Should use default position instead of off-screen bounds
      expect(window.options.x).toBeUndefined();
    });

    it('should accept bounds that are partially visible', async () => {
      // Create persisted bounds on-screen
      const boundsPath = path.join(USER_DATA_PATH, 'window-bounds.json');
      const boundsData = {
        'project-test-123': {
          x: 100,
          y: 100,
          width: 1200,
          height: 800
        }
      };
      writeFileSync(boundsPath, JSON.stringify(boundsData));

      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const sourceWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      const window = manager.createWindow({
        type: 'project',
        projectId: 'test-123'
      }, sourceWindow) as any;

      expect(window.options.x).toBe(100);
      expect(window.options.y).toBe(100);
    });
  });

  describe('broadcastStateChange', () => {
    it('should send state to all windows', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const window1 = new BrowserWindow({ width: 800, height: 600 }) as any;
      const window2 = new BrowserWindow({ width: 800, height: 600 }) as any;

      const state = {
        type: 'project-changed' as const,
        projectId: 'test-123'
      };

      manager.broadcastStateChange(state);

      expect(window1.webContents.send).toHaveBeenCalled();
      expect(window2.webContents.send).toHaveBeenCalled();
    });

    it('should skip destroyed windows', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const window = new BrowserWindow({ width: 800, height: 600 }) as any;
      window._isDestroyed = true;

      const state = {
        type: 'project-changed' as const,
        projectId: 'test-123'
      };

      // Should not throw
      expect(() => manager.broadcastStateChange(state)).not.toThrow();
    });
  });

  describe('getMainWindow', () => {
    it('should return main window if registered', async () => {
      const { WindowManager } = await import('../window-manager');
      const { BrowserWindow } = await import('electron');
      const manager = WindowManager.getInstance();

      const mainWindow = new BrowserWindow({ width: 800, height: 600 }) as any;
      manager.registerMainWindow(mainWindow);

      const retrieved = manager.getMainWindow();

      expect(retrieved?.id).toBe(mainWindow.id);
    });

    it('should return null if main window not registered', async () => {
      const { WindowManager } = await import('../window-manager');
      const manager = WindowManager.getInstance();

      const retrieved = manager.getMainWindow();

      expect(retrieved).toBeNull();
    });
  });

  describe('screen API error handling', () => {
    it('should handle screen.getPrimaryDisplay errors gracefully', async () => {
      mockScreen.getPrimaryDisplay.mockImplementationOnce(() => {
        throw new Error('Screen API failed');
      });

      const { WindowManager } = await import('../window-manager');
      const manager = WindowManager.getInstance();

      // Should not throw, should use defaults
      expect(() => manager.createWindow({ type: 'project', projectId: 'test' })).not.toThrow();
    });

    it('should handle invalid display data', async () => {
      mockScreen.getPrimaryDisplay.mockImplementationOnce(() => ({
        workAreaSize: null  // Invalid data
      }));

      const { WindowManager } = await import('../window-manager');
      const manager = WindowManager.getInstance();

      // Should not throw, should use defaults
      expect(() => manager.createWindow({ type: 'project', projectId: 'test' })).not.toThrow();
    });

    it('should handle screen.getAllDisplays errors in validation', async () => {
      mockScreen.getAllDisplays.mockImplementationOnce(() => {
        throw new Error('getAllDisplays failed');
      });

      // Create persisted bounds
      const boundsPath = path.join(USER_DATA_PATH, 'window-bounds.json');
      const boundsData = {
        'project-test-123': { x: 100, y: 100, width: 1200, height: 800 }
      };
      writeFileSync(boundsPath, JSON.stringify(boundsData));

      const { WindowManager } = await import('../window-manager');
      const manager = WindowManager.getInstance();

      // Should not throw, validation should fail gracefully
      expect(() => manager.createWindow({
        type: 'project',
        projectId: 'test-123'
      })).not.toThrow();
    });
  });
});
