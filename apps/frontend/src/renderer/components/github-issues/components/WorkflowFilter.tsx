import { useTranslation } from 'react-i18next';
import { Filter } from 'lucide-react';
import { Button } from '../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { WORKFLOW_STATE_COLORS } from '../../../../shared/constants/enrichment';
import type { WorkflowState } from '../../../../shared/types/enrichment';

const ALL_STATES: WorkflowState[] = [
  'new',
  'triage',
  'ready',
  'in_progress',
  'review',
  'done',
  'blocked',
];

interface WorkflowFilterProps {
  selectedStates: WorkflowState[];
  onChange: (states: WorkflowState[]) => void;
  stateCounts?: Record<WorkflowState, number>;
}

export function WorkflowFilter({ selectedStates, onChange, stateCounts }: WorkflowFilterProps) {
  const { t } = useTranslation('common');
  const isAll = selectedStates.length === 0;

  function handleToggle(state: WorkflowState) {
    if (selectedStates.includes(state)) {
      onChange(selectedStates.filter((s) => s !== state));
    } else {
      onChange([...selectedStates, state]);
    }
  }

  function handleClear() {
    onChange([]);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          aria-label={t('enrichment.filter.filterByState')}
        >
          <Filter className="h-3.5 w-3.5" />
          {isAll ? t('enrichment.filter.allStates') : t('enrichment.filter.selectedCount', { count: selectedStates.length })}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{t('enrichment.filter.workflowState')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={isAll} onCheckedChange={handleClear}>
          {t('enrichment.filter.allStates')}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {ALL_STATES.map((state) => {
          const colors = WORKFLOW_STATE_COLORS[state];
          const count = stateCounts?.[state];
          return (
            <DropdownMenuCheckboxItem
              key={state}
              checked={selectedStates.includes(state)}
              onCheckedChange={() => handleToggle(state)}
            >
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${colors.bg}`} />
              {t(`enrichment.states.${state}`)}
              {count !== undefined && (
                <span className="ml-auto text-xs text-muted-foreground">{count}</span>
              )}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
