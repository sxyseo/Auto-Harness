/**
 * FIFO Queue for Sequential Agent Spawning
 *
 * Ensures only one agent spawns at a time to prevent ~/.claude.json
 * race condition and file corruption from concurrent writes.
 *
 * Key behaviors:
 * - Processes items FIFO (first in, first out)
 * - Waits for each agent to exit before spawning the next
 * - Continues to next item if spawn fails (error resilience)
 * - Provides drain() method to wait for all queued items
 */

import type { ChildProcess } from 'child_process';

/**
 * Request to spawn an agent process
 */
export interface SpawnRequest {
  /** Unique identifier for this spawn request */
  id: string;
  /** Callback invoked when process is spawned (receives ChildProcess) */
  onSpawn: (process: ChildProcess) => Promise<void>;
  /** Callback invoked if spawn fails */
  onError: (error: Error) => void;
  /** Project ID for the task */
  projectId: string;
  /** Project path where the task runs */
  projectPath: string;
  /** Command-line arguments to pass to the process */
  args: string[];
  /** Environment variables for the process */
  env: Record<string, string>;
}

/**
 * Function type for spawning a process
 * Abstracted for testability and dependency injection
 */
export type SpawnFunction = (
  id: string,
  projectPath: string,
  args: string[],
  env: Record<string, string>
) => Promise<ChildProcess>;

/**
 * FIFO queue for sequential agent spawning
 */
export class SpawnQueue {
  private queue: SpawnRequest[] = [];
  private processing = false;
  private spawnFn: SpawnFunction;

  constructor(spawnFn: SpawnFunction) {
    this.spawnFn = spawnFn;
  }

  /**
   * Add a spawn request to the queue
   * Automatically starts processing if not already running
   */
  enqueue(request: SpawnRequest): void {
    this.queue.push(request);

    // Start processing if not already running
    if (!this.processing) {
      this.processNext().catch((error) => {
        console.error('[SpawnQueue] Fatal error processing queue:', error);
        this.processing = false;
      });
    }
  }

  /**
   * Process the next item in the queue
   * Continues processing until queue is empty
   */
  private async processNext(): Promise<void> {
    // Mark as processing
    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift();

      if (!request) {
        continue;
      }

      try {
        // Spawn the process
        const process = await this.spawnFn(
          request.id,
          request.projectPath,
          request.args,
          request.env
        );

        // Invoke the onSpawn callback
        await request.onSpawn(process);

        // Wait for the process to exit before continuing
        await this.waitForExit(process);
      } catch (error) {
        // If spawn or onSpawn fails, invoke error callback and continue
        const errorObj = error instanceof Error ? error : new Error(String(error));
        request.onError(errorObj);
      }
    }

    // Queue is empty, no longer processing
    this.processing = false;
  }

  /**
   * Wait for a child process to exit
   */
  private waitForExit(process: ChildProcess): Promise<void> {
    return new Promise<void>((resolve) => {
      // Check if process already exited
      if (process.exitCode !== null) {
        resolve();
        return;
      }

      // Wait for exit event
      process.once('exit', () => {
        resolve();
      });
    });
  }

  /**
   * Wait for all queued items to complete
   * Uses polling to check completion status
   */
  async drain(): Promise<void> {
    // Poll until queue is empty and not processing
    while (this.queue.length > 0 || this.processing) {
      await this.sleep(10);
    }
  }

  /**
   * Current queue length
   */
  get length(): number {
    return this.queue.length;
  }

  /**
   * Whether the queue is currently processing an item
   */
  get isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Sleep for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
