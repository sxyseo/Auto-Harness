import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CreateSpecButtonProps {
  issueNumber: number;
  issueClosed: boolean;
  hasActiveAgent: boolean;
  activeSpecNumber?: string;
  hasEnrichment: boolean;
  onCreateSpec: () => Promise<{ specNumber: string } | null>;
}

export function CreateSpecButton({
  issueNumber,
  issueClosed,
  hasActiveAgent,
  activeSpecNumber: _activeSpecNumber,
  hasEnrichment,
  onCreateSpec,
}: CreateSpecButtonProps) {
  const { t } = useTranslation('common');
  const [showConfirm, setShowConfirm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ specNumber: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setCreating(true);
    setError(null);
    try {
      const res = await onCreateSpec();
      if (res) {
        setResult(res);
        setShowConfirm(false);
      } else {
        setError(t('spec.createFailed'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('spec.createFailed'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <section aria-label="Create spec from issue" className="space-y-2">
      {/* Main button */}
      <button
        type="button"
        className="px-3 py-1.5 text-sm rounded-md border border-border bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={hasActiveAgent}
        title={
          hasActiveAgent
            ? t('spec.agentActive')
            : undefined
        }
        onClick={() => {
          setShowConfirm(true);
          setResult(null);
          setError(null);
        }}
      >
        {t('spec.createFromIssue')}
      </button>

      {/* Tooltip for disabled state */}
      {hasActiveAgent && (
        <p className="text-xs text-muted-foreground">
          {t('spec.agentActive')}
        </p>
      )}

      {/* Confirmation panel */}
      {showConfirm && (
        <div className="rounded-md border border-border bg-card p-3 space-y-2">
          <p className="text-sm">
            {t('spec.confirm', { number: issueNumber })}
          </p>

          {issueClosed && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('spec.closedWarning')}
            </p>
          )}

          {!hasEnrichment && (
            <p className="text-xs text-muted-foreground">
              {t('spec.noEnrichmentTip')}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-2.5 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              onClick={handleConfirm}
              disabled={creating}
            >
              {creating ? t('labels.creating') : t('buttons.confirm')}
            </button>
            <button
              type="button"
              className="px-2.5 py-1 text-xs rounded-md border border-border bg-card hover:bg-accent"
              onClick={() => setShowConfirm(false)}
              disabled={creating}
            >
              {t('buttons.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Success notification */}
      {result && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          {t('spec.created', { specNumber: result.specNumber })}
        </p>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
