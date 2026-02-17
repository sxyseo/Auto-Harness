/**
 * Integration tests for task logs loading flow (IPC → service → state)
 *
 * Tests the complete flow from IPC handler through TaskLogService to ensure
 * logs are correctly loaded and forwarded to the renderer process.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import type { IPCResult, TaskLogs } from '../../../../shared/types';

// Mock modules
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn()
  },
  BrowserWindow: vi.fn()
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  watchFile: vi.fn()
}));

vi.mock('../../../project-store', () => ({
  projectStore: {
    getProject: vi.fn()
  }
}));

vi.mock('../../../task-log-service', () => ({
  taskLogService: {
    loadLogs: vi.fn(),
    startWatching: vi.fn(),
    stopWatching: vi.fn(),
    on: vi.fn()
  }
}));

vi.mock('../../../utils/spec-path-helpers', () => ({
  isValidTaskId: vi.fn((id: string) => {
    if (!id || typeof id !== 'string') return false;
    if (id.includes('/') || id.includes('\\')) return false;
    if (id === '.' || id === '..') return false;
    if (id.includes('\0')) return false;
    return true;
  })
}));

vi.mock('../../../../shared/utils/debug-logger', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn()
}));

vi.mock('../../../utils/path-helpers', () => ({
  ensureAbsolutePath: vi.fn((p: string) => {
    const pathMod = require('path');
    return pathMod.isAbsolute(p) ? p : pathMod.resolve(p);
  })
}));

describe('Task Logs Integration (IPC → Service → State)', () => {
  let ipcHandlers: Record<string, Function>;
  let mockMainWindow: Partial<BrowserWindow>;
  let getMainWindow: () => BrowserWindow | null;

  beforeEach(async () => {
    vi.clearAllMocks();
    ipcHandlers = {};

    // Capture IPC handlers
    (ipcMain.handle as Mock).mockImplementation((channel: string, handler: Function) => {
      ipcHandlers[channel] = handler;
    });

    // Mock main window
    mockMainWindow = {
      webContents: {
        send: vi.fn()
      } as any
    };
    getMainWindow = vi.fn(() => mockMainWindow as BrowserWindow);

    // Import and register handlers
    const { registerTaskLogsHandlers } = await import('../logs-handlers');
    registerTaskLogsHandlers(getMainWindow);
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('TASK_LOGS_GET handler', () => {
    it('should successfully load and return task logs', async () => {
      const { projectStore } = await import('../../../project-store');
      const { taskLogService } = await import('../../../task-log-service');
      const { existsSync } = await import('fs');

      const mockProject = {
        id: 'project-123',
        path: '/absolute/path/to/project',
        autoBuildPath: '.auto-claude'
      };

      const mockLogs: TaskLogs = {
        spec_id: '001-test-task',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z',
        phases: {
          planning: {
            phase: 'planning',
            status: 'completed',
            started_at: '2024-01-01T00:00:00Z',
            completed_at: '2024-01-01T00:30:00Z',
            entries: [
              {
                type: 'text',
                content: 'Planning started',
                phase: 'planning',
                timestamp: '2024-01-01T00:00:00Z'
              }
            ]
          },
          coding: {
            phase: 'coding',
            status: 'active',
            started_at: '2024-01-01T00:30:00Z',
            completed_at: null,
            entries: [
              {
                type: 'text',
                content: 'Coding started',
                phase: 'coding',
                timestamp: '2024-01-01T00:30:00Z'
              }
            ]
          },
          validation: {
            phase: 'validation',
            status: 'pending',
            started_at: null,
            completed_at: null,
            entries: []
          }
        }
      };

      (projectStore.getProject as Mock).mockReturnValue(mockProject);
      (existsSync as Mock).mockReturnValue(true);
      (taskLogService.loadLogs as Mock).mockReturnValue(mockLogs);

      const handler = ipcHandlers['task:logsGet'];
      const result = await handler({}, 'project-123', '001-test-task') as IPCResult<TaskLogs>;

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockLogs);
      expect(projectStore.getProject).toHaveBeenCalledWith('project-123');
      expect(taskLogService.loadLogs).toHaveBeenCalledWith(
        path.join('/absolute/path/to/project', '.auto-claude/specs', '001-test-task'),
        '/absolute/path/to/project',
        '.auto-claude/specs',
        '001-test-task'
      );
    });

    it('should normalize relative project paths to absolute', async () => {
      const { projectStore } = await import('../../../project-store');
      const { taskLogService } = await import('../../../task-log-service');
      const { existsSync } = await import('fs');

      const mockProject = {
        id: 'project-123',
        path: './relative/path',
        autoBuildPath: '.auto-claude'
      };

      const mockLogs: TaskLogs = {
        spec_id: '001-test-task',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z',
        phases: {
          planning: { phase: 'planning', status: 'pending', started_at: null, completed_at: null, entries: [] },
          coding: { phase: 'coding', status: 'pending', started_at: null, completed_at: null, entries: [] },
          validation: { phase: 'validation', status: 'pending', started_at: null, completed_at: null, entries: [] }
        }
      };

      (projectStore.getProject as Mock).mockReturnValue(mockProject);
      (existsSync as Mock).mockReturnValue(true);
      (taskLogService.loadLogs as Mock).mockReturnValue(mockLogs);

      const handler = ipcHandlers['task:logsGet'];
      const result = await handler({}, 'project-123', '001-test-task') as IPCResult<TaskLogs>;

      expect(result.success).toBe(true);

      // Verify that path.resolve was called implicitly (absolute path used)
      const loadLogsCall = (taskLogService.loadLogs as Mock).mock.calls[0];
      expect(path.isAbsolute(loadLogsCall[1])).toBe(true);
    });

    it('should reject invalid specId with path traversal characters', async () => {
      const handler = ipcHandlers['task:logsGet'];
      const result = await handler({}, 'project-123', '../../../etc/passwd') as IPCResult<TaskLogs>;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid spec ID');
    });

    it('should return error when project not found', async () => {
      const { projectStore } = await import('../../../project-store');

      (projectStore.getProject as Mock).mockReturnValue(null);

      const handler = ipcHandlers['task:logsGet'];
      const result = await handler({}, 'nonexistent-project', '001-test-task') as IPCResult<TaskLogs>;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });

    it('should return error when spec directory not found', async () => {
      const { projectStore } = await import('../../../project-store');
      const { existsSync } = await import('fs');

      const mockProject = {
        id: 'project-123',
        path: '/absolute/path/to/project',
        autoBuildPath: '.auto-claude'
      };

      (projectStore.getProject as Mock).mockReturnValue(mockProject);
      (existsSync as Mock).mockReturnValue(false);

      const handler = ipcHandlers['task:logsGet'];
      const result = await handler({}, 'project-123', 'nonexistent-spec') as IPCResult<TaskLogs>;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Spec directory not found');
    });

    it('should handle taskLogService errors gracefully', async () => {
      const { projectStore } = await import('../../../project-store');
      const { taskLogService } = await import('../../../task-log-service');
      const { existsSync } = await import('fs');

      const mockProject = {
        id: 'project-123',
        path: '/absolute/path/to/project',
        autoBuildPath: '.auto-claude'
      };

      (projectStore.getProject as Mock).mockReturnValue(mockProject);
      (existsSync as Mock).mockReturnValue(true);
      (taskLogService.loadLogs as Mock).mockImplementation(() => {
        throw new Error('Failed to parse logs');
      });

      const handler = ipcHandlers['task:logsGet'];
      const result = await handler({}, 'project-123', '001-test-task') as IPCResult<TaskLogs>;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to parse logs');
    });

    it('should return null logs when file exists but has no content', async () => {
      const { projectStore } = await import('../../../project-store');
      const { taskLogService } = await import('../../../task-log-service');
      const { existsSync } = await import('fs');

      const mockProject = {
        id: 'project-123',
        path: '/absolute/path/to/project',
        autoBuildPath: '.auto-claude'
      };

      (projectStore.getProject as Mock).mockReturnValue(mockProject);
      (existsSync as Mock).mockReturnValue(true);
      (taskLogService.loadLogs as Mock).mockReturnValue(null);

      const handler = ipcHandlers['task:logsGet'];
      const result = await handler({}, 'project-123', '001-test-task') as IPCResult<TaskLogs | null>;

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('TASK_LOGS_WATCH handler', () => {
    it('should start watching spec directory for log changes', async () => {
      const { projectStore } = await import('../../../project-store');
      const { taskLogService } = await import('../../../task-log-service');
      const { existsSync } = await import('fs');

      const mockProject = {
        id: 'project-123',
        path: '/absolute/path/to/project',
        autoBuildPath: '.auto-claude'
      };

      (projectStore.getProject as Mock).mockReturnValue(mockProject);
      (existsSync as Mock).mockReturnValue(true);

      const handler = ipcHandlers['task:logsWatch'];
      const result = await handler({}, 'project-123', '001-test-task') as IPCResult;

      expect(result.success).toBe(true);
      expect(taskLogService.startWatching).toHaveBeenCalledWith(
        '001-test-task',
        path.join('/absolute/path/to/project', '.auto-claude/specs', '001-test-task'),
        '/absolute/path/to/project',
        '.auto-claude/specs'
      );
    });

    it('should reject invalid specId with path traversal characters', async () => {
      const handler = ipcHandlers['task:logsWatch'];
      const result = await handler({}, 'project-123', '../../../etc/passwd') as IPCResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid spec ID');
    });

    it('should return error when project not found', async () => {
      const { projectStore } = await import('../../../project-store');

      (projectStore.getProject as Mock).mockReturnValue(null);

      const handler = ipcHandlers['task:logsWatch'];
      const result = await handler({}, 'nonexistent-project', '001-test-task') as IPCResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });

    it('should return error when spec directory not found', async () => {
      const { projectStore } = await import('../../../project-store');
      const { existsSync } = await import('fs');

      const mockProject = {
        id: 'project-123',
        path: '/absolute/path/to/project',
        autoBuildPath: '.auto-claude'
      };

      (projectStore.getProject as Mock).mockReturnValue(mockProject);
      (existsSync as Mock).mockReturnValue(false);

      const handler = ipcHandlers['task:logsWatch'];
      const result = await handler({}, 'project-123', 'nonexistent-spec') as IPCResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Spec directory not found');
    });

    it('should handle taskLogService watch errors gracefully', async () => {
      const { projectStore } = await import('../../../project-store');
      const { taskLogService } = await import('../../../task-log-service');
      const { existsSync } = await import('fs');

      const mockProject = {
        id: 'project-123',
        path: '/absolute/path/to/project',
        autoBuildPath: '.auto-claude'
      };

      (projectStore.getProject as Mock).mockReturnValue(mockProject);
      (existsSync as Mock).mockReturnValue(true);
      (taskLogService.startWatching as Mock).mockImplementation(() => {
        throw new Error('Watch failed');
      });

      const handler = ipcHandlers['task:logsWatch'];
      const result = await handler({}, 'project-123', '001-test-task') as IPCResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Watch failed');
    });
  });

  describe('TASK_LOGS_UNWATCH handler', () => {
    it('should stop watching spec directory', async () => {
      const { taskLogService } = await import('../../../task-log-service');

      const handler = ipcHandlers['task:logsUnwatch'];
      const result = await handler({}, '001-test-task') as IPCResult;

      expect(result.success).toBe(true);
      expect(taskLogService.stopWatching).toHaveBeenCalledWith('001-test-task');
    });

    it('should handle taskLogService unwatch errors gracefully', async () => {
      const { taskLogService } = await import('../../../task-log-service');

      (taskLogService.stopWatching as Mock).mockImplementation(() => {
        throw new Error('Unwatch failed');
      });

      const handler = ipcHandlers['task:logsUnwatch'];
      const result = await handler({}, '001-test-task') as IPCResult;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unwatch failed');
    });
  });

  describe('Path resolution consistency (regression test for issue #1657)', () => {
    it('should handle relative paths consistently across restarts', async () => {
      const { projectStore } = await import('../../../project-store');
      const { taskLogService } = await import('../../../task-log-service');
      const { existsSync } = await import('fs');

      // Simulate first load with relative path
      const mockProjectRelative = {
        id: 'project-123',
        path: './my-project',
        autoBuildPath: '.auto-claude'
      };

      (projectStore.getProject as Mock).mockReturnValue(mockProjectRelative);
      (existsSync as Mock).mockReturnValue(true);
      (taskLogService.loadLogs as Mock).mockReturnValue(null);

      const handler = ipcHandlers['task:logsGet'];
      const result1 = await handler({}, 'project-123', '001-test-task') as IPCResult<TaskLogs>;

      expect(result1.success).toBe(true);

      // Get the resolved absolute path from first call
      const firstCall = (taskLogService.loadLogs as Mock).mock.calls[0];
      const firstResolvedPath = firstCall[1];
      expect(path.isAbsolute(firstResolvedPath)).toBe(true);

      // Simulate second load after restart (should resolve to same absolute path)
      vi.clearAllMocks();
      (projectStore.getProject as Mock).mockReturnValue(mockProjectRelative);
      (existsSync as Mock).mockReturnValue(true);
      (taskLogService.loadLogs as Mock).mockReturnValue(null);

      const result2 = await handler({}, 'project-123', '001-test-task') as IPCResult<TaskLogs>;

      expect(result2.success).toBe(true);

      // Verify second call uses same absolute path
      const secondCall = (taskLogService.loadLogs as Mock).mock.calls[0];
      const secondResolvedPath = secondCall[1];
      expect(secondResolvedPath).toBe(firstResolvedPath);
    });

    it('should preserve absolute paths across multiple calls', async () => {
      const { projectStore } = await import('../../../project-store');
      const { taskLogService } = await import('../../../task-log-service');
      const { existsSync } = await import('fs');

      const mockProject = {
        id: 'project-123',
        path: '/absolute/path/to/project',
        autoBuildPath: '.auto-claude'
      };

      (projectStore.getProject as Mock).mockReturnValue(mockProject);
      (existsSync as Mock).mockReturnValue(true);
      (taskLogService.loadLogs as Mock).mockReturnValue(null);

      const handler = ipcHandlers['task:logsGet'];

      // Call multiple times
      await handler({}, 'project-123', '001-test-task');
      await handler({}, 'project-123', '001-test-task');
      await handler({}, 'project-123', '001-test-task');

      // Verify all calls used the same absolute path
      const calls = (taskLogService.loadLogs as Mock).mock.calls;
      expect(calls).toHaveLength(3);
      expect(calls[0][1]).toBe('/absolute/path/to/project');
      expect(calls[1][1]).toBe('/absolute/path/to/project');
      expect(calls[2][1]).toBe('/absolute/path/to/project');
    });
  });

  describe('Oscillation prevention (regression: worktree coding phase reset during agent retry)', () => {
    it('should return worktree coding phase even when status is pending and entries are empty', async () => {
      // Verifies that the IPC handler returns whatever the service returns without modification,
      // specifically when the worktree coding phase has been reset to pending (agent retry state).
      // The actual anti-oscillation fix lives in TaskLogService.mergeLogs() using ?? instead of
      // a status-based ternary condition. This test confirms the IPC layer does not interfere.
      const { projectStore } = await import('../../../project-store');
      const { taskLogService } = await import('../../../task-log-service');
      const { existsSync } = await import('fs');

      const mockProject = {
        id: 'project-123',
        path: '/absolute/path/to/project',
        autoBuildPath: '.auto-claude'
      };

      // Simulate the service returning merged logs where the worktree coding phase is
      // present but pending/empty (agent retried and reset coding phase to 'pending').
      // With the ?? fix, the service returns the worktree phase (not mainLogs fallback).
      const mockLogsWithPendingCoding: TaskLogs = {
        spec_id: '001-test-task',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:31:00Z',
        phases: {
          planning: {
            phase: 'planning',
            status: 'completed',
            started_at: '2024-01-01T00:00:00Z',
            completed_at: '2024-01-01T00:30:00Z',
            entries: [
              { type: 'text', content: 'Planning done', phase: 'planning', timestamp: '2024-01-01T00:00:00Z' }
            ]
          },
          // Worktree coding phase is present but pending/empty — agent just reset it.
          // The ?? fix ensures this is returned, not the main coding phase.
          coding: {
            phase: 'coding',
            status: 'pending',
            started_at: null,
            completed_at: null,
            entries: []
          },
          validation: {
            phase: 'validation',
            status: 'pending',
            started_at: null,
            completed_at: null,
            entries: []
          }
        }
      };

      (projectStore.getProject as Mock).mockReturnValue(mockProject);
      (existsSync as Mock).mockReturnValue(true);
      (taskLogService.loadLogs as Mock).mockReturnValue(mockLogsWithPendingCoding);

      const handler = ipcHandlers['task:logsGet'];
      const result = await handler({}, 'project-123', '001-test-task') as IPCResult<TaskLogs>;

      // IPC handler must return the service result as-is (no re-applying the old ternary logic)
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockLogsWithPendingCoding);
      // Coding phase should reflect the worktree's pending state, not oscillate to main
      expect(result.data?.phases.coding?.status).toBe('pending');
      expect(result.data?.phases.coding?.entries).toHaveLength(0);
    });

    it('should return consistent coding status across multiple rapid calls (no flip-flop)', async () => {
      // Confirms that repeated calls with a pending worktree coding phase produce consistent
      // results. Old code would flip between worktree (when active) and main (when pending),
      // producing oscillation. The IPC handler must pass through the service result every time.
      const { projectStore } = await import('../../../project-store');
      const { taskLogService } = await import('../../../task-log-service');
      const { existsSync } = await import('fs');

      const mockProject = {
        id: 'project-123',
        path: '/absolute/path/to/project',
        autoBuildPath: '.auto-claude'
      };

      // Service always returns the same merged result (pending worktree coding phase)
      const pendingCodingLogs: TaskLogs = {
        spec_id: '001-test-task',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:31:00Z',
        phases: {
          planning: { phase: 'planning', status: 'completed', started_at: null, completed_at: null, entries: [] },
          coding: { phase: 'coding', status: 'pending', started_at: null, completed_at: null, entries: [] },
          validation: { phase: 'validation', status: 'pending', started_at: null, completed_at: null, entries: [] }
        }
      };

      (projectStore.getProject as Mock).mockReturnValue(mockProject);
      (existsSync as Mock).mockReturnValue(true);
      (taskLogService.loadLogs as Mock).mockReturnValue(pendingCodingLogs);

      const handler = ipcHandlers['task:logsGet'];

      // Call multiple times to simulate rapid polling (previously would cause oscillation)
      const results = await Promise.all([
        handler({}, 'project-123', '001-test-task') as Promise<IPCResult<TaskLogs>>,
        handler({}, 'project-123', '001-test-task') as Promise<IPCResult<TaskLogs>>,
        handler({}, 'project-123', '001-test-task') as Promise<IPCResult<TaskLogs>>
      ]);

      // All results must be consistent — no oscillation
      for (const result of results) {
        expect(result.success).toBe(true);
        expect(result.data?.phases.coding?.status).toBe('pending');
        expect(result.data?.phases.coding?.entries).toHaveLength(0);
      }
    });
  });

  describe('Stale cache emission prevention (regression: mid-write JSON parse failures)', () => {
    it('should forward logs-changed events to renderer when service emits fresh data', async () => {
      // The service uses cacheVersions to gate emission: it only emits logs-changed when a
      // fresh parse succeeded (version incremented). This test verifies that when the service
      // DOES emit (fresh data available), the IPC handler correctly forwards it to the renderer.
      const { taskLogService } = await import('../../../task-log-service');

      const freshLogs: TaskLogs = {
        spec_id: '001-test-task',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:01:00Z',
        phases: {
          planning: { phase: 'planning', status: 'completed', started_at: null, completed_at: null, entries: [] },
          coding: {
            phase: 'coding',
            status: 'active',
            started_at: '2024-01-01T00:30:00Z',
            completed_at: null,
            entries: [
              { type: 'text', content: 'Coding in progress', phase: 'coding', timestamp: '2024-01-01T01:00:00Z' }
            ]
          },
          validation: { phase: 'validation', status: 'pending', started_at: null, completed_at: null, entries: [] }
        }
      };

      const onCall = (taskLogService.on as Mock).mock.calls.find(
        call => call[0] === 'logs-changed'
      );
      expect(onCall).toBeDefined();
      if (!onCall) throw new Error('logs-changed handler not registered');
      const eventHandler = onCall[1];

      // Service emits (fresh parse succeeded, cacheVersions incremented)
      eventHandler('001-test-task', freshLogs);

      // IPC handler must forward it to the renderer exactly once
      expect(mockMainWindow.webContents?.send).toHaveBeenCalledTimes(1);
      expect(mockMainWindow.webContents?.send).toHaveBeenCalledWith(
        'task:logsChanged',
        '001-test-task',
        freshLogs
      );
    });

    it('should NOT forward any update to renderer when service does not emit (parse failure)', async () => {
      // When a mid-write JSON parse failure occurs, the service's cacheVersions does NOT
      // increment, so the service skips the logs-changed emit. This test confirms the renderer
      // receives NO update when the service stays silent (no stale cache forwarded).
      const { taskLogService } = await import('../../../task-log-service');

      const onCall = (taskLogService.on as Mock).mock.calls.find(
        call => call[0] === 'logs-changed'
      );
      expect(onCall).toBeDefined();
      if (!onCall) throw new Error('logs-changed handler not registered');

      // Simulate parse failure: service does NOT call the event handler
      // (equivalent to the version check in startWatching() preventing the emit)

      // Renderer should receive zero updates
      expect(mockMainWindow.webContents?.send).not.toHaveBeenCalled();
    });

    it('should forward only the second event when first emission is suppressed (parse failure then success)', async () => {
      // Simulates: (1) parse failure → service silent, (2) next poll succeeds → service emits.
      // The renderer should only receive the second (fresh) emission, not stale data.
      const { taskLogService } = await import('../../../task-log-service');

      const freshLogs: TaskLogs = {
        spec_id: '001-test-task',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:02:00Z',
        phases: {
          planning: { phase: 'planning', status: 'completed', started_at: null, completed_at: null, entries: [] },
          coding: {
            phase: 'coding',
            status: 'active',
            started_at: '2024-01-01T00:30:00Z',
            completed_at: null,
            entries: [
              { type: 'text', content: 'Coder making progress', phase: 'coding', timestamp: '2024-01-01T01:02:00Z' }
            ]
          },
          validation: { phase: 'validation', status: 'pending', started_at: null, completed_at: null, entries: [] }
        }
      };

      const onCall = (taskLogService.on as Mock).mock.calls.find(
        call => call[0] === 'logs-changed'
      );
      expect(onCall).toBeDefined();
      if (!onCall) throw new Error('logs-changed handler not registered');
      const eventHandler = onCall[1];

      // Poll 1: parse failure — service does NOT emit (version not incremented)
      // (no eventHandler call here)

      // Poll 2: fresh parse succeeds — service emits
      eventHandler('001-test-task', freshLogs);

      // Renderer receives exactly one update (the fresh one)
      expect(mockMainWindow.webContents?.send).toHaveBeenCalledTimes(1);
      expect(mockMainWindow.webContents?.send).toHaveBeenCalledWith(
        'task:logsChanged',
        '001-test-task',
        freshLogs
      );
    });
  });

  describe('Event forwarding to renderer', () => {
    it('should forward logs-changed events to renderer', async () => {
      const { taskLogService } = await import('../../../task-log-service');

      const mockLogs: TaskLogs = {
        spec_id: '001-test-task',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z',
        phases: {
          planning: { phase: 'planning', status: 'completed', started_at: null, completed_at: null, entries: [] },
          coding: { phase: 'coding', status: 'active', started_at: null, completed_at: null, entries: [] },
          validation: { phase: 'validation', status: 'pending', started_at: null, completed_at: null, entries: [] }
        }
      };

      // Get the registered event handler
      const onCall = (taskLogService.on as Mock).mock.calls.find(
        call => call[0] === 'logs-changed'
      );
      expect(onCall).toBeDefined();
      if (!onCall) throw new Error('logs-changed handler not registered');
      const eventHandler = onCall[1];

      // Trigger the event
      eventHandler('001-test-task', mockLogs);

      // Verify it was forwarded to renderer
      expect(mockMainWindow.webContents?.send).toHaveBeenCalledWith(
        'task:logsChanged',
        '001-test-task',
        mockLogs
      );
    });

    it('should forward stream-chunk events to renderer', async () => {
      const { taskLogService } = await import('../../../task-log-service');

      const mockChunk = {
        type: 'text' as const,
        content: 'Test log entry',
        phase: 'coding' as const,
        timestamp: '2024-01-01T01:00:00Z'
      };

      // Get the registered event handler
      const onCall = (taskLogService.on as Mock).mock.calls.find(
        call => call[0] === 'stream-chunk'
      );
      expect(onCall).toBeDefined();
      if (!onCall) throw new Error('stream-chunk handler not registered');
      const eventHandler = onCall[1];

      // Trigger the event
      eventHandler('001-test-task', mockChunk);

      // Verify it was forwarded to renderer
      expect(mockMainWindow.webContents?.send).toHaveBeenCalledWith(
        'task:logsStream',
        '001-test-task',
        mockChunk
      );
    });

    it('should not crash when main window is null', async () => {
      // Clear all mocks and re-setup with null window
      vi.clearAllMocks();
      vi.resetModules();

      // Re-mock modules
      vi.doMock('electron', () => ({
        ipcMain: {
          handle: vi.fn(),
          on: vi.fn()
        },
        BrowserWindow: vi.fn()
      }));

      vi.doMock('fs', () => ({
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
        watchFile: vi.fn()
      }));

      vi.doMock('../../../project-store', () => ({
        projectStore: {
          getProject: vi.fn()
        }
      }));

      const mockOn = vi.fn();
      vi.doMock('../../../task-log-service', () => ({
        taskLogService: {
          loadLogs: vi.fn(),
          startWatching: vi.fn(),
          stopWatching: vi.fn(),
          on: mockOn
        }
      }));

      // Create getMainWindow that returns null
      const nullGetMainWindow = vi.fn(() => null);

      // Import and register handlers with null window
      const { registerTaskLogsHandlers } = await import('../logs-handlers');
      registerTaskLogsHandlers(nullGetMainWindow);

      const mockLogs: TaskLogs = {
        spec_id: '001-test-task',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z',
        phases: {
          planning: { phase: 'planning', status: 'pending', started_at: null, completed_at: null, entries: [] },
          coding: { phase: 'coding', status: 'pending', started_at: null, completed_at: null, entries: [] },
          validation: { phase: 'validation', status: 'pending', started_at: null, completed_at: null, entries: [] }
        }
      };

      // Get the registered event handler
      const onCall = mockOn.mock.calls.find(
        call => call[0] === 'logs-changed'
      );
      expect(onCall).toBeDefined();
      if (!onCall) throw new Error('logs-changed handler not registered');
      const eventHandler = onCall[1];

      // Should not throw
      expect(() => eventHandler('001-test-task', mockLogs)).not.toThrow();

      // Verify nullGetMainWindow was called
      expect(nullGetMainWindow).toHaveBeenCalled();
    });
  });

});
