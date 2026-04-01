/**
 * MultiClientSettings - Main settings section for multi-client orchestration
 *
 * Container component that orchestrates all multi-client configuration UI.
 * Follows the pattern of AgentProfileSettings and other settings sections.
 */

import { useTranslation } from 'react-i18next';
import { SettingsSection } from './SettingsSection';
import { MultiClientToggle } from './MultiClientToggle';
import { ExternalClientList } from './ExternalClientList';
import { PhaseClientMapping } from './PhaseClientMapping';
import { useSettingsStore } from '../../stores/settings-store';
import { Separator } from '../ui/separator';

/**
 * MultiClientSettings component
 *
 * Main container for multi-client configuration.
 * Conditionally displays configuration options based on toggle state.
 */
export function MultiClientSettings() {
  const { t } = useTranslation('settings');
  const {
    multiClientEnabled,
    phaseClientMapping,
    setMultiClientEnabled,
    setPhaseClientMapping,
  } = useSettingsStore();

  /**
   * Handle phase client mapping change
   */
  const handleMappingChange = (phase: keyof typeof phaseClientMapping, clientRef: any) => {
    const newMapping = { ...phaseClientMapping, [phase]: clientRef };
    setPhaseClientMapping(newMapping);
  };

  /**
   * Handle client modification (refreshes phase mapping)
   */
  const handleClientModified = () => {
    // Phase mapping will auto-refresh from store
  };

  return (
    <SettingsSection
      title={t('sections.multiClient.title')}
      description={t('sections.multiClient.description')}
    >
      <div className="space-y-6">
        {/* Multi-client toggle */}
        <MultiClientToggle
          enabled={multiClientEnabled}
          onEnabledChange={setMultiClientEnabled}
        />

        {/* Configuration options (shown when enabled) */}
        {multiClientEnabled && (
          <>
            <Separator />

            {/* External CLI clients section */}
            <ExternalClientList onClientModified={handleClientModified} />

            <Separator />

            {/* Phase-to-client mapping section */}
            <PhaseClientMapping
              mapping={phaseClientMapping}
              onMappingChange={handleMappingChange}
            />
          </>
        )}
      </div>
    </SettingsSection>
  );
}
