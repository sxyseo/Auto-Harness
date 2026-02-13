import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hasEnrichmentContent,
  buildEnrichedTaskDescription,
} from '../create-spec-handler';
import { createDefaultEnrichment } from '../../../../shared/types/enrichment';
import type { IssueEnrichment } from '../../../../shared/types/enrichment';

// ============================================
// hasEnrichmentContent
// ============================================

describe('hasEnrichmentContent', () => {
  it('returns false for empty enrichment', () => {
    const enrichment = createDefaultEnrichment(42);
    expect(hasEnrichmentContent(enrichment)).toBe(false);
  });

  it('returns true when problem is set', () => {
    const enrichment = createDefaultEnrichment(42);
    enrichment.enrichment.problem = 'The login form is broken';
    expect(hasEnrichmentContent(enrichment)).toBe(true);
  });

  it('returns true when acceptanceCriteria has items', () => {
    const enrichment = createDefaultEnrichment(42);
    enrichment.enrichment.acceptanceCriteria = ['User can login'];
    expect(hasEnrichmentContent(enrichment)).toBe(true);
  });

  it('returns false when arrays are empty', () => {
    const enrichment = createDefaultEnrichment(42);
    enrichment.enrichment.scopeIn = [];
    enrichment.enrichment.scopeOut = [];
    enrichment.enrichment.acceptanceCriteria = [];
    enrichment.enrichment.risksEdgeCases = [];
    expect(hasEnrichmentContent(enrichment)).toBe(false);
  });
});

// ============================================
// buildEnrichedTaskDescription
// ============================================

describe('buildEnrichedTaskDescription', () => {
  const mockIssue = {
    number: 42,
    title: 'Fix login bug',
    body: 'The login form breaks on mobile.',
    html_url: 'https://github.com/test/repo/issues/42',
  };

  it('includes issue title and body', () => {
    const enrichment = createDefaultEnrichment(42);
    const desc = buildEnrichedTaskDescription(mockIssue, enrichment);
    expect(desc).toContain('# GitHub Issue #42: Fix login bug');
    expect(desc).toContain('The login form breaks on mobile.');
  });

  it('includes enrichment sections when present', () => {
    const enrichment = createDefaultEnrichment(42);
    enrichment.enrichment.problem = 'Login fails on mobile browsers';
    enrichment.enrichment.goal = 'Fix the responsive layout';
    enrichment.enrichment.acceptanceCriteria = ['Login works on mobile', 'No desktop regression'];

    const desc = buildEnrichedTaskDescription(mockIssue, enrichment);
    expect(desc).toContain('## Problem Statement');
    expect(desc).toContain('Login fails on mobile browsers');
    expect(desc).toContain('## Goal');
    expect(desc).toContain('Fix the responsive layout');
    expect(desc).toContain('## Acceptance Criteria');
    expect(desc).toContain('- Login works on mobile');
    expect(desc).toContain('- No desktop regression');
  });

  it('includes scope sections', () => {
    const enrichment = createDefaultEnrichment(42);
    enrichment.enrichment.scopeIn = ['Mobile login form'];
    enrichment.enrichment.scopeOut = ['Desktop layout changes'];

    const desc = buildEnrichedTaskDescription(mockIssue, enrichment);
    expect(desc).toContain('## In Scope');
    expect(desc).toContain('- Mobile login form');
    expect(desc).toContain('## Out of Scope');
    expect(desc).toContain('- Desktop layout changes');
  });

  it('includes technical context and risks', () => {
    const enrichment = createDefaultEnrichment(42);
    enrichment.enrichment.technicalContext = 'Uses CSS grid layout';
    enrichment.enrichment.risksEdgeCases = ['Safari flexbox bug'];

    const desc = buildEnrichedTaskDescription(mockIssue, enrichment);
    expect(desc).toContain('## Technical Context');
    expect(desc).toContain('Uses CSS grid layout');
    expect(desc).toContain('## Risks & Edge Cases');
    expect(desc).toContain('- Safari flexbox bug');
  });

  it('includes triage result when available', () => {
    const enrichment = createDefaultEnrichment(42);
    enrichment.triageResult = {
      category: 'bug',
      confidence: 0.92,
      labelsToAdd: ['bug'],
      labelsToRemove: [],
      isDuplicate: false,
      isSpam: false,
      suggestedBreakdown: ['Fix CSS', 'Add tests'],
      triagedAt: '2026-01-01T00:00:00Z',
    };

    const desc = buildEnrichedTaskDescription(mockIssue, enrichment);
    expect(desc).toContain('## Triage Analysis');
    expect(desc).toContain('**Category:** bug');
    expect(desc).toContain('**Confidence:** 92%');
    expect(desc).toContain('- Fix CSS');
    expect(desc).toContain('- Add tests');
  });

  it('skips empty sections', () => {
    const enrichment = createDefaultEnrichment(42);
    const desc = buildEnrichedTaskDescription(mockIssue, enrichment);
    expect(desc).not.toContain('## Problem Statement');
    expect(desc).not.toContain('## Acceptance Criteria');
    expect(desc).not.toContain('## Triage Analysis');
  });
});
