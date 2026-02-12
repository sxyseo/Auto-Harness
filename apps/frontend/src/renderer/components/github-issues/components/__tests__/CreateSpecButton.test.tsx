/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateSpecButton } from '../CreateSpecButton';

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
    expect(screen.getByText('Create Spec')).toBeDefined();
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
    fireEvent.click(screen.getByText('Create Spec'));
    expect(screen.getByText('Create a spec from issue #42?')).toBeDefined();
    expect(screen.getByText('Confirm')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
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
    fireEvent.click(screen.getByText('Create Spec'));
    fireEvent.click(screen.getByText('Confirm'));

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
    const button = screen.getByText('Create Spec');
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByText('An agent is already working on this issue'),
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
    fireEvent.click(screen.getByText('Create Spec'));
    expect(
      screen.getByText('Enrichment data will improve spec quality'),
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
    fireEvent.click(screen.getByText('Create Spec'));
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(screen.getByText('Spec 007 created')).toBeDefined();
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
    fireEvent.click(screen.getByText('Create Spec'));
    fireEvent.click(screen.getByText('Confirm'));

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
