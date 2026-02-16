/**
 * Utility functions for spec creation and management
 */

import path from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'fs';
import { AUTO_BUILD_PATHS, getSpecsDir } from '../../../shared/constants';
import type { Project, TaskMetadata } from '../../../shared/types';
import { withSpecNumberLock } from '../../utils/spec-number-lock';
import { debugLog } from './utils/logger';
import { labelMatchesWholeWord } from '../shared/label-utils';
import { sanitizeText, sanitizeStringArray, sanitizeUrl } from '../shared/sanitize';

export interface SpecCreationData {
  specId: string;
  specDir: string;
  taskDescription: string;
  metadata: TaskMetadata;
}

/**
 * Create a slug from a title
 */
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

/**
 * Determine task category based on GitHub issue labels
 * Maps to TaskCategory type from shared/types/task.ts
 */
function determineCategoryFromLabels(labels: string[]): 'feature' | 'bug_fix' | 'refactoring' | 'documentation' | 'security' | 'performance' | 'ui_ux' | 'infrastructure' | 'testing' {
  const lowerLabels = labels.map(l => l.toLowerCase());

  // Check for bug labels
  if (lowerLabels.some(l => l.includes('bug') || l.includes('defect') || l.includes('error') || l.includes('fix'))) {
    return 'bug_fix';
  }

  // Check for security labels
  if (lowerLabels.some(l => l.includes('security') || l.includes('vulnerability') || l.includes('cve'))) {
    return 'security';
  }

  // Check for performance labels
  if (lowerLabels.some(l => l.includes('performance') || l.includes('optimization') || l.includes('speed'))) {
    return 'performance';
  }

  // Check for UI/UX labels
  if (lowerLabels.some(l => l.includes('ui') || l.includes('ux') || l.includes('design') || l.includes('styling'))) {
    return 'ui_ux';
  }

  // Check for infrastructure labels
  // Use whole-word matching for 'ci' and 'cd' to avoid false positives like 'acid' or 'decide'
  if (lowerLabels.some(l =>
    l.includes('infrastructure') ||
    l.includes('devops') ||
    l.includes('deployment') ||
    labelMatchesWholeWord(l, 'ci') ||
    labelMatchesWholeWord(l, 'cd')
  )) {
    return 'infrastructure';
  }

  // Check for testing labels
  if (lowerLabels.some(l => l.includes('test') || l.includes('testing') || l.includes('qa'))) {
    return 'testing';
  }

  // Check for refactoring labels
  if (lowerLabels.some(l => l.includes('refactor') || l.includes('cleanup') || l.includes('maintenance') || l.includes('chore') || l.includes('tech-debt') || l.includes('technical debt'))) {
    return 'refactoring';
  }

  // Check for documentation labels
  if (lowerLabels.some(l => l.includes('documentation') || l.includes('docs'))) {
    return 'documentation';
  }

  // Check for enhancement/feature labels (default)
  // This catches 'enhancement', 'feature', 'improvement', or any unlabeled issues
  return 'feature';
}

/**
 * Build a spec.md file from an investigation report.
 * Formats the report data into a readable markdown specification.
 */
