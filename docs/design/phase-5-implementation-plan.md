# Phase 5 Implementation Plan

**Parent:** [Phase 5 PRD](phase-5-prd.md) | [Design Document](design-document.md)
**Approach:** TDD — tests written before implementation in every work package
**Base path:** `apps/frontend/src/`

---

## Execution Order

```
WP-1  Type Extensions & Barrel Exports        (no dependencies)
  │
  ├── WP-2  Issue List Enrichment Wiring       (WP-1)
  │     │
  │     └── WP-3  Workflow Filter Integration  (WP-2)
  │
  ├── WP-4  IssueDetail Enhancement           (WP-1)
  │     │
  │     └── WP-5  Bulk Operations Wiring       (WP-2 + WP-4)
  │
  ├── WP-6  AI Triage Dialogs                 (WP-4)
  │
  ├── WP-7  3-Panel Triage Mode               (WP-2 + WP-4)
  │
  └── WP-8  Settings, Metrics & i18n          (WP-4 + WP-7)
        │
        └── WP-9  Verification                (WP-8)
```

**Parallelizable:** WP-2, WP-4, WP-6, WP-7 can overlap after WP-1.

---

## WP-1: Type Extensions & Barrel Exports

**Goal:** Extend existing type interfaces for new props. Update barrel exports so all hooks and components are importable.

### Step 1.1 — Extend type interfaces

**Modify:** `renderer/components/github-issues/types/index.ts`

Add to `IssueListProps`:
```typescript
enrichments?: Record<string, IssueEnrichment>;
selectedIssueNumbers?: Set<number>;
onToggleSelect?: (issueNumber: number) => void;
```

Add to `IssueListItemProps`:
```typescript
isSelectable?: boolean;
isChecked?: boolean;
onToggleSelect?: () => void;
```

Add to `IssueDetailProps`:
```typescript
onAITriage?: () => void;
onImproveIssue?: () => void;
onSplitIssue?: () => void;
onEditTitle?: (title: string) => Promise<void>;
onEditBody?: (body: string) => Promise<void>;
onAddLabels?: (labels: string[]) => Promise<void>;
onRemoveLabels?: (labels: string[]) => Promise<void>;
onAddAssignees?: (logins: string[]) => Promise<void>;
onRemoveAssignees?: (logins: string[]) => Promise<void>;
onClose?: (comment?: string) => Promise<void>;
onReopen?: () => Promise<void>;
onComment?: (body: string) => Promise<void>;
dependencies?: IssueDependencies;
isDepsLoading?: boolean;
depsError?: string | null;
```

Add `IssueListHeaderProps`:
```typescript
onToggleTriageMode?: () => void;
isTriageModeEnabled?: boolean;
isTriageModeAvailable?: boolean;
onShowMetrics?: () => void;
```

Add new type:
```typescript
export interface TriageSidebarProps {
  enrichment: IssueEnrichment | null;
  currentState: WorkflowState;
  previousState?: WorkflowState | null;
  isAgentLocked?: boolean;
  onTransition: (to: WorkflowState, resolution?: Resolution) => void;
  completenessScore: number;
  onAITriage?: () => void;
  onImproveIssue?: () => void;
  onSplitIssue?: () => void;
  dependencies?: IssueDependencies;
  isDepsLoading?: boolean;
  depsError?: string | null;
  metrics?: TriageMetrics;
  metricsTimeWindow?: MetricsTimeWindow;
  isMetricsLoading?: boolean;
  onTimeWindowChange?: (tw: MetricsTimeWindow) => void;
  onRefreshMetrics?: () => void;
}
```

### Step 1.2 — Update barrel exports

**Modify:** `renderer/components/github-issues/hooks/index.ts`

