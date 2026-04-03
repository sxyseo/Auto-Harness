/**
 * GitHub module types and interfaces
 */

export interface GitHubConfig {
  token: string;
  repo: string;
}

export interface GitHubAPIIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  labels: Array<{ id: number; name: string; color: string; description?: string }>;
  assignees: Array<{ login: string; avatar_url?: string }>;
  user: { login: string; avatar_url?: string };
  milestone?: { id: number; title: string; state: 'open' | 'closed' };
  created_at: string;
  updated_at: string;
  closed_at?: string;
  comments: number;
  url: string;
  html_url: string;
  pull_request?: unknown;
}

export interface GitHubAPIRepository {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  html_url: string;
  default_branch: string;
  private: boolean;
  owner: { login: string; avatar_url?: string };
}

export interface GitHubAPIComment {
  id: number;
  body: string;
  user: { login: string; avatar_url?: string };
  created_at: string;
  updated_at: string;
}

export interface ReleaseOptions {
  draft?: boolean;
  prerelease?: boolean;
}

// =============================================================================
// Review Template Types
// =============================================================================

/** Types of review templates available. */
export const ReviewTemplateType = {
  /** Full comprehensive review covering all aspects */
  COMPREHENSIVE: 'comprehensive',
  /** Quick review for small, low-risk changes */
  QUICK: 'quick',
  /** Security-focused review */
  SECURITY: 'security',
  /** Quality and maintainability focused review */
  QUALITY: 'quality',
  /** Architecture and structural review */
  ARCHITECTURE: 'architecture',
  /** Review focused on test coverage */
  TEST_COVERAGE: 'test_coverage',
  /** Review for documentation changes */
  DOCUMENTATION: 'documentation',
} as const;

export type ReviewTemplateType = (typeof ReviewTemplateType)[keyof typeof ReviewTemplateType];

/** Review pass types. */
export const ReviewPass = {
  QUICK_SCAN: 'quick_scan',
  SECURITY: 'security',
  QUALITY: 'quality',
  DEEP_ANALYSIS: 'deep_analysis',
  STRUCTURAL: 'structural',
  AI_COMMENT_TRIAGE: 'ai_comment_triage',
} as const;

export type ReviewPass = (typeof ReviewPass)[keyof typeof ReviewPass];

/** Review severity levels. */
export const ReviewSeverity = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type ReviewSeverity = (typeof ReviewSeverity)[keyof typeof ReviewSeverity];

/** A single pass configuration within a template. */
export interface TemplatePassConfig {
  pass: ReviewPass;
  enabled: boolean;
  weight?: number;
  maxFindings?: number;
  timeoutMs?: number;
}

/** Review template definition with configuration. */
export interface ReviewTemplate {
  id: string;
  name: string;
  description: string;
  type: ReviewTemplateType;
  /** Which passes to run and their configuration */
  passes: TemplatePassConfig[];
  /** Whether to enable parallel execution */
  parallel: boolean;
  /** Priority threshold for including findings */
  minSeverity?: ReviewSeverity;
  /** Maximum total findings to report */
  maxTotalFindings?: number;
  /** Whether to include structural analysis */
  includeStructural?: boolean;
  /** Whether to include AI comment triage */
  includeAITriage?: boolean;
  /** Tags for categorization */
  tags?: string[];
  /** Is this a built-in template or user-defined */
  builtin: boolean;
}

/** Configuration for applying a template. */
export interface ReviewTemplateConfig {
  templateType?: ReviewTemplateType;
  customTemplate?: ReviewTemplate;
  overrides?: Partial<TemplatePassConfig>;
  skipPasses?: ReviewPass[];
}

// =============================================================================
// Auto-Fix Types
// =============================================================================

/** Status of an auto-fix for a finding. */
export const AutoFixStatus = {
  /** Fix has not been applied yet */
  PENDING: 'pending',
  /** Fix was applied successfully */
  APPLIED: 'applied',
  /** Fix was rejected by user */
  REJECTED: 'rejected',
  /** Fix was attempted but failed */
  FAILED: 'failed',
  /** Fix was skipped */
  SKIPPED: 'skipped',
} as const;

export type AutoFixStatus = (typeof AutoFixStatus)[keyof typeof AutoFixStatus];

/** Represents a single attempt to apply a fix to a finding. */
export interface AutoFixAttempt {
  /** Unique identifier for this attempt */
  attemptId: string;
  /** ID of the finding this fix is for */
  findingId: string;
  /** The generated fix code/patch */
  fixCode: string;
  /** When the fix was generated */
  generatedAt: string;
  /** When the fix was applied (if applied) */
  appliedAt?: string;
  /** Status of the fix attempt */
  status: AutoFixStatus;
  /** Error message if the fix failed */
  errorMessage?: string;
  /** Whether the fix was verified after application */
  verified: boolean;
  /** Notes from verification */
  verificationNote?: string;
}

/** Result of applying an auto-fix to a finding. */
export interface AutoFixResult {
  /** ID of the finding that was fixed */
  findingId: string;
  /** Whether the fix was successful */
  success: boolean;
  /** Status of the fix */
  status: AutoFixStatus;
  /** The applied fix code */
  appliedFix?: string;
  /** Git commit SHA if fix was committed */
  commitSha?: string;
  /** Error message if the fix failed */
  errorMessage?: string;
  /** Branch name where fix was applied */
  branchName?: string;
  /** Timestamp when fix was applied */
  appliedAt?: string;
  /** Verification status */
  verified: boolean;
  /** Human-readable explanation of what was done */
  summary: string;
}

/** Request to apply an auto-fix to a finding. */
export interface AutoFixRequest {
  /** ID of the finding to fix */
  findingId: string;
  /** The suggested fix from the review */
  suggestedFix: string;
  /** File path to apply the fix to */
  file: string;
  /** Line number where the fix should be applied */
  line: number;
  /** End line if the fix spans multiple lines */
  endLine?: number;
  /** Optional: specific code context for the fix */
  context?: string;
  /** Whether to create a commit for this fix */
  createCommit?: boolean;
}

/** Summary of auto-fix statistics from a review. */
export interface AutoFixSummary {
  totalFixable: number;
  pending: number;
  applied: number;
  rejected: number;
  failed: number;
  skipped: number;
}
