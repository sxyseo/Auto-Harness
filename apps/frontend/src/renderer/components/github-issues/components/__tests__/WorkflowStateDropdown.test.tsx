/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkflowStateDropdown } from '../WorkflowStateDropdown';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

/** Radix DropdownMenu requires pointer events to open in jsdom */
function openDropdown(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
}

describe('WorkflowStateDropdown', () => {
  it('shows i18n state label on trigger', () => {
    render(<WorkflowStateDropdown currentState="new" onTransition={() => {}} />);
    expect(screen.getByText('enrichment.states.new')).toBeDefined();
  });

  it('has i18n aria-label on trigger', () => {
    render(<WorkflowStateDropdown currentState="new" onTransition={() => {}} />);
    expect(screen.getByRole('button', { name: 'enrichment.dropdown.changeState' })).toBeDefined();
  });

  it('shows valid targets for "new" state with i18n keys', async () => {
    render(<WorkflowStateDropdown currentState="new" onTransition={() => {}} />);
    openDropdown(screen.getByRole('button', { name: 'enrichment.dropdown.changeState' }));

    // new → triage, ready, in_progress, blocked
    for (const target of ['triage', 'ready', 'in_progress', 'blocked']) {
      await waitFor(() => {
        expect(screen.getAllByText(`enrichment.states.${target}`).length).toBeGreaterThan(0);
      });
    }
  });

  it('shows only "Ready" (reopen) for "done" state', async () => {
    render(<WorkflowStateDropdown currentState="done" onTransition={() => {}} />);
    openDropdown(screen.getByRole('button', { name: 'enrichment.dropdown.changeState' }));

    await waitFor(() => {
      expect(screen.getAllByText('enrichment.states.ready').length).toBeGreaterThan(0);
    });

    // done only transitions to ready — no Triage in menu
    const menu = document.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    expect(menu!.textContent).not.toContain('enrichment.states.triage');
  });

  it('shows "Unblock" option for blocked state with previousState', async () => {
    render(
      <WorkflowStateDropdown
        currentState="blocked"
        previousState="in_progress"
        onTransition={() => {}}
      />,
    );
    openDropdown(screen.getByRole('button', { name: 'enrichment.dropdown.changeState' }));

    await waitFor(() => {
      expect(screen.getAllByText(/enrichment\.dropdown\.unblock/).length).toBeGreaterThan(0);
    });
  });

  it('fires onTransition when selecting a target', async () => {
    const onTransition = vi.fn();
    render(<WorkflowStateDropdown currentState="new" onTransition={onTransition} />);
    openDropdown(screen.getByRole('button', { name: 'enrichment.dropdown.changeState' }));

    await waitFor(() => {
      expect(screen.getAllByText('enrichment.states.triage').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText('enrichment.states.triage')[0]);
    expect(onTransition).toHaveBeenCalledWith('triage');
  });

  it('is disabled when isAgentLocked is true', () => {
    render(
      <WorkflowStateDropdown currentState="new" isAgentLocked onTransition={() => {}} />,
    );
    const button = screen.getByRole('button', { name: 'enrichment.dropdown.changeState' });
    expect(
      button.hasAttribute('disabled') || button.getAttribute('data-disabled') !== null,
    ).toBe(true);
  });

  it('shows i18n "moveTo" label in dropdown header', async () => {
    render(<WorkflowStateDropdown currentState="new" onTransition={() => {}} />);
    openDropdown(screen.getByRole('button', { name: 'enrichment.dropdown.changeState' }));

    await waitFor(() => {
      expect(screen.getAllByText('enrichment.dropdown.moveTo').length).toBeGreaterThan(0);
    });
  });

  it('shows i18n resolution labels for "done" target', async () => {
    render(<WorkflowStateDropdown currentState="review" onTransition={() => {}} />);
    openDropdown(screen.getByRole('button', { name: 'enrichment.dropdown.changeState' }));

    // "done" should appear as a target from "review" state
    await waitFor(() => {
      expect(screen.getAllByText('enrichment.states.done').length).toBeGreaterThan(0);
    });
  });
});
