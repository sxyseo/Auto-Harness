# Phase 5 Brownfield Analysis: Full Integration

**Date:** 2026-02-12
**Phase:** 5 of 5 — Full Integration
**Scope:** Wire all Phase 1-4 components into the running application

---

## 1. Integration Gap Summary

Phases 1-4 built the complete building-block layer: types, constants, IPC handlers, Zustand stores, hooks, and UI components. However, **none of these components are mounted in the actual application UI**. The main container (`GitHubIssues.tsx`) still uses a minimal two-column layout with partial enrichment integration.

### Current State vs Target State

| Feature | Current | Target |
|---------|---------|--------|
| Enrichment in list items | triageState/completenessScore NOT passed from parent | Enrichment data flows through IssueList → IssueListItem |
| Workflow filtering | WorkflowFilter UI rendered in header | Filter actually applied to displayed issues |
| AI triage buttons | EnrichmentPanel accepts props but IssueDetail doesn't pass them | Buttons wired to useAITriage hook |
| Mutation components | InlineEditor, LabelManager, AssigneeManager, CommentForm exist | Mounted in IssueDetail for inline editing |
| Bulk operations | BulkActionBar, BulkResultsPanel exist | Multi-select + action bar in GitHubIssues container |
| AI triage dialogs | IssueSplitDialog, TriageProgressOverlay, EnrichmentCommentPreview exist | Wired with state management in GitHubIssues |
| Dependencies | DependencyList component exists | Mounted in IssueDetail panel |
| Completeness breakdown | CompletenessBreakdown component exists | Mounted in IssueDetail enrichment section |
| Metrics dashboard | MetricsDashboard component exists | Mounted in GitHubIssues page |
| Label sync settings | LabelSyncSettings component exists | Mounted in project settings |
| Progressive trust | ProgressiveTrustSettings component exists | Mounted in project settings |
| 3-panel triage mode | phase4-store has triageModeEnabled flag | Layout toggle, responsive 3-panel |
| Barrel exports | Partial — hooks/index.ts exports only 4 hooks | All hooks and components exported |

---

## 2. Container Component: GitHubIssues.tsx

**File:** `apps/frontend/src/renderer/components/GitHubIssues.tsx` (286 lines)

### Current Architecture

```
GitHubIssues.tsx (container)
├── useGitHubIssues()          — Issue loading, filtering, pagination
├── useGitHubInvestigation()   — Investigation flow
├── useIssueFiltering()        — Text search + GitHub state filter
├── useAutoFix()               — Auto-fix toggle
├── useAnalyzePreview()        — Batch analysis wizard
├── useEnrichmentStore         — Enrichment data (direct store access)
└── Renders:
    ├── IssueListHeader        — Filters, search, auto-fix, analyze
    ├── IssueList              — Scrollable list (50% width)
    │   └── IssueListItem[]    — Individual issue cards
    ├── IssueDetail            — Detail panel (50% width)
    │   └── EnrichmentPanel    — Enrichment sections
    ├── InvestigationDialog     — Task creation dialog
    └── BatchReviewWizard       — Batch analysis wizard
```

### Missing Hook Integrations

These hooks exist but are NOT called in GitHubIssues.tsx:

| Hook | Created In | Purpose |
|------|-----------|---------|
| `useMutations` | Phase 2 | Edit title/body/labels/assignees, close/reopen, comment |
| `useBulkOperations` | Phase 2 | Execute bulk actions across selected issues |
| `useAITriage` | Phase 3 | AI enrichment, split suggestion, apply results |
| `useLabelSync` | Phase 4 | Enable/disable sync, sync on transition |
| `useDependencies` | Phase 4 | Fetch issue dependencies |
| `useMetrics` | Phase 4 | Compute/refresh triage metrics |
| `useEnrichedIssueFiltering` | Phase 1 | Workflow state + completeness filtering |

### Missing Component Mounts

Components built but not rendered:

**Phase 2:** InlineEditor, LabelManager, AssigneeManager, CommentForm, BulkActionBar, BulkResultsPanel, CreateSpecButton
**Phase 3:** TriageResultCard, BatchTriageReview, EnrichmentCommentPreview, IssueSplitDialog, TriageProgressOverlay, ProgressiveTrustSettings
**Phase 4:** LabelSyncSettings, DependencyList, MetricsDashboard, CompletenessBreakdown

