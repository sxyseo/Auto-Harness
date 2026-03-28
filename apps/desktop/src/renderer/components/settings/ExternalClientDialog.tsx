/**
 * ExternalClientDialog - Dialog for adding/editing external CLI clients
 *
 * Allows users to configure external CLI tools (like CodeX, custom CLIs)
 * for use in the multi-client orchestration system.
 *
 * Features:
 * - Add or edit external CLI clients
 * - Configure CLI type, executable path, arguments, and environment variables
 * - Set client capabilities (tools, thinking, streaming, vision)
 * - Form validation with error display
 * - Executable path validation
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Loader2, AlertCircle, CheckCircle2, FolderOpen } from 'lucide-react';
import { useSettingsStore } from '../../stores/settings-store';
import { useToast } from '../../hooks/use-toast';
import type { ExternalClientConfig } from '@shared/types/client-config';

interface ExternalClientDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Client being edited (undefined = create mode) */
  client?: ExternalClientConfig;
  /** Optional callback when client is successfully saved */
  onSaved?: () => void;
}

/**
 * ExternalClientDialog component
 *
 * Complex form dialog following the pattern of ProfileEditDialog.
 * Supports both create and edit modes with pre-populated data.
 */
export function ExternalClientDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: ExternalClientDialogProps) {
  const { t } = useTranslation('settings');
  const { addExternalClient, updateExternalClient, externalCliClients } = useSettingsStore();
  const { toast } = useToast();

  // Edit mode detection
  const isEditMode = !!client;

  // Form state
  const [name, setName] = useState('');
  const [cliType, setCliType] = useState<'codex' | 'claude-code' | 'custom'>('custom');
  const [executable, setExecutable] = useState('');
  const [args, setArgs] = useState('');
  const [envVars, setEnvVars] = useState('');
  const [description, setDescription] = useState('');

  // Capabilities state
  const [supportsTools, setSupportsTools] = useState(true);
  const [supportsThinking, setSupportsThinking] = useState(false);
  const [supportsStreaming, setSupportsStreaming] = useState(true);
  const [supportsVision, setSupportsVision] = useState(false);
  const [maxTokens, setMaxTokens] = useState<number | undefined>(undefined);

  // Validation state
  const [nameError, setNameError] = useState<string | null>(null);
  const [executableError, setExecutableError] = useState<string | null>(null);
  const [isValidatingPath, setIsValidatingPath] = useState(false);
  const [pathValid, setPathValid] = useState<boolean | null>(null);

  // Loading state
  const [isSaving, setIsSaving] = useState(false);

  // Reset form on open/close
  useEffect(() => {
    if (open) {
      if (client) {
        // Edit mode: pre-populate form
        setName(client.name);
        setCliType(client.type);
        setExecutable(client.executable);
        setArgs(client.args?.join(' ') || '');
        setEnvVars(
          client.env
            ? Object.entries(client.env)
                .map(([k, v]) => `${k}=${v}`)
                .join(' ')
            : ''
        );
        setDescription(client.description || '');
        setSupportsTools(client.capabilities.supportsTools);
        setSupportsThinking(client.capabilities.supportsThinking);
        setSupportsStreaming(client.capabilities.supportsStreaming);
        setSupportsVision(client.capabilities.supportsVision);
        setMaxTokens(client.capabilities.maxTokens);
      } else {
        // Create mode: reset form
        setName('');
        setCliType('custom');
        setExecutable('');
        setArgs('');
        setEnvVars('');
        setDescription('');
        setSupportsTools(true);
        setSupportsThinking(false);
        setSupportsStreaming(true);
        setSupportsVision(false);
        setMaxTokens(undefined);
      }
      // Clear validation errors
      setNameError(null);
      setExecutableError(null);
      setPathValid(null);
    }
  }, [open, client]);

  // Validate executable path (debounced)
  useEffect(() => {
    if (!executable) {
      setPathValid(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsValidatingPath(true);
      try {
        const result = await window.electronAPI.validateExecutablePath(executable);
        if (result.success && result.data) {
          setPathValid(result.data.valid);
          if (!result.data.valid) {
            setExecutableError(result.data.error || null);
          }
        } else {
          setPathValid(false);
        }
      } catch {
        setPathValid(false);
      } finally {
        setIsValidatingPath(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [executable]);

  // Validate name uniqueness
  useEffect(() => {
    if (!name) {
      setNameError(null);
      return;
    }

    const isDuplicate = externalCliClients.some(
      (c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== client?.id
    );

    if (isDuplicate) {
      setNameError(t('multiClient.dialog.validation.duplicateName'));
    } else {
      setNameError(null);
    }
  }, [name, client, externalCliClients, t]);

  /**
   * Handle form submission
   */
  const handleSave = async () => {
    // Validate required fields
    let hasError = false;

    if (!name.trim()) {
      setNameError(t('multiClient.dialog.validation.nameRequired'));
      hasError = true;
    }

    if (!executable.trim()) {
      setExecutableError(t('multiClient.dialog.validation.executableRequired'));
      hasError = true;
    }

    if (hasError) return;

    // Parse arguments and env vars
    const argsArray = args.trim() ? args.trim().split(/\s+/) : undefined;
    const envObj: Record<string, string> | undefined = envVars.trim()
      ? envVars
          .trim()
          .split(/\s+/)
          .reduce((acc, pair) => {
            const [key, ...valueParts] = pair.split('=');
            if (key) {
              acc[key] = valueParts.join('=') || '';
            }
            return acc;
          }, {} as Record<string, string>)
      : undefined;

    const clientData: Omit<ExternalClientConfig, 'id'> = {
      name: name.trim(),
      type: cliType,
      executable: executable.trim(),
      args: argsArray,
      env: envObj,
      description: description.trim() || undefined,
      capabilities: {
        supportsTools,
        supportsThinking,
        supportsStreaming,
        supportsVision,
        maxTokens,
      },
    };

    setIsSaving(true);

    try {
      const success = isEditMode
        ? await updateExternalClient(client!.id, clientData)
        : await addExternalClient(clientData);

      if (success) {
        toast({
          title: isEditMode
            ? t('multiClient.dialog.toast.updated')
            : t('multiClient.dialog.toast.created'),
        });
        onOpenChange(false);
        onSaved?.();
      } else {
        toast({
          title: t('multiClient.dialog.toast.error'),
          variant: 'destructive',
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle browse button click
   */
  const handleBrowse = async () => {
    try {
      const result = await window.electronAPI.selectExecutableFile();
      if (result.success && result.data) {
        setExecutable(result.data);
      }
    } catch {
      // User cancelled or error
      // Ignore
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode
              ? t('multiClient.dialog.editTitle')
              : t('multiClient.dialog.addTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('multiClient.dialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Name field */}
          <div className="space-y-2">
            <Label htmlFor="name">{t('multiClient.dialog.fields.name')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('multiClient.dialog.fields.namePlaceholder')}
            />
            {nameError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {nameError}
              </p>
            )}
          </div>

          {/* CLI Type field */}
          <div className="space-y-2">
            <Label htmlFor="type">{t('multiClient.dialog.fields.type')}</Label>
            <Select value={cliType} onValueChange={(v: any) => setCliType(v)}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="codex">
                  {t('multiClient.externalClients.types.codex')}
                </SelectItem>
                <SelectItem value="claude-code">
                  {t('multiClient.externalClients.types.claude-code')}
                </SelectItem>
                <SelectItem value="custom">
                  {t('multiClient.externalClients.types.custom')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Executable field */}
          <div className="space-y-2">
            <Label htmlFor="executable">{t('multiClient.dialog.fields.executable')}</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  id="executable"
                  value={executable}
                  onChange={(e) => setExecutable(e.target.value)}
                  placeholder={t('multiClient.dialog.fields.executablePlaceholder')}
                  className={executableError ? 'border-destructive' : ''}
                />
              </div>
              <Button type="button" variant="outline" onClick={handleBrowse}>
                <FolderOpen className="h-4 w-4 mr-2" />
                {t('multiClient.dialog.actions.browse')}
              </Button>
            </div>

            {/* Validation feedback */}
            {executable && (
              <div className="flex items-center gap-2 text-sm">
                {isValidatingPath ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : pathValid === true ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : pathValid === false ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : null}
                {pathValid === true && (
                  <span className="text-green-600 dark:text-green-400">
                    {t('multiClient.clientCard.valid')}
                  </span>
                )}
                {pathValid === false && (
                  <span className="text-destructive">
                    {t('multiClient.dialog.validation.executableNotFound')}
                  </span>
                )}
              </div>
            )}

            {executableError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {executableError}
              </p>
            )}
          </div>

          {/* Arguments field */}
          <div className="space-y-2">
            <Label htmlFor="args">{t('multiClient.dialog.fields.args')}</Label>
            <Input
              id="args"
              value={args}
              onChange={(e) => setArgs(e.target.value)}
              placeholder={t('multiClient.dialog.fields.argsPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">
              Space-separated arguments (e.g., --arg1 --arg2)
            </p>
          </div>

          {/* Environment Variables field */}
          <div className="space-y-2">
            <Label htmlFor="envVars">{t('multiClient.dialog.fields.envVars')}</Label>
            <Input
              id="envVars"
              value={envVars}
              onChange={(e) => setEnvVars(e.target.value)}
              placeholder="KEY=value KEY2=value2"
            />
            <p className="text-xs text-muted-foreground">
              Space-separated key=value pairs
            </p>
          </div>

          {/* Description field */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('multiClient.dialog.fields.description')}</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('multiClient.dialog.fields.descriptionPlaceholder')}
            />
          </div>

          {/* Capabilities section */}
          <div className="space-y-3">
            <Label className="text-base">{t('multiClient.dialog.capabilities.title')}</Label>

            <div className="space-y-3">
              {/* Supports Tools */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="supportsTools"
                  checked={supportsTools}
                  onCheckedChange={(c) => setSupportsTools(!!c)}
                />
                <Label htmlFor="supportsTools" className="cursor-pointer">
                  {t('multiClient.dialog.capabilities.supportsTools')}
                </Label>
              </div>

              {/* Supports Thinking */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="supportsThinking"
                  checked={supportsThinking}
                  onCheckedChange={(c) => setSupportsThinking(!!c)}
                />
                <Label htmlFor="supportsThinking" className="cursor-pointer">
                  {t('multiClient.dialog.capabilities.supportsThinking')}
                </Label>
              </div>

              {/* Supports Streaming */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="supportsStreaming"
                  checked={supportsStreaming}
                  onCheckedChange={(c) => setSupportsStreaming(!!c)}
                />
                <Label htmlFor="supportsStreaming" className="cursor-pointer">
                  {t('multiClient.dialog.capabilities.supportsStreaming')}
                </Label>
              </div>

              {/* Supports Vision */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="supportsVision"
                  checked={supportsVision}
                  onCheckedChange={(c) => setSupportsVision(!!c)}
                />
                <Label htmlFor="supportsVision" className="cursor-pointer">
                  {t('multiClient.dialog.capabilities.supportsVision')}
                </Label>
              </div>

              {/* Max Tokens */}
              <div className="space-y-1">
                <Label htmlFor="maxTokens">{t('multiClient.dialog.capabilities.maxTokens')}</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  value={maxTokens || ''}
                  onChange={(e) => setMaxTokens(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="128000"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('multiClient.dialog.actions.cancel')}
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || !!nameError || !!executableError}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('multiClient.dialog.actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
