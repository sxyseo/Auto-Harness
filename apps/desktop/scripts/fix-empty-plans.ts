#!/usr/bin/env npx tsx
/**
 * Fix Empty Implementation Plans
 * =============================
 *
 * Scans all task directories for implementation_plan.json files with empty phases arrays
 * and generates valid phases from spec.md when possible.
 *
 * Usage: npx tsx scripts/fix-empty-plans.ts [--dry-run]
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

interface ImplementationPlan {
  feature?: string;
  description?: string;
  phases: unknown[];
  status?: string;
}

interface SpecSection {
  title?: string;
  content?: string;
}

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Extract structured sections from spec markdown
 */
function parseSpecSections(specContent: string): Map<string, string> {
  const sections = new Map<string, string>();

  // Match section headers (##, ###) and capture content until next header
  const lines = specContent.split('\n');
  let currentSection = 'overview';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^(#{2,4})\s+(.+)$/);
    if (headerMatch) {
      // Save previous section
      if (currentContent.length > 0) {
        sections.set(currentSection, currentContent.join('\n').trim());
      }
      // Start new section
      currentSection = headerMatch[2].toLowerCase().replace(/\s+/g, '-');
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentContent.length > 0) {
    sections.set(currentSection, currentContent.join('\n').trim());
  }

  return sections;
}

/**
 * Generate a minimal valid phases array from spec content
 */
function generatePhasesFromSpec(specContent: string, feature: string): unknown[] {
  const sections = parseSpecSections(specContent);
  const description = sections.get('overview') || sections.get('description') || feature;
  const acceptanceCriteria = sections.get('acceptance-criteria') || sections.get('acceptance-criteria') || '';

  // Extract user stories or requirements
  const userStories = sections.get('user-stories') || sections.get('rationale') || description;
  const requirements = sections.get('requirements') || '';

  // Generate subtasks from acceptance criteria
  const acLines = acceptanceCriteria.split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- [') || line.startsWith('* ['))
    .map(line => line.replace(/^[-*]\s*\[[x\s]\]\s*/i, '').trim())
    .filter(line => line.length > 0);

  // Create a default implementation plan with 3 phases
  const phases = [
    {
      id: 'phase-1-planning',
      name: 'Planning & Design',
      type: 'planning',
      description: `Analyze requirements and create detailed technical design for ${feature}`,
      subtasks: [
        {
          id: 'subtask-1-1',
          title: `Review requirements and user stories for ${feature}`,
          description: userStories.substring(0, 500),
          status: 'pending' as const,
          files_to_modify: [],
          files_to_create: [],
        },
        {
          id: 'subtask-1-2',
          title: 'Create technical design document',
          description: 'Design the data structures, APIs, and implementation approach',
          status: 'pending' as const,
          files_to_create: ['docs/technical-design.md'],
          files_to_modify: [],
        },
      ],
    },
    {
      id: 'phase-2-implementation',
      name: 'Implementation',
      type: 'implementation',
      description: `Implement ${feature} according to the design`,
      subtasks: acLines.slice(0, 5).map((ac, idx) => ({
        id: `subtask-2-${idx + 1}`,
        title: `Implement: ${ac.substring(0, 80)}`,
        description: ac,
        status: 'pending' as const,
        files_to_modify: [],
        files_to_create: [],
      })),
    },
    {
      id: 'phase-3-testing',
      name: 'Testing & QA',
      type: 'testing',
      description: 'Test the implementation and verify acceptance criteria',
      subtasks: [
        {
          id: 'subtask-3-1',
          title: 'Verify all acceptance criteria',
          description: acceptanceCriteria,
          status: 'pending' as const,
          files_to_modify: [],
          files_to_create: [],
        },
        {
          id: 'subtask-3-2',
          title: 'Integration testing',
          description: 'Test integration with existing features',
          status: 'pending' as const,
          files_to_modify: [],
          files_to_create: [],
        },
      ],
    },
  ];

  // Ensure each phase has at least one subtask
  phases.forEach((phase: any) => {
    if (!phase.subtasks || phase.subtasks.length === 0) {
      phase.subtasks = [
        {
          id: `${phase.id}-1`,
          title: phase.description || phase.name,
          description: `Complete ${phase.name}`,
          status: 'pending' as const,
          files_to_modify: [],
          files_to_create: [],
        },
      ];
    }
  });

  return phases;
}

/**
 * Fix a single implementation plan
 */
async function fixImplementationPlan(planPath: string, specPath: string): Promise<boolean> {
  try {
    const planContent = await readFile(planPath, 'utf-8');
    const plan: ImplementationPlan = JSON.parse(planContent);

    // Check if phases is empty or missing
    if (!plan.phases || plan.phases.length === 0) {
      console.log(`❌ ${planPath}: phases array is empty`);

      // Try to read spec.md
      if (!existsSync(specPath)) {
        console.log(`  ⚠️  No spec.md found at ${specPath}`);
        return false;
      }

      const specContent = await readFile(specPath, 'utf-8');
      const feature = plan.feature || plan.description || 'Feature';

      console.log(`  📝 Generating phases from spec.md...`);
      const newPhases = generatePhasesFromSpec(specContent, feature);

      if (DRY_RUN) {
        console.log(`  🔍 [DRY RUN] Would add ${newPhases.length} phases`);
        return true;
      }

      // Update the plan
      plan.phases = newPhases;
      plan.status = 'pending'; // Reset status to allow re-execution

      await writeFile(planPath, JSON.stringify(plan, null, 2));
      console.log(`  ✅ Fixed: added ${newPhases.length} phases`);
      return true;
    }

    return false;
  } catch (error) {
    console.log(`  ⚠️  Error processing ${planPath}:`, (error as Error).message);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Fixing Empty Implementation Plans');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE (will modify files)'}\n`);

  const worktreesDir = '/Users/abel/dev/lifeFlow/.auto-claude/worktrees/tasks';
  const specsDir = '/Users/abel/dev/lifeFlow/.auto-claude/specs';

  let fixedCount = 0;
  let checkedCount = 0;

  // Check worktree tasks
  try {
    const taskDirs = await readdir(worktreesDir, { withFileTypes: true });
    console.log(`📁 Scanning worktree tasks...`);

    for (const taskDir of taskDirs) {
      if (!taskDir.isDirectory()) continue;

      const taskId = taskDir.name;
      const planPath = join(worktreesDir, taskId, `.auto-claude/specs/${taskId}/implementation_plan.json`);
      const specPath = join(worktreesDir, taskId, '.auto-claude/specs', taskId, 'spec.md');

      if (existsSync(planPath)) {
        checkedCount++;
        const fixed = await fixImplementationPlan(planPath, specPath);
        if (fixed) fixedCount++;
      }
    }
  } catch (error) {
    console.log(`  ⚠️  Error scanning worktrees:`, (error as Error).message);
  }

  // Check main specs directory
  try {
    console.log(`\n📁 Scanning main specs directory...`);
    const specDirs = await readdir(specsDir, { withFileTypes: true });

    for (const specDir of specDirs) {
      if (!specDir.isDirectory()) continue;

      const taskId = specDir.name;
      const planPath = join(specsDir, taskId, 'implementation_plan.json');
      const specPath = join(specsDir, taskId, 'spec.md');

      if (existsSync(planPath)) {
        checkedCount++;
        const fixed = await fixImplementationPlan(planPath, specPath);
        if (fixed) fixedCount++;
      }
    }
  } catch (error) {
    console.log(`  ⚠️  Error scanning specs directory:`, (error as Error).message);
  }

  console.log(`\n✨ Done!`);
  console.log(`📊 Checked: ${checkedCount} plans`);
  console.log(`🔧 Fixed: ${fixedCount} plans`);

  if (DRY_RUN && fixedCount > 0) {
    console.log(`\n⚠️  This was a DRY RUN. Run without --dry-run to apply fixes.`);
  }
}

main().catch(console.error);
