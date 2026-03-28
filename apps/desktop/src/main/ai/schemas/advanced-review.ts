/**
 * Advanced Review Schemas
 * =======================
 *
 * Zod schemas and TypeScript types for advanced PR review with memory integration.
 * Provides context types for injecting architectural memory into review passes.
 */

import { z } from 'zod';

// =============================================================================
// Memory Context Types
// =============================================================================

/**
 * Represents architectural context retrieved from memory.
 * Used to provide AI reviewers with project-specific patterns and decisions.
 */
export interface MemoryContext {
  /** Project ID for this review */
  projectId: string;
  /** Architectural patterns discovered in the codebase */
  architecturalPatterns: ArchitecturalPattern[];
  /** Past decisions relevant to this PR */
  relevantDecisions: Decision[];
  /** Gotchas and pitfalls to watch for */
  gotchas: Gotcha[];
  /** Code patterns that are approved for this project */
  approvedPatterns: ApprovedPattern[];
  /** Generated timestamp */
  retrievedAt: string;
}

/**
 * An architectural pattern used in the codebase.
 */
export interface ArchitecturalPattern {
  id: string;
  name: string;
  description: string;
  filePath: string;
  lineNumber: number;
  confidence: number;
  tags: string[];
}

/**
 * A past decision recorded in memory.
 */
export interface Decision {
  id: string;
  title: string;
  rationale: string;
  decidedAt: string;
  decidedBy: string;
  relatedFiles: string[];
  confidence: number;
}

/**
 * A known gotcha or pitfall in the codebase.
 */
