import { describe, it, expect, beforeEach } from 'vitest';
import { useAITriageStore } from '../stores/github/ai-triage-store';
import type { TriageReviewItem } from '../../shared/types/ai-triage';

function createReviewItem(overrides: Partial<TriageReviewItem> = {}): TriageReviewItem {
  return {
    issueNumber: 1,
    issueTitle: 'Test Issue',
    result: {
      category: 'bug',
      confidence: 0.9,
      labelsToAdd: ['bug'],
      labelsToRemove: [],
      isDuplicate: false,
      isSpam: false,
      isFeatureCreep: false,
      suggestedBreakdown: [],
      priority: 'high',
      triagedAt: '2026-01-01T00:00:00Z',
    },
    status: 'pending',
    ...overrides,
  };
}

beforeEach(() => {
  useAITriageStore.setState({
    isTriaging: false,
    triageProgress: null,
    reviewItems: [],
    enrichmentProgress: null,
    splitSuggestion: null,
    splitProgress: null,
  });
});

describe('initial state', () => {
  it('has no results, not triaging, no review items', () => {
    const state = useAITriageStore.getState();
    expect(state.isTriaging).toBe(false);
    expect(state.triageProgress).toBeNull();
    expect(state.reviewItems).toEqual([]);
    expect(state.enrichmentProgress).toBeNull();
    expect(state.splitSuggestion).toBeNull();
    expect(state.splitProgress).toBeNull();
  });
});

describe('startTriage / endTriage', () => {
  it('startTriage sets isTriaging to true', () => {
    useAITriageStore.getState().startTriage();
    expect(useAITriageStore.getState().isTriaging).toBe(true);
  });

  it('endTriage sets isTriaging to false', () => {
    useAITriageStore.getState().startTriage();
    useAITriageStore.getState().endTriage();
    expect(useAITriageStore.getState().isTriaging).toBe(false);
  });
});

describe('setTriageProgress', () => {
  it('updates progress', () => {
    const progress = { phase: 'analyzing' as const, progress: 50, message: 'Processing...' };
    useAITriageStore.getState().setTriageProgress(progress);
    expect(useAITriageStore.getState().triageProgress).toEqual(progress);
  });
});

describe('review items', () => {
  it('addReviewItems adds items to review queue', () => {
    const items = [createReviewItem({ issueNumber: 1 }), createReviewItem({ issueNumber: 2 })];
    useAITriageStore.getState().addReviewItems(items);
    expect(useAITriageStore.getState().reviewItems).toHaveLength(2);
  });

  it('acceptReviewItem changes status to accepted', () => {
    useAITriageStore.getState().addReviewItems([createReviewItem({ issueNumber: 1 })]);
    useAITriageStore.getState().acceptReviewItem(1);
    expect(useAITriageStore.getState().reviewItems[0].status).toBe('accepted');
  });

  it('rejectReviewItem changes status to rejected', () => {
    useAITriageStore.getState().addReviewItems([createReviewItem({ issueNumber: 1 })]);
    useAITriageStore.getState().rejectReviewItem(1);
    expect(useAITriageStore.getState().reviewItems[0].status).toBe('rejected');
  });

  it('acceptAllRemaining accepts all pending items', () => {
    useAITriageStore.getState().addReviewItems([
      createReviewItem({ issueNumber: 1 }),
      createReviewItem({ issueNumber: 2, status: 'rejected' }),
      createReviewItem({ issueNumber: 3 }),
    ]);
    useAITriageStore.getState().acceptAllRemaining();

    const items = useAITriageStore.getState().reviewItems;
    expect(items[0].status).toBe('accepted');
    expect(items[1].status).toBe('rejected'); // Unchanged — already decided
    expect(items[2].status).toBe('accepted');
  });

  it('dismissReview clears review queue', () => {
    useAITriageStore.getState().addReviewItems([createReviewItem()]);
    useAITriageStore.getState().dismissReview();
    expect(useAITriageStore.getState().reviewItems).toEqual([]);
  });

  it('getUnreviewedCount returns count of pending items', () => {
    useAITriageStore.getState().addReviewItems([
      createReviewItem({ issueNumber: 1 }),
      createReviewItem({ issueNumber: 2, status: 'accepted' }),
      createReviewItem({ issueNumber: 3 }),
    ]);
    expect(useAITriageStore.getState().getUnreviewedCount()).toBe(2);
  });
});

describe('enrichment progress', () => {
  it('setEnrichmentProgress sets progress', () => {
    const progress = { phase: 'analyzing' as const, progress: 30, message: 'Analyzing...' };
    useAITriageStore.getState().setEnrichmentProgress(progress);
    expect(useAITriageStore.getState().enrichmentProgress).toEqual(progress);
  });

  it('clearEnrichmentProgress clears progress', () => {
    useAITriageStore.getState().setEnrichmentProgress({
      phase: 'analyzing',
      progress: 30,
      message: 'X',
    });
    useAITriageStore.getState().clearEnrichmentProgress();
    expect(useAITriageStore.getState().enrichmentProgress).toBeNull();
  });
});

describe('split suggestion', () => {
  it('setSplitSuggestion sets suggestion', () => {
    const suggestion = {
      issueNumber: 42,
      subIssues: [{ title: 'Sub 1', body: 'Body', labels: [] }],
      rationale: 'Too broad',
      confidence: 0.9,
    };
    useAITriageStore.getState().setSplitSuggestion(suggestion);
    expect(useAITriageStore.getState().splitSuggestion).toEqual(suggestion);
  });

  it('clearSplitSuggestion clears suggestion', () => {
    useAITriageStore.getState().setSplitSuggestion({
      issueNumber: 42,
      subIssues: [],
      rationale: 'X',
      confidence: 0.5,
    });
    useAITriageStore.getState().clearSplitSuggestion();
    expect(useAITriageStore.getState().splitSuggestion).toBeNull();
  });
});

describe('split progress', () => {
  it('setSplitProgress sets progress', () => {
    const progress = { phase: 'creating' as const, progress: 60, message: 'Creating sub-issues...' };
    useAITriageStore.getState().setSplitProgress(progress);
    expect(useAITriageStore.getState().splitProgress).toEqual(progress);
  });

  it('clearSplitProgress clears progress', () => {
    useAITriageStore.getState().setSplitProgress({
      phase: 'creating',
      progress: 60,
      message: 'X',
    });
    useAITriageStore.getState().clearSplitProgress();
    expect(useAITriageStore.getState().splitProgress).toBeNull();
  });
});
