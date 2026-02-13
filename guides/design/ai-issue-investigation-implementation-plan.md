# AI Issue Investigation — Implementation Plan

> **Design doc:** [ai-issue-investigation-design.md](ai-issue-investigation-design.md)
> **Date:** 2026-02-13
> **Branch:** `feat/issues`

## Implementation Phases

14 phases ordered by dependency. Backend (B) and frontend (F) phases can run in parallel where noted.

---

### Phase 1 — Backend: Shared Infrastructure Extraction [B1]

**Goal:** Extract reusable parallel orchestrator base from PR review system.

**New files:**
- `apps/backend/runners/github/services/parallel_agent_base.py` — `ParallelAgentOrchestrator` base class + `SpecialistConfig` dataclass. Extracts: `_load_prompt()`, `_run_specialist_session()`, `_run_parallel_specialists()` (asyncio.gather wrapper), `_report_progress()`.

**Modified files:**
- `apps/backend/runners/github/services/parallel_orchestrator_reviewer.py` — Inherit from base, remove duplicated methods, keep PR-specific logic (finding validation, verdict generation, SPECIALIST_CONFIGS).
- `apps/backend/runners/github/services/__init__.py` — Add exports.

**Depends on:** Nothing (foundational).

---

### Phase 2 — Backend: Investigation Models & Persistence [B2]

**Goal:** Pydantic models for structured agent output + `.auto-claude/issues/` read/write layer.

**New files:**
- `apps/backend/runners/github/services/investigation_models.py` — `RootCauseAnalysis`, `ImpactAssessment`, `FixAdvice`, `ReproductionAnalysis`, `InvestigationReport`, `SuggestedLabel`, `LinkedPR`, per-specialist response models.
- `apps/backend/runners/github/services/investigation_persistence.py` — `save_investigation_state()`, `load_investigation_state()`, `save_investigation_report()`, `load_investigation_report()`, `save_agent_log()`, `save_github_comment_id()`, `list_investigated_issues()`. All writes via `write_json_atomic()`.

**Depends on:** B1 (SpecialistConfig import).

---

### Phase 3 — Frontend: Type Definitions & IPC Foundation [F1]

**Goal:** All type contracts, IPC channels, and preload bridge for the investigation system.

**New files:**
- `apps/frontend/src/shared/types/investigation.ts` — `InvestigationState`, `InvestigationReport`, `InvestigationProgress`, `InvestigationResult`, `InvestigationDismissReason`, `InvestigationSettings`, `BatchStagingItem`.

**Modified files:**
- `apps/frontend/src/shared/types/integrations.ts` — Deprecate old `GitHubInvestigationResult`/`Status`.
- `apps/frontend/src/shared/types/index.ts` — Add `investigation` exports.
- `apps/frontend/src/shared/constants/ipc.ts` — Add 7 new IPC channels (`INVESTIGATION_START`, `CANCEL`, `CREATE_TASK`, `DISMISS`, `POST_GITHUB`, `GET_SETTINGS`, `SAVE_SETTINGS`).
- `apps/frontend/src/shared/types/ipc.ts` — Update callback signatures, add new method declarations.
- `apps/frontend/src/preload/api/modules/github-api.ts` — Add 7 new API methods + implementations.

**Depends on:** Nothing. **Can run in parallel with B1 and B2.**

---

### Phase 4 — Backend: Investigation Orchestrator & Prompts [B3]

**Goal:** Core orchestrator that runs 4 specialist agents in parallel + prompt files.

**New files:**
- `apps/backend/runners/github/services/issue_investigation_orchestrator.py` — `IssueInvestigationOrchestrator` inheriting from `ParallelAgentOrchestrator`. 4 specialist configs (root_cause, impact, fix_advisor, reproducer) with `["Read", "Grep", "Glob"]` tools only.
- `apps/backend/prompts/github/investigation_root_cause.md` — Trace bug to source code paths.
- `apps/backend/prompts/github/investigation_impact.md` — Blast radius and affected components.
- `apps/backend/prompts/github/investigation_fix_advice.md` — Concrete fix approaches with files and patterns.
- `apps/backend/prompts/github/investigation_reproduction.md` — Reproducibility and test coverage.

**Modified files:**
- `apps/backend/agents/tools_pkg/models.py` — Add `investigation_specialist` agent config (`BASE_READ_TOOLS` only).
- `apps/backend/runners/github/orchestrator.py` — Add `investigate_issue()` method.
- `apps/backend/runners/github/services/__init__.py` — Add exports.

**Depends on:** B1 (base class), B2 (models + persistence).

---

### Phase 5 — Frontend: Investigation Store [F2]

**Goal:** Full multi-issue Zustand store modeled after `pr-review-store.ts`.

