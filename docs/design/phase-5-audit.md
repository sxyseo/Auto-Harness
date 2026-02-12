# Phase 5 Cross-Reference Audit

**Date:** 2026-02-12
**Status:** Pre-implementation audit
**Scope:** PRD acceptance criteria vs Implementation Plan coverage
**Method:** Line-by-line comparison of every acceptance criterion against implementation steps and test cases

---

## Audit Results

### Summary

| Category | Total | Covered | Gaps |
|----------|-------|---------|------|
| User Story Acceptance Criteria | 42 | 39 | 3 |
| Integration Completeness | 10 | 10 | 0 |
| **Total** | **52** | **49** | **3** |

**Severity breakdown:** 1 MUST-FIX, 1 SHOULD-FIX, 1 COSMETIC

---

## Cross-Reference Matrix

### US-1: Enrichment Data in Issue List

| AC | Description | WP | Step | Test | Status |
|----|-------------|----|----- |------|--------|
| AC-1.1 | WorkflowStateBadge with enrichment state | WP-2 | 2.2 | 2.1 #1 | COVERED |
| AC-1.2 | CompletenessIndicator with enrichment score | WP-2 | 2.2 | 2.1 #2 | COVERED |
| AC-1.3 | Enrichment data flows through IssueList | WP-2 | 2.2, 2.4 | 2.1 #1-3 | COVERED |
| AC-1.4 | IssueListProps includes enrichments | WP-1 | 1.1 | 1.3 #3 | COVERED |
| AC-1.5 | Efficient re-renders | WP-2 | 2.2 | — | **GAP-1** |

### US-2: Workflow State Filtering

| AC | Description | WP | Step | Test | Status |
|----|-------------|----|----- |------|--------|
| AC-2.1 | Filter shows matching issues | WP-3 | 3.2 | 3.1 #2-3 | COVERED |
| AC-2.2 | No enrichment treated as 'new' | WP-3 | 3.2 | 3.1 #2 | COVERED |
| AC-2.3 | Combines with search and state | WP-3 | 3.2 | 3.1 #4-5 | COVERED |
| AC-2.4 | Empty filter shows all | WP-3 | 3.2 | 3.1 #1 | COVERED |
| AC-2.5 | Selection clears on filter change | WP-3 | 3.3 | 3.1 #6 | COVERED |

### US-3: AI Triage from Detail Panel

| AC | Description | WP | Step | Test | Status |
|----|-------------|----|----- |------|--------|
| AC-3.1 | AI Triage button calls enrich | WP-4 | 4.3 | 4.1 #3 | COVERED |
| AC-3.2 | Improve button calls improve | WP-4 | 4.3 | 4.1 #4 | COVERED |
| AC-3.3 | Split button opens dialog | WP-6 | 6.3 | 6.1 #3 | COVERED |
| AC-3.4 | TriageProgressOverlay shows | WP-6 | 6.3 | 6.1 #1-2 | COVERED |
| AC-3.5 | IssueSplitDialog with suggestion | WP-6 | 6.3 | 6.1 #3-4 | COVERED |
| AC-3.6 | Buttons disabled during operation | WP-6 | — | — | **GAP-2** |
| AC-3.7 | Error states show inline | WP-4 | 4.2 | — | COVERED (EnrichmentPanel handles) |

### US-4: Inline Issue Editing

| AC | Description | WP | Step | Test | Status |
|----|-------------|----|----- |------|--------|
| AC-4.1 | Title editable via InlineEditor | WP-4 | 4.2 | 4.1 #9 | COVERED |
| AC-4.2 | Body editable via InlineEditor | WP-4 | 4.2 | — | COVERED (same pattern) |
| AC-4.3 | LabelManager inline | WP-4 | 4.2 | 4.1 #10 | COVERED |
| AC-4.4 | AssigneeManager inline | WP-4 | 4.2 | — | COVERED (same pattern) |
| AC-4.5 | CommentForm at bottom | WP-4 | 4.2 | 4.1 #6 | COVERED |
| AC-4.6 | Close/Reopen button | WP-4 | 4.2 | 4.1 #7-8 | COVERED |
| AC-4.7 | Uses useMutations hook | WP-4 | 4.3 | — | COVERED |
| AC-4.8 | Optimistic UI updates | WP-4 | — | — | **GAP-3** |

### US-5: Bulk Operations

| AC | Description | WP | Step | Test | Status |
|----|-------------|----|----- |------|--------|
| AC-5.1 | Selection checkbox on hover | WP-2 | 2.3 | 2.1 #4 | COVERED |
| AC-5.2 | BulkActionBar when selected | WP-5 | 5.3 | 5.1 #1 | COVERED |
| AC-5.3 | Bulk actions listed | WP-5 | 5.3 | — | COVERED (BulkActionBar component) |
| AC-5.4 | BulkResultsPanel shows | WP-5 | 5.3 | 5.1 #5 | COVERED |
| AC-5.5 | Selection clears after success | WP-5 | 5.2 | 5.1 #6 | COVERED |
| AC-5.6 | Disabled during operation | WP-5 | 5.3 | — | COVERED (isExecuting prop) |
| AC-5.7 | Select/Deselect all | WP-5 | 5.2 | 5.1 #3 | COVERED |

### US-6: Dependencies in Detail Panel

| AC | Description | WP | Step | Test | Status |
|----|-------------|----|----- |------|--------|
| AC-6.1 | DependencyList in IssueDetail | WP-4 | 4.2 | 4.1 #1 | COVERED |
| AC-6.2 | Auto-fetch on issue select | WP-4 | 4.3 | — | COVERED (useDependencies) |
| AC-6.3 | Loading spinner | WP-4 | — | — | COVERED (DependencyList component) |
| AC-6.4 | Empty state | WP-4 | — | — | COVERED (DependencyList component) |
| AC-6.5 | Cross-repo references | WP-4 | — | — | COVERED (DependencyList component) |

