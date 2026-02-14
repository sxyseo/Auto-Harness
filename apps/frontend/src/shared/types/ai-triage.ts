/**
 * AI triage types for Phase 3 (AI Power).
 * Progressive trust, enrichment, splitting, and review queue types.
 */
import type { TriageCategory as EnrichmentTriageCategory } from './enrichment';

// Re-export TriageResult from triage-handlers for convenience
// (cannot import directly due to main/renderer boundary — consumers
// in renderer use IPC; only main-process code imports triage-handlers)

// ============================================
// AI Enrichment
// ============================================

export interface AIEnrichmentResult {
  issueNumber: number;
  problem: string;
  goal: string;
  scopeIn: string[];
  scopeOut: string[];
  acceptanceCriteria: string[];
  technicalContext: string;
  risksEdgeCases: string[];
  confidence: number;
}

// ============================================
// Issue Splitting
// ============================================

export interface SplitSuggestion {
  issueNumber: number;
  subIssues: Array<{
    title: string;
    body: string;
    labels: string[];
  }>;
  rationale: string;
  confidence: number;
}

export interface CreateIssueParams {
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
}

export interface CreateIssueResult {
  number: number;
  url: string;
}

// ============================================
// Triage Review Queue
// ============================================

export type TriageReviewStatus = 'pending' | 'accepted' | 'rejected' | 'auto-applied';

export interface TriageReviewItem {
  issueNumber: number;
  issueTitle: string;
  result: {
    category: string;
    confidence: number;
    labelsToAdd: string[];
    labelsToRemove: string[];
    isDuplicate: boolean;
    duplicateOf?: number;
    isSpam: boolean;
    isFeatureCreep: boolean;
    suggestedBreakdown: string[];
    priority: 'high' | 'medium' | 'low';
    comment?: string;
    triagedAt: string;
  };
  status: TriageReviewStatus;
}

// ============================================
// Progress Types
// ============================================

export interface EnrichmentProgress {
  phase: 'analyzing' | 'generating' | 'complete';
  progress: number;
  message: string;
}

export interface SplitProgress {
  phase: 'analyzing' | 'suggesting' | 'creating' | 'closing' | 'complete';
  progress: number;
  message: string;
  createdCount?: number;
  totalCount?: number;
}

export interface ApplyResultsProgress {
  totalItems: number;
  processedItems: number;
  currentIssueNumber?: number;
}

// ============================================
// Category Mapping
// ============================================

/**
 * Maps Python triage runner categories to enrichment TriageCategory.
 * The runner may return 'duplicate', 'spam', or 'feature_creep' which
 * don't exist in the enrichment type system — this function bridges them.
 */
export function mapTriageCategory(category: string): EnrichmentTriageCategory {
  const mapping: Record<string, EnrichmentTriageCategory> = {
    bug: 'bug',
    feature: 'feature',
    documentation: 'documentation',
    question: 'question',
    enhancement: 'enhancement',
    chore: 'chore',
    security: 'security',
    performance: 'performance',
    duplicate: 'bug',
    spam: 'chore',
    feature_creep: 'enhancement',
  };
  return mapping[category] ?? 'chore';
}
