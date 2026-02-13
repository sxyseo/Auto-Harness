import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { Button } from '../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import {
  WORKFLOW_STATE_COLORS,
  getValidTargets,
} from '@shared/constants/enrichment';
import type { WorkflowState, Resolution } from '@shared/types/enrichment';

const RESOLUTION_KEYS: { value: Resolution; i18nKey: string }[] = [
  { value: 'completed', i18nKey: 'enrichment.resolutions.completed' },
  { value: 'split', i18nKey: 'enrichment.resolutions.split' },
  { value: 'duplicate', i18nKey: 'enrichment.resolutions.duplicate' },
  { value: 'wontfix', i18nKey: 'enrichment.resolutions.wontfix' },
  { value: 'stale', i18nKey: 'enrichment.resolutions.stale' },
];

interface WorkflowStateDropdownProps {
  currentState: WorkflowState;
  previousState?: WorkflowState | null;
  isAgentLocked?: boolean;
  onTransition: (to: WorkflowState, resolution?: Resolution) => void;
}

export function WorkflowStateDropdown({
  currentState,
  previousState,
  isAgentLocked,
  onTransition,
}: WorkflowStateDropdownProps) {
  const { t } = useTranslation('common');
  const isBlocked = currentState === 'blocked';
  const targets = isBlocked ? [] : getValidTargets(currentState);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          disabled={isAgentLocked}
          aria-label={t('enrichment.dropdown.changeState')}
          title={isAgentLocked ? t('enrichment.dropdown.agentLocked') : undefined}
        >
          <span
            className={`inline-block w-2 h-2 rounded-full ${WORKFLOW_STATE_COLORS[currentState].bg}`}
          />
          {t(`enrichment.states.${currentState}`)}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{t('enrichment.dropdown.moveTo')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isBlocked && previousState && (
          <DropdownMenuItem onSelect={() => onTransition(previousState)}>
            <span
              className={`inline-block w-2 h-2 rounded-full mr-2 ${WORKFLOW_STATE_COLORS[previousState].bg}`}
            />
            {t('enrichment.dropdown.unblock')} → {t(`enrichment.states.${previousState}`)}
          </DropdownMenuItem>
        )}
        {targets.map((target) => {
          if (target === 'done') {
            return (
              <DropdownMenuSub key={target}>
                <DropdownMenuSubTrigger>
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-2 ${WORKFLOW_STATE_COLORS.done.bg}`}
                  />
                  {t('enrichment.states.done')}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuLabel>{t('enrichment.dropdown.resolution')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {RESOLUTION_KEYS.map((res) => (
                    <DropdownMenuItem
                      key={res.value}
                      onSelect={() => onTransition('done', res.value)}
                    >
                      {t(res.i18nKey)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          }

          return (
            <DropdownMenuItem key={target} onSelect={() => onTransition(target)}>
              <span
                className={`inline-block w-2 h-2 rounded-full mr-2 ${WORKFLOW_STATE_COLORS[target].bg}`}
              />
              {t(`enrichment.states.${target}`)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
