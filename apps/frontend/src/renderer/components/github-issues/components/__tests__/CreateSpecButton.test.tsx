/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateSpecButton } from '../CreateSpecButton';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('CreateSpecButton', () => {
  it('renders Create Spec button', () => {
    render(
      <CreateSpecButton
        issueNumber={42}
        issueClosed={false}
        hasActiveAgent={false}
        hasEnrichment={true}
        onCreateSpec={vi.fn()}
      />,
    );
    expect(screen.getByText('spec.createFromIssue')).toBeDefined();
  });

  it('click shows confirmation', () => {
    render(
      <CreateSpecButton
        issueNumber={42}
        issueClosed={false}
        hasActiveAgent={false}
        hasEnrichment={true}
        onCreateSpec={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('spec.createFromIssue'));
    expect(screen.getByText('spec.confirm')).toBeDefined();
    expect(screen.getByText('buttons.confirm')).toBeDefined();
    expect(screen.getByText('buttons.cancel')).toBeDefined();
  });

  it('confirm fires onCreateSpec', async () => {
    const onCreateSpec = vi.fn().mockResolvedValue({ specNumber: '001' });
    render(
      <CreateSpecButton
        issueNumber={42}
        issueClosed={false}
        hasActiveAgent={false}
        hasEnrichment={true}
        onCreateSpec={onCreateSpec}
      />,
    );
    fireEvent.click(screen.getByText('spec.createFromIssue'));
    fireEvent.click(screen.getByText('buttons.confirm'));

    await waitFor(() => {
      expect(onCreateSpec).toHaveBeenCalled();
    });
  });

  it('disabled when hasActiveAgent', () => {
    render(
      <CreateSpecButton
        issueNumber={42}
        issueClosed={false}
        hasActiveAgent={true}
        hasEnrichment={true}
        onCreateSpec={vi.fn()}
      />,
    );
    const button = screen.getByText('spec.createFromIssue');
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByText('spec.agentActive'),
    ).toBeDefined();
  });

  it('no enrichment shows tip text', () => {
    render(
      <CreateSpecButton
        issueNumber={42}
        issueClosed={false}
        hasActiveAgent={false}
        hasEnrichment={false}
        onCreateSpec={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('spec.createFromIssue'));
    expect(
      screen.getByText('spec.noEnrichmentTip'),
    ).toBeDefined();
  });

  it('after success shows spec number', async () => {
    const onCreateSpec = vi.fn().mockResolvedValue({ specNumber: '007' });
    render(
      <CreateSpecButton
        issueNumber={42}
        issueClosed={false}
        hasActiveAgent={false}
        hasEnrichment={true}
        onCreateSpec={onCreateSpec}
      />,
    );
    fireEvent.click(screen.getByText('spec.createFromIssue'));
    fireEvent.click(screen.getByText('buttons.confirm'));

    await waitFor(() => {
      expect(screen.getByText('spec.created')).toBeDefined();
    });
  });

  it('on failure shows error', async () => {
    const onCreateSpec = vi.fn().mockRejectedValue(new Error('Network error'));
    render(
      <CreateSpecButton
        issueNumber={42}
        issueClosed={false}
        hasActiveAgent={false}
        hasEnrichment={true}
        onCreateSpec={onCreateSpec}
      />,
    );
    fireEvent.click(screen.getByText('spec.createFromIssue'));
    fireEvent.click(screen.getByText('buttons.confirm'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeDefined();
    });
  });

  it('has aria-label "Create spec from issue"', () => {
    const { container } = render(
      <CreateSpecButton
        issueNumber={42}
        issueClosed={false}
        hasActiveAgent={false}
        hasEnrichment={true}
        onCreateSpec={vi.fn()}
      />,
    );
    const el = container.querySelector(
      '[aria-label="Create spec from issue"]',
    );
    expect(el).not.toBeNull();
  });
});