function buildSpecMdFromReport(
  report: {
    ai_summary?: string;
    root_cause?: {
      identified_root_cause?: string;
      evidence?: string;
    };
    fix_advice?: {
      approaches?: Array<{
        description?: string;
        files_affected?: string[];
      }>;
      recommended_approach?: number;
      gotchas?: string[];
    };
    reproduction?: {
      reproduction_steps?: string[];
      suggested_test_approach?: string;
    };
  },
  issueNumber: number,
  title: string,
): string {
  const lines: string[] = [];
  lines.push(`# Issue #${issueNumber}: ${title}\n`);

  if (report.ai_summary) {
    lines.push(`## Summary\n${report.ai_summary}\n`);
  }

  const rootCause = report.root_cause;
  if (rootCause?.identified_root_cause) {
    lines.push(`## Root Cause\n${rootCause.identified_root_cause}\n`);
    if (rootCause.evidence) {
      lines.push(`### Evidence\n${rootCause.evidence}\n`);
    }
  }

  const fixAdvice = report.fix_advice;
  if (fixAdvice?.approaches && fixAdvice.approaches.length > 0) {
    lines.push('## Fix Approaches\n');
    for (const [i, approach] of fixAdvice.approaches.entries()) {
      const rec = i === fixAdvice.recommended_approach ? ' (Recommended)' : '';
      lines.push(`${i + 1}. ${approach.description}${rec}`);
      if (approach.files_affected?.length) {
        lines.push(`   Files: ${approach.files_affected.join(', ')}`);
      }
    }
    lines.push('');
  }

  if (fixAdvice?.gotchas && fixAdvice.gotchas.length > 0) {
    lines.push('## Gotchas\n');
    for (const g of fixAdvice.gotchas) lines.push(`- ${g}`);
    lines.push('');
  }

  const repro = report.reproduction;
  if (repro?.reproduction_steps && repro.reproduction_steps.length > 0) {
    lines.push('## Reproduction Steps\n');
    for (const step of repro.reproduction_steps) lines.push(`1. ${step}`);
    lines.push('');
    if (repro.suggested_test_approach) {
      lines.push(`## Testing\n${repro.suggested_test_approach}\n`);
    }
  }

  return lines.join('\n');
}

/**
 * Create a new spec directory and initial files
 * Uses coordinated spec numbering to prevent collisions across worktrees
 */
