# Phase 5 Edge Case Analysis: Full Integration

**Date:** 2026-02-12
**Phase:** 5 of 5 — Full Integration
**Scope:** Integration-specific failure modes not covered in Phase 1-4 edge case analyses

---

## 1. Data Flow & Prop Passing

### EC-1.1: Enrichment map empty during initial load

**Scenario:** Issues load from GitHub before enrichment data loads from disk.
**Current:** `enrichments` is `{}` on first render, so all issues show `triageState='new'` and `completenessScore=0`.
**Expected behavior:** This is correct — `new` is the default. No fix needed, but ensure no flash of undefined states.
**Test:** Render IssueList with empty enrichments map, verify all items show WorkflowStateBadge with 'new'.

### EC-1.2: Enrichment exists for issue not in current filter

**Scenario:** User filters to "open" issues. An enrichment exists for a closed issue.
**Impact:** No visual impact (closed issue not rendered), but enrichment map still has the entry.
**Handling:** No action needed. Enrichment lookup is per-rendered-issue.

### EC-1.3: Issue list re-renders on every enrichment update

**Scenario:** User transitions one issue's state → enrichment store updates → entire issue list re-renders.
**Risk:** Performance degradation with 200+ issues.
**Mitigation:** Pass enrichments as a stable reference. Use `React.memo` on `IssueListItem` with custom comparator that checks `enrichments[issueNumber]` identity.

### EC-1.4: IssueListItem receives undefined enrichment mid-transition

**Scenario:** During a workflow transition, the store briefly clears the old enrichment before writing the new one.
**Risk:** Badge flashes from current state to 'new' and back.
**Mitigation:** Zustand store updates are synchronous and atomic — `setEnrichment` replaces the entry in one call. No intermediate clear. Not a real risk.

---

## 2. Multi-Select & Bulk Operations

### EC-2.1: User selects issues, then changes filter

**Scenario:** User selects 5 issues in "open" filter, switches to "closed" filter.
**Question:** Should selection persist? Selected issues are no longer visible.
**Decision:** Clear selection on filter change. Invisible selections confuse users.

### EC-2.2: Bulk operation while auto-refresh triggers

**Scenario:** Auto-refresh re-fetches issues while bulk close is in progress.
**Risk:** New issue data overwrites optimistic state before bulk op completes.
**Mitigation:** Disable auto-refresh while `isBulkExecuting` is true. Re-fetch after completion.

### EC-2.3: User navigates away during bulk operation

**Scenario:** User switches to Kanban view while bulk label operation is running.
**Impact:** Hook unmounts, but IPC call is fire-and-forget in main process.
**Handling:** Bulk operation completes in main process regardless. Results are lost from UI state. On return, user sees final state. Acceptable behavior — no data loss.

### EC-2.4: Select all with 500+ issues

**Scenario:** User clicks "Select All" with a large loaded issue list.
**Risk:** Bulk operation with 500 items exceeds rate limits.
**Mitigation:** `BULK_MAX_BATCH_SIZE` constant (from Phase 2) caps at 50. UI should show warning or auto-paginate.

### EC-2.5: Checkbox click propagation

**Scenario:** Clicking checkbox on IssueListItem should toggle selection, NOT navigate to issue detail.
**Implementation:** `e.stopPropagation()` on checkbox click handler (same pattern as investigate button).

---

## 3. AI Triage Dialog Interactions

### EC-3.1: AI enrichment completes but user already closed dialog

**Scenario:** User clicks "AI Triage", sees progress overlay, clicks away before completion.
**Risk:** EnrichmentCommentPreview has no trigger to show.
**Handling:** Store enrichment result in `useAITriage` state. On next detail view, check for pending results and show preview.

### EC-3.2: Split dialog with 0 sub-issues suggested

**Scenario:** AI split returns empty sub-issue array (issue is atomic).
**Expected:** Show "No split suggested" message instead of empty dialog.

### EC-3.3: Concurrent AI operations

**Scenario:** User clicks "AI Triage" on issue #10, then immediately clicks on issue #11 and triggers another.
**Risk:** Two concurrent enrichment operations may race.
**Mitigation:** `useAITriage` should track current operation and reject/queue if busy. Show "Operation in progress" indicator.

### EC-3.4: AI triage result stale after manual edit

**Scenario:** User edits issue title/body via InlineEditor, then clicks "AI Triage".
**Risk:** AI analyzes old cached data.
**Handling:** AI triage handler re-fetches issue from GitHub before analysis. Not a Phase 5 concern — handler already does this.

