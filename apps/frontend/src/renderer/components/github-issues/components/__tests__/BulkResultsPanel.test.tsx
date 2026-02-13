/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkResultsPanel } from '../BulkResultsPanel';
import type { BulkOperationResult } from '@shared/types/mutations';

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
    render(
      <BulkResultsPanel
        result={resultWithFailures}
        onRetry={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('2 succeeded')).toBeDefined();
    expect(screen.getByText('1 failed')).toBeDefined();
  });

  it('success items show checkmark', () => {
    render(
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
    render(
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
    render(
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
    render(
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
    const { container } = render(
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
