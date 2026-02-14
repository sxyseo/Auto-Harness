# Investigation Pipeline Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the investigation pipeline from 4 parallel agents to a two-phase pipeline where root cause runs first, and downstream agents receive its output.

**Architecture:** Phase 1 runs root_cause + reproducer in parallel. Phase 2 runs impact + fix_advisor in parallel with root cause results injected into their prompts. Per-specialist model/thinking settings replace the single `githubIssues` feature config for investigations.

**Tech Stack:** TypeScript (Electron/React), Python (asyncio, Claude Agent SDK), Zustand, Tailwind CSS, react-i18next

**Design doc:** `docs/plans/2026-02-14-investigation-pipeline-redesign-design.md`

**Correction from design doc:** `featureModels.githubIssues` stays in `FeatureModelConfig` because triage/enrich/split handlers also use it. The new `investigationModels`/`investigationThinking` fields are _additions_ to `AppSettings`, not replacements.

---

### Task 1: Add TypeScript types for per-specialist investigation config

**Files:**
- Modify: `apps/frontend/src/shared/types/settings.ts:182-201` (after `FeatureThinkingConfig`)

**Step 1: Add the new interfaces and AppSettings fields**

Add after `FeatureThinkingConfig` (line 201):

```typescript
// Per-specialist investigation model configuration
export interface InvestigationModelConfig {
  rootCause: ModelTypeShort;
  impact: ModelTypeShort;
  fixAdvisor: ModelTypeShort;
  reproducer: ModelTypeShort;
}

// Per-specialist investigation thinking level configuration
export interface InvestigationThinkingConfig {
  rootCause: ThinkingLevel;
  impact: ThinkingLevel;
  fixAdvisor: ThinkingLevel;
  reproducer: ThinkingLevel;
}
```

Add to `AppSettings` interface (after `featureThinking` on line 265):

```typescript
  // Per-specialist investigation agent configuration
  investigationModels?: InvestigationModelConfig;
  investigationThinking?: InvestigationThinkingConfig;
```

**Step 2: Run typecheck**

Run: `cd apps/frontend && npm run typecheck`
Expected: PASS (new types are optional, nothing references them yet)

**Step 3: Commit**

```bash
git add apps/frontend/src/shared/types/settings.ts
git commit -m "feat(investigation): add per-specialist model/thinking type definitions"
```

---

### Task 2: Add constants and defaults for investigation specialists

**Files:**
- Modify: `apps/frontend/src/shared/constants/models.ts:141-151` (after `DEFAULT_FEATURE_THINKING`)

**Step 1: Add defaults and labels**

Add after `DEFAULT_FEATURE_THINKING` (line 141), before `FEATURE_LABELS`:

```typescript
// ============================================
// Investigation Specialist Settings
// ============================================

// Keys for iterating over investigation specialist config
export const INVESTIGATION_SPECIALIST_KEYS: readonly (keyof import('../types/settings').InvestigationModelConfig)[] = [
  'rootCause', 'impact', 'fixAdvisor', 'reproducer'
] as const;

// Default per-specialist model configuration
export const DEFAULT_INVESTIGATION_MODELS: import('../types/settings').InvestigationModelConfig = {
  rootCause: 'opus',
  impact: 'sonnet',
  fixAdvisor: 'sonnet',
  reproducer: 'sonnet'
};

// Default per-specialist thinking configuration
export const DEFAULT_INVESTIGATION_THINKING: import('../types/settings').InvestigationThinkingConfig = {
  rootCause: 'high',
  impact: 'medium',
  fixAdvisor: 'medium',
  reproducer: 'low'
};

// Labels for investigation specialist UI
export const INVESTIGATION_SPECIALIST_LABELS: Record<
  keyof import('../types/settings').InvestigationModelConfig,
  { label: string; description: string }
> = {
  rootCause: { label: 'Root Cause Agent', description: 'Traces the bug to its source code' },
  impact: { label: 'Impact Agent', description: 'Determines blast radius and severity' },
  fixAdvisor: { label: 'Fix Advisor Agent', description: 'Suggests concrete fix approaches' },
  reproducer: { label: 'Reproducer Agent', description: 'Checks reproducibility and test coverage' }
};
```

Also update the models.ts import line (line 6) to include the new type:

```typescript
import type { AgentProfile, PhaseModelConfig, FeatureModelConfig, FeatureThinkingConfig, InvestigationModelConfig } from '../types/settings';
```