export async function createSpecForIssue(
  project: Project,
  issueNumber: number,
  issueTitle: string,
  taskDescription: string,
  githubUrl: string,
  labels: string[] = [],
  baseBranch?: string,
  preAllocatedSpecNumber?: number,
  investigationReport?: Record<string, unknown>,
): Promise<SpecCreationData> {
  const specsBaseDir = getSpecsDir(project.autoBuildPath);
  const specsDir = path.join(project.path, specsBaseDir);

  if (!existsSync(specsDir)) {
    mkdirSync(specsDir, { recursive: true });
  }

  // Sanitize network-sourced data before writing to disk
  const safeTitle = sanitizeText(issueTitle, 500);
  const safeDescription = sanitizeText(taskDescription, 50000, true);
  const safeGithubUrl = sanitizeUrl(githubUrl);
  const safeLabels = sanitizeStringArray(labels, 50, 200);

  // Use coordinated spec numbering with lock to prevent collisions
  return await withSpecNumberLock(project.path, async (lock) => {
    // Use pre-allocated number if provided, otherwise get next from lock
    const specNumber = preAllocatedSpecNumber ?? lock.getNextSpecNumber(project.autoBuildPath);
    const slugifiedTitle = slugifyTitle(safeTitle);
    const specId = `${String(specNumber).padStart(3, '0')}-${slugifiedTitle}`;

    // Create spec directory (inside lock to ensure atomicity)
    const specDir = path.join(specsDir, specId);
    mkdirSync(specDir, { recursive: true });

    // Create initial files
    const now = new Date().toISOString();

    // implementation_plan.json
    const implementationPlan = {
      feature: safeTitle,
      description: safeDescription,
      created_at: now,
      updated_at: now,
      status: 'pending',
      phases: []
    };
    writeFileSync(
      path.join(specDir, AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN),
      JSON.stringify(implementationPlan, null, 2),
      'utf-8'
    );

    // requirements.json — enriched when investigation report is available
    let requirements: Record<string, unknown>;
    if (investigationReport) {
      const fixAdvice = investigationReport.fix_advice as {
        approaches?: Array<{
          description?: string;
          complexity?: string;
          files_affected?: string[];
        }>;
      } | undefined;
      const reqs = (fixAdvice?.approaches || []).map((approach, i: number) => ({
        id: `REQ-${String(i + 1).padStart(3, '0')}`,
        description: approach.description || '',
        complexity: approach.complexity || 'moderate',
        files: approach.files_affected || [],
      }));
      requirements = {
        issue_number: issueNumber,
        issue_title: safeTitle,
        severity: (investigationReport.severity as string) || 'medium',
        requirements: reqs,
        task_description: safeDescription,
        workflow_type: 'bugfix',
      };
    } else {
      requirements = {
        task_description: safeDescription,
        workflow_type: 'feature',
      };
    }
    writeFileSync(
      path.join(specDir, AUTO_BUILD_PATHS.REQUIREMENTS),
      JSON.stringify(requirements, null, 2),
      'utf-8'
    );

    // Determine category from GitHub issue labels
    const category = determineCategoryFromLabels(safeLabels);

    // task_metadata.json
    const metadata: TaskMetadata = {
      sourceType: 'github',
      githubIssueNumber: issueNumber,
      githubUrl: safeGithubUrl,
      category,
      // Store baseBranch for worktree creation and QA comparison
      // This comes from project.settings.mainBranch or task-level override
      ...(baseBranch && { baseBranch })
    };
    writeFileSync(
      path.join(specDir, 'task_metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf-8'
    );

    // Generate spec.md from investigation report if available
    if (investigationReport) {
      const specMd = buildSpecMdFromReport(investigationReport, issueNumber, safeTitle);
      writeFileSync(path.join(specDir, 'spec.md'), specMd, 'utf-8');
      debugLog('github', `[spec-utils] Generated spec.md for issue #${issueNumber}`);
    }

    // Copy investigation data to spec directory for agent context
    const investigationDir = path.join(project.path, '.auto-claude', 'issues', `${issueNumber}`);
    const investigationSpecDir = specDir;

    if (existsSync(investigationDir)) {
      const filesToCopy = [
        'investigation_report.json',
        'investigation_logs.json',
        'activity_log.json'
      ];

      let copiedCount = 0;
      for (const file of filesToCopy) {
        const src = path.join(investigationDir, file);
        const dest = path.join(investigationSpecDir, file);
        if (existsSync(src)) {
          copyFileSync(src, dest);
          copiedCount++;
        }
      }

      if (copiedCount > 0) {
        debugLog('github', `[spec-utils] Copied ${copiedCount} investigation files to spec ${specId}`);
      }
    }

    return {
      specId,
      specDir,
      taskDescription: safeDescription,
      metadata
    };
  });
}

/**
 * Build issue context with comments
 */
export function buildIssueContext(
  issueNumber: number,
  issueTitle: string,
  issueBody: string | undefined,
  labels: string[],
  htmlUrl: string,
  comments: Array<{ body: string; user: { login: string } }>
): string {
  return `
# GitHub Issue #${issueNumber}: ${issueTitle}

${issueBody || 'No description provided.'}

${comments.length > 0 ? `## Comments (${comments.length}):
${comments.map(c => `**${c.user.login}:** ${c.body}`).join('\n\n')}` : ''}

**Labels:** ${labels.join(', ') || 'None'}
**URL:** ${htmlUrl}
`;
}

/**
 * Build investigation task description
 */
export function buildInvestigationTask(
  issueNumber: number,
  issueTitle: string,
  issueContext: string
): string {
  return `Investigate GitHub Issue #${issueNumber}: ${issueTitle}

${issueContext}

Please analyze this issue and provide:
1. A brief summary of what the issue is about
2. A proposed solution approach
3. The files that would likely need to be modified
4. Estimated complexity (simple/standard/complex)
5. Acceptance criteria for resolving this issue`;
}

/**
 * Update implementation plan status
 * Used to immediately update the plan file so the frontend shows the correct status
 */
export function updateImplementationPlanStatus(specDir: string, status: string): void {
  const planPath = path.join(specDir, AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN);

  try {
    const content = readFileSync(planPath, 'utf-8');
    const plan = JSON.parse(content);
    plan.status = status;
    plan.updated_at = new Date().toISOString();
    writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf-8');
  } catch (error) {
    // File doesn't exist or couldn't be read - this is expected for new specs
    // Log legitimate errors (malformed JSON, disk write failures, permission errors)
    if (error instanceof Error && error.message && !error.message.includes('ENOENT')) {
      debugLog('spec-utils', `Failed to update implementation plan status: ${error.message}`);
    }
  }
}
