/**
 * Tests for SpawnQueue - Sequential Agent Spawning
 *
 * Tests the FIFO queue that ensures only one agent runs at a time
 * to prevent ~/.claude.json race condition and file corruption.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpawnQueue, type SpawnFunction } from './spawn-queue';
import type { ChildProcess } from 'child_process';
import type { Readable, Writable } from 'stream';

describe('SpawnQueue', () => {
  let queue: SpawnQueue;
  let mockSpawnFn: SpawnFunction;
  let mockChildProcess: ChildProcess;

  // Helper to create a valid spawn request
  const createRequest = (overrides: Partial<{
    id: string;
    type: string;
    onSpawn: (process: ChildProcess) => Promise<void>;
    onError: (error: Error) => void;
    projectId: string;
    projectPath: string;
    args: string[];
    env: Record<string, string>;
    cwd: string;
  }> = {}) => ({
    id: 'test-id',
    type: 'test',
    onSpawn: vi.fn(async () => { /* noop */ }),
    onError: vi.fn(),
    projectId: 'test-project',
    projectPath: '/test/path',
    args: [],
    env: {},
    cwd: '/test/cwd',
    ...overrides
  });

  beforeEach(() => {
    // Mock child process that exits successfully
    mockChildProcess = {
      on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
        if (event === 'exit') {
          // Simulate immediate exit for testing
          setTimeout(() => callback(0), 0);
        }
        return mockChildProcess as ChildProcess;
      }),
      once: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
        if (event === 'exit') {
          // Simulate immediate exit for testing
          setTimeout(() => callback(0), 0);
        }
        return mockChildProcess as ChildProcess;
      }),
      kill: vi.fn(),
      pid: 12345,
      exitCode: null,
      signalCode: null,
      stdin: null,
      stdout: null,
      stderr: null,
      stdio: [null, null, null] as [
        Writable | null,
        Readable | null,
        Readable | null
      ],
      connected: false
    } as unknown as ChildProcess;

    // Mock spawn function with proper type
    mockSpawnFn = vi.fn().mockResolvedValue(mockChildProcess) as SpawnFunction;

    // Create queue with mock spawn function
    queue = new SpawnQueue(mockSpawnFn);
  });

  describe('Sequential Processing', () => {
    it('should process items in FIFO order', async () => {
      const executionOrder: string[] = [];

      // Create three spawn requests that track execution order
      const request1 = createRequest({
        id: 'task-1',
        onSpawn: vi.fn(async () => {
          executionOrder.push('task-1');
        })
      });

      const request2 = createRequest({
        id: 'task-2',
        onSpawn: vi.fn(async () => {
          executionOrder.push('task-2');
        })
      });

      const request3 = createRequest({
        id: 'task-3',
        onSpawn: vi.fn(async () => {
          executionOrder.push('task-3');
        })
      });

      // Enqueue all three items
      queue.enqueue(request1);
      queue.enqueue(request2);
      queue.enqueue(request3);

      // Wait for all to complete
      await queue.drain();

      // Verify they executed in FIFO order
      expect(executionOrder).toEqual(['task-1', 'task-2', 'task-3']);
      expect(request1.onSpawn).toHaveBeenCalledTimes(1);
      expect(request2.onSpawn).toHaveBeenCalledTimes(1);
      expect(request3.onSpawn).toHaveBeenCalledTimes(1);
    });

    it('should wait for each spawn to complete before starting next', async () => {
      let task1Running = false;
      let task2Started = false;

      const request1 = createRequest({
        id: 'task-1',
        onSpawn: vi.fn(async () => {
          task1Running = true;
          // Simulate work
          await new Promise(resolve => setTimeout(resolve, 50));
          task1Running = false;
        })
      });

      const request2 = createRequest({
        id: 'task-2',
        onSpawn: vi.fn(async () => {
          task2Started = true;
          // Task 2 should only start after task 1 completes
          expect(task1Running).toBe(false);
        })
      });

      queue.enqueue(request1);
      queue.enqueue(request2);

      await queue.drain();

      expect(task1Running).toBe(false);
      expect(task2Started).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should continue to next item when spawn fails', async () => {
      const executionOrder: string[] = [];

      // First request fails
      const request1 = createRequest({
        id: 'task-1',
        onSpawn: vi.fn().mockRejectedValue(new Error('Spawn failed')),
        onError: vi.fn((error: Error) => {
          executionOrder.push('task-1-error');
          expect(error.message).toBe('Spawn failed');
        })
      });

      // Second request succeeds
      const request2 = createRequest({
        id: 'task-2',
        onSpawn: vi.fn(async () => {
          executionOrder.push('task-2');
        })
      });

      queue.enqueue(request1);
      queue.enqueue(request2);

      await queue.drain();

      // Verify both were processed in order
      expect(executionOrder).toEqual(['task-1-error', 'task-2']);
      expect(request1.onSpawn).toHaveBeenCalledTimes(1);
      expect(request2.onSpawn).toHaveBeenCalledTimes(1);
      expect(request1.onError).toHaveBeenCalledTimes(1);
      expect(request2.onError).not.toHaveBeenCalled();
    });

    it('should handle multiple failures gracefully', async () => {
      let errorCount = 0;

      const failingRequest = createRequest({
        id: `task-${errorCount}`,
        onSpawn: vi.fn().mockRejectedValue(new Error('Failed')),
        onError: vi.fn((_error: Error) => {
          errorCount++;
        })
      });

      // Enqueue multiple failing requests
      queue.enqueue({ ...failingRequest, id: 'task-1' });
      queue.enqueue({ ...failingRequest, id: 'task-2' });
      queue.enqueue({ ...failingRequest, id: 'task-3' });

      await queue.drain();

      expect(errorCount).toBe(3);
    });
  });

  describe('Empty Queue', () => {
    it('should handle drain gracefully when queue is empty', async () => {
      // Drain should resolve immediately with no items
      await expect(queue.drain()).resolves.toBeUndefined();
    });

    it('should return zero length for empty queue', () => {
      expect(queue.length).toBe(0);
    });

    it('should not be processing when queue is empty', () => {
      expect(queue.isProcessing).toBe(false);
    });
  });

  describe('Queue State', () => {
    it('should track queue length correctly', async () => {
      expect(queue.length).toBe(0);

      // Enqueue first item - it will start processing immediately
      queue.enqueue(createRequest({
        id: 'task-1',
        onSpawn: vi.fn(async () => {
          // While task-1 is processing, check that subsequent items are queued
          queue.enqueue(createRequest({
            id: 'task-2',
            onSpawn: vi.fn()
          }));
          // Task 2 should be queued while task 1 processes
          expect(queue.length).toBe(1);

          queue.enqueue(createRequest({
            id: 'task-3',
            onSpawn: vi.fn()
          }));
          // Now both task 2 and task 3 are queued
          expect(queue.length).toBe(2);
        })
      }));

      // Wait for all to complete
      await queue.drain();

      // Queue should be empty after all processing
      expect(queue.length).toBe(0);
    });

    it('should track processing state', async () => {
      expect(queue.isProcessing).toBe(false);

      const request = createRequest({
        id: 'task-1',
        onSpawn: vi.fn(async () => {
          // Check that processing is true during execution
          expect(queue.isProcessing).toBe(true);
        })
      });

      queue.enqueue(request);
      expect(queue.isProcessing).toBe(true);

      await queue.drain();
      expect(queue.isProcessing).toBe(false);
    });
  });

  describe('Spawn Function Integration', () => {
    it('should call spawn function with correct arguments', async () => {
      const request = createRequest({
        id: 'task-1',
        projectId: 'project-1',
        projectPath: '/path/to/project',
        args: ['--test', '--verbose'],
        env: { TEST_VAR: 'test-value' },
        cwd: '/test/cwd'
      });

      queue.enqueue(request);
      await queue.drain();

      expect(mockSpawnFn).toHaveBeenCalledTimes(1);
      expect(mockSpawnFn).toHaveBeenCalledWith(
        'task-1',
        '/path/to/project',
        ['--test', '--verbose'],
        { TEST_VAR: 'test-value' },
        'project-1',
        '/test/cwd'
      );
    });

    it('should pass spawned process to onSpawn callback', async () => {
      let receivedProcess: import('child_process').ChildProcess | undefined;

      const request = createRequest({
        id: 'task-1',
        onSpawn: vi.fn(async (process: import('child_process').ChildProcess) => {
          receivedProcess = process;
        })
      });

      queue.enqueue(request);
      await queue.drain();

      expect(receivedProcess).toBeDefined();
      expect(receivedProcess?.pid).toBe(12345);
    });
  });
});