---

## 3. IssueList → IssueListItem Data Flow Gap

**File:** `apps/frontend/src/renderer/components/github-issues/components/IssueList.tsx` (117 lines)

### The Problem (lines 77-84)

```tsx
{issues.map((issue) => (
  <IssueListItem
    key={issue.id}
    issue={issue}
    isSelected={selectedIssueNumber === issue.number}
    onClick={() => onSelectIssue(issue.number)}
    onInvestigate={() => onInvestigate(issue)}
    // ❌ Missing: triageState, completenessScore
  />
))}
```

`IssueListItem` accepts `triageState` and `completenessScore` as optional props, and the component already renders `WorkflowStateBadge` and `CompletenessIndicator`. But `IssueList` doesn't receive enrichment data and thus can't pass it through.

### Solution Pattern

**Option A — Enrichment lookup prop:** Pass `enrichments: Record<string, IssueEnrichment>` to `IssueList`, look up per-issue.
**Option B — Pre-enriched items:** Use `useEnrichedIssueFiltering` in container to merge issues + enrichment before passing to IssueList.

Option A is simpler and doesn't change the data flow pattern. Add `enrichments` to `IssueListProps`.

---

## 4. IssueDetail Integration Points

**File:** `apps/frontend/src/renderer/components/github-issues/components/IssueDetail.tsx` (234 lines)

### Current Integration (line 182-198)

EnrichmentPanel receives basic props but is missing:
- `onAITriage` — not wired (useAITriage hook not called)
- `onImproveIssue` — not wired
- `onSplitIssue` — not wired

### Missing Sections After Enrichment Card

The detail panel currently shows: Header → Meta → Labels → Actions → Task Linked → Description → Enrichment → Assignees → Milestone.

**Needed additions:**
1. **CompletenessBreakdown** — Section-by-section score detail (after completeness score in EnrichmentPanel)
2. **DependencyList** — Tracks/tracked-by relationships (new card after Enrichment)
3. **Mutation actions** — InlineEditor for title/body, LabelManager, AssigneeManager (enhance existing sections)
4. **CommentForm** — Add comment at bottom of detail panel

### Prop Extensions Needed

`IssueDetailProps` must be extended with:
- `onAITriage?: () => void`
- `onImproveIssue?: () => void`
- `onSplitIssue?: () => void`
- `onEditTitle?: (title: string) => Promise<void>`
- `onEditBody?: (body: string) => Promise<void>`
- `onAddLabels?: (labels: string[]) => Promise<void>`
- `onRemoveLabels?: (labels: string[]) => Promise<void>`
- `onAddAssignees?: (logins: string[]) => Promise<void>`
- `onRemoveAssignees?: (logins: string[]) => Promise<void>`
- `onClose?: (comment?: string) => Promise<void>`
- `onReopen?: () => Promise<void>`
- `onComment?: (body: string) => Promise<void>`
- `dependencies?: IssueDependencies`
- `isDepsLoading?: boolean`

---

## 5. Bulk Operations Integration

### Current Multi-Select State

`GitHubIssues.tsx` has NO multi-select state. The `IssueListItem` has no checkbox.

### Required Changes

1. Add `selectedIssueNumbers: Set<number>` state to GitHubIssues
2. Add `onToggleSelect` prop to IssueListItem (checkbox)
3. Add `onSelectAll` / `onDeselectAll` handlers
4. Mount `BulkActionBar` when selection is non-empty
5. Mount `BulkResultsPanel` when bulk operation completes
6. Wire `useBulkOperations` hook

### BulkActionBar Props (from component interface)

```tsx
interface BulkActionBarProps {
  selectedCount: number;
  onAction: (action: BulkActionType, params?: Record<string, unknown>) => void;
  onClearSelection: () => void;
  isExecuting: boolean;
}
```

---

## 6. AI Triage Dialog Integration

### Existing Components to Wire

