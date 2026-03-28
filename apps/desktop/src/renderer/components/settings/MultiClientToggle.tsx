/**
 * MultiClientToggle - Toggle switch for enabling multi-client mode
 *
 * Simple toggle component that enables/disables multi-client orchestration.
 * When enabled, reveals additional configuration options for external CLI clients
 * and phase-to-client mappings.
 */

import { useTranslation } from 'react-i18next';
import { Switch } from '../ui/switch';

interface MultiClientToggleProps {
  /** Whether multi-client mode is currently enabled */
  enabled: boolean;
  /** Callback when toggle state changes */
  onEnabledChange: (enabled: boolean) => Promise<boolean>;
}

/**
 * MultiClientToggle component
 *
 * Follows existing switch component patterns in the settings UI.
 * Provides clear description of what multi-client mode does.
 */
export function MultiClientToggle({ enabled, onEnabledChange }: MultiClientToggleProps) {
  const { t } = useTranslation('settings');

  return (
    <div className="flex items-center justify-between py-4">
      <div className="space-y-1">
        <h4 className="text-sm font-medium text-foreground">
          {t('multiClient.toggle.label')}
        </h4>
        <p className="text-sm text-muted-foreground">
          {t('multiClient.toggle.description')}
        </p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onEnabledChange}
        aria-label={t('multiClient.toggle.label')}
      />
    </div>
  );
}
