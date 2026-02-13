import { useTranslation } from 'react-i18next';
import { Badge } from '../../ui/badge';
import { WORKFLOW_STATE_COLORS } from '@shared/constants/enrichment';
import type { WorkflowState } from '@shared/types/enrichment';

interface WorkflowStateBadgeProps {
  state: WorkflowState;
}

export function WorkflowStateBadge({ state }: WorkflowStateBadgeProps) {
  const { t } = useTranslation('common');
  const colors = WORKFLOW_STATE_COLORS[state];
  const label = t(`enrichment.states.${state}`);

  return (
    <div aria-live="polite">
      <Badge
        variant="outline"
        className={`text-xs ${colors.bg} ${colors.text}`}
        role="status"
        aria-label={label}
      >
        {label}
      </Badge>
    </div>
  );
}
