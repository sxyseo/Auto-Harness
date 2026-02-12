import { describe, it, expect } from 'vitest';
import {
  isWorkflowState,
  isResolution,
  createDefaultEnrichment,
} from '../types/enrichment';

describe('isWorkflowState', () => {
  it('returns true for valid workflow states', () => {
    expect(isWorkflowState('new')).toBe(true);
    expect(isWorkflowState('triage')).toBe(true);
    expect(isWorkflowState('ready')).toBe(true);
    expect(isWorkflowState('in_progress')).toBe(true);
    expect(isWorkflowState('review')).toBe(true);
    expect(isWorkflowState('done')).toBe(true);
    expect(isWorkflowState('blocked')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isWorkflowState('invalid')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isWorkflowState('')).toBe(false);
  });
});

describe('isResolution', () => {
  it('returns true for valid resolutions', () => {
    expect(isResolution('completed')).toBe(true);
    expect(isResolution('split')).toBe(true);
    expect(isResolution('duplicate')).toBe(true);
    expect(isResolution('wontfix')).toBe(true);
    expect(isResolution('stale')).toBe(true);
  });

  it('returns false for invalid values', () => {
    expect(isResolution('unknown')).toBe(false);
  });
});

describe('createDefaultEnrichment', () => {
  it('creates enrichment with correct issue number', () => {
    const enrichment = createDefaultEnrichment(42);
    expect(enrichment.issueNumber).toBe(42);
  });

  it('defaults triageState to new', () => {
    const enrichment = createDefaultEnrichment(42);
    expect(enrichment.triageState).toBe('new');
  });

  it('defaults completenessScore to 0', () => {
    const enrichment = createDefaultEnrichment(42);
    expect(enrichment.completenessScore).toBe(0);
  });

  it('defaults priority to null', () => {
    const enrichment = createDefaultEnrichment(42);
    expect(enrichment.priority).toBeNull();
  });

  it('has empty enrichment sub-object', () => {
    const enrichment = createDefaultEnrichment(42);
    expect(enrichment.enrichment).toEqual({});
  });

  it('has empty agentLinks array', () => {
    const enrichment = createDefaultEnrichment(42);
    expect(enrichment.agentLinks).toEqual([]);
  });

  it('has timestamps set', () => {
    const enrichment = createDefaultEnrichment(42);
    expect(enrichment.createdAt).toBeDefined();
    expect(enrichment.updatedAt).toBeDefined();
    expect(new Date(enrichment.createdAt).getTime()).not.toBeNaN();
    expect(new Date(enrichment.updatedAt).getTime()).not.toBeNaN();
  });
});
