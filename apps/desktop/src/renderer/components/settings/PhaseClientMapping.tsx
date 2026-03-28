/**
 * PhaseClientMapping - Phase-to-client mapping configuration
 *
 * Allows users to assign different AI clients to each pipeline phase.
 * Grid layout with phase cards and client selectors.
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ClientSelector } from './ClientSelector';
import type { PhaseClientMapping } from '@shared/types/client-config';

interface PhaseClientMappingProps {
  /** Current phase-to-client mapping */
  mapping: PhaseClientMapping;
  /** Callback when mapping for a phase changes */
  onMappingChange: (phase: keyof PhaseClientMapping, clientRef: PhaseClientMapping[keyof PhaseClientMapping]) => void;
}

/**
 * PhaseClientMapping component
 *
 * Displays four phase cards (spec, planning, coding, qa) with client selectors.
 * Simplified version following the pattern of MixedPhaseEditor.
 */
export function PhaseClientMapping({ mapping, onMappingChange }: PhaseClientMappingProps) {
  const { t } = useTranslation('settings');

  // Phase definitions with labels and descriptions
  const phases = [
    {
      key: 'spec' as const,
      label: t('multiClient.phaseMapping.phases.spec.label'),
      description: t('multiClient.phaseMapping.phases.spec.description'),
      icon: '📋',
    },
    {
      key: 'planning' as const,
      label: t('multiClient.phaseMapping.phases.planning.label'),
      description: t('multiClient.phaseMapping.phases.planning.description'),
      icon: '📝',
    },
    {
      key: 'coding' as const,
      label: t('multiClient.phaseMapping.phases.coding.label'),
      description: t('multiClient.phaseMapping.phases.coding.description'),
      icon: '💻',
    },
    {
      key: 'qa' as const,
      label: t('multiClient.phaseMapping.phases.qa.label'),
      description: t('multiClient.phaseMapping.phases.qa.description'),
      icon: '🔍',
    },
  ];

  /**
   * Handle client change for a phase
   */
  const handleClientChange = (phase: keyof PhaseClientMapping) => (clientRef: PhaseClientMapping[typeof phase]) => {
    onMappingChange(phase, clientRef);
  };

  /**
   * Get badge for client type
   */
  const getClientTypeBadge = (clientRef: PhaseClientMapping[keyof PhaseClientMapping]) => {
    if (clientRef.type === 'cli') {
      return (
        <span className="text-xs bg-blue-500/15 text-blue-500 px-2 py-0.5 rounded font-medium">
          {t('multiClient.phaseMapping.badges.cli')}
        </span>
      );
    }
    return (
      <span className="text-xs bg-purple-500/15 text-purple-500 px-2 py-0.5 rounded font-medium">
        {t('multiClient.phaseMapping.badges.provider')}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div>
        <h4 className="text-sm font-medium text-foreground">
          {t('multiClient.phaseMapping.title')}
        </h4>
        <p className="text-xs text-muted-foreground mt-1">
          {t('multiClient.phaseMapping.description')}
        </p>
      </div>

      {/* Phase cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {phases.map((phase) => (
          <Card key={phase.key} className="border">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{phase.icon}</span>
                  <div>
                    <CardTitle className="text-sm">{phase.label}</CardTitle>
                  </div>
                </div>
                {getClientTypeBadge(mapping[phase.key])}
              </div>
              <CardDescription className="text-xs">
                {phase.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ClientSelector
                value={mapping[phase.key]}
                onChange={handleClientChange(phase.key)}
                phase={phase.key}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