**Step 2: Run typecheck**

Run: `cd apps/frontend && npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/frontend/src/shared/constants/models.ts
git commit -m "feat(investigation): add per-specialist defaults and labels"
```

---

### Task 3: Update GeneralSettings UI to show 4 specialist rows

**Files:**
- Modify: `apps/frontend/src/renderer/components/settings/GeneralSettings.tsx:9-14` (imports), `177-239` (feature model loop)

**Step 1: Update imports**

Add to the constants import (line 9-15):

```typescript
import {
  AVAILABLE_MODELS,
  THINKING_LEVELS,
  DEFAULT_FEATURE_MODELS,
  DEFAULT_FEATURE_THINKING,
  FEATURE_LABELS,
  DEFAULT_INVESTIGATION_MODELS,
  DEFAULT_INVESTIGATION_THINKING,
  INVESTIGATION_SPECIALIST_KEYS,
  INVESTIGATION_SPECIALIST_LABELS
} from '../../../shared/constants';
```

Add `InvestigationModelConfig` to the types import:

```typescript
import type {
  AppSettings,
  FeatureModelConfig,
  InvestigationModelConfig,
  ModelTypeShort,
  ThinkingLevel,
  ToolDetectionResult
} from '../../../shared/types';
```

**Step 2: Replace the FEATURE_LABELS loop**

Replace the loop at line 177-239 with code that:
1. Iterates over `FEATURE_LABELS` but SKIPS `githubIssues` (that becomes the specialist section)
2. After skipping githubIssues in the loop, renders a "GitHub Issues" header with 4 indented specialist sub-rows

```tsx
{/* Standard feature rows (skip githubIssues — shown as specialist section below) */}
{(Object.keys(FEATURE_LABELS) as Array<keyof FeatureModelConfig>)
  .filter((feature) => feature !== 'githubIssues')
  .map((feature) => {
    const featureModels = settings.featureModels || DEFAULT_FEATURE_MODELS;
    const featureThinking = settings.featureThinking || DEFAULT_FEATURE_THINKING;

    return (
      <div key={feature} className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-foreground">
            {FEATURE_LABELS[feature].label}
          </Label>
          <span className="text-xs text-muted-foreground">
            {FEATURE_LABELS[feature].description}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('general.model')}</Label>
            <Select
              value={featureModels[feature]}
              onValueChange={(value) => {
                const newFeatureModels = { ...featureModels, [feature]: value as ModelTypeShort };
                onSettingsChange({ ...settings, featureModels: newFeatureModels });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('general.thinkingLevel')}</Label>
            <Select
              value={featureThinking[feature]}
              onValueChange={(value) => {
                const newFeatureThinking = { ...featureThinking, [feature]: value as ThinkingLevel };
                onSettingsChange({ ...settings, featureThinking: newFeatureThinking });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THINKING_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  })}

{/* GitHub Issues — per-specialist investigation agent config */}
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <Label className="text-sm font-medium text-foreground">
      {t('general.investigationAgents.title')}
    </Label>
    <span className="text-xs text-muted-foreground">
      {t('general.investigationAgents.description')}
    </span>
  </div>
  {INVESTIGATION_SPECIALIST_KEYS.map((specialist) => {
    const invModels = settings.investigationModels || DEFAULT_INVESTIGATION_MODELS;
    const invThinking = settings.investigationThinking || DEFAULT_INVESTIGATION_THINKING;

    return (
      <div key={specialist} className="space-y-1 pl-4 border-l-2 border-border">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-foreground">
            {INVESTIGATION_SPECIALIST_LABELS[specialist].label}
          </Label>
          <span className="text-xs text-muted-foreground">
            {INVESTIGATION_SPECIALIST_LABELS[specialist].description}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('general.model')}</Label>
            <Select
              value={invModels[specialist]}
              onValueChange={(value) => {
                const newInvModels = { ...invModels, [specialist]: value as ModelTypeShort };
                onSettingsChange({ ...settings, investigationModels: newInvModels });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t('general.thinkingLevel')}</Label>
            <Select
              value={invThinking[specialist]}
              onValueChange={(value) => {
                const newInvThinking = { ...invThinking, [specialist]: value as ThinkingLevel };
                onSettingsChange({ ...settings, investigationThinking: newInvThinking });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THINKING_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  })}
</div>
```

**Step 3: Run typecheck**

