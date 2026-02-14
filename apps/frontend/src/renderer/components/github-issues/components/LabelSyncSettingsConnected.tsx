/**
 * Connected wrapper for LabelSyncSettings that calls useLabelSync hook.
 * Used in SectionRouter where hooks can't be called conditionally.
 */

import { useEffect, useRef, useCallback } from 'react';
import { LabelSyncSettings } from './LabelSyncSettings';
import { useLabelSync } from '../hooks/useLabelSync';
import type { WorkflowLabelCustomization } from '@shared/types/label-sync';

export function LabelSyncSettingsConnected() {
  const { config, isSyncing, error, loadStatus, enableSync, disableSync, saveConfig } = useLabelSync();
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadStatus();
    }
  }, [loadStatus]);

  const handleCustomizationChange = useCallback(
    (customization: WorkflowLabelCustomization | undefined) => {
      saveConfig({ ...config, customization });
    },
    [config, saveConfig],
  );

  return (
    <LabelSyncSettings
      enabled={config.enabled}
      isSyncing={isSyncing}
      lastSyncedAt={config.lastSyncedAt}
      error={error}
      customization={config.customization}
      onEnable={enableSync}
      onDisable={disableSync}
      onCustomizationChange={handleCustomizationChange}
    />
  );
}
