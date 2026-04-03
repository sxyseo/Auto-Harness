import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wrench,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Code2,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { PRReviewFinding } from '../../../preload/api/modules/github-api';
import type { FixTrackingState } from '../../stores/github/pr-review-store';
import { cn } from '../../lib/utils';

interface PRAutoFixDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onOpenChange: (open: boolean) => void;
  /** The finding to display/fix */
  finding: PRReviewFinding;
  /** The fix tracking state for this finding (if any) */
  fixState?: FixTrackingState;
  /** Current fix progress (if a fix is being applied) */
  fixProgress?: { phase: string; progress: number; message: string } | null;
  /** Whether a fix is currently being applied */
  isApplying?: boolean;
  /** Project ID for the PR */
  projectId: string;
  /** PR number */
  prNumber: number;
  /** Callback when fix is applied */
  onApplyFix: (findingId: string, suggestedFix: string) => void;
  /** Callback when fix is rejected */
  onRejectFix: (findingId: string, reason?: string) => void;
}

/**
 * Severity colors for badges
 */
const SEVERITY_COLORS = {
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
  high: 'bg-warning/10 text-warning border-warning/20',
  medium: 'bg-info/10 text-info border-info/20',
  low: 'bg-muted text-muted-foreground border-muted',
} as const;

/**
 * Category labels
 */
const CATEGORY_LABELS: Record<PRReviewFinding['category'], string> = {
  security: 'Security',
  quality: 'Quality',
  style: 'Style',
  test: 'Test',
  docs: 'Documentation',
  pattern: 'Pattern',
  performance: 'Performance',
};

/**
 * PRAutoFixDialog displays a single finding with suggested fix and allows
 * users to apply or reject the fix.
 */
