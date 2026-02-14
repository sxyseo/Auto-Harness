/**
 * Label sync types for Phase 4 (Polish + Extras).
 * Optional one-directional sync of workflow state labels to GitHub.
 */

import type { WorkflowState } from './enrichment';

// ============================================
// Label Customization
// ============================================

export interface CustomWorkflowLabel {
  suffix: string;
  color: string; // 6-char hex, no #
  description: string;
}

export interface WorkflowLabelCustomization {
  prefix: string; // default "ac:"
  labels: Record<WorkflowState, CustomWorkflowLabel>;
}

// ============================================
// Configuration
// ============================================

export interface LabelSyncConfig {
  enabled: boolean;
  lastSyncedAt: string | null;
  customization?: WorkflowLabelCustomization;
}

// ============================================
// Label Definition
// ============================================

export interface WorkflowLabel {
  name: string;
  color: string;
  description: string;
}

// ============================================
// Sync Results
// ============================================

export interface LabelSyncResult {
  created: number;
  updated: number;
  removed: number;
  errors: Array<{ label: string; error: string }>;
}

export interface LabelSyncProgress {
  phase: 'creating' | 'syncing' | 'cleaning' | 'complete';
  progress: number;
  message: string;
}

// ============================================
// Factory Functions
// ============================================

export function createDefaultLabelSyncConfig(): LabelSyncConfig {
  return { enabled: false, lastSyncedAt: null };
}