Run: `cd apps/frontend && npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/frontend/src/renderer/components/settings/GeneralSettings.tsx
git commit -m "feat(investigation): show per-specialist model/thinking rows in settings UI"
```

---

### Task 4: Add i18n keys for investigation specialist labels

**Files:**
- Modify: `apps/frontend/src/shared/i18n/locales/en/settings.json`
- Modify: `apps/frontend/src/shared/i18n/locales/fr/settings.json`

**Step 1: Add English keys**

Add under the `"general"` section (near `featureModelSettings`):

```json
"investigationAgents": {
  "title": "GitHub Issues",
  "description": "Issue investigation agents"
}
```

**Step 2: Add French keys**

Add same structure with French translations:

```json
"investigationAgents": {
  "title": "GitHub Issues",
  "description": "Agents d'investigation des issues"
}
```

**Step 3: Commit**

```bash
git add apps/frontend/src/shared/i18n/locales/en/settings.json apps/frontend/src/shared/i18n/locales/fr/settings.json
git commit -m "feat(i18n): add investigation specialist settings labels"
```

---

### Task 5: Update investigation-handlers.ts to read per-specialist config

**Files:**
- Modify: `apps/frontend/src/main/ipc-handlers/github/investigation-handlers.ts:604-612` (`getGitHubIssuesSettings`)

**Step 1: Add new function to read per-specialist config**

Add alongside the existing `getGitHubIssuesSettings()` function (which stays for triage):

```typescript
/**
 * Get per-specialist investigation model and thinking settings from app settings.
 * Returns a JSON-serializable config dict for --specialist-config CLI arg.
 */
function getInvestigationSpecialistConfig(): Record<string, { model: string; thinking: string }> {
  const rawSettings = readSettingsFile() as Partial<AppSettings> | undefined;
  const invModels = rawSettings?.investigationModels ?? DEFAULT_INVESTIGATION_MODELS;
  const invThinking = rawSettings?.investigationThinking ?? DEFAULT_INVESTIGATION_THINKING;

  return {
    root_cause: {
      model: MODEL_ID_MAP[invModels.rootCause] ?? MODEL_ID_MAP['opus'],
      thinking: invThinking.rootCause ?? 'high'
    },
    impact: {
      model: MODEL_ID_MAP[invModels.impact] ?? MODEL_ID_MAP['sonnet'],
      thinking: invThinking.impact ?? 'medium'
    },
    fix_advisor: {
      model: MODEL_ID_MAP[invModels.fixAdvisor] ?? MODEL_ID_MAP['sonnet'],
      thinking: invThinking.fixAdvisor ?? 'medium'
    },
    reproducer: {
      model: MODEL_ID_MAP[invModels.reproducer] ?? MODEL_ID_MAP['sonnet'],
      thinking: invThinking.reproducer ?? 'low'
    }
  };
}
```

Add imports at the top of the file for `DEFAULT_INVESTIGATION_MODELS` and `DEFAULT_INVESTIGATION_THINKING`.

**Step 2: Update `runInvestigation()` to pass specialist config**

Find where `buildRunnerArgs` is called for investigation (around line 1044-1053). Replace the single `{ model, thinkingLevel }` with the specialist config:

```typescript
const specialistConfig = getInvestigationSpecialistConfig();
const args = [
  ...buildRunnerArgs(
    getRunnerPath(backendPath),
    project.path,
    'investigate',
    [String(issueNumber)],
    // No model/thinkingLevel here — per-specialist config replaces it
  ),
  '--specialist-config', JSON.stringify(specialistConfig),
  ...resumeSessionsArg,
];
```

Remove the `const { model, thinkingLevel } = getGitHubIssuesSettings();` call from the investigation path (keep it for triage).

**Step 3: Run typecheck**

Run: `cd apps/frontend && npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/frontend/src/main/ipc-handlers/github/investigation-handlers.ts
git commit -m "feat(investigation): pass per-specialist config as CLI arg"
```

---

### Task 6: Update Python runner to accept --specialist-config

**Files:**
- Modify: `apps/backend/runners/github/runner.py:838-850` (investigate parser), `340-376` (cmd_investigate)
- Modify: `apps/backend/runners/github/models.py:995-1006` (GitHubRunnerConfig)

**Step 1: Add specialist_config field to GitHubRunnerConfig**

Add after `fast_mode` field (line 1006):

```python
    # Per-specialist investigation config (overrides model/thinking_level for each specialist)
    # Dict mapping specialist name → {"model": str, "thinking": str}
    specialist_config: dict[str, dict[str, str]] | None = None
```

