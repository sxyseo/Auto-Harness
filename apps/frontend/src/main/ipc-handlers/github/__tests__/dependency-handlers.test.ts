import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process
const mockExecFileSync = vi.fn();
vi.mock('child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

// Mock project-middleware
const mockProject = { id: 'test-project', path: '/fake/project', name: 'Test' };
vi.mock('../utils/project-middleware', () => ({
  withProject: vi.fn((_id: string, handler: (p: typeof mockProject) => Promise<unknown>) =>
    handler(mockProject),
  ),
}));

// Mock env-utils
vi.mock('../../../env-utils', () => ({
  getAugmentedEnv: vi.fn(() => ({ PATH: '/usr/bin', GH_TOKEN: 'test-token' })),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  createContextLogger: () => ({ debug: vi.fn() }),
}));

import { ipcMain } from 'electron';
import { registerDependencyHandlers } from '../dependency-handlers';

type HandlerFn = (event: unknown, ...args: unknown[]) => Promise<unknown>;
const handlers: Record<string, HandlerFn> = {};

beforeEach(() => {
  vi.clearAllMocks();

  (ipcMain.handle as ReturnType<typeof vi.fn>).mockImplementation((channel: string, handler: HandlerFn) => {
    handlers[channel] = handler;
  });

  registerDependencyHandlers(() => null as never);
});

describe('fetchDependencies handler', () => {
  it('returns tracks and trackedBy arrays', async () => {
    mockExecFileSync.mockReturnValue(JSON.stringify({
      data: {
        repository: {
          issue: {
            trackedIssues: { nodes: [{ number: 10, title: 'Sub-task A', state: 'OPEN' }] },
            trackedInIssues: { nodes: [{ number: 5, title: 'Parent', state: 'CLOSED' }] },
          },
        },
      },
    }));

    const result = await handlers['github:deps:fetch']({}, 'test-project', 42) as {
      tracks: unknown[];
      trackedBy: unknown[];
    };

    expect(result.tracks).toHaveLength(1);
    expect(result.trackedBy).toHaveLength(1);
  });

  it('handles GraphQL field error (unavailable API)', async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('GraphQL: Field trackedIssues does not exist');
    });

    const result = await handlers['github:deps:fetch']({}, 'test-project', 42) as {
      error: string;
      unavailable: boolean;
    };

    expect(result.unavailable).toBe(true);
  });

  it('handles empty dependencies', async () => {
    mockExecFileSync.mockReturnValue(JSON.stringify({
      data: {
        repository: {
          issue: {
            trackedIssues: { nodes: [] },
            trackedInIssues: { nodes: [] },
          },
        },
      },
    }));

    const result = await handlers['github:deps:fetch']({}, 'test-project', 42) as {
      tracks: unknown[];
      trackedBy: unknown[];
    };

    expect(result.tracks).toHaveLength(0);
    expect(result.trackedBy).toHaveLength(0);
  });

  it('validates issue number', async () => {
    const result = await handlers['github:deps:fetch']({}, 'test-project', -1) as { error: string };
    expect(result.error).toBeTruthy();
  });

  it('handles auth error', async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('HTTP 401: Bad credentials');
    });

    const result = await handlers['github:deps:fetch']({}, 'test-project', 42) as { error: string };
    expect(result.error).toContain('401');
  });

  it('handles cross-repo dependencies', async () => {
    mockExecFileSync.mockReturnValue(JSON.stringify({
      data: {
        repository: {
          issue: {
            trackedIssues: { nodes: [
              { number: 10, title: 'Sub-task', state: 'OPEN', repository: { nameWithOwner: 'org/other-repo' } },
            ] },
            trackedInIssues: { nodes: [] },
          },
        },
      },
    }));

    const result = await handlers['github:deps:fetch']({}, 'test-project', 42) as {
      tracks: Array<{ repo?: string }>;
    };

    expect(result.tracks[0].repo).toBe('org/other-repo');
  });
});
