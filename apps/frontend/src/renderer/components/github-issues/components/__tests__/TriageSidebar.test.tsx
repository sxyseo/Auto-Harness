/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TriageSidebar } from '../TriageSidebar';
import type { WorkflowState } from '../../../../../shared/types/enrichment';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const baseProps = {
  enrichment: null,
  currentState: 'new' as WorkflowState,
  onTransition: vi.fn(),
  completenessScore: 0,
};

describe('TriageSidebar', () => {
  it('renders with semantic section element', () => {
    const { container } = render(<TriageSidebar {...baseProps} />);
    expect(container.querySelector('section')).toBeDefined();
  });

  it('renders EnrichmentPanel with props', () => {
    render(<TriageSidebar {...baseProps} completenessScore={75} />);
    // EnrichmentPanel renders completeness section via i18n
    expect(screen.getByText('enrichment.panel.completeness')).toBeDefined();
  });

  it('renders DependencyList when dependencies provided', () => {
    const deps = {
      tracks: [{ issueNumber: 10, title: 'Dep A', state: 'open' as const }],
      trackedBy: [],
    };
    render(<TriageSidebar {...baseProps} dependencies={deps} isDepsLoading={false} depsError={null} />);
    expect(screen.getByText('#10')).toBeDefined();
  });

  it('hides MetricsDashboard when metrics not provided', () => {
    const { container } = render(<TriageSidebar {...baseProps} />);
    // MetricsDashboard uses role="group" on its toggle area
    expect(container.querySelectorAll('[role="group"]').length).toBe(0);
  });
});