Add exports for all Phase 1-4 hooks:
```typescript
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

**Modify:** `renderer/components/github-issues/components/index.ts`

Add exports for all Phase 2-4 components:
```typescript
export { InlineEditor } from './InlineEditor';
export { LabelManager } from './LabelManager';
export { AssigneeManager } from './AssigneeManager';
export { CommentForm } from './CommentForm';
export { BulkActionBar } from './BulkActionBar';
export { BulkResultsPanel } from './BulkResultsPanel';
export { CreateSpecButton } from './CreateSpecButton';
export { TriageResultCard } from './TriageResultCard';
export { BatchTriageReview } from './BatchTriageReview';
export { EnrichmentCommentPreview } from './EnrichmentCommentPreview';
export { IssueSplitDialog } from './IssueSplitDialog';
export { TriageProgressOverlay } from './TriageProgressOverlay';
export { ProgressiveTrustSettings } from './ProgressiveTrustSettings';
export { LabelSyncSettings } from './LabelSyncSettings';
export { DependencyList } from './DependencyList';
export { MetricsDashboard } from './MetricsDashboard';
export { CompletenessBreakdown } from './CompletenessBreakdown';
```

### Step 1.3 — Write barrel export tests

**Create:** `renderer/components/github-issues/__tests__/phase5-exports.test.ts`

Tests:
1. All hooks are importable from hooks/index
2. All components are importable from components/index
3. Type extensions compile (TypeScript type-level test)

### Checkpoint

- `npm run typecheck` passes
- Export test file passes

---

## WP-2: Issue List Enrichment Wiring

**Goal:** Pass enrichment data through IssueList to IssueListItem so every issue shows workflow state and completeness score.

### Step 2.1 — Write tests

**Create:** `renderer/components/github-issues/components/__tests__/IssueList.integration.test.tsx`

```
/**
 * @vitest-environment jsdom
 */
```

Tests:
1. Renders IssueListItem with triageState from enrichments map
2. Renders IssueListItem with completenessScore from enrichments map
3. Issues without enrichment show triageState='new' and completenessScore=0
4. Selection checkbox renders when onToggleSelect provided
5. Clicking checkbox calls onToggleSelect with issue number
6. Checkbox click does not trigger issue selection (no navigation)

### Step 2.2 — Modify IssueList.tsx

Add `enrichments`, `selectedIssueNumbers`, `onToggleSelect` props from `IssueListProps`.

In the map, pass enrichment data:
```tsx
const enrichment = enrichments?.[String(issue.number)];
<IssueListItem
  key={issue.id}
  issue={issue}
  isSelected={selectedIssueNumber === issue.number}
  onClick={() => onSelectIssue(issue.number)}
  onInvestigate={() => onInvestigate(issue)}
  triageState={enrichment?.triageState ?? 'new'}
  completenessScore={enrichment?.completenessScore ?? 0}
  isSelectable={!!onToggleSelect}
  isChecked={selectedIssueNumbers?.has(issue.number) ?? false}
  onToggleSelect={onToggleSelect ? () => onToggleSelect(issue.number) : undefined}
