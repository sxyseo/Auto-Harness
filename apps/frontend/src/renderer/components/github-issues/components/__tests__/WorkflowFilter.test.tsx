/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkflowFilter } from '../WorkflowFilter';
import type { WorkflowState } from '../../../../../shared/types/enrichment';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'enrichment.filter.selectedCount' && params?.count !== undefined) {
        return `${params.count} selected`;
      }
      return key;
    },
  }),
}));

/** Radix DropdownMenu requires pointer events to open in jsdom */
function openDropdown(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
}

const ALL_STATES: WorkflowState[] = [
  'new', 'triage', 'ready', 'in_progress', 'review', 'done', 'blocked',
];

describe('WorkflowFilter', () => {
  it('renders trigger with i18n "allStates" key when no selection', () => {
    render(<WorkflowFilter selectedStates={[]} onChange={() => {}} />);
    expect(screen.getByText('enrichment.filter.allStates')).toBeDefined();
  });

  it('shows selected count when states are selected', () => {
    render(<WorkflowFilter selectedStates={['new', 'triage']} onChange={() => {}} />);
    expect(screen.getByText('2 selected')).toBeDefined();
  });

  it('has i18n aria-label on filter trigger', () => {
    render(<WorkflowFilter selectedStates={[]} onChange={() => {}} />);
    const trigger = screen.getByRole('button', { name: 'enrichment.filter.filterByState' });
    expect(trigger).toBeDefined();
  });

  it('renders all 7 state i18n keys plus allStates when menu is open', async () => {
    render(<WorkflowFilter selectedStates={[]} onChange={() => {}} />);
    openDropdown(screen.getByRole('button', { name: 'enrichment.filter.filterByState' }));

    for (const state of ALL_STATES) {
      await waitFor(() => {
        expect(screen.getAllByText(`enrichment.states.${state}`).length).toBeGreaterThan(0);
      });
    }
    // "All states" is used both on trigger and in dropdown
    await waitFor(() => {
      expect(screen.getAllByText('enrichment.filter.allStates').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('calls onChange when a state is toggled on', async () => {
    const onChange = vi.fn();
    render(<WorkflowFilter selectedStates={[]} onChange={onChange} />);
    openDropdown(screen.getByRole('button', { name: 'enrichment.filter.filterByState' }));

    await waitFor(() => {
      expect(screen.getAllByText('enrichment.states.new').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText('enrichment.states.new')[0]);
    expect(onChange).toHaveBeenCalledWith(['new']);
  });

  it('calls onChange removing a state when toggled off', async () => {
    const onChange = vi.fn();
    render(<WorkflowFilter selectedStates={['new', 'triage']} onChange={onChange} />);
    openDropdown(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getAllByText('enrichment.states.new').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText('enrichment.states.new')[0]);
    expect(onChange).toHaveBeenCalledWith(['triage']);
  });
});
