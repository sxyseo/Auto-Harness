/**
 * Tests for AgentQueueManager
 */

import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'events';
import { AgentQueueManager } from './agent-queue';
import { AgentState } from './agent-state';
import { AgentEvents } from './agent-events';
import { AgentProcessManager } from './agent-process';
import { SpawnQueue } from './spawn-queue';

describe('AgentQueueManager', () => {
  it('should initialize SpawnQueue instance', () => {
    // Create minimal dependencies for testing
    const mockState = {} as unknown as AgentState;
    const mockEvents = {} as unknown as AgentEvents;
    const mockProcessManager = {
      ensurePythonEnvReady: async () => ({ ready: true }),
      getAutoBuildSourcePath: () => '/mock/path'
    } as unknown as AgentProcessManager;
    const mockEmitter = new EventEmitter();

    // Instantiate AgentQueueManager
    const manager = new AgentQueueManager(
      mockState,
      mockEvents,
      mockProcessManager,
      mockEmitter
    );

    // Access private property via type assertion
    const spawnQueue = (manager as unknown as { spawnQueue: SpawnQueue }).spawnQueue;

    // Verify spawnQueue is a SpawnQueue instance
    expect(spawnQueue).toBeDefined();
    expect(spawnQueue).toBeInstanceOf(SpawnQueue);
  });

  it('should initialize SpawnQueue with empty queue', () => {
    const mockState = {} as unknown as AgentState;
    const mockEvents = {} as unknown as AgentEvents;
    const mockProcessManager = {
      ensurePythonEnvReady: async () => ({ ready: true }),
      getAutoBuildSourcePath: () => '/mock/path'
    } as unknown as AgentProcessManager;
    const mockEmitter = new EventEmitter();

    const manager = new AgentQueueManager(
      mockState,
      mockEvents,
      mockProcessManager,
      mockEmitter
    );

    const spawnQueue = (manager as unknown as { spawnQueue: SpawnQueue }).spawnQueue;

    // Verify initial queue state
    expect(spawnQueue.length).toBe(0);
    expect(spawnQueue.isProcessing).toBe(false);
  });
});