/>
```

### Step 2.3 — Modify IssueListItem.tsx

Add checkbox rendering:
```tsx
{isSelectable && (
  <input
    type="checkbox"
    checked={isChecked}
    onChange={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
    className="..."
    aria-label={t('phase5.selectIssue', { number: issue.number })}
  />
)}
```

### Step 2.4 — Wire in GitHubIssues.tsx

Pass `enrichments` to `IssueList`:
```tsx
<IssueList
  issues={filteredIssues}
  enrichments={enrichments}
  ...
/>
```

### Checkpoint

- WP-2 tests pass
- All 14 existing MetricsDashboard tests still pass
- Existing IssueList-related tests still pass

---

## WP-3: Workflow Filter Integration

**Goal:** Make the workflow filter actually filter the displayed issues.

### Step 3.1 — Write tests

**Create:** `renderer/components/github-issues/__tests__/workflow-filter-integration.test.ts`

Tests:
1. Empty workflowFilter shows all issues
2. Filter to ['new'] only shows unenriched issues and those with triageState='new'
3. Filter to ['triage', 'ready'] shows matching issues
4. Workflow filter combines with text search
5. Workflow filter combines with GitHub state (open/closed)
6. Changing workflow filter clears multi-select selection

### Step 3.2 — Implement filtering in GitHubIssues.tsx

After `filteredIssues` is computed from `useIssueFiltering`, apply workflow filter:

```typescript
const workflowFilteredIssues = useMemo(() => {
  if (workflowFilter.length === 0) return filteredIssues;
  return filteredIssues.filter((issue) => {
    const state = enrichments[String(issue.number)]?.triageState ?? 'new';
    return workflowFilter.includes(state);
  });
}, [filteredIssues, workflowFilter, enrichments]);
```

Pass `workflowFilteredIssues` to `IssueList` instead of `filteredIssues`.

### Step 3.3 — Clear selection on filter change

Add effect:
```typescript
useEffect(() => {
  setSelectedIssueNumbers(new Set());
}, [workflowFilter, filterState, searchQuery]);
```

### Checkpoint

- WP-3 tests pass
- Workflow filter actually filters displayed issues

---

## WP-4: IssueDetail Enhancement

**Goal:** Wire AI triage buttons, mutation components (InlineEditor, LabelManager, AssigneeManager, CommentForm), dependencies, and completeness breakdown into the detail panel.

### Step 4.1 — Write tests

**Create:** `renderer/components/github-issues/components/__tests__/IssueDetail.integration.test.tsx`

```
/**
 * @vitest-environment jsdom
 */
```

Tests:
1. Renders DependencyList when dependencies prop provided
2. Renders CompletenessBreakdown when enrichment has scores
3. Passes onAITriage to EnrichmentPanel
4. Passes onImproveIssue to EnrichmentPanel
5. Passes onSplitIssue to EnrichmentPanel
6. Renders CommentForm when onComment provided
7. Shows close button when issue is open and onClose provided
8. Shows reopen button when issue is closed and onReopen provided
9. Title is editable when onEditTitle provided
10. Labels section shows LabelManager when onAddLabels provided

### Step 4.2 — Enhance IssueDetail.tsx

Add new imports and props. Restructure the component:

1. **Title section** — Wrap in InlineEditor (double-click to edit) when `onEditTitle` provided
2. **Labels section** — Replace static badges with LabelManager when `onAddLabels`/`onRemoveLabels` provided
3. **Assignees section** — Replace static badges with AssigneeManager when `onAddAssignees`/`onRemoveAssignees` provided
4. **Actions** — Add Close/Reopen button when `onClose`/`onReopen` provided
5. **EnrichmentPanel** — Pass through `onAITriage`, `onImproveIssue`, `onSplitIssue`
6. **After Enrichment** — Add `DependencyList` card when `dependencies` provided
7. **Bottom** — Add `CommentForm` when `onComment` provided

### Step 4.3 — Wire hooks in GitHubIssues.tsx

Import and call `useMutations`, `useDependencies`:

```typescript
const mutations = useMutations(selectedProject?.id);
const { dependencies, isLoading: isDepsLoading, error: depsError } = useDependencies(
  selectedProject?.id, selectedIssue?.number ?? null
);
```

Pass to IssueDetail:
```tsx
<IssueDetail
  ...existing props...
  onEditTitle={(title) => mutations.editTitle(selectedIssue.number, title)}
  onEditBody={(body) => mutations.editBody(selectedIssue.number, body)}
  onAddLabels={(labels) => mutations.addLabels(selectedIssue.number, labels)}
  onRemoveLabels={(labels) => mutations.removeLabels(selectedIssue.number, labels)}
  onAddAssignees={(logins) => mutations.addAssignees(selectedIssue.number, logins)}
  onRemoveAssignees={(logins) => mutations.removeAssignees(selectedIssue.number, logins)}
  onClose={(comment) => mutations.closeIssue(selectedIssue.number, comment)}
  onReopen={() => mutations.reopenIssue(selectedIssue.number)}
  onComment={(body) => mutations.commentOnIssue(selectedIssue.number, body)}
  onAITriage={() => aiTriage.enrich(selectedIssue.number)}
  onImproveIssue={() => aiTriage.improve(selectedIssue.number)}
  onSplitIssue={() => aiTriage.split(selectedIssue.number)}
  dependencies={dependencies}
  isDepsLoading={isDepsLoading}
  depsError={depsError}
/>
```

### Checkpoint

- WP-4 tests pass
- IssueDetail shows all new sections
- Existing IssueDetail tests still pass

---

## WP-5: Bulk Operations Wiring

**Goal:** Wire multi-select, BulkActionBar, and BulkResultsPanel into the GitHubIssues container.

### Step 5.1 — Write tests

**Create:** `renderer/components/github-issues/__tests__/bulk-integration.test.tsx`

```
/**
 * @vitest-environment jsdom
 */
```

Tests:
1. BulkActionBar renders when selectedIssueNumbers is non-empty
2. BulkActionBar hidden when no issues selected
3. Select all / deselect all work correctly
4. Bulk action triggers useBulkOperations.execute
5. BulkResultsPanel shows after bulk operation completes
6. Selection clears after successful bulk operation

### Step 5.2 — Add multi-select state to GitHubIssues.tsx

```typescript
const [selectedIssueNumbers, setSelectedIssueNumbers] = useState<Set<number>>(new Set());

const handleToggleSelect = useCallback((issueNumber: number) => {
  setSelectedIssueNumbers(prev => {
    const next = new Set(prev);
    if (next.has(issueNumber)) next.delete(issueNumber);
    else next.add(issueNumber);
    return next;
  });
}, []);

const handleSelectAll = useCallback(() => {
  setSelectedIssueNumbers(new Set(workflowFilteredIssues.map(i => i.number)));
}, [workflowFilteredIssues]);

const handleDeselectAll = useCallback(() => {
  setSelectedIssueNumbers(new Set());
}, []);
```

### Step 5.3 — Mount BulkActionBar and BulkResultsPanel

Import `useBulkOperations` and mount:

```tsx
{selectedIssueNumbers.size > 0 && (
  <BulkActionBar
    selectedCount={selectedIssueNumbers.size}
    onAction={(action, params) => bulkOps.execute(
      [...selectedIssueNumbers], action, params
    )}
    onClearSelection={handleDeselectAll}
    isExecuting={bulkOps.isExecuting}
  />
)}
```

Pass `selectedIssueNumbers` and `onToggleSelect` to IssueList.

### Checkpoint

- WP-5 tests pass
- Multi-select and bulk action bar functional

---

## WP-6: AI Triage Dialogs

**Goal:** Wire IssueSplitDialog, TriageProgressOverlay, and EnrichmentCommentPreview into the container.

### Step 6.1 — Write tests

**Create:** `renderer/components/github-issues/__tests__/ai-triage-integration.test.tsx`

Tests:
1. TriageProgressOverlay renders when AI enrichment in progress
2. TriageProgressOverlay renders when AI split in progress
3. IssueSplitDialog opens with split suggestion data
4. IssueSplitDialog calls onConfirm with accepted sub-issues
5. EnrichmentCommentPreview shows after enrichment completes
6. Closing overlay/dialog resets AI triage state

### Step 6.2 — Wire useAITriage in GitHubIssues.tsx

```typescript
const aiTriage = useAITriage(selectedProject?.id);
```

### Step 6.3 — Mount dialogs

Add after existing dialogs:

```tsx
{/* AI Triage Progress */}
<TriageProgressOverlay
  isVisible={aiTriage.isEnriching || aiTriage.isSplitting}
  progress={aiTriage.enrichProgress ?? aiTriage.splitProgress}
  onCancel={aiTriage.cancel}
/>

{/* Split Dialog */}
<IssueSplitDialog
  isOpen={!!aiTriage.splitSuggestion}
  suggestion={aiTriage.splitSuggestion}
  onConfirm={aiTriage.confirmSplit}
  onCancel={aiTriage.cancelSplit}
/>

{/* Enrichment Comment Preview */}
{aiTriage.pendingComment && (
  <EnrichmentCommentPreview
    comment={aiTriage.pendingComment}
    onApprove={aiTriage.approveComment}
    onDiscard={aiTriage.discardComment}
  />
)}
```

### Checkpoint

- WP-6 tests pass
- AI triage dialogs appear and dismiss correctly

---

## WP-7: 3-Panel Triage Mode

**Goal:** Implement the 3-panel layout toggle with a triage sidebar, keyboard shortcuts, and responsive behavior.

### Step 7.1 — Create useTriageMode hook

**Create:** `renderer/components/github-issues/hooks/useTriageMode.ts`

```typescript
export function useTriageMode() {
  const isEnabled = usePhase4Store(s => s.triageModeEnabled);
  const [isAvailable, setIsAvailable] = useState(false);

  // ResizeObserver to check viewport width ≥ 1200px
  // Keyboard shortcuts Ctrl+1/2/3 (only when enabled)
  // Toggle function that checks availability

  return { isEnabled, isAvailable, toggle, focusPanel };
}
```

**Create:** `renderer/components/github-issues/hooks/__tests__/useTriageMode.test.ts`

Tests:
1. Returns isAvailable=false when viewport < 1200px
2. Returns isAvailable=true when viewport ≥ 1200px
3. Toggle enables/disables triage mode in store
4. Auto-disables when viewport shrinks below 1200px
5. Does not toggle when isAvailable is false

### Step 7.2 — Create TriageSidebar component

**Create:** `renderer/components/github-issues/components/TriageSidebar.tsx`

Composition of existing components:
```tsx
export function TriageSidebar({ ...props }: TriageSidebarProps) {
  return (
    <ScrollArea className="flex-1">
      <div className="p-3 space-y-4">
        <EnrichmentPanel ... />
        <DependencyList ... />
        {metrics && <MetricsDashboard ... />}
      </div>
    </ScrollArea>
  );
}
```

**Create:** `renderer/components/github-issues/components/__tests__/TriageSidebar.test.tsx`

Tests:
1. Renders EnrichmentPanel with props
2. Renders DependencyList with props
3. Renders MetricsDashboard when metrics provided
4. Hides MetricsDashboard when metrics not provided
5. Uses semantic section element

### Step 7.3 — Implement 3-panel layout in GitHubIssues.tsx

Replace the fixed 50/50 split with dynamic layout:

```tsx
const { isEnabled: triageModeEnabled, isAvailable: triageModeAvailable, toggle: toggleTriageMode } = useTriageMode();

// Layout classes
const listWidth = triageModeEnabled ? 'w-1/4' : 'w-1/2';
const detailWidth = triageModeEnabled ? 'w-1/2' : 'w-1/2';

<div className="flex-1 flex min-h-0">
  <div className={`${listWidth} border-r border-border flex flex-col`}>
    <IssueList ... />
  </div>
  <div className={`${detailWidth} flex flex-col ${triageModeEnabled ? 'border-r border-border' : ''}`}>
    {selectedIssue ? <IssueDetail ... /> : <EmptyState />}
  </div>
  {triageModeEnabled && (
    <div className="w-1/4 flex flex-col">
      <TriageSidebar ... />
    </div>
  )}
</div>
```

### Step 7.4 — Add toggle to IssueListHeader

Pass `onToggleTriageMode`, `isTriageModeEnabled`, `isTriageModeAvailable` to `IssueListHeader`.
Add a toggle button in the header actions area.

### Checkpoint

- WP-7 tests pass
- 3-panel layout toggles correctly
- Auto-fallback works on narrow screens

---

## WP-8: Settings, Metrics & i18n

**Goal:** Mount LabelSyncSettings and ProgressiveTrustSettings in project settings. Add MetricsDashboard access. Add Phase 5 i18n keys.

### Step 8.1 — Add i18n keys

**Modify:** `shared/i18n/locales/en/common.json`

Add `phase5` section with integration keys:
```json
"phase5": {
  "triageMode": "Triage Mode",
  "triageModeTooltip": "Toggle 3-panel triage layout",
  "selectAll": "Select All",
  "deselectAll": "Deselect All",
  "selectedCount": "{{count}} selected",
  "selectIssue": "Select issue #{{number}}",
  "metricsToggle": "Show Metrics",
  "editTitle": "Edit Title",
  "editBody": "Edit Body",
  "addComment": "Add Comment",
  "closeIssue": "Close Issue",
  "reopenIssue": "Reopen Issue",
  "bulkInProgress": "Bulk operation in progress...",
  "narrowScreen": "Triage mode requires a wider screen"
}
```

**Modify:** `shared/i18n/locales/fr/common.json`

Add French translations.

### Step 8.2 — Wire settings

**Modify:** `renderer/components/settings/sections/SectionRouter.tsx`

Under the `github` case, after existing GitHub integration content, add:

```tsx
<LabelSyncSettings
  enabled={labelSync.enabled}
  isSyncing={labelSync.isSyncing}
  lastSyncedAt={labelSync.lastSyncedAt}
  error={labelSync.error}
  onEnable={labelSync.enable}
  onDisable={labelSync.disable}
/>
<ProgressiveTrustSettings
  config={aiTriage.trustConfig}
  onSave={aiTriage.saveTrustConfig}
/>
```

### Step 8.3 — Wire metrics in container

In `GitHubIssues.tsx`, call `useMetrics()` and pass to TriageSidebar:
```typescript
const { metrics, timeWindow, isLoading: isMetricsLoading, computeMetrics, setTimeWindow } = useMetrics();
```

Compute on mount:
```typescript
useEffect(() => {
  if (selectedProject?.id && enrichmentLoaded) {
    computeMetrics();
  }
}, [selectedProject?.id, enrichmentLoaded, computeMetrics]);
```

### Step 8.4 — Write integration tests

**Create:** `renderer/components/github-issues/__tests__/phase5-integration.test.ts`

Tests:
1. All Phase 5 i18n keys exist in EN locale
2. All Phase 5 i18n keys exist in FR locale
3. Barrel exports cover all hooks (count check)
4. Barrel exports cover all components (count check)
5. Type interfaces compile with new properties
6. IssueListProps includes enrichments
7. IssueDetailProps includes mutation callbacks
8. TriageSidebarProps includes all triage panel data

### Checkpoint

- WP-8 tests pass
- Settings show label sync and trust config
- i18n complete for EN and FR

---

## WP-9: Verification

**Goal:** Full lint, typecheck, and test suite. Fix any remaining issues.

### Step 9.1 — Lint all Phase 5 files

```bash
npx biome check <all Phase 5 source files>
```

Fix any warnings (semantic elements, exhaustive deps, etc.)

### Step 9.2 — Typecheck

```bash
npm run typecheck
```

Fix any TypeScript errors from new prop threading.

### Step 9.3 — Full test suite

```bash
npm test
```

Verify:
- 0 failures
- All new tests pass
- No regressions in existing tests

### Step 9.4 — Manual verification checklist

- [ ] IssueListItem shows WorkflowStateBadge for all issues
- [ ] IssueListItem shows CompletenessIndicator for all issues
- [ ] Workflow filter actually filters displayed issues
- [ ] EnrichmentPanel AI buttons are clickable
- [ ] Multi-select checkboxes appear on hover
- [ ] BulkActionBar appears when issues selected
- [ ] DependencyList renders in detail panel
- [ ] 3-panel triage mode toggles
- [ ] Settings page shows LabelSyncSettings
- [ ] Barrel exports are complete

### Checkpoint

- Full test suite passes (187+ files, 3693+ tests)
- 0 lint errors on Phase 5 files
- TypeScript compiles cleanly