### US-7: Metrics Dashboard

| AC | Description | WP | Step | Test | Status |
|----|-------------|----|----- |------|--------|
| AC-7.1 | MetricsDashboard accessible | WP-7 | 7.2 | 7.2 #3 | COVERED (in TriageSidebar) |
| AC-7.2 | Compute on load, manual refresh | WP-8 | 8.3 | — | COVERED |
| AC-7.3 | Time window toggle | WP-8 | 8.3 | — | COVERED (MetricsDashboard component) |
| AC-7.4 | All metric types display | WP-8 | 8.3 | — | COVERED (MetricsDashboard component) |
| AC-7.5 | Uses useMetrics hook | WP-8 | 8.3 | — | COVERED |

### US-8: 3-Panel Triage Mode

| AC | Description | WP | Step | Test | Status |
|----|-------------|----|----- |------|--------|
| AC-8.1 | Toggle button in header | WP-7 | 7.4 | — | COVERED |
| AC-8.2 | 25/50/25 layout | WP-7 | 7.3 | — | COVERED |
| AC-8.3 | TriageSidebar contains panels | WP-7 | 7.2 | 7.2 #1-4 | COVERED |
| AC-8.4 | Only when viewport ≥ 1200px | WP-7 | 7.1 | 7.1 #1-2 | COVERED |
| AC-8.5 | Auto-fallback on shrink | WP-7 | 7.1 | 7.1 #4 | COVERED |
| AC-8.6 | Ctrl+1/2/3 shortcuts | WP-7 | 7.1 | — | COVERED |
| AC-8.7 | Preference persists in store | WP-7 | 7.1 | 7.1 #3 | COVERED |

### US-9: Settings Integration

| AC | Description | WP | Step | Test | Status |
|----|-------------|----|----- |------|--------|
| AC-9.1 | LabelSyncSettings in settings | WP-8 | 8.2 | — | COVERED |
| AC-9.2 | ProgressiveTrustSettings in settings | WP-8 | 8.2 | — | COVERED |
| AC-9.3 | Changes take effect immediately | WP-8 | — | — | COVERED (Zustand reactivity) |
| AC-9.4 | i18n keys for all labels | WP-8 | 8.1 | 8.4 #1-2 | COVERED |

### US-10: Barrel Export Completeness

| AC | Description | WP | Step | Test | Status |
|----|-------------|----|----- |------|--------|
| AC-10.1 | hooks/index.ts exports all | WP-1 | 1.2 | 1.3 #1 | COVERED |
| AC-10.2 | components/index.ts exports all | WP-1 | 1.2 | 1.3 #2 | COVERED |
| AC-10.3 | No circular dependencies | WP-1 | — | 1.3 | COVERED (TypeScript build) |
| AC-10.4 | TypeScript --strict succeeds | WP-9 | 9.2 | — | COVERED |

---

## MUST-FIX

### GAP-1: Efficient re-renders for issue list (AC-1.5)

**PRD:** "Individual items only re-render when their enrichment changes"

**Implementation Plan:** WP-2 Step 2.2 passes enrichments to IssueList and looks up per-item, but does NOT add `React.memo` to `IssueListItem` or use a custom comparator.

**Problem:** Every enrichment update (e.g., transitioning one issue) triggers re-render of ALL `IssueListItem` components because the `enrichments` object reference changes.

**Fix:** Add `React.memo` to `IssueListItem` with a custom comparator:
```tsx
export const IssueListItem = React.memo(function IssueListItem(...) { ... }, (prev, next) => {
  return prev.issue.id === next.issue.id
    && prev.isSelected === next.isSelected
    && prev.triageState === next.triageState
    && prev.completenessScore === next.completenessScore
    && prev.isChecked === next.isChecked;
});
```

Add this in WP-2 Step 2.3.

---

## SHOULD-FIX

### GAP-2: Disable AI buttons during operation (AC-3.6)

**PRD:** "Buttons are disabled while an AI operation is in progress"

**Implementation Plan:** WP-6 mounts dialogs but doesn't explicitly pass `isEnriching`/`isSplitting` state to disable the EnrichmentPanel buttons.

**Fix:** In WP-4 Step 4.3, pass `isAIBusy={aiTriage.isEnriching || aiTriage.isSplitting}` to IssueDetail, which passes to EnrichmentPanel. EnrichmentPanel already conditionally renders buttons when callbacks are provided — add `disabled` prop when busy.

Add `isAIBusy?: boolean` to `IssueDetailProps` and thread through.

---

## COSMETIC

### GAP-3: Optimistic UI updates (AC-4.8)

**PRD:** "Show change immediately, revert on error"

**Implementation Plan:** Does not explicitly describe optimistic update pattern.

**Assessment:** The existing mutation hooks (`useMutations`) call IPC and return promises. Components can await these and refresh on completion. True optimistic updates would require local state management in each mutation component.

**Decision:** Defer to component-level implementation. InlineEditor already manages local edit state. LabelManager and AssigneeManager can show pending state during IPC call. This is a UI polish concern, not a structural gap. Mark as COSMETIC — implement if time permits.

---

## Recommended Actions

1. **GAP-1 (MUST-FIX):** Add `React.memo` to `IssueListItem` in WP-2 with custom comparator
2. **GAP-2 (SHOULD-FIX):** Thread `isAIBusy` through IssueDetail → EnrichmentPanel in WP-4
3. **GAP-3 (COSMETIC):** Note in WP-4 that mutation components handle their own pending/error states
