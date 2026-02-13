/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProgressiveTrustSettings } from '../ProgressiveTrustSettings';
import { createDefaultProgressiveTrust } from '@shared/types/ai-triage';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  config: createDefaultProgressiveTrust(),
  onSave: vi.fn(),
  onCancel: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProgressiveTrustSettings', () => {
  it('renders four category rows', () => {
    render(<ProgressiveTrustSettings {...defaultProps} />);
    expect(screen.getByText(/type/i)).toBeDefined();
    expect(screen.getByText(/priority/i)).toBeDefined();
    expect(screen.getByText(/labels/i)).toBeDefined();
    expect(screen.getByText(/duplicate/i)).toBeDefined();
  });

  it('renders toggle for each category', () => {
    render(<ProgressiveTrustSettings {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(4);
  });

  it('calls onSave when save button clicked', () => {
    render(<ProgressiveTrustSettings {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(defaultProps.onSave).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button clicked', () => {
    render(<ProgressiveTrustSettings {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('shows batch size input', () => {
    render(<ProgressiveTrustSettings {...defaultProps} />);
    const batchInput = screen.getByDisplayValue('50');
    expect(batchInput).toBeDefined();
  });

  it('shows confirm-above input', () => {
    render(<ProgressiveTrustSettings {...defaultProps} />);
    const confirmInput = screen.getByDisplayValue('10');
    expect(confirmInput).toBeDefined();
  });

  it('toggles category enabled state', () => {
    render(<ProgressiveTrustSettings {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    // After save, the config should reflect the change
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    const savedConfig = defaultProps.onSave.mock.calls[0][0];
    expect(savedConfig.autoApply.type.enabled).toBe(true);
  });

  it('renders trust level radio group with Crawl/Walk/Run', () => {
    render(<ProgressiveTrustSettings {...defaultProps} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(screen.getByText('common:progressiveTrust.crawl')).toBeDefined();
    expect(screen.getByText('common:progressiveTrust.walk')).toBeDefined();
    expect(screen.getByText('common:progressiveTrust.run')).toBeDefined();
  });

  it('defaults to Crawl when all categories disabled', () => {
    render(<ProgressiveTrustSettings {...defaultProps} />);
    const radios = screen.getAllByRole('radio');
    // Default config has all disabled → crawl selected
    expect((radios[0] as HTMLInputElement).checked).toBe(true);
  });

  it('selecting Run enables all categories and shows warning', () => {
    render(<ProgressiveTrustSettings {...defaultProps} />);
    const radios = screen.getAllByRole('radio');
    // Click Run (third radio)
    fireEvent.click(radios[2]);
    // All checkboxes should be checked
    const checkboxes = screen.getAllByRole('checkbox');
    for (const checkbox of checkboxes) {
      expect((checkbox as HTMLInputElement).checked).toBe(true);
    }
    // Warning should be shown
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('common:progressiveTrust.runWarning')).toBeDefined();
  });

  it('selecting Crawl disables all categories', () => {
    // Start with all enabled (run-like config)
    const runConfig = createDefaultProgressiveTrust();
    runConfig.autoApply.type.enabled = true;
    runConfig.autoApply.priority.enabled = true;
    runConfig.autoApply.labels.enabled = true;
    runConfig.autoApply.duplicate.enabled = true;

    render(<ProgressiveTrustSettings {...defaultProps} config={runConfig} />);
    const radios = screen.getAllByRole('radio');
    // Click Crawl (first radio)
    fireEvent.click(radios[0]);
    // All checkboxes should be unchecked
    const checkboxes = screen.getAllByRole('checkbox');
    for (const checkbox of checkboxes) {
      expect((checkbox as HTMLInputElement).checked).toBe(false);
    }
    // No warning
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('selecting Walk enables labels and duplicate only', () => {
    render(<ProgressiveTrustSettings {...defaultProps} />);
    const radios = screen.getAllByRole('radio');
    // Click Walk (second radio)
    fireEvent.click(radios[1]);

    // Save and check config
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    const savedConfig = defaultProps.onSave.mock.calls[0][0];
    expect(savedConfig.autoApply.type.enabled).toBe(false);
    expect(savedConfig.autoApply.priority.enabled).toBe(false);
    expect(savedConfig.autoApply.labels.enabled).toBe(true);
    expect(savedConfig.autoApply.duplicate.enabled).toBe(true);
  });
});
