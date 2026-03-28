/**
 * ClientSelector - Unified selector for choosing between providers and external CLIs
 *
 * Allows selection of either a provider account (with model) or an external CLI client.
 * Used in phase-to-client mapping configuration.
 */

import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useSettingsStore } from '../../stores/settings-store';
import type { ClientReference } from '@shared/types/client-config';

interface ClientSelectorProps {
  /** Currently selected client reference */
  value: ClientReference;
  /** Callback when selection changes */
  onChange: (clientRef: ClientReference) => void;
  /** Optional phase name for display context */
  phase?: string;
}

/**
 * ClientSelector component
 *
 * Displays provider accounts grouped by provider and external CLI clients.
 * Simplified version following the pattern of MultiProviderModelSelect.
 */
export function ClientSelector({ value, onChange, phase }: ClientSelectorProps) {
  const { t } = useTranslation('settings');
  const { providerAccounts } = useSettingsStore();

  // Group provider accounts by provider
  const groupedProviders = providerAccounts.reduce((acc, account) => {
    if (!acc[account.provider]) {
      acc[account.provider] = [];
    }
    acc[account.provider].push(account);
    return acc;
  }, {} as Record<string, typeof providerAccounts>);

  /**
   * Get display label for a client reference
   */
  const getClientLabel = (clientRef: ClientReference): string => {
    if (clientRef.type === 'cli') {
      // TODO: Look up CLI client name
      return `CLI: ${clientRef.cliId}`;
    }
    return `${clientRef.provider} - ${clientRef.modelId}`;
  };

  /**
   * Get display value for a client reference
   */
  const getClientValue = (clientRef: ClientReference): string => {
    if (clientRef.type === 'cli') {
      return `cli:${clientRef.cliId}`;
    }
    return `provider:${clientRef.provider}:${clientRef.modelId}`;
  };

  /**
   * Parse client value back to ClientReference
   */
  const parseClientValue = (valueStr: string): ClientReference => {
    if (valueStr.startsWith('cli:')) {
      const cliId = valueStr.substring(4);
      return { type: 'cli', cliId };
    }
    // provider:anthropic:sonnet
    const [, provider, modelId] = valueStr.split(':');
    return { type: 'provider', provider: provider as any, modelId };
  };

  return (
    <Select
      value={getClientValue(value)}
      onValueChange={(val) => onChange(parseClientValue(val))}
    >
      <SelectTrigger>
        <SelectValue placeholder={t('multiClient.phaseMapping.clientSelector.placeholder')} />
      </SelectTrigger>
      <SelectContent>
        {/* Provider section */}
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          {t('multiClient.phaseMapping.clientSelector.providerSection')}
        </div>

        {Object.keys(groupedProviders).length === 0 ? (
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            {t('multiClient.phaseMapping.clientSelector.noProviders')}
          </div>
        ) : (
          Object.entries(groupedProviders).map(([provider, accounts]) => (
            <div key={provider}>
              {accounts.map((account) => (
                <SelectItem
                  key={`${account.id}-sonnet`}
                  value={`provider:${provider}:sonnet`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{provider}</span>
                    <span className="text-muted-foreground">Sonnet</span>
                  </div>
                </SelectItem>
              ))}
            </div>
          ))
        )}

        {/* External CLI section */}
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
          {t('multiClient.phaseMapping.clientSelector.cliSection')}
        </div>

        {/* TODO: Add external CLI clients */}
        <div className="px-2 py-4 text-sm text-muted-foreground text-center">
          External CLI clients will appear here
        </div>
      </SelectContent>
    </Select>
  );
}
