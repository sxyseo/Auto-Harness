# Phase 5 PRD: Full Integration

**Status:** Draft
**Parent:** [Design Document](design-document.md)
**Phase:** 5 of 5
**Scope:** Wire all Phase 1-4 components into the running application UI

---

## 1. Objective

Connect all building blocks from Phases 1-4 into a fully functional Issues tab. After Phase 5, every component, hook, and handler built in previous phases is accessible through the live application. The Issues tab transforms from a basic read-only view with partial enrichment into a complete triage hub with inline editing, bulk operations, AI triage, dependencies, metrics, and a 3-panel triage mode.

**User-visible outcome:** The Issues tab is a full-featured triage workstation. Users can filter by workflow state, edit issues inline, perform bulk operations, trigger AI triage, view dependencies and metrics, configure label sync and trust settings, and use 3-panel triage mode for efficient issue processing.

---

## 2. User Stories

### US-1: Enrichment Data in Issue List

**As a** maintainer browsing issues,
**I want to** see workflow state badges and completeness scores on every issue in the list,
**So that** I can quickly identify which issues need attention.

**Acceptance Criteria:**
- AC-1.1: Every `IssueListItem` displays `WorkflowStateBadge` with enrichment state (defaults to `new` if no enrichment)
- AC-1.2: Every `IssueListItem` displays `CompletenessIndicator` with enrichment score (defaults to 0)
- AC-1.3: Enrichment data flows from `enrichments` store through `IssueList` to `IssueListItem`
- AC-1.4: `IssueListProps` type includes `enrichments` parameter
- AC-1.5: List re-renders efficiently — individual items only re-render when their enrichment changes

### US-2: Workflow State Filtering

**As a** maintainer triaging a backlog,
**I want** the workflow filter to actually filter the displayed issues,
**So that** I can focus on issues in a specific stage.

**Acceptance Criteria:**
- AC-2.1: When workflow filter states are selected, only issues matching those states appear in the list
- AC-2.2: Issues with no enrichment are treated as `new` state for filtering purposes
- AC-2.3: Workflow filter combines with existing text search and GitHub state (open/closed) filters
- AC-2.4: Empty filter (no states selected) shows all issues
- AC-2.5: Selection clears when filter changes

### US-3: AI Triage from Detail Panel

**As a** maintainer reviewing an issue,
**I want to** trigger AI triage, improvement, and split operations from the enrichment panel,
**So that** I can enrich issues without leaving the detail view.

**Acceptance Criteria:**
- AC-3.1: "AI Triage" button in EnrichmentPanel calls `useAITriage.enrich()` with current issue number
- AC-3.2: "Improve Issue" button calls `useAITriage.improve()` — posts structured comment
- AC-3.3: "Split Issue" button calls `useAITriage.split()` — opens split dialog
- AC-3.4: `TriageProgressOverlay` shows during AI operations
- AC-3.5: `IssueSplitDialog` opens with split suggestion and allows user to confirm/modify
- AC-3.6: Buttons are disabled while an AI operation is in progress
- AC-3.7: Error states show inline in the enrichment panel

### US-4: Inline Issue Editing

**As a** maintainer triaging an issue,
**I want to** edit the issue title, body, labels, and assignees directly from the detail panel,
**So that** I don't need to switch to GitHub.

**Acceptance Criteria:**
- AC-4.1: Issue title is editable via double-click or edit icon → `InlineEditor`
- AC-4.2: Issue body is editable via edit icon → `InlineEditor` with markdown support
- AC-4.3: Labels section shows `LabelManager` — add/remove labels inline
- AC-4.4: Assignees section shows `AssigneeManager` — add/remove assignees inline
- AC-4.5: `CommentForm` appears at the bottom of the detail panel
- AC-4.6: Close/Reopen button available in actions area with enrichment auto-transition
- AC-4.7: All mutations use `useMutations` hook, which calls IPC handlers
- AC-4.8: Optimistic UI updates — show change immediately, revert on error

### US-5: Bulk Operations

**As a** maintainer triaging many issues,
**I want to** select multiple issues and perform batch actions,
**So that** I can efficiently process large backlogs.

**Acceptance Criteria:**
- AC-5.1: Each `IssueListItem` shows a selection checkbox on hover and when selected
- AC-5.2: `BulkActionBar` appears when one or more issues are selected
- AC-5.3: Bulk actions include: close, reopen, add label, remove label, add assignee, transition state
- AC-5.4: `BulkResultsPanel` shows per-item success/failure after bulk operation
- AC-5.5: Selection clears after successful bulk operation
- AC-5.6: Bulk operations are disabled during another bulk operation
- AC-5.7: "Select All" / "Deselect All" controls in the action bar

### US-6: Dependencies in Detail Panel

**As a** maintainer reviewing an issue,
**I want to** see which issues this issue tracks and which issues track it,
**So that** I can understand dependency relationships.

**Acceptance Criteria:**
- AC-6.1: `DependencyList` renders below the enrichment card in `IssueDetail`
- AC-6.2: Dependencies auto-fetch when issue is selected (via `useDependencies` hook)
- AC-6.3: Shows loading spinner while fetching
- AC-6.4: Shows "No dependencies" when empty
- AC-6.5: Cross-repo references display as `org/repo#number`

