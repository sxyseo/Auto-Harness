import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExternalClientConfig } from '../../../../shared/types/client-config';
import type { ToolContext } from '../../tools/types';

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}));

import { invokeExternalCli } from '../invoker';

type MockProcess = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: {
    write: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
  kill: ReturnType<typeof vi.fn>;
};

function createMockProcess(): MockProcess {
  const process = new EventEmitter() as MockProcess;
  process.stdout = new EventEmitter();
  process.stderr = new EventEmitter();
  process.stdin = {
    write: vi.fn(),
    end: vi.fn(),
  };
  process.kill = vi.fn();
  return process;
}

function createClient(overrides: Partial<ExternalClientConfig> = {}): ExternalClientConfig {
  return {
    id: 'codex-cli',
    name: 'Codex CLI',
    type: 'codex',
    executable: 'codex',
    args: [],
    env: {},
    capabilities: {
      supportsTools: true,
      supportsThinking: true,
      supportsStreaming: true,
      supportsVision: false,
    },
    ...overrides,
  };
}

function createToolContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    cwd: '/tmp/project',
    projectDir: '/tmp/project',
    specDir: '/tmp/project/.auto-claude/specs/001-test',
    securityProfile: {
      baseCommands: new Set(),
      stackCommands: new Set(),
      scriptCommands: new Set(),
      customCommands: new Set(),
      customScripts: { shellScripts: [] },
      getAllAllowedCommands() {
        return new Set();
      },
    },
    ...overrides,
  };
}

describe('invokeExternalCli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('launches Codex through exec mode with stdin prompt content', async () => {
    const child = createMockProcess();
    spawnMock.mockImplementation(() => {
      queueMicrotask(() => {
        child.stdout.emit('data', Buffer.from('All done'));
        child.emit('close', 0);
      });
      return child;
    });

    const result = await invokeExternalCli({
      client: createClient(),
      systemPrompt: 'You are the coder.',
      initialMessage: 'Fix the failing build.',
      toolContext: createToolContext(),
      cwd: '/tmp/project',
    });

    expect(spawnMock).toHaveBeenCalledWith(
      'codex',
      ['exec', '--cd', '/tmp/project', '--color', 'never', '-'],
      expect.objectContaining({
        cwd: '/tmp/project',
        stdio: ['pipe', 'pipe', 'pipe'],
      }),
    );
    expect(child.stdin.write).toHaveBeenCalledWith(
      expect.stringContaining('System instructions:\nYou are the coder.'),
    );
    expect(child.stdin.write).toHaveBeenCalledWith(
      expect.stringContaining('User request:\nFix the failing build.'),
    );
    expect(child.stdin.end).toHaveBeenCalledOnce();
    expect(result.outcome).toBe('completed');
    expect(result.messages).toEqual([{ role: 'assistant', content: 'All done' }]);
  });

  it('maps spawn ENOENT errors to cli_not_found', async () => {
    const child = createMockProcess();
    spawnMock.mockImplementation(() => {
      queueMicrotask(() => {
        const error = new Error('spawn codex ENOENT') as Error & { code?: string };
        error.code = 'ENOENT';
        child.emit('error', error);
      });
      return child;
    });

    const result = await invokeExternalCli({
      client: createClient(),
      systemPrompt: 'system',
      initialMessage: 'message',
      toolContext: createToolContext(),
      cwd: '/tmp/project',
    });

    expect(result.outcome).toBe('error');
    expect(result.error).toEqual(
      expect.objectContaining({
        code: 'cli_not_found',
        message: 'External CLI executable not found: codex',
      }),
    );
  });

  it('uses Codex bypass flag for yolo mode', async () => {
    const child = createMockProcess();
    spawnMock.mockImplementation(() => {
      queueMicrotask(() => child.emit('close', 0));
      return child;
    });

    await invokeExternalCli({
      client: createClient({ yoloMode: true }),
      systemPrompt: 'system',
      initialMessage: 'message',
      toolContext: createToolContext(),
      cwd: '/tmp/project',
    });

    expect(spawnMock).toHaveBeenCalledWith(
      'codex',
      [
        'exec',
        '--cd',
        '/tmp/project',
        '--color',
        'never',
        '--dangerously-bypass-approvals-and-sandbox',
        '-',
      ],
      expect.any(Object),
    );
  });
});
