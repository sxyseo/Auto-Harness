import { useState } from 'react';
import { Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import type { BulkOperationResult } from '@shared/types/mutations';

interface BulkResultsPanelProps {
  result: BulkOperationResult;
  onRetry: (result: BulkOperationResult) => void;
  onDismiss: () => void;
}

export function BulkResultsPanel({
  result,
  onRetry,
  onDismiss,
}: BulkResultsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      aria-label="Bulk operation results"
      className="rounded-md border border-border bg-card p-3 space-y-2"
    >
      {/* Summary */}
      <div className="flex items-center gap-3 text-sm">
        <span className="text-emerald-600 dark:text-emerald-400">
          {result.succeeded} succeeded
        </span>
        <span className="text-destructive">
          {result.failed} failed
        </span>
      </div>

      {/* Collapsible details */}
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        Details
      </button>

      {expanded && (
        <ul className="space-y-1">
          {result.results.map((item) => (
            <li
              key={item.issueNumber}
              className="flex items-center gap-2 text-xs"
            >
              {item.status === 'success' ? (
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-label="Success" />
              ) : (
                <X className="h-3.5 w-3.5 text-destructive" aria-label="Failed" />
              )}
              <span>#{item.issueNumber}</span>
              {item.error && (
                <span className="text-destructive">{item.error}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {result.failed > 0 && (
          <button
            type="button"
            className="px-2.5 py-1 text-xs rounded-md border border-border bg-card hover:bg-accent"
            onClick={() => onRetry(result)}
          >
            Retry {result.failed} failed
          </button>
        )}
        <button
          type="button"
          className="px-2.5 py-1 text-xs rounded-md border border-border bg-card hover:bg-accent"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </section>
  );
}
