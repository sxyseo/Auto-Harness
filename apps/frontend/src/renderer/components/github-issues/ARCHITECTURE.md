# GitHubIssues Component Architecture

## Component Hierarchy

```
GitHubIssues (Main Orchestrator - 131 lines)
│
├── Hooks (Business Logic)
│   ├── useGitHubIssues
│   │   ├── Manages issue state
│   │   ├── Loads issues on project change
│   │   └── Handles refresh and filtering
│   │
│   ├── useGitHubInvestigation
│   │   ├── Sets up event listeners
│   │   ├── Handles investigation lifecycle
│   │   └── Manages investigation state
│   │
│   └── useIssueFiltering
│       ├── Search query state
│       └── Memoized filtered results
│
└── Components (UI Layer)
    │
    ├── NotConnectedState
    │   └── Shown when GitHub is not configured
    │
    ├── IssueListHeader
    │   ├── Repo name and stats
    │   ├── Search input
    │   ├── Filter dropdown (open/closed/all)
    │   └── Refresh button
    │
    ├── Layout (Split View)
    │   │
    │   ├── IssueList (Left Panel)
    │   │   ├── Loading state
    │   │   ├── Error state
    │   │   ├── Empty state
    │   │   └── ScrollArea with IssueListItems
    │   │       └── IssueListItem (Repeating)
    │   │           ├── State badge
    │   │           ├── Issue title
    │   │           ├── Metadata (author, comments, labels)
    │   │           └── Investigate button (hover)
    │   │
    │   └── IssueDetail (Right Panel)
    │       ├── Empty state (no selection)
    │       └── ScrollArea with sections
    │           ├── Header (title, state, external link)
    │           ├── Meta (author, date, comments)
    │           ├── Labels
    │           ├── Actions (Investigate button)
    │           ├── Investigation Result (if exists)
    │           ├── Description
    │           ├── Assignees (if any)
    │           └── Milestone (if any)
    │
    └── InvestigationDialog (Modal)
        ├── Idle state (explanation + start button)
        ├── Progress state (progress bar + message)
        ├── Error state (error message)
        └── Complete state (success message + done button)
```

## Automatic Label Sync

GitHub issue labels are automatically synchronized when investigation state changes during the build process.

### When Labels Sync Automatically

1. **Investigation state changes:** When an issue moves through investigation states (queued → investigating → findings_ready)
2. **Task creation:** When a task is created from an investigation (task_created → ready label)
3. **Build progress:** When the linked task status changes during build (in_progress → building → in-progress label)
4. **Task completion:** When the task reaches done or pr_created state (done → done label)

### State Mapping

The mapping from InvestigationState to GitHub workflow labels is defined in:
`apps/frontend/src/shared/constants/label-sync.ts:mapInvestigationStateToWorkflowState()`

| Investigation State | Workflow Label | GitHub Label |
|-------------------|----------------|--------------|
| new | new | ac:new |
| queued | ready | ac:ready |
| investigating | triage | ac:triage |
| findings_ready | ready | ac:ready |
| resolved | done | ac:done |
| task_created | ready | ac:ready |
| building | in_progress | ac:in-progress |
| done | done | ac:done |

### Implementation

- **Label Sync Hook:** `useLabelSync()` provides `syncIssueLabel()` with 2-second debouncing
- **Store Callback:** Investigation store accepts an optional `setStateChangeCallback()`
- **Registration:** GitHubIssues component registers callback on mount, unregisters on cleanup
- **Triggering:** Both the store callback and direct sync in task state changes trigger updates
- **Error Handling:** Label sync failures are silent and don't disrupt the build process

### Files

