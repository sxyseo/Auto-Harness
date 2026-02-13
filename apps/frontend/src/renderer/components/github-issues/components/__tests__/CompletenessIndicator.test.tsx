/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompletenessIndicator } from '../CompletenessIndicator';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'enrichment.completeness.label' && params?.score !== undefined) {
        return `enrichment.completeness.label::${params.score}`;
      }
      return key;
    },
  }),
}));

describe('CompletenessIndicator', () => {
  it('renders "0%" for score 0', () => {
    render(<CompletenessIndicator score={0} />);
    expect(screen.getByText('0%')).toBeDefined();
  });

  it('renders "100%" for score 100', () => {
    render(<CompletenessIndicator score={100} />);
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('renders "65%" for score 65', () => {
    render(<CompletenessIndicator score={65} />);
    expect(screen.getByText('65%')).toBeDefined();
  });

  it('renders i18n key for null score', () => {
    render(<CompletenessIndicator score={null} />);
    expect(screen.getByText('enrichment.completeness.notAssessed')).toBeDefined();
  });

  it('renders i18n key for undefined score', () => {
    render(<CompletenessIndicator score={undefined} />);
    expect(screen.getByText('enrichment.completeness.notAssessed')).toBeDefined();
  });

  it('has i18n aria-label for numeric score', () => {
    const { container } = render(<CompletenessIndicator score={42} />);
    const el = container.querySelector('[aria-label="enrichment.completeness.label::42"]');
    expect(el).not.toBeNull();
  });

  it('has i18n aria-label for null score', () => {
    const { container } = render(<CompletenessIndicator score={null} />);
    const el = container.querySelector('[aria-label="enrichment.completeness.notAssessed"]');
    expect(el).not.toBeNull();
  });

  it('progress bar width matches percentage', () => {
    const { container } = render(<CompletenessIndicator score={75} />);
    const bar = container.querySelector('[style*="width"]') as HTMLElement;
    expect(bar).not.toBeNull();
    expect(bar.style.width).toBe('75%');
  });

  it('compact variant renders text only', () => {
    const { container } = render(<CompletenessIndicator score={50} compact />);
    expect(screen.getByText('50%')).toBeDefined();
    // No progress bar in compact mode
    const bar = container.querySelector('[style*="width"]');
    expect(bar).toBeNull();
  });
});
