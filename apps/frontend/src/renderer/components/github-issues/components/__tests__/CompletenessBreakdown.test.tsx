/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompletenessBreakdown } from '../CompletenessBreakdown';
import type { IssueEnrichment } from '@shared/types/enrichment';

const fullEnrichment: IssueEnrichment['enrichment'] = {
  problem: 'A problem description',
  goal: 'A goal',
  scopeIn: ['item 1'],
  scopeOut: ['item 1'],
  acceptanceCriteria: ['criterion 1'],
  technicalContext: 'Some context',
  risksEdgeCases: ['risk 1'],
};

const emptyEnrichment: IssueEnrichment['enrichment'] = {};

const partialEnrichment: IssueEnrichment['enrichment'] = {
  problem: 'A problem',
  goal: 'A goal',
};

describe('CompletenessBreakdown', () => {
  it('shows all 7 sections', () => {
    render(
      <CompletenessBreakdown enrichment={fullEnrichment} score={100} />,
    );
    // Expand to show sections
    fireEvent.click(screen.getByText('100%'));

    expect(screen.getByText('Problem')).toBeDefined();
    expect(screen.getByText('Goal')).toBeDefined();
    expect(screen.getByText('Scope In')).toBeDefined();
    expect(screen.getByText('Scope Out')).toBeDefined();
    expect(screen.getByText('Acceptance Criteria')).toBeDefined();
    expect(screen.getByText('Technical Context')).toBeDefined();
    expect(screen.getByText('Risks & Edge Cases')).toBeDefined();
  });

  it('filled sections have checkmark', () => {
    render(
      <CompletenessBreakdown enrichment={fullEnrichment} score={100} />,
    );
    fireEvent.click(screen.getByText('100%'));

    const filled = screen.getAllByLabelText('Filled');
    expect(filled.length).toBe(7);
  });

  it('empty sections have circle', () => {
    render(
      <CompletenessBreakdown enrichment={emptyEnrichment} score={0} />,
    );
    fireEvent.click(screen.getByText('0%'));

    const empty = screen.getAllByLabelText('Empty');
    expect(empty.length).toBe(7);
  });

  it('overall percentage displayed', () => {
    render(
      <CompletenessBreakdown enrichment={partialEnrichment} score={42} />,
    );
    expect(screen.getByText('42%')).toBeDefined();
  });

  it('0% shows all empty', () => {
    render(
      <CompletenessBreakdown enrichment={emptyEnrichment} score={0} />,
    );
    fireEvent.click(screen.getByText('0%'));

    const empty = screen.getAllByLabelText('Empty');
    expect(empty.length).toBe(7);
    expect(screen.queryAllByLabelText('Filled').length).toBe(0);
  });

  it('100% shows all filled', () => {
    render(
      <CompletenessBreakdown enrichment={fullEnrichment} score={100} />,
    );
    fireEvent.click(screen.getByText('100%'));

    const filled = screen.getAllByLabelText('Filled');
    expect(filled.length).toBe(7);
    expect(screen.queryAllByLabelText('Empty').length).toBe(0);
  });

  it('has aria-label "Completeness score breakdown"', () => {
    const { container } = render(
      <CompletenessBreakdown enrichment={emptyEnrichment} score={0} />,
    );
    const el = container.querySelector(
      '[aria-label="Completeness score breakdown"]',
    );
    expect(el).not.toBeNull();
  });
});
