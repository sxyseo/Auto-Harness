import { memo } from 'react';
import { Sparkles } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import {
  GITHUB_ISSUE_STATE_COLORS,
  GITHUB_ISSUE_STATE_LABELS
} from '@shared/constants';
import { InvestigationProgressBar } from './InvestigationProgressBar';
import { useTranslation } from 'react-i18next';
import type { IssueListItemProps } from '../types';
import type { InvestigationState } from '@shared/types';

const INVESTIGATION_BORDER_COLORS: Record<InvestigationState, string | null> = {
  new: null,
  queued: '#6b7280',
  investigating: '#3b82f6',
  interrupted: '#f97316',
  findings_ready: '#f59e0b',
  resolved: '#22c55e',
  failed: '#ef4444',
  task_created: '#a855f7',
  building: '#a855f7',
  done: '#22c55e',
};

export const IssueListItem = memo(function IssueListItem({
  issue,
  isSelected,
  onClick,
  onInvestigate,
  isSelectable,
  isChecked,
  onToggleSelect,
  investigationState,
  investigationProgress,
  linkedTaskId,
  onViewTask,
  isStale,
}: IssueListItemProps) {
  const { t } = useTranslation('common');
  const borderColor = investigationState
    ? INVESTIGATION_BORDER_COLORS[investigationState]
    : null;

  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      className={`group p-3 rounded-lg cursor-pointer transition-colors ${
        isStale ? 'opacity-60 ' : ''
      }${
        isSelected
          ? 'bg-accent/50 border border-accent'
          : 'hover:bg-muted/50 border border-transparent'
      }`}
      style={borderColor ? { borderLeft: `3px solid ${borderColor}` } : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-start gap-3 min-w-0 overflow-hidden">
        {isSelectable && (
          <button
            type="button"
            role="checkbox"
            aria-checked={isChecked ?? false}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
            className="mt-1 h-4 w-4 shrink-0 rounded-full border-2 transition-colors"
            style={{
              backgroundColor: isChecked ? 'var(--accent-foreground)' : 'transparent',
              borderColor: 'var(--accent-foreground)',
            }}
            aria-label={t('phase5.selectIssue', { number: issue.number })}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className={`text-xs ${GITHUB_ISSUE_STATE_COLORS[issue.state]}`}
            >
              {GITHUB_ISSUE_STATE_LABELS[issue.state]}
            </Badge>
            <span className="text-xs text-muted-foreground">#{issue.number}</span>
            {investigationState === 'queued' && (
              <span className="text-[10px] text-gray-500 italic">
                {t('investigation.states.queued', 'Queued')}
              </span>
            )}
            {investigationState === 'interrupted' && (
              <span className="text-[10px] text-orange-500 italic">
                {t('investigation.states.interrupted', 'Interrupted')}
              </span>
            )}
            {isStale && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground border-muted-foreground/40">
                {t('investigation.states.stale', 'Stale')}
              </Badge>
            )}
          </div>
          <h4 className="text-sm font-medium text-foreground truncate">
            {issue.title}
          </h4>
          {/* Progress bar only during active investigation — border stripe handles other states */}
          {investigationState === 'investigating' && (
            <InvestigationProgressBar
              state={investigationState}
              progress={investigationProgress}
            />
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onInvestigate();
          }}
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.issue.id === next.issue.id
    && prev.isSelected === next.isSelected
    && prev.investigationState === next.investigationState
    && prev.investigationProgress === next.investigationProgress
    && prev.linkedTaskId === next.linkedTaskId
    && prev.isChecked === next.isChecked
    && prev.isSelectable === next.isSelectable
    && prev.isStale === next.isStale;
});
