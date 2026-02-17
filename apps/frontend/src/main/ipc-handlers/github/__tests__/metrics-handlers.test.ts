import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Mock enrichment-persistence
const mockEnrichmentData = {
  schemaVersion: 1,
  issues: {} as Record<string, { triageState: string; completenessScore?: number }>,
};
const mockTransitionsData = {
  transitions: [] as Array<{ issueNumber: number; from: string; to: string; timestamp: string }>,
};

vi.mock('../enrichment-persistence', () => ({
  readEnrichmentFile: vi.fn(() => Promise.resolve(mockEnrichmentData)),
  readTransitionsFile: vi.fn(() => Promise.resolve(mockTransitionsData)),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  createContextLogger: () => ({ debug: vi.fn() }),
}));

import { ipcMain } from 'electron';
import { registerMetricsHandlers } from '../metrics-handlers';
import type { TriageMetrics } from '../../../../shared/types/metrics';

type HandlerFn = (event: unknown, ...args: unknown[]) => Promise<unknown>;
const handlers: Record<string, HandlerFn> = {};

beforeEach(() => {
  vi.clearAllMocks();
  mockEnrichmentData.issues = {};
  mockTransitionsData.transitions = [];

  (ipcMain.handle as ReturnType<typeof vi.fn>).mockImplementation((channel: string, handler: HandlerFn) => {
    handlers[channel] = handler;
  });

  registerMetricsHandlers(() => null as never);
});

describe('computeMetrics handler', () => {
  it('returns state counts from enrichment data', async () => {
    mockEnrichmentData.issues = {
      '1': { triageState: 'triage', completenessScore: 50 },
      '2': { triageState: 'triage', completenessScore: 30 },
      '3': { triageState: 'done', completenessScore: 90 },
    };

    const result = await handlers['github:metrics:compute']({}, 'test-project', 'all') as TriageMetrics;
    expect(result.stateCounts.triage).toBe(2);
    expect(result.stateCounts.done).toBe(1);
    expect(result.stateCounts.new).toBe(0);
  });

  it('computes average time in state from transitions', async () => {
    const now = Date.now();
    mockTransitionsData.transitions = [
      { issueNumber: 1, from: 'new', to: 'triage', timestamp: new Date(now - 60_000).toISOString() },
      { issueNumber: 1, from: 'triage', to: 'ready', timestamp: new Date(now).toISOString() },
    ];

    const result = await handlers['github:metrics:compute']({}, 'test-project', 'all') as TriageMetrics;
    // triage lasted ~60 seconds
    expect(result.avgTimeInState.triage).toBeGreaterThan(50_000);
  });

  it('computes weekly throughput', async () => {
    const now = new Date();
    mockTransitionsData.transitions = [
      { issueNumber: 1, from: 'new', to: 'triage', timestamp: now.toISOString() },
      { issueNumber: 2, from: 'new', to: 'triage', timestamp: now.toISOString() },
    ];

    const result = await handlers['github:metrics:compute']({}, 'test-project', 'all') as TriageMetrics;
    expect(result.totalTransitions).toBe(2);
  });

  it('computes completeness distribution', async () => {
    mockEnrichmentData.issues = {
      '1': { triageState: 'triage', completenessScore: 10 },
      '2': { triageState: 'ready', completenessScore: 40 },
      '3': { triageState: 'done', completenessScore: 60 },
      '4': { triageState: 'done', completenessScore: 80 },
    };

    const result = await handlers['github:metrics:compute']({}, 'test-project', 'all') as TriageMetrics;
    expect(result.completenessDistribution.low).toBe(1);
    expect(result.completenessDistribution.medium).toBe(1);
    expect(result.completenessDistribution.high).toBe(1);
    expect(result.completenessDistribution.excellent).toBe(1);
  });

  it('computes backlog age', async () => {
    mockEnrichmentData.issues = {
      '1': { triageState: 'new', completenessScore: 0 },
    };
    const _now = Date.now();
    mockTransitionsData.transitions = [];

    const result = await handlers['github:metrics:compute']({}, 'test-project', 'all') as TriageMetrics;
    // Backlog age should be >= 0 (some issues in 'new' state)
    expect(result.avgBacklogAge).toBeGreaterThanOrEqual(0);
  });

  it('handles empty transitions (returns zeros)', async () => {
    const result = await handlers['github:metrics:compute']({}, 'test-project', 'all') as TriageMetrics;
    expect(result.totalTransitions).toBe(0);
    expect(result.avgBacklogAge).toBe(0);
  });

  it('filters by 7d time window', async () => {
    const now = Date.now();
    mockTransitionsData.transitions = [
      { issueNumber: 1, from: 'new', to: 'triage', timestamp: new Date(now - 3 * 86_400_000).toISOString() },
      { issueNumber: 2, from: 'new', to: 'triage', timestamp: new Date(now - 10 * 86_400_000).toISOString() },
    ];

    const result = await handlers['github:metrics:compute']({}, 'test-project', '7d') as TriageMetrics;
    expect(result.totalTransitions).toBe(1); // Only the 3-day-old one
  });
});

describe('getStateCounts handler', () => {
  it('returns quick count query', async () => {
    mockEnrichmentData.issues = {
      '1': { triageState: 'new' },
      '2': { triageState: 'new' },
      '3': { triageState: 'done' },
    };

    const result = await handlers['github:metrics:state-counts']({}, 'test-project') as Record<string, number>;
    expect(result.new).toBe(2);
    expect(result.done).toBe(1);
  });
});