- `apps/frontend/src/shared/constants/label-sync.ts` - State mapping and constants
- `apps/frontend/src/renderer/stores/github/investigation-store.ts` - Callback mechanism
- `apps/frontend/src/renderer/components/GitHubIssues.tsx` - Callback registration and triggering
- `apps/frontend/src/renderer/components/github-issues/hooks/useLabelSync.ts` - Debounced API calls
- `apps/frontend/src/main/ipc-handlers/github/label-sync-handlers.ts` - IPC to GitHub CLI

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHubIssues                              │
│                     (Main Component)                             │
└───────────────┬─────────────────────────────────────────────────┘
                │
                ├─► useProjectStore() ────► selectedProject
                │
                ├─► useGitHubIssues(projectId)
                │   │
                │   ├─► loadGitHubIssues() ──► API call
                │   ├─► checkGitHubConnection() ──► API call
                │   │
                │   └─► Returns:
                │       ├─ issues
                │       ├─ syncStatus
                │       ├─ isLoading
                │       ├─ error
                │       ├─ selectedIssueNumber
                │       ├─ filterState
                │       ├─ selectIssue()
                │       ├─ getFilteredIssues()
                │       ├─ getOpenIssuesCount()
                │       ├─ handleRefresh()
                │       └─ handleFilterChange()
                │
                ├─► useGitHubInvestigation(projectId)
                │   │
                │   ├─► Sets up event listeners:
                │   │   ├─ onGitHubInvestigationProgress
                │   │   ├─ onGitHubInvestigationComplete
                │   │   └─ onGitHubInvestigationError
                │   │
                │   └─► Returns:
                │       ├─ investigationStatus
                │       ├─ lastInvestigationResult
                │       ├─ startInvestigation()
                │       └─ resetInvestigationStatus()
                │
                └─► useIssueFiltering(filteredIssues)
                    │
                    ├─► filterIssuesBySearch()
                    │
                    └─► Returns:
                        ├─ searchQuery
                        ├─ setSearchQuery()
                        └─ filteredIssues (memoized)
```

## State Management

### Store State (Zustand)
```
useGitHubStore
├── issues: GitHubIssue[]
├── syncStatus: { connected, repoFullName, error }
├── isLoading: boolean
├── error: string | null
├── selectedIssueNumber: number | null
├── filterState: 'open' | 'closed' | 'all'
├── investigationStatus: { phase, progress, message, error }
└── lastInvestigationResult: GitHubInvestigationResult | null
```

### Local Component State
```
GitHubIssues Component
├── showInvestigateDialog: boolean
└── selectedIssueForInvestigation: GitHubIssue | null
```

## Module Organization

### /types
- **Purpose:** TypeScript type definitions
- **Exports:** Component props interfaces, FilterState type
- **Dependencies:** Imports from shared/types

### /utils
- **Purpose:** Pure utility functions
- **Exports:** formatDate, filterIssuesBySearch
- **Dependencies:** None (pure functions)

### /hooks
- **Purpose:** Reusable business logic
- **Exports:** Custom React hooks
- **Dependencies:** Stores, utils, types

### /components
- **Purpose:** Presentational UI components
- **Exports:** React components
- **Dependencies:** UI library, types, utils

## Separation of Concerns

### GitHubIssues.tsx (Main Component)
- **Role:** Orchestrator/Composer
- **Responsibilities:**
  - Import and compose child components
  - Connect hooks to components
  - Handle high-level callbacks
  - Manage dialog state
- **Does NOT:**
  - Contain business logic
  - Make API calls directly
  - Render complex UI elements
  - Handle low-level state

### Custom Hooks
- **Role:** Business Logic Layer
- **Responsibilities:**
  - Manage state and side effects
  - Handle API interactions
  - Set up event listeners
  - Provide data transformations
- **Does NOT:**
  - Render UI
  - Know about specific components
  - Handle UI-specific events

### UI Components
- **Role:** Presentation Layer
- **Responsibilities:**
  - Render UI elements
  - Handle user interactions
  - Display data from props
  - Emit events via callbacks
- **Does NOT:**
  - Manage business logic
  - Make API calls
  - Know about stores directly
  - Handle complex state

## Key Design Patterns

### 1. Container/Presentational Pattern
- **GitHubIssues:** Container (connects data to UI)
- **Child Components:** Presentational (pure UI)

### 2. Custom Hooks Pattern
- Encapsulate reusable logic
- Compose multiple hooks
- Return consistent interfaces

### 3. Compound Components Pattern
- Components work together
- Shared context through props
- Flexible composition

### 4. Separation of Concerns
- Types in /types
- Logic in /hooks
- UI in /components
- Utils in /utils

## Benefits

### Testability
- **Hooks:** Can be tested with @testing-library/react-hooks
- **Components:** Can be tested with @testing-library/react
- **Utils:** Can be tested as pure functions
- **Isolated:** Each module tests independently

### Reusability
- Hooks can be used in other components
- Components can be reused in different contexts
- Utils are framework-agnostic
- Types ensure consistency

### Maintainability
- Changes are localized
- Dependencies are explicit
- Purpose is clear
- Code is discoverable

### Scalability
- Easy to add new features
- Simple to extend existing components
- Clear patterns to follow
- Modular architecture
