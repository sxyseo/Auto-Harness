/**
 * External API Settings Component
 *
 * Allows users to configure external API access for tools like OpenCLaw.
 * Provides security controls and monitoring capabilities.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsSection } from './SettingsSection';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Loader2, Server, Key, Shield, AlertTriangle } from 'lucide-react';
import { useSettingsStore } from '../../stores/settings-store';
import { useToast } from '../../hooks/use-toast';
import type { ExternalApiConfig } from '@shared/types/external-api';

const DEFAULT_CONFIG: ExternalApiConfig = {
  enabled: false,
  port: 3456,
  apiKey: '',
  allowedOrigins: '*',
  rateLimit: 100,
  allowWrite: true,
  allowDangerousOps: false,
};

export function ExternalApiSettings() {
  const { t } = useTranslation('settings');
  const { settings, updateSettings } = useSettingsStore();
  const { toast } = useToast();

  const [config, setConfig] = useState<ExternalApiConfig>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load configuration from settings
  useEffect(() => {
    if (settings.externalApiConfig) {
      setConfig(settings.externalApiConfig as ExternalApiConfig);
    }
  }, [settings.externalApiConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings({ externalApiConfig: config });
      toast({
        title: 'External API configuration saved',
        description: 'Restart the app to apply changes.',
      });
    } catch (error) {
      toast({
        title: 'Failed to save configuration',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // Test connection to the API server
      const response = await fetch(`http://localhost:${config.port}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey && { 'X-API-Key': config.apiKey }),
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult({
          success: true,
          message: `Connected successfully (API v${data.version})`,
        });
      } else {
        setTestResult({
          success: false,
          message: `Connection failed: ${response.status}`,
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Cannot connect to API server. Make sure it is running.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const generateApiKey = () => {
    const key = 'ak-' + Math.random().toString(36).substring(2, 15) +
                 Math.random().toString(36).substring(2, 15);
    setConfig({ ...config, apiKey: key });
  };

  return (
    <SettingsSection
      title={t('externalApi.title')}
      description={t('externalApi.description')}
    >
      <div className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">{t('externalApi.enable.label')}</h4>
            <p className="text-sm text-muted-foreground">{t('externalApi.enable.description')}</p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
          />
        </div>

        {/* Security Warning */}
        {config.enabled && (
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-yellow-500/50">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-yellow-600 dark:text-yellow-500">
                {t('externalApi.warning.title')}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {t('externalApi.warning.description')}
              </p>
            </div>
          </div>
        )}

        {/* Server Configuration */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Server className="h-4 w-4" />
            {t('externalApi.server.title')}
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="api-port">{t('externalApi.server.port')}</Label>
              <Input
                id="api-port"
                type="number"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 3456 })}
                min="1024"
                max="65535"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rate-limit">{t('externalApi.server.rateLimit')}</Label>
              <Input
                id="rate-limit"
                type="number"
                value={config.rateLimit}
                onChange={(e) => setConfig({ ...config, rateLimit: parseInt(e.target.value) || 100 })}
                min="1"
                max="1000"
              />
              <p className="text-xs text-muted-foreground">{t('externalApi.server.rateLimitDescription')}</p>
            </div>
          </div>
        </div>

        {/* Authentication */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Key className="h-4 w-4" />
            {t('externalApi.auth.title')}
          </h4>

          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder={t('externalApi.auth.apiKeyPlaceholder')}
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                type="password"
              />
              <Button
                type="button"
                variant="outline"
                onClick={generateApiKey}
              >
                {t('externalApi.auth.generate')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('externalApi.auth.apiKeyDescription')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="allowed-origins">{t('externalApi.auth.allowedOrigins')}</Label>
            <Input
              id="allowed-origins"
              placeholder="* or https://example.com"
              value={config.allowedOrigins}
              onChange={(e) => setConfig({ ...config, allowedOrigins: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {t('externalApi.auth.allowedOriginsDescription')}
            </p>
          </div>
        </div>

        {/* Permissions */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t('externalApi.permissions.title')}
          </h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="allow-write">{t('externalApi.permissions.allowWrite.label')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('externalApi.permissions.allowWrite.description')}
                </p>
              </div>
              <Switch
                id="allow-write"
                checked={config.allowWrite}
                onCheckedChange={(checked) => setConfig({ ...config, allowWrite: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="allow-dangerous" className="text-destructive">
                  {t('externalApi.permissions.allowDangerousOps.label')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('externalApi.permissions.allowDangerousOps.description')}
                </p>
              </div>
              <Switch
                id="allow-dangerous"
                checked={config.allowDangerousOps}
                onCheckedChange={(checked) => setConfig({ ...config, allowDangerousOps: checked })}
              />
            </div>
          </div>
        </div>

        {/* Test Connection */}
        {config.enabled && (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting}
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('externalApi.testing')}
                </>
              ) : (
                t('externalApi.testConnection')
            )}
            </Button>

            {testResult && (
              <div className={`flex items-center gap-2 text-sm ${
                testResult.success ? 'text-green-600' : 'text-red-600'
              }`}>
                {testResult.success ? (
                  <Badge variant="default" className="bg-green-600">Connected</Badge>
                ) : (
                  <Badge variant="destructive">Failed</Badge>
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('externalApi.saving')}
              </>
            ) : (
              t('externalApi.save')
            )}
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}
