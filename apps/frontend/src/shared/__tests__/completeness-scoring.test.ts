import { describe, it, expect } from 'vitest';
import { calculateCompleteness } from '../utils/completeness-scoring';

describe('calculateCompleteness', () => {
  it('returns 0 for empty enrichment', () => {
    expect(calculateCompleteness({})).toBe(0);
  });

  it('returns 100 for all fields populated', () => {
    const enrichment = {
      problem: 'A real problem',
      goal: 'A goal',
      scopeIn: ['item'],
      scopeOut: ['item'],
      acceptanceCriteria: ['AC1'],
      technicalContext: 'Some context',
      risksEdgeCases: ['Risk 1'],
    };
    expect(calculateCompleteness(enrichment)).toBe(100);
  });

  it('returns 20 for only problem set', () => {
    expect(calculateCompleteness({ problem: 'A problem' })).toBe(20);
  });

  it('returns 25 for only acceptanceCriteria set', () => {
    expect(calculateCompleteness({ acceptanceCriteria: ['AC1'] })).toBe(25);
  });

  it('treats whitespace-only strings as empty', () => {
    expect(calculateCompleteness({ problem: '  ' })).toBe(0);
  });

  it('treats empty array as empty', () => {
    expect(calculateCompleteness({ scopeIn: [] })).toBe(0);
  });

  it('returns 5 for scopeIn with one item', () => {
    expect(calculateCompleteness({ scopeIn: ['item'] })).toBe(5);
  });

  it('returns 55 for problem + goal + acceptanceCriteria', () => {
    const enrichment = {
      problem: 'Problem',
      goal: 'Goal',
      acceptanceCriteria: ['AC1'],
    };
    expect(calculateCompleteness(enrichment)).toBe(55);
  });

  it('returns 0 for undefined fields', () => {
    expect(calculateCompleteness({ problem: undefined })).toBe(0);
  });
});
