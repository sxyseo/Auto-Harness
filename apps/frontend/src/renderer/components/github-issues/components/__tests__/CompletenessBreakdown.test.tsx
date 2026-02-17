/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { CompletenessBreakdown } from '../CompletenessBreakdown';
import type { IssueEnrichment } from '@shared/types/enrichment';

// Create test i18n instance
const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common'],
  resources: {
    en: {
      common: {
        'completenessBreakdown.title': 'Completeness Breakdown',
        'completenessBreakdown.filled': 'Filled',
        'completenessBreakdown.empty': 'Empty'
      }
    }
  }
});

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={testI18n}>{ui}</I18nextProvider>);
}

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
    renderWithI18n(
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
    renderWithI18n(
      <CompletenessBreakdown enrichment={fullEnrichment} score={100} />,
    );
    fireEvent.click(screen.getByText('100%'));

    const filled = screen.getAllByLabelText('Filled');
    expect(filled.length).toBe(7);
  });

  it('empty sections have circle', () => {
    renderWithI18n(
      <CompletenessBreakdown enrichment={emptyEnrichment} score={0} />,
    );
    fireEvent.click(screen.getByText('0%'));

    const empty = screen.getAllByLabelText('Empty');
    expect(empty.length).toBe(7);
  });

  it('overall percentage displayed', () => {
    renderWithI18n(
      <CompletenessBreakdown enrichment={partialEnrichment} score={42} />,
    );
    expect(screen.getByText('42%')).toBeDefined();
  });

  it('0% shows all empty', () => {
    renderWithI18n(
      <CompletenessBreakdown enrichment={emptyEnrichment} score={0} />,
    );
    fireEvent.click(screen.getByText('0%'));

    const empty = screen.getAllByLabelText('Empty');
    expect(empty.length).toBe(7);
    expect(screen.queryAllByLabelText('Filled').length).toBe(0);
  });

  it('100% shows all filled', () => {
    renderWithI18n(
      <CompletenessBreakdown enrichment={fullEnrichment} score={100} />,
    );
    fireEvent.click(screen.getByText('100%'));

    const filled = screen.getAllByLabelText('Filled');
    expect(filled.length).toBe(7);
    expect(screen.queryAllByLabelText('Empty').length).toBe(0);
  });

  it('has aria-label "Completeness score breakdown"', () => {
    const { container } = renderWithI18n(
      <CompletenessBreakdown enrichment={emptyEnrichment} score={0} />,
    );
    const el = container.querySelector(
      '[aria-label="Completeness Breakdown"]',
    );
    expect(el).not.toBeNull();
  });
});
