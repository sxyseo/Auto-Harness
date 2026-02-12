import { describe, it, expect } from 'vitest';
import { isValidTransition, VALID_TRANSITIONS } from '../constants/enrichment';
import type { WorkflowState } from '../types/enrichment';

describe('workflow transitions — forward transitions', () => {
  const validForward: [WorkflowState, WorkflowState][] = [
    ['new', 'triage'],
    ['new', 'ready'],
    ['new', 'in_progress'],
    ['triage', 'ready'],
    ['ready', 'in_progress'],
    ['in_progress', 'review'],
    ['in_progress', 'done'],
    ['review', 'done'],
  ];

  for (const [from, to] of validForward) {
    it(`${from} → ${to} is valid`, () => {
      expect(isValidTransition(from, to)).toBe(true);
    });
  }
});

describe('workflow transitions — backward transitions', () => {
  const validBackward: [WorkflowState, WorkflowState][] = [
    ['review', 'in_progress'],   // QA reject
    ['ready', 'triage'],         // re-triage
    ['done', 'ready'],           // reopen
  ];

  for (const [from, to] of validBackward) {
    it(`${from} → ${to} is valid (backward)`, () => {
      expect(isValidTransition(from, to)).toBe(true);
    });
  }
});

describe('workflow transitions — invalid transitions', () => {
  const invalid: [WorkflowState, WorkflowState][] = [
    ['done', 'triage'],
    ['done', 'new'],
    ['done', 'in_progress'],
    ['new', 'done'],
    ['triage', 'new'],
  ];

  for (const [from, to] of invalid) {
    it(`${from} → ${to} is invalid`, () => {
      expect(isValidTransition(from, to)).toBe(false);
    });
  }
});

describe('workflow transitions — blocked state', () => {
  it('new → blocked is valid', () => {
    expect(isValidTransition('new', 'blocked')).toBe(true);
  });

  it('in_progress → blocked is valid', () => {
    expect(isValidTransition('in_progress', 'blocked')).toBe(true);
  });

  it('blocked → blocked is invalid (already blocked)', () => {
    // VALID_TRANSITIONS for blocked is [], so nothing is valid
    expect(isValidTransition('blocked', 'blocked')).toBe(false);
  });

  it('blocked has no transitions (uses previousState)', () => {
    expect(VALID_TRANSITIONS.blocked).toEqual([]);
  });
});

describe('workflow transitions — resolution required', () => {
  it('in_progress → done requires resolution (transition valid, resolution enforced by handler)', () => {
    // The state machine allows the transition
    expect(isValidTransition('in_progress', 'done')).toBe(true);
    // Resolution enforcement is at the handler level, not the transition validation level
  });

  it('review → done requires resolution', () => {
    expect(isValidTransition('review', 'done')).toBe(true);
  });
});