**Rewrite:**
- `apps/frontend/src/renderer/stores/github/investigation-store.ts` — Complete rewrite. Keyed by `${projectId}:${issueNumber}`. State per issue: `isInvestigating`, `progress`, `report`, `error`, `previousReport`, `specId`, `dismissReason`. Derived state computation (8 states). Global IPC listeners. Settings sub-state.

**Modified files:**
- `apps/frontend/src/renderer/stores/github/index.ts` — Wire up `initializeInvestigationListeners()` / `cleanupInvestigationListeners()`.

**Depends on:** F1 (types).

---

### Phase 6 — Backend: Report Builder & Worktree Pre-Allocation [B4]

**Goal:** GitHub comment formatter + worktree creation at investigation start.

**New files:**
- `apps/backend/runners/github/services/investigation_report_builder.py` — `build_github_comment(report)` (branded markdown with collapsible sections), `build_summary(report)` (one-paragraph for list display).

**Modified files:**
- `apps/backend/runners/github/orchestrator.py` — Add `start_investigation()` method: allocate worktree via `WorktreeManager.get_or_create_worktree(spec_name)`, save initial state, run orchestrator, handle retry-once on failure, save results.
- `apps/backend/runners/github/models.py` — Add investigation settings to `GitHubRunnerConfig`.

**Depends on:** B2 (models), B3 (orchestrator).

---

### Phase 7 — Frontend: IPC Handler Rewrite [F3]

**Goal:** Main process handlers for the full investigation lifecycle.

**Rewrite:**
- `apps/frontend/src/main/ipc-handlers/github/investigation-handlers.ts` — Complete rewrite. Handles all 7 IPC channels. Spawns backend subprocess via `runPythonSubprocess()`. Tracks running processes (Map of issueNumber → process) for cancel support. Uses `createIPCCommunicators` for progress/error/complete. Create-task handler uses template-based spec generation. Dismiss handler closes GitHub issue with reason comment. Post handler posts branded comment.

**Modified files:**
- `apps/frontend/src/main/ipc-handlers/github/index.ts` — Update handler registration if needed.

**Depends on:** F1 (IPC channels), B4 (backend ready to receive investigation requests).

---

### Phase 8 — Frontend: Core UI Components [F4]

**Goal:** InvestigateButton, InvestigationPanel, progress bar, and hook rewrite.

**New files:**
- `apps/frontend/src/renderer/components/github-issues/components/InvestigateButton.tsx` — State machine button: `AI Investigate` (blue) → `Investigating...` (animated) → `View Results` (green) → `Create Task` (purple). Cancel button alongside during investigation.
- `apps/frontend/src/renderer/components/github-issues/components/InvestigationPanel.tsx` — Mirrors PR review layout. 4 collapsible agent sections. AI summary, severity badge, suggested labels (accept/reject), activity log, "Post to GitHub" button, "Likely resolved" banner, "Show original" toggle.
- `apps/frontend/src/renderer/components/github-issues/components/InvestigationProgressBar.tsx` — Mini progress bar for issue list items (0-100%, checkmark + task link after completion).

**Rewrite:**
- `apps/frontend/src/renderer/components/github-issues/hooks/useGitHubInvestigation.ts` — Use new investigation store. Return: `investigationState()`, `startInvestigation`, `cancelInvestigation`, `createTask`, `dismissIssue`, `getActiveInvestigations`.

**Modified files:**
- `apps/frontend/src/renderer/components/github-issues/components/index.ts` — Add new exports, remove `EnrichmentPanel`.
- `apps/frontend/src/renderer/components/github-issues/types/index.ts` — Update all component prop types (remove triage/enrichment props, add investigation props).

**Depends on:** F2 (store), F1 (types).

---

### Phase 9 — Frontend: Issue Detail & List Rewiring [F5]

**Goal:** Replace enrichment/triage UI with investigation UI in detail view and list.

**Modified files:**
- `apps/frontend/src/renderer/components/github-issues/components/IssueDetail.tsx` — Remove: enrichment panel, create spec button, triage button. Add: `InvestigateButton` (state machine), `InvestigationPanel`, dismiss button with reason dropdown, closed issue warning banner, AI summary as primary view with "Show original" toggle.
- `apps/frontend/src/renderer/components/github-issues/components/IssueListItem.tsx` — Remove: `WorkflowStateBadge`, `CompletenessIndicator`. Add: `InvestigationProgressBar`, task link badge.
- `apps/frontend/src/renderer/components/github-issues/components/IssueList.tsx` — Pass investigation states instead of enrichments.
- `apps/frontend/src/renderer/components/github-issues/components/IssueListHeader.tsx` — Replace workflow filter chips with investigation state filter chips. Add "Show dismissed" toggle. Remove triage mode toggle.

**Depends on:** F4 (components exist).

---

### Phase 10 — Frontend: Main Component Rewiring [F6]

