/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLabelSync } from '../useLabelSync';
import { useLabelSyncStore } from '../../../../stores/github/label-sync-store';

// Mock project store
vi.mock('../../../../stores/project-store', () => ({
  useProjectStore: vi.fn((selector: (s: { activeProject: { id: string } | null }) => unknown) =>
    selector({ activeProject: { id: 'test-project' } }),
  ),
}));

// Mock window.electronAPI on jsdom window
const mockGithub = {
  getLabelSyncStatus: vi.fn(),
  enableLabelSync: vi.fn(),
  disableLabelSync: vi.fn(),
  syncIssueLabel: vi.fn(),
  saveLabelSyncConfig: vi.fn(),
};

beforeEach(() => {
  (window as Record<string, unknown>).electronAPI = { github: mockGithub };
});

describe('useLabelSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLabelSyncStore.getState().reset();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useLabelSync());
    expect(result.current.config.enabled).toBe(false);
    expect(result.current.isLoaded).toBe(false);
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('loadStatus fetches config from API', async () => {
    mockGithub.getLabelSyncStatus.mockResolvedValue({
      enabled: true,
      lastSyncedAt: '2026-01-01T00:00:00Z',
    });

    const { result } = renderHook(() => useLabelSync());
    await act(async () => {
      await result.current.loadStatus();
    });

    expect(result.current.config.enabled).toBe(true);
    expect(result.current.isLoaded).toBe(true);
  });

  it('enableSync calls API and updates store', async () => {
    mockGithub.enableLabelSync.mockResolvedValue({
      created: 7, updated: 0, removed: 0, errors: [],
    });

    const { result } = renderHook(() => useLabelSync());
    await act(async () => {
      await result.current.enableSync();
    });

    expect(mockGithub.enableLabelSync).toHaveBeenCalledWith('test-project');
    expect(result.current.config.enabled).toBe(true);
    expect(result.current.lastResult?.created).toBe(7);
  });

  it('disableSync calls API with cleanup flag', async () => {
    mockGithub.disableLabelSync.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useLabelSync());
    await act(async () => {
      await result.current.disableSync(true);
    });

    expect(mockGithub.disableLabelSync).toHaveBeenCalledWith('test-project', true);
    expect(result.current.config.enabled).toBe(false);
  });

  it('syncIssueLabel calls API when sync is enabled', async () => {
    mockGithub.syncIssueLabel.mockResolvedValue({ synced: true });
    // Enable sync first
    useLabelSyncStore.getState().setConfig({ enabled: true, lastSyncedAt: 'now' });

    const { result } = renderHook(() => useLabelSync());
    await act(async () => {
      await result.current.syncIssueLabel(42, 'triage', 'new');
    });

    expect(mockGithub.syncIssueLabel).toHaveBeenCalledWith('test-project', 42, 'triage', 'new');
  });

  it('syncIssueLabel skips when sync is disabled', async () => {
    const { result } = renderHook(() => useLabelSync());
    await act(async () => {
      await result.current.syncIssueLabel(42, 'triage', 'new');
    });

    expect(mockGithub.syncIssueLabel).not.toHaveBeenCalled();
  });

  it('saveConfig persists config', async () => {
    mockGithub.saveLabelSyncConfig.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useLabelSync());
    const config = { enabled: true, lastSyncedAt: '2026-01-01T00:00:00Z' };
    await act(async () => {
      await result.current.saveConfig(config);
    });

    expect(mockGithub.saveLabelSyncConfig).toHaveBeenCalledWith('test-project', config);
    expect(result.current.config.enabled).toBe(true);
  });

  it('handles enable error gracefully', async () => {
    mockGithub.enableLabelSync.mockRejectedValue(new Error('Auth failed'));

    const { result } = renderHook(() => useLabelSync());
    await act(async () => {
      await result.current.enableSync();
    });

    expect(result.current.error).toBe('Auth failed');
    expect(result.current.isSyncing).toBe(false);
  });
});
