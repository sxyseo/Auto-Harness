/**
 * ExternalClientList - List component for external CLI clients
 *
 * Displays all configured external CLI clients with add button.
 * Follows the pattern of ProfileList and ProviderAccountsList.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { ExternalClientCard } from './ExternalClientCard';
import { ExternalClientDialog } from './ExternalClientDialog';
import { useSettingsStore } from '../../stores/settings-store';
import type { ExternalClientConfig } from '@shared/types/client-config';

interface ExternalClientListProps {
  /** Optional callback when a client is modified */
  onClientModified?: () => void;
}

/**
 * ExternalClientList component
 *
 * Displays list of external CLI clients with add/edit/delete functionality.
 * Shows empty state when no clients are configured.
 */
export function ExternalClientList({ onClientModified }: ExternalClientListProps) {
  const { t } = useTranslation('settings');
  const { externalCliClients, deleteExternalClient } = useSettingsStore();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ExternalClientConfig | undefined>();

  /**
   * Handle add button click
   */
  const handleAdd = () => {
    setEditingClient(undefined);
    setDialogOpen(true);
  };

  /**
   * Handle edit button click
   */
  const handleEdit = (client: ExternalClientConfig) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  /**
   * Handle delete button click
   */
  const handleDelete = async (id: string) => {
    const client = externalCliClients.find((c) => c.id === id);
    if (!client) return;

    // TODO: Show confirmation dialog with in-use warning
    const success = await deleteExternalClient(id);
    if (success) {
      onClientModified?.();
    }
  };

  /**
   * Handle dialog close
   */
  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingClient(undefined);
  };

  /**
   * Handle client saved
   */
  const handleClientSaved = () => {
    setDialogOpen(false);
    setEditingClient(undefined);
    onClientModified?.();
  };

  return (
    <div className="space-y-4">
      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-foreground">
            {t('multiClient.externalClients.title')}
          </h4>
          <p className="text-xs text-muted-foreground">
            {t('multiClient.externalClients.description')}
          </p>
        </div>
        <Button type="button" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          {t('multiClient.externalClients.addButton')}
        </Button>
      </div>

      {/* Client list or empty state */}
      {externalCliClients.length === 0 ? (
        <div className="border border-dashed rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t('multiClient.externalClients.empty')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t('multiClient.externalClients.emptyDescription')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {externalCliClients.map((client) => (
            <ExternalClientCard
              key={client.id}
              client={client}
              onEdit={() => handleEdit(client)}
              onDelete={() => handleDelete(client.id)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <ExternalClientDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        client={editingClient}
        onSaved={handleClientSaved}
      />
    </div>
  );
}
