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
      const request1 = {
        id: 'task-1',
        onSpawn: vi.fn(async () => {
          executionOrder.push('task-1');
        }),
        onError: vi.fn(),
        projectId: 'project-1',
        projectPath: '/path/to/project',
        args: ['arg1'],
        env: {}
      };

      const request2 = {
        id: 'task-2',
        onSpawn: vi.fn(async () => {
          executionOrder.push('task-2');
        }),
        onError: vi.fn(),
        projectId: 'project-1',
        projectPath: '/path/to/project',
        args: ['arg2'],
        env: {}
      };

      const request3 = {
        id: 'task-3',
        onSpawn: vi.fn(async () => {
          executionOrder.push('task-3');
        }),
        onError: vi.fn(),
        projectId: 'project-1',
        projectPath: '/path/to/project',
        args: ['arg3'],
        env: {}
      };

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

      const request1 = {
        id: 'task-1',
        onSpawn: vi.fn(async () => {
          task1Running = true;
          // Simulate work
          await new Promise(resolve => setTimeout(resolve, 50));
          task1Running = false;
        }),
        onError: vi.fn(),
        projectId: 'project-1',
        projectPath: '/path/to/project',
        args: ['arg1'],
        env: {}
      };

      const request2 = {
        id: 'task-2',
        onSpawn: vi.fn(async () => {
          task2Started = true;
          // Task 2 should only start after task 1 completes
          expect(task1Running).toBe(false);
        }),
        onError: vi.fn(),
        projectId: 'project-1',
        projectPath: '/path/to/project',
        args: ['arg2'],
        env: {}
      };

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
      const request1 = {
        id: 'task-1',
        onSpawn: vi.fn().mockRejectedValue(new Error('Spawn failed')),
        onError: vi.fn((error: Error) => {
          executionOrder.push('task-1-error');
          expect(error.message).toBe('Spawn failed');
        }),
        projectId: 'project-1',
        projectPath: '/path/to/project',
        args: ['arg1'],
        env: {}
      };

      // Second request succeeds
      const request2 = {
        id: 'task-2',
        onSpawn: vi.fn(async () => {
          executionOrder.push('task-2');
        }),
        onError: vi.fn(),
        projectId: 'project-1',
        projectPath: '/path/to/project',
        args: ['arg2'],
        env: {}
      };

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

      const failingRequest = {
        id: `task-${errorCount}`,
        onSpawn: vi.fn().mockRejectedValue(new Error('Failed')),
        onError: vi.fn((error: Error) => {
          errorCount++;
        }),
        projectId: 'project-1',
        projectPath: '/path/to/project',
        args: ['arg'],
        env: {}
      };

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
      queue.enqueue({
        id: 'task-1',
        onSpawn: vi.fn(async () => {
          // While task-1 is processing, check that subsequent items are queued
          queue.enqueue({
            id: 'task-2',
            onSpawn: vi.fn(),
            onError: vi.fn(),
            projectId: 'project-1',
            projectPath: '/path/to/project',
            args: ['arg2'],
            env: {}
          });
          // Task 2 should be queued while task 1 processes
          expect(queue.length).toBe(1);

          queue.enqueue({
            id: 'task-3',
            onSpawn: vi.fn(),
            onError: vi.fn(),
            projectId: 'project-1',
            projectPath: '/path/to/project',
            args: ['arg3'],
            env: {}
          });
          // Now both task 2 and task 3 are queued
          expect(queue.length).toBe(2);
        }),
        onError: vi.fn(),
        projectId: 'project-1',
        projectPath: '/path/to/project',
        args: ['arg1'],
        env: {}
      });

      // Wait for all to complete
      await queue.drain();

      // Queue should be empty after all processing
      expect(queue.length).toBe(0);
    });

    it('should track processing state', async () => {
      expect(queue.isProcessing).toBe(false);

      const request = {
        id: 'task-1',
        onSpawn: vi.fn(async () => {
          // Check that processing is true during execution
          expect(queue.isProcessing).toBe(true);
        }),
        onError: vi.fn(),
        projectId: 'project-1',
        projectPath: '/path/to/project',
        args: ['arg1'],
        env: {}
      };

      queue.enqueue(request);
      expect(queue.isProcessing).toBe(true);

      await queue.drain();
      expect(queue.isProcessing).toBe(false);
    });
  });

  describe('Spawn Function Integration', () => {
    it('should call spawn function with correct arguments', async () => {
      const request = {
        id: 'task-1',
        onSpawn: vi.fn(),
        onError: vi.fn(),
        projectId: 'project-1',
        projectPath: '/path/to/project',
        args: ['--test', '--verbose'],
        env: { TEST_VAR: 'test-value' }
      };

      queue.enqueue(request);
      await queue.drain();

      expect(mockSpawnFn).toHaveBeenCalledTimes(1);
      expect(mockSpawnFn).toHaveBeenCalledWith(
        'task-1',
        '/path/to/project',
        ['--test', '--verbose'],
        { TEST_VAR: 'test-value' }
      );
    });

    it('should pass spawned process to onSpawn callback', async () => {
      let receivedProcess: import('child_process').ChildProcess | undefined;

      const request = {
        id: 'task-1',
        onSpawn: vi.fn(async (process: import('child_process').ChildProcess) => {
          receivedProcess = process;
        }),
        onError: vi.fn(),
        projectId: 'project-1',
        projectPath: '/path/to/project',
        args: ['arg1'],
        env: {}
      };

      queue.enqueue(request);
      await queue.drain();

      expect(receivedProcess).toBeDefined();
      expect(receivedProcess?.pid).toBe(12345);
    });
  });
});