---

## 4. 3-Panel Triage Mode

### EC-4.1: Window too narrow for 3-panel

**Scenario:** User enables triage mode on a 1024px-wide window (below 1200px minimum).
**Handling:** Don't show triage mode toggle if window width < 1200px. Use `window.innerWidth` or ResizeObserver.

### EC-4.2: Resize window while in triage mode

**Scenario:** User is in 3-panel mode, resizes window below 1200px.
**Handling:** Auto-fallback to 2-panel. Store triage mode preference so it re-enables when window widens.

### EC-4.3: No issue selected in triage mode

**Scenario:** User enables triage mode with no issue selected.
**Expected:** Center and right panels show empty state. Right panel shows aggregate metrics.

### EC-4.4: Keyboard shortcut conflicts

**Scenario:** Ctrl+1/2/3 already used by another part of the application.
**Handling:** Only register shortcuts when GitHubIssues view is active AND triage mode is enabled. Use `useEffect` cleanup.

---

## 5. Mutation + State Conflicts

### EC-5.1: Edit title while enrichment transition in progress

**Scenario:** User starts editing title inline, meanwhile a workflow transition completes and re-renders.
**Risk:** InlineEditor loses focus or resets.
**Mitigation:** InlineEditor maintains local state. Only external reset on `issue.title` change (which only happens on GitHub data refresh, not enrichment update).

### EC-5.2: Close issue while label sync is active

**Scenario:** User closes issue → enrichment auto-transitions to `done` → label sync fires → tries to set `ac:done` on now-closed issue.
**Risk:** Label sync to closed issue. GitHub allows labeling closed issues, so this is fine.

### EC-5.3: Add label via LabelManager while bulk label operation running

**Scenario:** User is manually adding a label while a bulk "add label" operation includes the same issue.
**Risk:** Race condition — both try to add label. GitHub is idempotent for labels — adding an existing label is a no-op.
**Handling:** No special handling needed. GitHub handles this gracefully.

### EC-5.4: Comment form submission while offline

**Scenario:** User writes a long comment, submits, but network is down.
**Risk:** Comment is lost.
**Mitigation:** CommentForm should preserve draft in local state on error. Show error with retry button. Don't clear textarea until success confirmed.

---

## 6. Settings Integration

### EC-6.1: Enable label sync for repo with existing `ac:` labels

**Scenario:** Repo already has `ac:new` label from a previous sync session.
**Handling:** `enableLabelSync` handler uses `gh label create --force` which updates existing labels. Safe.

### EC-6.2: Change progressive trust settings while AI triage is running

**Scenario:** User increases auto-apply threshold while a batch triage is in progress.
**Impact:** In-progress batch uses settings from start time. New settings apply to next batch only.
**Handling:** Settings changes don't retroactively affect running operations. Acceptable.

### EC-6.3: Open settings from issues page, modify GitHub config

**Scenario:** User navigates Settings → GitHub, disconnects repo. Returns to Issues tab.
**Impact:** Issues page should detect disconnection and show NotConnectedState.
**Handling:** `syncStatus?.connected` check at top of GitHubIssues already handles this.

---

## 7. Cross-Feature Interactions

### EC-7.1: Workflow filter + text search + bulk select

**Scenario:** User filters to "new" state, searches "auth", selects 3 results, bulk transitions to "triage".
**Expected flow:** All 3 issues transition → enrichment updates → issues may now be filtered out (no longer "new") → selection clears.
**Handling:** After bulk transition completes, clear selection. Filtered list updates automatically via enrichment store reactivity.

### EC-7.2: MetricsDashboard refresh during bulk transition

**Scenario:** Metrics dashboard shows state counts. Bulk transition moves 10 issues from "new" to "triage".
**Risk:** Metrics become stale immediately after bulk op.
**Handling:** Trigger metrics recompute after bulk operation completion.

### EC-7.3: Dependencies fetch for issue with 100+ dependencies

**Scenario:** Large tracking issue with many sub-issues.
**Risk:** DependencyList renders very long list.
**Handling:** DependencyList should show first 20 with "Show more" toggle. Paginate GraphQL query.

### EC-7.4: Multiple GitHubIssues instances (shouldn't happen)

**Scenario:** App renders GitHubIssues twice due to routing bug.
**Risk:** Duplicate IPC calls, state conflicts.
**Handling:** App.tsx conditional rendering prevents this. Not a real risk.
