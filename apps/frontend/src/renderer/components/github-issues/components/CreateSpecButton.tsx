import { useState } from 'react';

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
        setError('Failed to create spec');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create spec');
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
            ? 'An agent is already working on this issue'
            : undefined
        }
        onClick={() => {
          setShowConfirm(true);
          setResult(null);
          setError(null);
        }}
      >
        Create Spec
      </button>

      {/* Tooltip for disabled state */}
      {hasActiveAgent && (
        <p className="text-xs text-muted-foreground">
          An agent is already working on this issue
        </p>
      )}

      {/* Confirmation panel */}
      {showConfirm && (
        <div className="rounded-md border border-border bg-card p-3 space-y-2">
          <p className="text-sm">
            Create a spec from issue #{issueNumber}?
          </p>

          {issueClosed && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              This issue is closed. The spec may not be actionable.
            </p>
          )}

          {!hasEnrichment && (
            <p className="text-xs text-muted-foreground">
              Enrichment data will improve spec quality
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-2.5 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              onClick={handleConfirm}
              disabled={creating}
            >
              {creating ? 'Creating...' : 'Confirm'}
            </button>
            <button
              type="button"
              className="px-2.5 py-1 text-xs rounded-md border border-border bg-card hover:bg-accent"
              onClick={() => setShowConfirm(false)}
              disabled={creating}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Success notification */}
      {result && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">
          Spec {result.specNumber} created
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