export function PRAutoFixDialog({
  open,
  onOpenChange,
  finding,
  fixState,
  fixProgress,
  isApplying = false,
  projectId,
  prNumber,
  onApplyFix,
  onRejectFix
}: PRAutoFixDialogProps) {
  const { t } = useTranslation('common');
  const [showDiff, setShowDiff] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  /** Current status of the fix */
  const fixStatus = fixState?.status ?? 'pending';

  /** Whether the fix has been applied */
  const isApplied = fixStatus === 'applied';

  /** Whether the fix was rejected */
  const isRejected = fixStatus === 'rejected';

  /** Whether the fix failed */
  const isFailed = fixStatus === 'failed';

  /** Check if user can take action on this fix */
  const canTakeAction = !isApplying && !isApplied && !isRejected && fixStatus === 'pending';

  /** Handle apply fix */
  const handleApply = useCallback(() => {
    if (!finding.suggestedFix) return;
    onApplyFix(finding.id, finding.suggestedFix);
  }, [finding.id, finding.suggestedFix, onApplyFix]);

  /** Handle reject fix */
  const handleReject = useCallback(() => {
    onRejectFix(finding.id, rejectionReason || undefined);
    setRejectionReason('');
  }, [finding.id, rejectionReason, onRejectFix]);

  /** Handle dialog close */
  const handleClose = useCallback(() => {
    if (!isApplying) {
      onOpenChange(false);
    }
  }, [isApplying, onOpenChange]);

  /** Get progress percentage for display */
  const progressPercent = useMemo(() => {
    if (fixProgress?.progress !== undefined) {
      return Math.round(fixProgress.progress);
    }
    if (isApplying) {
      return 50; // Indeterminate state when applying
    }
    return 0;
  }, [fixProgress?.progress, isApplying]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary shrink-0" />
                <span className="truncate">{finding.title}</span>
              </DialogTitle>
              <DialogDescription className="mt-1.5 line-clamp-2">
                {finding.description}
              </DialogDescription>
            </div>
          </div>

          {/* Finding metadata badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn('text-xs', SEVERITY_COLORS[finding.severity])}
            >
              {finding.severity.charAt(0).toUpperCase() + finding.severity.slice(1)}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {CATEGORY_LABELS[finding.category]}
            </Badge>
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span className="truncate max-w-[200px]">{finding.file}</span>
              <span className="text-muted-foreground">:{finding.line}</span>
            </Badge>
          </div>
        </DialogHeader>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          {/* Status messages */}
          {(isApplied || isRejected || isFailed) && (
            <div
              className={cn(
                'flex items-start gap-3 p-4 rounded-lg border',
                isApplied && 'bg-success/5 border-success/20',
                isRejected && 'bg-muted border-muted',
                isFailed && 'bg-destructive/5 border-destructive/20'
              )}
            >
              {isApplied && (
                <>
                  <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-success">
                      {t('prReview.fix.applied', 'Fix Applied')}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {fixState?.appliedAt && (
                        <span>
                          {t('prReview.fix.appliedAt', 'Applied at')}{' '}
                          {new Date(fixState.appliedAt).toLocaleString()}
                        </span>
                      )}
                    </p>
                  </div>
                </>
              )}
              {isRejected && (
                <>
                  <X className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">
                      {t('prReview.fix.rejected', 'Fix Rejected')}
                    </p>
                    {fixState?.errorMessage && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {fixState.errorMessage}
                      </p>
                    )}
                  </div>
                </>
              )}
              {isFailed && (
                <>
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      {t('prReview.fix.failed', 'Fix Failed')}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {fixState?.errorMessage ?? t('prReview.fix.failedMessage', 'An error occurred while applying the fix.')}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Progress indicator when applying */}
          {isApplying && fixProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{fixProgress.message}</span>
                <span className="text-muted-foreground font-medium">{progressPercent}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Suggested fix code */}
          {finding.suggestedFix && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowDiff(!showDiff)}
                className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <Code2 className="h-4 w-4" />
                <span>{t('prReview.fix.suggestedFix', 'Suggested Fix')}</span>
                {showDiff ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showDiff && (
                <div className="relative">
                  <pre className="bg-muted/50 border border-border rounded-lg p-4 overflow-x-auto text-sm">
                    <code className="text-foreground font-mono whitespace-pre">
                      {finding.suggestedFix}
                    </code>
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Rejection reason input (shown before rejection) */}
          {!canTakeAction && !isRejected && !isApplied && !isFailed && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t('prReview.fix.reason', 'Reason (optional)')}
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={t('prReview.fix.reasonPlaceholder', 'Why are you rejecting this fix?')}
                className="w-full h-20 px-3 py-2 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {canTakeAction && (
            <>
              <Button
                variant="outline"
                onClick={() => handleReject()}
                disabled={isApplying}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                {t('prReview.fix.reject', 'Reject')}
              </Button>
              <Button
                variant="default"
                onClick={() => handleApply()}
                disabled={isApplying || !finding.suggestedFix}
                className="flex items-center gap-2"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('prReview.fix.applying', 'Applying...')}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {t('prReview.fix.apply', 'Apply Fix')}
                  </>
                )}
              </Button>
            </>
          )}

          {isApplying && (
            <Button
              variant="outline"
              onClick={() => {}}
              disabled
              className="flex items-center gap-2 ml-auto"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('prReview.fix.applyingProgress', 'Applying fix...')}
            </Button>
          )}

          {(isApplied || isRejected || isFailed) && (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="ml-auto"
            >
              {t('common:actions.close', 'Close')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Props for PRAutoFixBatchDialog
 */
interface PRAutoFixBatchDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onOpenChange: (open: boolean) => void;
  /** The finding to display/fix */
  finding: PRReviewFinding;
  /** All fixable findings for this PR */
  allFixableFindings: PRReviewFinding[];
  /** Fix tracking states keyed by finding ID */
  fixStates: Record<string, FixTrackingState>;
  /** Fix progress (if a fix is being applied) */
  fixProgress?: { findingId: string; phase: string; progress: number; message: string } | null;
  /** Current finding ID being applied (if any) */
  currentApplyingId?: string | null;
  /** Project ID for the PR */
  projectId: string;
  /** PR number */
  prNumber: number;
  /** Callback when fix is applied */
  onApplyFix: (findingId: string, suggestedFix: string) => void;
  /** Callback when fix is rejected */
  onRejectFix: (findingId: string, reason?: string) => void;
  /** Callback to apply all remaining fixes */
  onApplyAll: (findingIds: string[]) => void;
  /** Callback to reject all remaining fixes */
  onRejectAll: (findingIds: string[]) => void;
}

/**
 * PRAutoFixBatchDialog shows a batch of fixable findings with options to
 * apply or reject them individually or in bulk.
 */
export function PRAutoFixBatchDialog({
  open,
  onOpenChange,
  finding,
  allFixableFindings,
  fixStates,
  fixProgress,
  currentApplyingId,
  projectId,
  prNumber,
  onApplyFix,
  onRejectFix,
  onApplyAll,
  onRejectAll
}: PRAutoFixBatchDialogProps) {
  const { t } = useTranslation('common');

  /** Get pending findings that haven't been acted on */
  const pendingFindings = useMemo(() => {
    return allFixableFindings.filter(f => {
      const state = fixStates[f.id];
      return !state || state.status === 'pending';
    });
  }, [allFixableFindings, fixStates]);

  /** Get counts by status */
  const { appliedCount, rejectedCount, failedCount } = useMemo(() => {
    let applied = 0;
    let rejected = 0;
    let failed = 0;
    for (const f of allFixableFindings) {
      const state = fixStates[f.id];
      if (state?.status === 'applied') applied++;
      else if (state?.status === 'rejected') rejected++;
      else if (state?.status === 'failed') failed++;
    }
    return { appliedCount: applied, rejectedCount: rejected, failedCount: failed };
  }, [allFixableFindings, fixStates]);

  /** Whether any fixes are currently being applied */
  const hasApplyingFixes = allFixableFindings.some(f => f.id === currentApplyingId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary shrink-0" />
                <span>
                  {t('prReview.fix.batchTitle', 'Auto-Fix Review')}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {pendingFindings.length} {t('prReview.fix.pending', 'pending')}
                </Badge>
              </DialogTitle>
              <DialogDescription className="mt-1.5">
                {t('prReview.fix.batchDescription', 'Review and apply auto-fixes for the findings in this PR.')}
              </DialogDescription>
            </div>
          </div>

          {/* Summary stats */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {appliedCount > 0 && (
              <span className="flex items-center gap-1 text-success">
                <Check className="h-4 w-4" />
                {appliedCount} {t('prReview.fix.applied', 'applied')}
              </span>
            )}
            {rejectedCount > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <X className="h-4 w-4" />
                {rejectedCount} {t('prReview.fix.rejected', 'rejected')}
              </span>
            )}
            {failedCount > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {failedCount} {t('prReview.fix.failed', 'failed')}
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Findings list */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {allFixableFindings.map((f) => {
            const state = fixStates[f.id];
            const isCurrentApplying = f.id === currentApplyingId;
            const isPending = !state || state.status === 'pending';
            const isApplied = state?.status === 'applied';
            const isRejected = state?.status === 'rejected';
            const isFailed = state?.status === 'failed';
            const isDone = isApplied || isRejected || isFailed;

            return (
              <div
                key={f.id}
                className={cn(
                  'p-3 rounded-lg border transition-colors',
                  isDone && 'opacity-60',
                  isCurrentApplying && 'border-primary bg-primary/5',
                  !isDone && 'bg-card border-border hover:border-border/80'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Status icon */}
                  <div className="shrink-0 mt-0.5">
                    {isCurrentApplying ? (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    ) : isApplied ? (
                      <Check className="h-5 w-5 text-success" />
                    ) : isRejected ? (
                      <X className="h-5 w-5 text-muted-foreground" />
                    ) : isFailed ? (
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    ) : (
                      <Wrench className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{f.title}</span>
                      <Badge
                        variant="outline"
                        className={cn('text-xs', SEVERITY_COLORS[f.severity])}
                      >
                        {f.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {f.file}:{f.line}
                    </p>

                    {/* Error message for failed fixes */}
                    {isFailed && state?.errorMessage && (
                      <p className="text-xs text-destructive mt-1">
                        {state.errorMessage}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {isPending && !isCurrentApplying && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRejectFix(f.id)}
                        className="h-7 px-2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => f.suggestedFix && onApplyFix(f.id, f.suggestedFix)}
                        disabled={!f.suggestedFix}
                        className="h-7 px-2 text-muted-foreground hover:text-success"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {pendingFindings.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => onRejectAll(pendingFindings.map(f => f.id))}
                disabled={hasApplyingFixes}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                {t('prReview.fix.rejectAll', 'Reject All ({{count}})', { count: pendingFindings.length })}
              </Button>
              <Button
                variant="default"
                onClick={() => onApplyAll(pendingFindings.map(f => f.id))}
                disabled={hasApplyingFixes}
                className="flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                {t('prReview.fix.applyAll', 'Apply All ({{count}})', { count: pendingFindings.length })}
              </Button>
            </>
          )}
          {pendingFindings.length === 0 && (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="ml-auto"
            >
              {t('common:actions.close', 'Close')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