**Goal:** Update parent `GitHubIssues.tsx` to use investigation system.

**Modified files:**
- `apps/frontend/src/renderer/components/GitHubIssues.tsx` — Remove: all triage/enrichment imports, hooks, and state (`useEnrichmentStore`, `useAITriage`, `useTriageMode`, `BatchTriageReview`, `TriageProgressOverlay`, `TriageSidebar`, `InvestigationDialog`). Add: investigation store, investigation callbacks. Replace 3-panel triage mode with 2-panel (investigation panel is inline in detail view). Wire all investigation callbacks to IssueDetail.
- `apps/frontend/src/renderer/components/github-issues/index.ts` — Remove `InvestigationDialog`, add new exports.

**Depends on:** F5 (child components rewired).

---

### Phase 11 — Backend: Pipeline Extension & Spec Generation [B5]

**Goal:** `--issue-workflow` flag + template-based spec creation from investigation.

**New files:**
- `apps/backend/runners/github/services/investigation_spec_generator.py` — `generate_spec_from_investigation()`: loads report from `.auto-claude/issues/`, creates `spec.md` (from AI summary + root cause + fix advice), `requirements.json`, `task_metadata.json`, copies `investigation_report.json` into spec dir. All template-based (no AI cost).

**Modified files:**
- `apps/backend/cli/main.py` — Add `--issue-workflow` argument.
- `apps/backend/cli/build_commands.py` — Handle `issue_workflow=True`: load investigation report, inject context into coder prompt (via `prompt += "\n\n" + context` pattern), skip phases per setting, update investigation state to "building"/"done".
- `apps/backend/runners/github/orchestrator.py` — Add `create_task_from_investigation()` method.

**Depends on:** B2 (persistence), B3 (orchestrator). **Can run in parallel with F3-F6.**

---

### Phase 12 — Frontend: Batch Staging & Settings [F7]

**Goal:** Auto-create batch staging banner + investigation settings subsection.

**New files:**
- `apps/frontend/src/renderer/components/github-issues/components/BatchStagingBanner.tsx` — Collapsible inline banner. Pending task creations, approve/reject per item, configurable limit.
- `apps/frontend/src/renderer/components/github-issues/components/InvestigationSettings.tsx` — All 8 settings: auto-create toggle, auto-start toggle, pipeline mode dropdown, auto-post toggle, auto-close toggle, max parallel (1-10), label include/exclude filters.

**Modified files:**
- `apps/frontend/src/renderer/components/settings/sections/SectionRouter.tsx` — Render `InvestigationSettings` in GitHub settings section.
- `apps/frontend/src/renderer/components/GitHubIssues.tsx` — Render `BatchStagingBanner` above issue list.

**Depends on:** F2 (store), F1 (types).

---

### Phase 13 — Frontend: i18n [F8]

**Goal:** All translation keys for English and French.

**Modified files:**
- `apps/frontend/src/shared/i18n/locales/en/common.json` — Investigation namespace (buttons, states, agent names, dismiss reasons, filters, batch staging).
- `apps/frontend/src/shared/i18n/locales/en/settings.json` — Investigation settings labels and descriptions.
- `apps/frontend/src/shared/i18n/locales/fr/common.json` — French translations.
- `apps/frontend/src/shared/i18n/locales/fr/settings.json` — French translations.

**Depends on:** F4-F7 (all components exist to know what keys are needed).

---

### Phase 14 — Frontend: Cleanup Deprecated Code [F9]

**Goal:** Remove obsolete triage/enrichment code.

**Files to remove:**
- `InvestigationDialog.tsx` — Replaced by inline `InvestigateButton`.
- `CreateSpecButton.tsx` — No longer used (investigation is the only path).
- `useTriageMode.ts` — Triage mode removed.

**Files to deprecate (keep for backwards compat with old data):**
- `EnrichmentPanel.tsx`, `TriageSidebar.tsx`, `WorkflowStateBadge.tsx`, `WorkflowStateDropdown.tsx`, `WorkflowFilter.tsx`, `CompletenessIndicator.tsx`, `CompletenessBreakdown.tsx`, `useAITriage.ts`, `enrichment-store.ts`, `ai-triage-store.ts`.

**Depends on:** F6 (all references removed).

---

## Dependency Graph

```
B1 ──→ B2 ──→ B3 ──→ B4 ──→ B5
                              ↑
F1 ──→ F2 ──→ F4 ──→ F5 ──→ F6 ──→ F9
       ↓      ↑              ↑
       F3 ────┘              F7
       (needs B4)            ↓
                             F8
```

**Parallel lanes:**
- B1+B2 can run in parallel with F1
- B5 can run in parallel with F3-F6
- F7 can run in parallel with F5-F6
- F8 runs after all components exist
- F9 runs last

