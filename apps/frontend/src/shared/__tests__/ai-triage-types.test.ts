/**
 * Tests for AI triage type factories and utilities.
 */
import { describe, it, expect } from 'vitest';
import {
  mapTriageCategory,
} from '../types/ai-triage';

describe('mapTriageCategory', () => {
  it('maps bug to bug', () => {
    expect(mapTriageCategory('bug')).toBe('bug');
  });

  it('maps feature to feature', () => {
    expect(mapTriageCategory('feature')).toBe('feature');
  });

  it('maps documentation to documentation', () => {
    expect(mapTriageCategory('documentation')).toBe('documentation');
  });

  it('maps question to question', () => {
    expect(mapTriageCategory('question')).toBe('question');
  });

  it('maps duplicate to bug (flagged separately via isDuplicate)', () => {
    expect(mapTriageCategory('duplicate')).toBe('bug');
  });

  it('maps spam to chore', () => {
    expect(mapTriageCategory('spam')).toBe('chore');
  });

  it('maps feature_creep to enhancement', () => {
    expect(mapTriageCategory('feature_creep')).toBe('enhancement');
  });

  it('maps unknown categories to chore', () => {
    expect(mapTriageCategory('unknown_xyz')).toBe('chore');
  });

  it('maps enhancement to enhancement', () => {
    expect(mapTriageCategory('enhancement')).toBe('enhancement');
  });

  it('maps chore to chore', () => {
    expect(mapTriageCategory('chore')).toBe('chore');
  });

  it('maps security to security', () => {
    expect(mapTriageCategory('security')).toBe('security');
  });

  it('maps performance to performance', () => {
    expect(mapTriageCategory('performance')).toBe('performance');
  });
});