export interface Gotcha {
  id: string;
  title: string;
  description: string;
  filePath: string;
  workaround?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * An approved code pattern for this project.
 */
export interface ApprovedPattern {
  id: string;
  name: string;
  description: string;
  exampleFile: string;
  exampleLine: number;
  tags: string[];
}

// =============================================================================
// Review Session Memory Types
// =============================================================================

/**
 * Memory-specific data for a review session.
 * Tracks what was found and learned during this review.
 */
export interface ReviewSessionMemory {
  /** Unique session identifier */
  sessionId: string;
  /** PR number being reviewed */
  prNumber: number;
  /** Repository identifier */
  repo: string;
  /** Project ID for memory storage */
  projectId: string;
  /** Phase of the review */
  phase: ReviewPhase;
  /** Memory contexts used during review */
  usedMemoryContexts: string[];
  /** Findings that were validated against memory */
  memoryValidatedFindings: string[];
  /** Cross-references found between PR and existing patterns */
  patternMatches: PatternMatch[];
  /** Decisions that were consulted */
  consultedDecisions: string[];
  /** Session outcome */
  outcome?: 'success' | 'partial' | 'failed';
  /** Notes about what was learned */
  lessonsLearned?: string[];
  /** Created timestamp */
  createdAt: string;
}

/** Review session phases */
export type ReviewPhase =
  | 'quick_scan'
  | 'context_gathering'
  | 'security_review'
  | 'quality_review'
  | 'structural_review'
  | 'deep_analysis'
  | 'triage'
  | 'synthesis';

/** A pattern match found between PR and memory */
export interface PatternMatch {
  patternId: string;
  patternName: string;
  matchType: 'confirms' | 'violates' | 'extends' | 'unknown';
  filePath: string;
  lineNumber: number;
  confidence: number;
  description: string;
}

// =============================================================================
// Memory Integration Enums
// =============================================================================

/** Memory integration modes */
export const MemoryIntegrationMode = {
  /** No memory integration */
  NONE: 'none',
  /** Include architectural context only */
  ARCHITECTURAL: 'architectural',
  /** Include decisions and rationale */
  DECISIONS: 'decisions',
  /** Include gotchas and warnings */
  GOTCHAS: 'gotchas',
  /** Full memory integration */
  FULL: 'full',
} as const;

export type MemoryIntegrationMode =
  (typeof MemoryIntegrationMode)[keyof typeof MemoryIntegrationMode];

// =============================================================================
// Zod Schemas for Memory Context
// =============================================================================

/** Schema for validating ArchitecturalPattern from LLM */
export const ArchitecturalPatternSchema = z.preprocess(
  (input: unknown) => {
    if (!input || typeof input !== 'object') return input;
    const raw = input as Record<string, unknown>;
    return {
      ...raw,
      // Coerce field names
      filePath: raw.filePath ?? raw.file_path ?? '',
      lineNumber: raw.lineNumber ?? raw.line_number ?? 0,
    };
  },
  z.object({
    id: z.string().default(''),
    name: z.string().default(''),
    description: z.string().default(''),
    filePath: z.string().default(''),
    lineNumber: z.number().default(0),
    confidence: z.number().min(0).max(1).default(0.5),
    tags: z.array(z.string()).default([]),
  }).passthrough(),
);

/** Schema for validating Decision from LLM */
export const DecisionSchema = z.preprocess(
  (input: unknown) => {
    if (!input || typeof input !== 'object') return input;
    const raw = input as Record<string, unknown>;
    return {
      ...raw,
      // Coerce field names
      decidedAt: raw.decidedAt ?? raw.decided_at ?? '',
      decidedBy: raw.decidedBy ?? raw.decided_by ?? '',
      relatedFiles: raw.relatedFiles ?? raw.related_files ?? [],
    };
  },
  z.object({
    id: z.string().default(''),
    title: z.string().default(''),
    rationale: z.string().default(''),
    decidedAt: z.string().default(''),
    decidedBy: z.string().default(''),
    relatedFiles: z.array(z.string()).default([]),
    confidence: z.number().min(0).max(1).default(0.5),
  }).passthrough(),
);

/** Schema for validating Gotcha from LLM */
export const GotchaSchema = z.preprocess(
  (input: unknown) => {
    if (!input || typeof input !== 'object') return input;
    const raw = input as Record<string, unknown>;
    return {
      ...raw,
      // Coerce field names
      filePath: raw.filePath ?? raw.file_path ?? '',
    };
  },
  z.object({
    id: z.string().default(''),
    title: z.string().default(''),
    description: z.string().default(''),
    filePath: z.string().default(''),
    workaround: z.string().optional(),
    severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  }).passthrough(),
);

/** Schema for validating ApprovedPattern from LLM */
export const ApprovedPatternSchema = z.preprocess(
  (input: unknown) => {
    if (!input || typeof input !== 'object') return input;
    const raw = input as Record<string, unknown>;
    return {
      ...raw,
      // Coerce field names
      exampleFile: raw.exampleFile ?? raw.example_file ?? '',
      exampleLine: raw.exampleLine ?? raw.example_line ?? 0,
    };
  },
  z.object({
    id: z.string().default(''),
    name: z.string().default(''),
    description: z.string().default(''),
    exampleFile: z.string().default(''),
    exampleLine: z.number().default(0),
    tags: z.array(z.string()).default([]),
  }).passthrough(),
);

/** Schema for validating MemoryContext from LLM */
export const MemoryContextSchema = z.preprocess(
  (input: unknown) => {
    if (!input || typeof input !== 'object') return input;
    const raw = input as Record<string, unknown>;
    return {
      ...raw,
      // Ensure arrays exist
      architecturalPatterns: raw.architecturalPatterns ?? [],
      relevantDecisions: raw.relevantDecisions ?? raw.relevant_decisions ?? [],
      gotchas: raw.gotchas ?? [],
      approvedPatterns: raw.approvedPatterns ?? raw.approved_patterns ?? [],
    };
  },
  z.object({
    projectId: z.string().default(''),
    architecturalPatterns: z.array(ArchitecturalPatternSchema).default([]),
    relevantDecisions: z.array(DecisionSchema).default([]),
    gotchas: z.array(GotchaSchema).default([]),
    approvedPatterns: z.array(ApprovedPatternSchema).default([]),
    retrievedAt: z.string().default(''),
  }).passthrough(),
);

/** Schema for validating PatternMatch from LLM */
export const PatternMatchSchema = z.preprocess(
  (input: unknown) => {
    if (!input || typeof input !== 'object') return input;
    const raw = input as Record<string, unknown>;
    return {
      ...raw,
      // Coerce field names
      patternId: raw.patternId ?? raw.pattern_id ?? '',
      patternName: raw.patternName ?? raw.pattern_name ?? '',
      matchType: raw.matchType ?? raw.match_type ?? 'unknown',
      filePath: raw.filePath ?? raw.file_path ?? '',
      lineNumber: raw.lineNumber ?? raw.line_number ?? 0,
    };
  },
  z.object({
    patternId: z.string().default(''),
    patternName: z.string().default(''),
    matchType: z.enum(['confirms', 'violates', 'extends', 'unknown']).default('unknown'),
    filePath: z.string().default(''),
    lineNumber: z.number().default(0),
    confidence: z.number().min(0).max(1).default(0.5),
    description: z.string().default(''),
  }).passthrough(),
);

/** Schema for validating ReviewSessionMemory from LLM */
export const ReviewSessionMemorySchema = z.preprocess(
  (input: unknown) => {
    if (!input || typeof input !== 'object') return input;
    const raw = input as Record<string, unknown>;
    return {
      ...raw,
      // Coerce field names
      sessionId: raw.sessionId ?? raw.session_id ?? '',
      prNumber: raw.prNumber ?? raw.pr_number ?? 0,
      // Ensure arrays exist
      usedMemoryContexts: raw.usedMemoryContexts ?? raw.used_memory_contexts ?? [],
      memoryValidatedFindings: raw.memoryValidatedFindings ?? raw.memory_validated_findings ?? [],
      patternMatches: raw.patternMatches ?? raw.pattern_matches ?? [],
      consultedDecisions: raw.consultedDecisions ?? raw.consulted_decisions ?? [],
      lessonsLearned: raw.lessonsLearned ?? raw.lessons_learned ?? [],
    };
  },
  z.object({
    sessionId: z.string().default(''),
    prNumber: z.number().default(0),
    repo: z.string().default(''),
    projectId: z.string().default(''),
    phase: z.enum([
      'quick_scan',
      'context_gathering',
      'security_review',
      'quality_review',
      'structural_review',
      'deep_analysis',
      'triage',
      'synthesis',
    ]).default('quick_scan'),
    usedMemoryContexts: z.array(z.string()).default([]),
    memoryValidatedFindings: z.array(z.string()).default([]),
    patternMatches: z.array(PatternMatchSchema).default([]),
    consultedDecisions: z.array(z.string()).default([]),
    outcome: z.enum(['success', 'partial', 'failed']).optional(),
    lessonsLearned: z.array(z.string()).default([]),
    createdAt: z.string().default(''),
  }).passthrough(),
);

// =============================================================================
// Type Exports
// =============================================================================

export type ValidatedMemoryContext = z.infer<typeof MemoryContextSchema>;
export type ValidatedArchitecturalPattern = z.infer<typeof ArchitecturalPatternSchema>;
export type ValidatedDecision = z.infer<typeof DecisionSchema>;
export type ValidatedGotcha = z.infer<typeof GotchaSchema>;
export type ValidatedApprovedPattern = z.infer<typeof ApprovedPatternSchema>;
export type ValidatedPatternMatch = z.infer<typeof PatternMatchSchema>;
export type ValidatedReviewSessionMemory = z.infer<typeof ReviewSessionMemorySchema>;