| Component | Trigger | State Management |
|-----------|---------|-----------------|
| TriageProgressOverlay | AI enrich/split starts | useAITriage.enrichProgress / splitProgress |
| IssueSplitDialog | "Split" button in EnrichmentPanel | useAITriage.splitSuggestion |
| EnrichmentCommentPreview | AI enrichment completes | useAITriage.enrichResult |
| BatchTriageReview | "Triage All" action | useAITriage.reviewQueue |

### State Flow

```
EnrichmentPanel "AI Triage" button
  → useAITriage.enrich(issueNumber)
  → TriageProgressOverlay (shows progress)
  → On complete: EnrichmentCommentPreview (review before posting)
  → On approve: useAITriage.applyResults()
```

---

## 7. 3-Panel Triage Mode

### Design (from Phase 4 PRD)

```
┌─────────────┬─────────────────┬──────────────┐
│ Compact List│   Issue Detail  │ Triage Panel │
│  (25% width)│   (50% width)   │ (25% width)  │
│             │                 │              │
│ Issue #1    │  Title          │ Workflow     │
│ Issue #2 ← │  Description    │ Priority     │
│ Issue #3    │  Body           │ Completeness │
│ Issue #4    │  Comments       │ AI Actions   │
│             │                 │ Dependencies │
│             │                 │ Metrics      │
└─────────────┴─────────────────┴──────────────┘
```

### Implementation Strategy

- `phase4-store.triageModeEnabled` flag already exists
- Add toggle button in IssueListHeader
- When enabled: switch from 2-column (50/50) to 3-column (25/50/25)
- Right panel: EnrichmentPanel + DependencyList + MetricsDashboard
- Minimum width constraint: 1200px (from PRD)
- Keyboard: Ctrl+1/2/3 to focus panels

---

## 8. Settings Page Integration

### Project Settings Structure

**File:** `apps/frontend/src/renderer/components/settings/sections/SectionRouter.tsx`

Current sections: `general`, `linear`, `github`, `gitlab`, `memory`

### Integration Points

1. **LabelSyncSettings** → Add under existing `github` section or as sub-section
2. **ProgressiveTrustSettings** → Add under existing `github` section

Pattern: Each section uses `<SettingsSection title={...} description={...}>` wrapper.

The `GitHubIntegration` settings component already handles GitHub-related config. Adding label sync and trust settings as expandable sub-sections within it is the cleanest approach.

---

## 9. Barrel Export Gaps

### hooks/index.ts (currently exports 4 of 11 hooks)

```typescript
// Current
export { useGitHubIssues } from './useGitHubIssues';
export { useGitHubInvestigation } from './useGitHubInvestigation';
export { useIssueFiltering } from './useIssueFiltering';
export { useAutoFix } from './useAutoFix';

// Missing
export { useEnrichedIssue } from './useEnrichedIssue';
export { useEnrichedIssueFiltering } from './useEnrichedIssueFiltering';
export { useMutations } from './useMutations';
export { useBulkOperations } from './useBulkOperations';
export { useAITriage } from './useAITriage';
export { useLabelSync } from './useLabelSync';
export { useDependencies } from './useDependencies';
export { useMetrics } from './useMetrics';
export { useAnalyzePreview } from './useAnalyzePreview';
```

### components/index.ts (currently exports 13 of 30+ components)

Missing exports for: InlineEditor, LabelManager, AssigneeManager, CommentForm, BulkActionBar, BulkResultsPanel, CreateSpecButton, TriageResultCard, BatchTriageReview, EnrichmentCommentPreview, IssueSplitDialog, TriageProgressOverlay, ProgressiveTrustSettings, LabelSyncSettings, DependencyList, MetricsDashboard, CompletenessBreakdown

---

## 10. Risk Matrix

| Risk | Severity | Mitigation |
|------|----------|------------|
| Large prop-drilling depth in IssueDetail | Medium | Keep callbacks in container, pass through props |
| Performance: re-renders when enrichment updates | Medium | Use stable selectors, memo individual items |
| Layout breakage in 3-panel mode on narrow screens | Low | min-width guard, auto-fallback to 2-panel |
| State conflicts: bulk op + AI triage running concurrently | Medium | Disable conflicting actions while operation in progress |
| i18n key mismatches | Low | Integration tests verify key existence |
| Circular dependency from barrel re-exports | Low | Keep imports from direct paths, barrel for external consumers |
