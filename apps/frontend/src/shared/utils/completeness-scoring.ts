/**
 * Pure function for calculating issue completeness score.
 * Based on weighted checklist of enrichment sections.
 */
import type { IssueEnrichment } from '../types/enrichment';
import { COMPLETENESS_WEIGHTS } from '../constants/enrichment';

/**
 * Calculate completeness score (0-100) for an issue's enrichment data.
 * Each section is weighted according to COMPLETENESS_WEIGHTS.
 * Empty strings, whitespace-only strings, and empty arrays score 0.
 */
export function calculateCompleteness(
  enrichment: IssueEnrichment['enrichment'],
): number {
  if (!enrichment) return 0;

  let score = 0;

  // String fields: non-empty, non-whitespace
  if (enrichment.problem?.trim()) {
    score += COMPLETENESS_WEIGHTS.problem;
  }
  if (enrichment.goal?.trim()) {
    score += COMPLETENESS_WEIGHTS.goal;
  }
  if (enrichment.technicalContext?.trim()) {
    score += COMPLETENESS_WEIGHTS.technicalContext;
  }

  // Array fields: non-empty array with at least one item
  if (enrichment.scopeIn && enrichment.scopeIn.length > 0) {
    score += COMPLETENESS_WEIGHTS.scopeIn;
  }
  if (enrichment.scopeOut && enrichment.scopeOut.length > 0) {
    score += COMPLETENESS_WEIGHTS.scopeOut;
  }
  if (enrichment.acceptanceCriteria && enrichment.acceptanceCriteria.length > 0) {
    score += COMPLETENESS_WEIGHTS.acceptanceCriteria;
  }
  if (enrichment.risksEdgeCases && enrichment.risksEdgeCases.length > 0) {
    score += COMPLETENESS_WEIGHTS.risksEdgeCases;
  }

  return Math.round(score * 100);
}