**Step 2: Add argparse argument**

Add to investigate_parser (after line 850):

```python
investigate_parser.add_argument(
    "--specialist-config",
    type=str,
    default=None,
    help="JSON dict of specialist configs: {name: {model, thinking}}",
)
```

**Step 3: Update cmd_investigate and get_config**

In `get_config()` (line 180-190), add:

```python
specialist_config = None
if hasattr(args, "specialist_config") and args.specialist_config:
    specialist_config = json.loads(args.specialist_config)
```

Pass it to `GitHubRunnerConfig`:

```python
return GitHubRunnerConfig(
    ...
    specialist_config=specialist_config,
)
```

**Step 4: Run backend tests**

Run: `cd "D:\Koding\Autoclaude" && python -m pytest tests/test_github_investigation.py -x -v`
Expected: PASS (existing tests don't use specialist_config)

**Step 5: Commit**

```bash
git add apps/backend/runners/github/runner.py apps/backend/runners/github/models.py
git commit -m "feat(investigation): accept --specialist-config CLI arg in runner"
```

---

### Task 7: Remove thinking_budget_multiplier from SpecialistConfig

**Files:**
- Modify: `apps/backend/runners/github/services/parallel_agent_base.py:85` (remove field)
- Modify: `apps/backend/runners/github/services/issue_investigation_orchestrator.py:98` (remove from root_cause config)
- Modify: `tests/test_github_investigation.py:599` (remove from test mock)

**Step 1: Remove from SpecialistConfig dataclass**

In `parallel_agent_base.py` line 85, remove:

```python
    thinking_budget_multiplier: float = 1.0
```

**Step 2: Remove from root_cause specialist**

In `issue_investigation_orchestrator.py` line 98, remove:

```python
        thinking_budget_multiplier=1.5,
```

**Step 3: Remove _effective_budget calculation from factory**

In `issue_investigation_orchestrator.py` lines 366-371, remove:

```python
                # Apply per-specialist thinking multiplier
                _effective_budget = (
                    int(thinking_budget * cfg.thinking_budget_multiplier)
                    if thinking_budget
                    else None
                )
```

And update the reference in `_run_specialist_session` call to use the per-specialist thinking budget (this will be done in Task 8).

**Step 4: Fix test mock**

In `tests/test_github_investigation.py` line 599, remove `thinking_budget_multiplier` field from any test SpecialistConfig mocks.

**Step 5: Run backend tests**

Run: `cd "D:\Koding\Autoclaude" && python -m pytest tests/test_github_investigation.py -x -v`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/backend/runners/github/services/parallel_agent_base.py apps/backend/runners/github/services/issue_investigation_orchestrator.py tests/test_github_investigation.py
git commit -m "refactor(investigation): remove thinking_budget_multiplier from SpecialistConfig"
```

---

### Task 8: Implement two-phase execution in orchestrator

This is the core change. Replace the single `_run_investigation_specialists()` gather with two phases.

**Files:**
- Modify: `apps/backend/runners/github/services/issue_investigation_orchestrator.py:144-508`

**Step 1: Update `investigate()` to use specialist_config**

Replace the model/thinking resolution at lines 194-197:

```python
        # Resolve per-specialist config
        specialist_config = self.config.specialist_config or {}

        # Fallback: use single model/thinking_level for all specialists
        fallback_model_shorthand = self.config.model or "sonnet"
        fallback_model = resolve_model_id(fallback_model_shorthand)
        fallback_thinking_level = self.config.thinking_level or "medium"
        fallback_thinking_budget = get_thinking_budget(fallback_thinking_level)
```

Update the call to `_run_investigation_specialists()` to pass `specialist_config` instead of single model/budget.

**Step 2: Rewrite `_run_investigation_specialists()` as two phases**

Key changes:
1. Split `INVESTIGATION_SPECIALISTS` into `PHASE_1_SPECIALISTS` (root_cause, reproducer) and `PHASE_2_SPECIALISTS` (impact, fix_advisor)
2. Phase 1: gather root_cause + reproducer
3. Parse root_cause structured output
4. Phase 2: build prompts with root cause context, gather impact + fix_advisor
5. Combine results

```python
    # Phase groupings
    PHASE_1_NAMES = {"root_cause", "reproducer"}
    PHASE_2_NAMES = {"impact", "fix_advisor"}

    async def _run_investigation_specialists(
        self,
        issue_context: str,
        project_root: Path,
        specialist_config: dict[str, dict[str, str]],
        fallback_model: str,
        fallback_thinking_budget: int | None,
        issue_number: int | None = None,
        resume_sessions: dict[str, str] | None = None,
    ) -> dict[str, dict[str, Any]]:
        """Run investigation specialists in two phases.

        Phase 1 (parallel): root_cause + reproducer
        Phase 2 (parallel): impact + fix_advisor (with root cause context)
        """
        _agents_done = 0
        _agents_lock = asyncio.Lock()
        total_agents = len(INVESTIGATION_SPECIALISTS)

        phase_1_specs = [s for s in INVESTIGATION_SPECIALISTS if s.name in self.PHASE_1_NAMES]
        phase_2_specs = [s for s in INVESTIGATION_SPECIALISTS if s.name in self.PHASE_2_NAMES]

        def _resolve_specialist(cfg_name: str):
            """Resolve model and thinking budget for a specialist."""
            sc = specialist_config.get(cfg_name, {})
            model = sc.get("model", fallback_model)
            thinking_level = sc.get("thinking", self.config.thinking_level or "medium")
            budget = get_thinking_budget(thinking_level)
            return model, budget

        # ... (factory and lifecycle wrapper similar to current but using _resolve_specialist)

        # === Phase 1 ===
        self._report_progress("investigating", 20, "Phase 1: Root Cause Agent + Reproducer Agent...", issue_number=issue_number)
        phase_1_results = await self._run_parallel_specialists(...)

        # Parse root cause result for context injection
        root_cause_parsed = self._parse_specialist_result("root_cause", phase_1_result_map, RootCauseAnalysis)

        # === Phase 2 ===
        self._report_progress("investigating", 55, "Phase 2: Impact Agent + Fix Advisor Agent (with root cause context)...", issue_number=issue_number)
        # Build phase 2 prompts with root cause context injected
        phase_2_results = await self._run_parallel_specialists(...)

        # Combine all results
        return {**phase_1_result_map, **phase_2_result_map}
```

**Step 3: Add `_build_root_cause_context()` method**

```python
    def _build_root_cause_context(self, root_cause: RootCauseAnalysis | None) -> str:
        """Build root cause context string for injection into Phase 2 prompts."""
        if not root_cause:
            return ""

        code_paths_str = ""
        if root_cause.code_paths:
            code_paths_str = "\n".join(f"- {p}" for p in root_cause.code_paths)

        return f"""
## Root Cause Analysis (from prior investigation phase)

**Root Cause:** {root_cause.identified_root_cause}

**Confidence:** {root_cause.confidence}

**Code Paths:**
{code_paths_str}

**Evidence:** {root_cause.evidence}

**Likely Already Fixed:** {root_cause.likely_already_fixed}

Use this root cause analysis to inform your assessment. Do NOT re-investigate
the root cause — focus on your specialty using these findings as ground truth.
"""
```

**Step 4: Update `_build_specialist_prompt()` to accept root cause context**

Add optional `root_cause_context: str = ""` parameter:

```python
    def _build_specialist_prompt(
        self,
        config: SpecialistConfig,
        issue_context: str,
        project_root: Path,
        root_cause_context: str = "",
    ) -> str:
        # ... existing code ...
        return base_prompt + working_dir_section + issue_context + root_cause_context
```

**Step 5: Run backend tests**

Run: `cd "D:\Koding\Autoclaude" && python -m pytest tests/test_github_investigation.py -x -v`
Expected: PASS (may need test updates for new signature)

**Step 6: Commit**

```bash
git add apps/backend/runners/github/services/issue_investigation_orchestrator.py
git commit -m "feat(investigation): implement two-phase execution with root cause context injection"
```

---

### Task 9: Enhance root cause agent prompt

**Files:**
- Modify: `apps/backend/prompts/github/investigation_root_cause.md`

**Step 1: Add depth requirements section**

Add before the `## Output` section:

```markdown
## Depth Requirements

- You MUST trace at least 3 levels deep in the call chain (entry point → intermediate → root cause location) before concluding
- You MUST explore at least 2 competing hypotheses before settling on a root cause — read both code paths and explain why one is more likely
- Do NOT conclude with "medium" or "low" confidence if you still have unexplored code paths you could Read or Grep
- If the issue mentions a UI behavior, trace it from the React component through the store, IPC handler, and into the backend
- If you find the likely cause early, keep investigating to VERIFY it — read callers, check edge cases, look for related patterns
- Use your full tool budget. Read more files, run more greps. Thoroughness is more valuable than speed for root cause analysis
```

**Step 2: Commit**

```bash
git add apps/backend/prompts/github/investigation_root_cause.md
git commit -m "feat(investigation): add depth requirements to root cause agent prompt"
```

---

### Task 10: Update Phase 2 agent prompts to use root cause context

**Files:**
- Modify: `apps/backend/prompts/github/investigation_impact.md`
- Modify: `apps/backend/prompts/github/investigation_fix_advice.md`

**Step 1: Add context usage instruction to impact prompt**

Add after the "## Your Mission" section in `investigation_impact.md`:

```markdown
## Using Root Cause Context

If a "Root Cause Analysis" section is provided below the issue context, use it as the starting point for your impact assessment. The root cause agent has already identified the problematic code — your job is to trace outward from those code paths to determine blast radius and severity.

This means you can skip Steps 1-2 (identifying affected code) when root cause context is available, and instead focus on mapping dependencies outward from the identified code paths.
```

**Step 2: Add context usage instruction to fix advice prompt**

Add after the "## Your Mission" section in `investigation_fix_advice.md`:

```markdown
## Using Root Cause Context

If a "Root Cause Analysis" section is provided below the issue context, use it as the foundation for your fix approaches. The root cause agent has already identified the exact code location and cause — your job is to design fix strategies that address that specific root cause.

This means you can skip Step 1 (understanding the problem space) when root cause context is available, and instead focus on designing fixes that target the identified code paths.
```

**Step 3: Commit**

```bash
git add apps/backend/prompts/github/investigation_impact.md apps/backend/prompts/github/investigation_fix_advice.md
git commit -m "feat(investigation): update Phase 2 agent prompts to leverage root cause context"
```

---

### Task 11: Update progress reporting for two phases

**Files:**
- Modify: `apps/backend/runners/github/services/issue_investigation_orchestrator.py` (progress calls in Phase 1 and Phase 2)

**Step 1: Update progress percentages**

In the two-phase execution from Task 8, ensure progress reporting uses:

- 10%: Starting investigation
- 20%: Launching Phase 1 (Root Cause Agent + Reproducer Agent)
- 35%: First Phase 1 agent complete
- 50%: Phase 1 complete
- 55%: Launching Phase 2 with root cause context
- 65%: First Phase 2 agent complete
- 80%: Phase 2 complete
- 100%: Report built

The `_agent_lifecycle_wrapper` needs different progress math for each phase:
- Phase 1: 20 + (agent_index * 15) = 35, 50
- Phase 2: 55 + (agent_index * 15) = 65 (first), 80 (second... but wait, with only 2 agents per phase we want: 55 → 65 → 80)

Actually simplify: just pass the base offset into the wrapper.

**Step 2: Run backend tests**

Run: `cd "D:\Koding\Autoclaude" && python -m pytest tests/test_github_investigation.py -x -v`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/backend/runners/github/services/issue_investigation_orchestrator.py
git commit -m "feat(investigation): update progress reporting for two-phase execution"
```

---

### Task 12: Run full test suite and typecheck

**Step 1: Run frontend typecheck**

Run: `cd apps/frontend && npm run typecheck`
Expected: PASS

**Step 2: Run backend tests**

Run: `cd "D:\Koding\Autoclaude" && python -m pytest tests/ -x -v`
Expected: PASS

**Step 3: Run frontend lint**

Run: `cd apps/frontend && npm run lint`
Expected: PASS (or fix any lint issues)

**Step 4: Commit any fixes**

```bash
git commit -m "fix(investigation): address lint and test issues from pipeline redesign"
```

---

### Task 13: Update design doc with correction

**Files:**
- Modify: `docs/plans/2026-02-14-investigation-pipeline-redesign-design.md`

**Step 1: Fix the "Code Removed" section**

Remove the rows about `featureModels.githubIssues` and `featureThinking.githubIssues` since those stay for triage/enrich/split. Add a note that `investigationModels`/`investigationThinking` are additions, not replacements.

**Step 2: Commit**

```bash
git add -f docs/plans/2026-02-14-investigation-pipeline-redesign-design.md
git commit -m "docs: correct design doc — githubIssues stays for triage, investigation config is additive"
```