### US-7: Metrics Dashboard

**As a** project lead,
**I want to** see triage metrics (state distribution, throughput, backlog age),
**So that** I can monitor triage health.

**Acceptance Criteria:**
- AC-7.1: `MetricsDashboard` is accessible from the issues page header area
- AC-7.2: Metrics compute on first load and can be refreshed manually
- AC-7.3: Time window toggle (7d, 30d, all) filters metrics
- AC-7.4: State distribution, completeness distribution, transitions count, avg backlog age, weekly throughput all display
- AC-7.5: Uses `useMetrics` hook wired to IPC handlers

### US-8: 3-Panel Triage Mode

**As a** power user triaging issues,
**I want to** toggle a 3-panel layout (compact list | detail | triage sidebar),
**So that** I can see enrichment, dependencies, and metrics alongside the issue.

**Acceptance Criteria:**
- AC-8.1: Toggle button in header switches between 2-panel and 3-panel layout
- AC-8.2: 3-panel: 25% compact list, 50% detail, 25% triage sidebar
- AC-8.3: Triage sidebar contains: EnrichmentPanel (extracted from detail), DependencyList, MetricsDashboard summary
- AC-8.4: Only available when viewport width ≥ 1200px
- AC-8.5: Auto-falls back to 2-panel if viewport shrinks below 1200px
- AC-8.6: Keyboard shortcuts Ctrl+1/2/3 to focus panels (only in triage mode)
- AC-8.7: Triage mode preference persists in phase4-store

### US-9: Settings Integration

**As a** user,
**I want to** configure label sync and AI trust settings from the project settings,
**So that** I can customize the triage experience per project.

**Acceptance Criteria:**
- AC-9.1: `LabelSyncSettings` appears as a sub-section under GitHub project settings
- AC-9.2: `ProgressiveTrustSettings` appears as a sub-section under GitHub project settings
- AC-9.3: Settings changes take effect immediately (no app restart required)
- AC-9.4: Settings use i18n keys for all labels

### US-10: Barrel Export Completeness

**As a** developer,
**I want** all Phase 1-4 hooks and components exported from barrel files,
**So that** imports are clean and discoverable.

**Acceptance Criteria:**
- AC-10.1: `hooks/index.ts` exports all 13 hooks
- AC-10.2: `components/index.ts` exports all 30+ components
- AC-10.3: No circular dependencies introduced
- AC-10.4: TypeScript compilation succeeds with `--strict`

---

## 3. Technical Specification

### 3.1 Modified Files

| File | Changes |
|------|---------|
| `components/github-issues/types/index.ts` | Extend IssueListProps, IssueDetailProps with new props |
| `components/github-issues/components/IssueList.tsx` | Pass enrichment to IssueListItem |
| `components/github-issues/components/IssueListItem.tsx` | Add selection checkbox |
| `components/github-issues/components/IssueDetail.tsx` | Wire AI buttons, add mutations, dependencies, comments |
| `components/github-issues/components/IssueListHeader.tsx` | Add triage mode toggle, metrics button |
| `components/github-issues/components/index.ts` | Export all components |
| `components/github-issues/hooks/index.ts` | Export all hooks |
| `components/GitHubIssues.tsx` | Wire all hooks, add bulk/AI state, 3-panel layout |
| `settings/sections/SectionRouter.tsx` | Add label sync + trust settings under GitHub |
| `shared/i18n/locales/en/common.json` | Phase 5 integration i18n keys |
| `shared/i18n/locales/fr/common.json` | Phase 5 integration i18n keys (French) |

### 3.2 New Files

| File | Purpose |
|------|---------|
| `components/github-issues/components/TriageSidebar.tsx` | Right panel in 3-panel mode |
| `components/github-issues/components/__tests__/TriageSidebar.test.tsx` | Tests for triage sidebar |
| `components/github-issues/hooks/useTriageMode.ts` | Triage mode state, keyboard shortcuts, resize observer |
| `components/github-issues/hooks/__tests__/useTriageMode.test.ts` | Tests for triage mode hook |
| `components/github-issues/__tests__/phase5-integration.test.ts` | Phase 5 integration tests |

### 3.3 No New IPC Channels

Phase 5 only wires existing Phase 1-4 IPC channels. No new channels needed.

### 3.4 i18n Keys (New)

```
phase5.triageMode — "Triage Mode"
phase5.triageModeTooltip — "Toggle 3-panel triage layout"
phase5.selectAll — "Select All"
phase5.deselectAll — "Deselect All"
phase5.selectedCount — "{{count}} selected"
phase5.metricsToggle — "Show Metrics"
phase5.editTitle — "Edit Title"
phase5.editBody — "Edit Body"
phase5.addComment — "Add Comment"
phase5.closeIssue — "Close Issue"
phase5.reopenIssue — "Reopen Issue"
phase5.bulkInProgress — "Bulk operation in progress..."
phase5.narrowScreen — "Triage mode requires a wider screen"
```

---

## 4. Out of Scope

- Custom keyboard shortcuts (fixed Ctrl+1/2/3)
- Drag-and-drop issue reordering
- Real-time WebSocket updates from GitHub
- Resizable panel widths (fixed percentages)
- Offline mode / draft persistence for comments
- Custom workflow state definitions
