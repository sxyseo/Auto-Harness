/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { BulkResultsPanel } from '../BulkResultsPanel';
import type { BulkOperationResult } from '@shared/types/mutations';

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
        'bulk.actions': 'Bulk operation results',
        'bulk.complete': '{{succeeded}} succeeded, {{failed}} failed',
        'bulk.details': 'Details',
        'bulk.retryFailed': 'Retry {{count}} failed',
        'bulk.dismiss': 'Dismiss',
        'labels.success': 'Success',
        'labels.error': 'Failed'
      }
    }
  }
});

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={testI18n}>{ui}</I18nextProvider>);
}

const resultWithFailures: BulkOperationResult = {
  action: 'close',
  totalItems: 3,
  succeeded: 2,
  failed: 1,
  skipped: 0,
  results: [
    { issueNumber: 1, status: 'success' },
    { issueNumber: 2, status: 'success' },
    { issueNumber: 3, status: 'failed', error: 'Permission denied' },
  ],
};

const resultAllSuccess: BulkOperationResult = {
  action: 'close',
  totalItems: 2,
  succeeded: 2,
  failed: 0,
  skipped: 0,
  results: [
    { issueNumber: 1, status: 'success' },
    { issueNumber: 2, status: 'success' },
  ],
};

describe('BulkResultsPanel', () => {
  it('shows success/fail counts', () => {
    renderWithI18n(
      <BulkResultsPanel
        result={resultWithFailures}
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('2 succeeded, 1 failed')).toBeDefined();
  });

  it('success items show checkmark', () => {
    renderWithI18n(
      <BulkResultsPanel
        result={resultWithFailures}
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    // Expand details
    fireEvent.click(screen.getByText('Details'));
    const checkmarks = screen.getAllByLabelText('Success');
    expect(checkmarks.length).toBe(2);
  });

  it('failed items show error', () => {
    renderWithI18n(
      <BulkResultsPanel
        result={resultWithFailures}
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Details'));
    expect(screen.getByText('Permission denied')).toBeDefined();
    expect(screen.getByLabelText('Failed')).toBeDefined();
  });

  it('retry button fires onRetry when failures exist', () => {
    const onRetry = vi.fn();
    renderWithI18n(
      <BulkResultsPanel
        result={resultWithFailures}
        onRetry={onRetry}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Retry 1 failed'));
    expect(onRetry).toHaveBeenCalledWith(resultWithFailures);
  });

  it('dismiss button fires onDismiss', () => {
    const onDismiss = vi.fn();
    renderWithI18n(
      <BulkResultsPanel
        result={resultAllSuccess}
        onRetry={vi.fn()}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('has aria-label "Bulk operation results"', () => {
    const { container } = renderWithI18n(
      <BulkResultsPanel
        result={resultAllSuccess}
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const el = container.querySelector('[aria-label="Bulk operation results"]');
    expect(el).not.toBeNull();
  });
});
