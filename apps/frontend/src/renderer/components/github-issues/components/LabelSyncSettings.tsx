import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  getWorkflowLabels,
  resolveWorkflowCustomization,
} from '@shared/constants/label-sync';
import type { WorkflowLabelCustomization } from '@shared/types/label-sync';
import type { WorkflowState } from '@shared/types/enrichment';
import { LabelCustomizationEditor } from './LabelCustomizationEditor';
import type { LabelRow } from './LabelCustomizationEditor';

interface LabelSyncSettingsProps {
  enabled: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
  customization?: WorkflowLabelCustomization;
  onEnable: () => void;
  onDisable: (cleanup: boolean) => void;
  onCustomizationChange?: (customization: WorkflowLabelCustomization | undefined) => void;
}

const WORKFLOW_STATES: WorkflowState[] = [
  'new', 'triage', 'ready', 'in_progress', 'review', 'done', 'blocked',
];

export function LabelSyncSettings({
  enabled,
  isSyncing,
  lastSyncedAt,
  error,
  customization,
  onEnable,
  onDisable,
  onCustomizationChange,
}: LabelSyncSettingsProps) {
  const { t } = useTranslation('common');
  const [expanded, setExpanded] = useState(false);

  const resolved = resolveWorkflowCustomization(customization);

  const labelRows: LabelRow[] = WORKFLOW_STATES.map((state) => ({
    key: state,
    displayName: t(`labelSync.customization.states.${state}`, state),
    suffix: resolved.labels[state].suffix,
    color: resolved.labels[state].color,
    description: resolved.labels[state].description,
  }));

  const handlePrefixChange = useCallback(
    (prefix: string) => {
      onCustomizationChange?.({ ...resolved, prefix });
    },
    [resolved, onCustomizationChange],
  );

  const handleLabelChange = useCallback(
    (key: string, field: 'suffix' | 'color' | 'description', value: string) => {
      const updated = {
        ...resolved,
        labels: {
          ...resolved.labels,
          [key]: { ...resolved.labels[key as WorkflowState], [field]: value },
        },
      };
      onCustomizationChange?.(updated);
    },
    [resolved, onCustomizationChange],
  );

  const handleReset = useCallback(() => {
    onCustomizationChange?.(undefined);
  }, [onCustomizationChange]);

  return (
    <section className="space-y-3" aria-label={t('labelSync.settings')}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-foreground">
            {t('labelSync.title')}
          </h4>
          <p className="text-xs text-muted-foreground">
            {t('labelSync.description')}
          </p>
        </div>
        <button
          type="button"
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            enabled
              ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
          onClick={() => enabled ? onDisable(false) : onEnable()}
          disabled={isSyncing}
          aria-busy={isSyncing}
        >
          {isSyncing
            ? t('labelSync.syncing')
            : enabled
              ? t('labelSync.disable')
              : t('labelSync.enable')}
        </button>
      </div>

      {enabled && lastSyncedAt && (
        <p className="text-xs text-muted-foreground">
          {t('labelSync.lastSynced', { date: new Date(lastSyncedAt).toLocaleDateString() })}
        </p>
      )}

      {enabled && (
        <button
          type="button"
          className="text-xs text-destructive hover:underline"
          onClick={() => onDisable(true)}
          disabled={isSyncing}
        >
          {t('labelSync.disableAndCleanup')}
        </button>
      )}

      {enabled && (
        <div className="flex flex-wrap gap-1.5">
          {getWorkflowLabels(customization).map((label) => (
            <span
              key={label.name}
              data-testid="label-swatch"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: `#${label.color}` }}
              />
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Collapsible label configuration */}
      {enabled && onCustomizationChange && (
        <div className="pt-1">
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {t('labelSync.customization.title', 'Label Configuration')}
          </button>

          {expanded && (
            <div className="mt-2 pl-4 border-l-2 border-border">
              <p className="text-xs text-muted-foreground mb-3">
                {t('labelSync.customization.description', 'Customize label names, colors, and descriptions')}
              </p>
              <LabelCustomizationEditor
                prefix={resolved.prefix}
                onPrefixChange={handlePrefixChange}
                labels={labelRows}
                onLabelChange={handleLabelChange}
                onReset={handleReset}
                i18nPrefix="common:labelSync.customization"
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
