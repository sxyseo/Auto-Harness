import { describe, it, expect, beforeEach } from 'vitest';
import { useMutationStore } from '../stores/github/mutation-store';

beforeEach(() => {
  useMutationStore.setState({
    mutatingIssues: new Set(),
    mutationErrors: new Map(),
    isBulkOperating: false,
    bulkProgress: null,
    bulkResult: null,
    selectedIssues: new Set(),
  });
});

// ============================================
// Single mutation tracking
// ============================================

describe('single mutation tracking', () => {
  it('startMutation adds issue to mutatingIssues', () => {
    useMutationStore.getState().startMutation(42);
    expect(useMutationStore.getState().mutatingIssues.has(42)).toBe(true);
  });

  it('endMutation removes issue from mutatingIssues', () => {
    useMutationStore.getState().startMutation(42);
    useMutationStore.getState().endMutation(42);
    expect(useMutationStore.getState().mutatingIssues.has(42)).toBe(false);
  });

  it('endMutation with error sets mutation error', () => {
    useMutationStore.getState().startMutation(42);
    useMutationStore.getState().endMutation(42, 'something failed');
    expect(useMutationStore.getState().mutationErrors.get(42)).toBe('something failed');
  });

  it('clearMutationError removes the error', () => {
    useMutationStore.getState().startMutation(42);
    useMutationStore.getState().endMutation(42, 'error');
    useMutationStore.getState().clearMutationError(42);
    expect(useMutationStore.getState().mutationErrors.has(42)).toBe(false);
  });

  it('tracks multiple concurrent mutations', () => {
    useMutationStore.getState().startMutation(1);
    useMutationStore.getState().startMutation(2);
    const { mutatingIssues } = useMutationStore.getState();
    expect(mutatingIssues.has(1)).toBe(true);
    expect(mutatingIssues.has(2)).toBe(true);
  });
});

// ============================================
// Issue selection
// ============================================

describe('issue selection', () => {
  it('toggleIssueSelection adds to selection', () => {
    useMutationStore.getState().toggleIssueSelection(42);
    expect(useMutationStore.getState().selectedIssues.has(42)).toBe(true);
  });

  it('toggle again removes from selection', () => {
    useMutationStore.getState().toggleIssueSelection(42);
    useMutationStore.getState().toggleIssueSelection(42);
    expect(useMutationStore.getState().selectedIssues.has(42)).toBe(false);
  });

  it('selectAllIssues selects all given issues', () => {
    useMutationStore.getState().selectAllIssues([1, 2, 3]);
    const { selectedIssues } = useMutationStore.getState();
    expect(selectedIssues.has(1)).toBe(true);
    expect(selectedIssues.has(2)).toBe(true);
    expect(selectedIssues.has(3)).toBe(true);
    expect(selectedIssues.size).toBe(3);
  });

  it('deselectAllIssues clears selection', () => {
    useMutationStore.getState().selectAllIssues([1, 2, 3]);
    useMutationStore.getState().deselectAllIssues();
    expect(useMutationStore.getState().selectedIssues.size).toBe(0);
  });
});

// ============================================
// Bulk operations
// ============================================

describe('bulk operations', () => {
  it('startBulkOperation sets bulk state', () => {
    useMutationStore.getState().startBulkOperation('close', 10);
    const state = useMutationStore.getState();
    expect(state.isBulkOperating).toBe(true);
    expect(state.bulkProgress).toEqual({
      action: 'close',
      totalItems: 10,
      processedItems: 0,
    });
  });

  it('updateBulkProgress updates progress', () => {
    useMutationStore.getState().startBulkOperation('close', 10);
    useMutationStore.getState().updateBulkProgress({
      action: 'close',
      totalItems: 10,
      processedItems: 5,
      currentIssueNumber: 42,
    });
    expect(useMutationStore.getState().bulkProgress).toEqual({
      action: 'close',
      totalItems: 10,
      processedItems: 5,
      currentIssueNumber: 42,
    });
  });

  it('endBulkOperation clears operating state and sets result', () => {
    useMutationStore.getState().startBulkOperation('close', 2);
    const result = {
      action: 'close' as const,
      totalItems: 2,
      succeeded: 2,
      failed: 0,
      skipped: 0,
      results: [
        { issueNumber: 1, status: 'success' as const },
        { issueNumber: 2, status: 'success' as const },
      ],
    };
    useMutationStore.getState().endBulkOperation(result);
    const state = useMutationStore.getState();
    expect(state.isBulkOperating).toBe(false);
    expect(state.bulkResult).toEqual(result);
  });

  it('clearBulkResult clears the result', () => {
    useMutationStore.getState().startBulkOperation('close', 1);
    useMutationStore.getState().endBulkOperation({
      action: 'close',
      totalItems: 1,
      succeeded: 1,
      failed: 0,
      skipped: 0,
      results: [{ issueNumber: 1, status: 'success' }],
    });
    useMutationStore.getState().clearBulkResult();
    expect(useMutationStore.getState().bulkResult).toBeNull();
  });

  it('startBulkOperation while already operating is ignored', () => {
    useMutationStore.getState().startBulkOperation('close', 10);
    useMutationStore.getState().startBulkOperation('reopen', 5);
    // Should still show the first operation
    expect(useMutationStore.getState().bulkProgress?.action).toBe('close');
    expect(useMutationStore.getState().bulkProgress?.totalItems).toBe(10);
  });
});