---

## File Summary

### New files (17)

| # | File | Phase |
|---|------|-------|
| 1 | `apps/backend/runners/github/services/parallel_agent_base.py` | B1 |
| 2 | `apps/backend/runners/github/services/investigation_models.py` | B2 |
| 3 | `apps/backend/runners/github/services/investigation_persistence.py` | B2 |
| 4 | `apps/backend/runners/github/services/issue_investigation_orchestrator.py` | B3 |
| 5 | `apps/backend/prompts/github/investigation_root_cause.md` | B3 |
| 6 | `apps/backend/prompts/github/investigation_impact.md` | B3 |
| 7 | `apps/backend/prompts/github/investigation_fix_advice.md` | B3 |
| 8 | `apps/backend/prompts/github/investigation_reproduction.md` | B3 |
| 9 | `apps/backend/runners/github/services/investigation_report_builder.py` | B4 |
| 10 | `apps/backend/runners/github/services/investigation_spec_generator.py` | B5 |
| 11 | `apps/frontend/src/shared/types/investigation.ts` | F1 |
| 12 | `apps/frontend/src/renderer/components/github-issues/components/InvestigateButton.tsx` | F4 |
| 13 | `apps/frontend/src/renderer/components/github-issues/components/InvestigationPanel.tsx` | F4 |
| 14 | `apps/frontend/src/renderer/components/github-issues/components/InvestigationProgressBar.tsx` | F4 |
| 15 | `apps/frontend/src/renderer/components/github-issues/components/BatchStagingBanner.tsx` | F7 |
| 16 | `apps/frontend/src/renderer/components/github-issues/components/InvestigationSettings.tsx` | F7 |
| 17 | (i18n keys added to 4 existing locale files) | F8 |

### Files to rewrite (3)

| # | File | Phase |
|---|------|-------|
| 1 | `apps/frontend/src/renderer/stores/github/investigation-store.ts` | F2 |
| 2 | `apps/frontend/src/main/ipc-handlers/github/investigation-handlers.ts` | F3 |
| 3 | `apps/frontend/src/renderer/components/github-issues/hooks/useGitHubInvestigation.ts` | F4 |

### Files to modify (22)

| # | File | Phase(s) |
|---|------|----------|
| 1 | `apps/backend/runners/github/services/parallel_orchestrator_reviewer.py` | B1 |
| 2 | `apps/backend/runners/github/services/__init__.py` | B1, B3, B5 |
| 3 | `apps/backend/agents/tools_pkg/models.py` | B3 |
| 4 | `apps/backend/runners/github/orchestrator.py` | B3, B4, B5 |
| 5 | `apps/backend/runners/github/models.py` | B4 |
| 6 | `apps/backend/cli/main.py` | B5 |
| 7 | `apps/backend/cli/build_commands.py` | B5 |
| 8 | `apps/frontend/src/shared/types/integrations.ts` | F1 |
| 9 | `apps/frontend/src/shared/types/index.ts` | F1 |
| 10 | `apps/frontend/src/shared/constants/ipc.ts` | F1 |
| 11 | `apps/frontend/src/shared/types/ipc.ts` | F1 |
| 12 | `apps/frontend/src/preload/api/modules/github-api.ts` | F1 |
| 13 | `apps/frontend/src/renderer/stores/github/index.ts` | F2 |
| 14 | `apps/frontend/src/main/ipc-handlers/github/index.ts` | F3 |
| 15 | `apps/frontend/src/renderer/components/github-issues/components/index.ts` | F4 |
| 16 | `apps/frontend/src/renderer/components/github-issues/types/index.ts` | F4 |
| 17 | `apps/frontend/src/renderer/components/github-issues/components/IssueDetail.tsx` | F5 |
| 18 | `apps/frontend/src/renderer/components/github-issues/components/IssueListItem.tsx` | F5 |
| 19 | `apps/frontend/src/renderer/components/github-issues/components/IssueList.tsx` | F5 |
| 20 | `apps/frontend/src/renderer/components/github-issues/components/IssueListHeader.tsx` | F5 |
| 21 | `apps/frontend/src/renderer/components/GitHubIssues.tsx` | F6, F7 |
| 22 | `apps/frontend/src/renderer/components/settings/sections/SectionRouter.tsx` | F7 |

### Files to remove (3)

| # | File | Phase |
|---|------|-------|
| 1 | `InvestigationDialog.tsx` | F9 |
| 2 | `CreateSpecButton.tsx` | F9 |
| 3 | `useTriageMode.ts` | F9 |

### Files to deprecate (10)

EnrichmentPanel, TriageSidebar, WorkflowStateBadge, WorkflowStateDropdown, WorkflowFilter, CompletenessIndicator, CompletenessBreakdown, useAITriage, enrichment-store, ai-triage-store.
