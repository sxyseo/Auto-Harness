import { describe, it, expect } from 'vitest';

// Integration test: verify Phase 4 types, stores, and constants are consistent

import { IPC_CHANNELS } from '../../../../shared/constants/ipc';
import {
  LABEL_PREFIX,
  WORKFLOW_LABEL_MAP,
  WORKFLOW_LABEL_COLORS,
  getLabelForState,
  getStateFromLabel,
  getWorkflowLabels,
  isAutoClaudeLabel,
  SYNC_DEBOUNCE_MS,
  TRIAGE_MODE_MIN_WIDTH,
} from '../../../../shared/constants/label-sync';
import { createDefaultLabelSyncConfig } from '../../../../shared/types/label-sync';
import { createEmptyDependencies, hasDependencies, totalDependencyCount } from '../../../../shared/types/dependencies';
import { createEmptyMetrics, getCompletenessCategory, formatDuration } from '../../../../shared/types/metrics';
import type { WorkflowState } from '../../../../shared/types/enrichment';

describe('Phase 4 integration: types + constants consistency', () => {
  it('every WorkflowState has a label, color, and IPC coverage', () => {
    const states: WorkflowState[] = ['new', 'triage', 'ready', 'in_progress', 'review', 'done', 'blocked'];
    for (const state of states) {
      expect(WORKFLOW_LABEL_MAP[state]).toBeDefined();
      expect(WORKFLOW_LABEL_COLORS[state]).toBeDefined();
      expect(getLabelForState(state)).toContain(LABEL_PREFIX);
    }
  });

  it('label map is bidirectional (state → label → state)', () => {
    const states: WorkflowState[] = ['new', 'triage', 'ready', 'in_progress', 'review', 'done', 'blocked'];
    for (const state of states) {
      const label = getLabelForState(state);
      expect(getStateFromLabel(label)).toBe(state);
    }
  });

  it('getWorkflowLabels returns all 7 labels with name, color, description', () => {
    const labels = getWorkflowLabels();
    expect(labels).toHaveLength(7);
    for (const label of labels) {
      expect(label.name).toBeTruthy();
      expect(label.color).toMatch(/^[0-9a-f]{6}$/i);
      expect(label.description).toBeTruthy();
    }
  });

  it('isAutoClaudeLabel correctly identifies ac: labels', () => {
    expect(isAutoClaudeLabel('ac:triage')).toBe(true);
    expect(isAutoClaudeLabel('bug')).toBe(false);
    expect(isAutoClaudeLabel('ac:custom')).toBe(true);
  });
});

describe('Phase 4 integration: IPC channel coverage', () => {
  it('all Phase 4 channels are defined', () => {
    // Label sync channels
    expect(IPC_CHANNELS.GITHUB_LABEL_SYNC_ENABLE).toBeDefined();
    expect(IPC_CHANNELS.GITHUB_LABEL_SYNC_DISABLE).toBeDefined();
    expect(IPC_CHANNELS.GITHUB_LABEL_SYNC_ISSUE).toBeDefined();
    expect(IPC_CHANNELS.GITHUB_LABEL_SYNC_STATUS).toBeDefined();
    expect(IPC_CHANNELS.GITHUB_LABEL_SYNC_SAVE).toBeDefined();

    // Dependency channels
    expect(IPC_CHANNELS.GITHUB_DEPS_FETCH).toBeDefined();

    // Metrics channels
    expect(IPC_CHANNELS.GITHUB_METRICS_COMPUTE).toBeDefined();
    expect(IPC_CHANNELS.GITHUB_METRICS_STATE_COUNTS).toBeDefined();
  });
});

describe('Phase 4 integration: factory functions produce valid defaults', () => {
  it('createDefaultLabelSyncConfig returns disabled config', () => {
    const config = createDefaultLabelSyncConfig();
    expect(config.enabled).toBe(false);
    expect(config.lastSyncedAt).toBeNull();
  });

  it('createEmptyDependencies has no deps', () => {
    const deps = createEmptyDependencies();
    expect(hasDependencies(deps)).toBe(false);
    expect(totalDependencyCount(deps)).toBe(0);
  });

  it('createEmptyMetrics has zero-value fields', () => {
    const metrics = createEmptyMetrics();
    expect(metrics.totalTransitions).toBe(0);
    expect(metrics.avgBacklogAge).toBe(0);
    expect(metrics.weeklyThroughput).toEqual([]);
  });
});

describe('Phase 4 integration: utility functions', () => {
  it('getCompletenessCategory buckets correctly', () => {
    expect(getCompletenessCategory(10)).toBe('low');
    expect(getCompletenessCategory(30)).toBe('medium');
    expect(getCompletenessCategory(60)).toBe('high');
    expect(getCompletenessCategory(80)).toBe('excellent');
  });

  it('formatDuration formats time values', () => {
    expect(formatDuration(3_600_000)).toBe('1h'); // 1 hour
    expect(formatDuration(86_400_000)).toBe('1d'); // 1 day
    expect(formatDuration(60_000)).toBe('1m'); // 1 minute
  });

  it('SYNC_DEBOUNCE_MS is 2 seconds', () => {
    expect(SYNC_DEBOUNCE_MS).toBe(2000);
  });

  it('TRIAGE_MODE_MIN_WIDTH is 1200px', () => {
    expect(TRIAGE_MODE_MIN_WIDTH).toBe(1200);
  });
});
