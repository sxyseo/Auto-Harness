/**
 * ExternalClientCard - Card component displaying a single external CLI client
 *
 * Shows client information with edit and delete actions.
 * Follows the pattern of ProviderAccountCard.
 */

import { useTranslation } from 'react-i18next';
import { Edit, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { ExternalClientConfig } from '@shared/types/client-config';

interface ExternalClientCardProps {
  /** The client configuration to display */
  client: ExternalClientConfig;
  /** Callback when edit button is clicked */
  onEdit: () => void;
  /** Callback when delete button is clicked */
  onDelete: () => void;
}

/**
 * ExternalClientCard component
 *
 * Displays client name, type, executable path, and capabilities.
 * Provides quick access to edit and delete actions.
 */
export function ExternalClientCard({ client, onEdit, onDelete }: ExternalClientCardProps) {
  const { t } = useTranslation('settings');

  // Get CLI type display name
  const getTypeLabel = () => {
    switch (client.type) {
      case 'codex':
        return t('multiClient.externalClients.types.codex');
      case 'claude-code':
        return t('multiClient.externalClients.types.claude-code');
      case 'custom':
        return t('multiClient.externalClients.types.custom');
      default:
        return client.type;
    }
  };

  // Get capabilities icons
  const getCapabilityBadges = () => {
    const badges = [];
    if (client.capabilities.supportsTools) {
      badges.push(<Badge key="tools" variant="secondary">Tools</Badge>);
    }
    if (client.capabilities.supportsThinking) {
      badges.push(<Badge key="thinking" variant="secondary">Thinking</Badge>);
    }
    if (client.capabilities.supportsStreaming) {
      badges.push(<Badge key="streaming" variant="secondary">Streaming</Badge>);
    }
    if (client.capabilities.supportsVision) {
      badges.push(<Badge key="vision" variant="secondary">Vision</Badge>);
    }
    return badges;
  };

  return (
    <div className="border rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors">
      {/* Header: Name and actions */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">{client.name}</h4>
            <Badge variant="outline">{getTypeLabel()}</Badge>
          </div>
          {client.description && (
            <p className="text-xs text-muted-foreground mt-1">{client.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onEdit}
            aria-label={t('multiClient.clientCard.edit')}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            aria-label={t('multiClient.clientCard.delete')}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Executable path */}
      <div className="text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <code className="text-xs bg-muted px-2 py-1 rounded">{client.executable}</code>
          {client.args && client.args.length > 0 && (
            <code className="text-xs bg-muted px-2 py-1 rounded">
              {client.args.join(' ')}
            </code>
          )}
        </div>
      </div>

      {/* Capabilities */}
      {getCapabilityBadges().length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {getCapabilityBadges()}
        </div>
      )}
    </div>
  );
}
