/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IssueDetail } from '../IssueDetail';
import type { GitHubIssue } from '../../../../../shared/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => children,
}));

vi.mock('remark-gfm', () => ({
  default: () => { /* noop plugin stub */ },
}));

const baseIssue: GitHubIssue = {
  id: 1,
  number: 42,
  title: 'Test Issue',
  body: 'Issue body text',
  state: 'open',
  htmlUrl: 'https://github.com/owner/repo/issues/42',
  author: { login: 'testuser', avatarUrl: '' },
  labels: [{ id: 1, name: 'bug', color: 'ff0000', description: '' }],
  assignees: [{ login: 'dev1', avatarUrl: '' }],
  commentsCount: 3,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  milestone: null,
} as GitHubIssue;

const baseProps = {
  issue: baseIssue,
  onInvestigate: vi.fn(),
  investigationResult: null,
};

describe('IssueDetail integration', () => {
  it('renders DependencyList when dependencies provided', () => {
    const deps = {
      tracks: [{ issueNumber: 10, title: 'Sub A', state: 'open' as const }],
      trackedBy: [],
    };
    render(<IssueDetail {...baseProps} dependencies={deps} isDepsLoading={false} depsError={null} />);
    expect(screen.getByText('#10')).toBeDefined();
    expect(screen.getByText('Sub A')).toBeDefined();
  });

  it('passes AI triage callbacks to EnrichmentPanel', () => {
    const onAITriage = vi.fn();
    const enrichment = {
      issueNumber: 42,
      triageState: 'new' as const,
      completenessScore: 30,
      enrichment: { problem: '', goal: '', scopeIn: [], scopeOut: [], acceptanceCriteria: [], technicalContext: '' },
    };
    render(
      <IssueDetail
        {...baseProps}
        enrichment={enrichment as never}
        onTransition={vi.fn()}
        onAITriage={onAITriage}
      />,
    );
    // The EnrichmentPanel should render the AI Triage button since currentState is 'new'
    expect(screen.getByText('aiTriage.enrichButton')).toBeDefined();
  });

  it('renders CommentForm when onComment provided', () => {
    render(<IssueDetail {...baseProps} onComment={vi.fn()} />);
    expect(screen.getByText('phase5.addComment')).toBeDefined();
  });

  it('shows close button when issue is open and onClose provided', () => {
    render(<IssueDetail {...baseProps} onClose={vi.fn()} />);
    expect(screen.getByText('phase5.closeIssue')).toBeDefined();
  });

  it('shows reopen button when issue is closed and onReopen provided', () => {
    const closedIssue = { ...baseIssue, state: 'closed' as const };
    render(<IssueDetail {...baseProps} issue={closedIssue} onReopen={vi.fn()} />);
    expect(screen.getByText('phase5.reopenIssue')).toBeDefined();
  });

  it('does not render DependencyList when no dependencies prop', () => {
    const { container } = render(<IssueDetail {...baseProps} />);
    // DependencyList uses a section element
    expect(container.querySelectorAll('section').length).toBe(0);
  });

  it('does not render CommentForm when onComment not provided', () => {
    render(<IssueDetail {...baseProps} />);
    expect(screen.queryByText('phase5.addComment')).toBeNull();
  });
});
