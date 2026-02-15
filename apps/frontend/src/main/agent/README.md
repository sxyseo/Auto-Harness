# Agent Queue System

## Overview

The Agent Queue System manages the lifecycle and execution of background AI agents in Auto Claude. It ensures that agents spawn sequentially to prevent race conditions and file corruption.

## Why Sequential Execution?

### The Problem: `~/.claude.json` Race Condition

When multiple agents spawn concurrently, they all attempt to read and write to `~/.claude.json`:

```
Agent 1: Read ~/.claude.json → Modify → Write
Agent 2: Read ~/.claude.json → Modify → Write (concurrently!)
Agent 3: Read ~/.claude.json → Modify → Write (concurrently!)
```

This caused:
- **JSON corruption**: Invalid JSON structure from interleaved writes
- **Backup file accumulation**: `.claude.json.backup`, `.claude.json.backup.1`, etc.
- **Lost configuration**: Last write wins, earlier changes lost
- **Mysterious failures**: Agents failing with "invalid JSON" errors

### The Solution: Sequential Spawning via SpawnQueue

All agent types now execute **sequentially** through a FIFO queue:

```
Request 1 (ideation) → Spawn → Wait for exit → Next
Request 2 (roadmap)  → Spawn → Wait for exit → Next
Request 3 (ideation) → Spawn → Wait for exit → Next
```

**Benefits:**
- No concurrent writes to `~/.claude.json`
- No JSON corruption or backup files
- Predictable execution order
- Simple error recovery (continue on failure)

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     AgentQueueManager                        │
│  - startIdeationGeneration()                                 │
│  - startRoadmapGeneration()                                  │
│  - stopIdeation() / stopRoadmap()                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │   SpawnQueue    │
              │  (FIFO Queue)   │
              └────────┬────────┘
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
┌─────────────────────┐    ┌─────────────────────┐
│ executeIdeationSpawn│    │executeRoadmapSpawn  │
│  (ideation_runner)  │    │ (roadmap_runner)    │
└─────────────────────┘    └─────────────────────┘
         │                           │
         └───────────┬───────────────┘
                     ▼
            ┌─────────────────┐
            │  AgentState     │
            │  - addProcess() │
            │  - deleteProcess│
            └─────────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │  AgentEvents    │
            │  (emit events)  │
            └─────────────────┘
```

### Data Flow

1. **User Request**: User triggers ideation or roadmap generation from UI
2. **Enqueue**: `AgentQueueManager` creates `SpawnRequest` and enqueues it
3. **Queue Processing**: `SpawnQueue` processes requests FIFO
4. **Spawn Execution**: Router calls `executeIdeationSpawn()` or `executeRoadmapSpawn()`
5. **Process Tracking**: Spawned process added to `AgentState` for tracking
6. **Event Handlers**: stdout/stderr/exit handlers attached to process
7. **Wait for Exit**: Queue waits for process to exit before processing next
8. **Completion**: Success/error events emitted to renderer process

### Queue Behavior

**FIFO Processing:**
- First in, first out
- No priority system (simple is better)
- All agent types share same queue

**Error Resilience:**
- If spawn fails, invoke `onError` callback
- Continue to next item in queue
- Don't block queue on single failure

**Sequential Execution:**
- Only one agent spawns at a time
- Wait for `process.exit()` before next spawn
- Prevents `~/.claude.json` race condition

## Agent Types

### Ideation Agents

**Purpose**: Discover improvements, performance issues, security vulnerabilities

**Runner**: `apps/backend/runners/ideation_runner.py`

**Types**:
- `discovery`: Code improvements and refactorings
- `performance`: Performance optimizations
- `security`: Security vulnerabilities
- `testing`: Test coverage gaps
- `documentation`: Documentation improvements
- `accessibility`: Accessibility issues

**Process Type**: `'ideation'`

**Events**:
- `ideation-progress`: Progress updates with phase/message
- `ideation-log`: Log output lines
- `ideation-type-complete`: Single type completed with ideas
- `ideation-type-failed`: Single type failed
- `ideation-complete`: All types completed
- `ideation-error`: Fatal error
- `ideation-stopped`: User stopped generation

### Roadmap Agents

**Purpose**: Generate strategic roadmap with competitor analysis

**Runner**: `apps/backend/runners/roadmap_runner.py`

**Features**:
- Strategic feature planning
- Competitive analysis (optional)
- Timeline estimation
- Priority ranking

**Process Type**: `'roadmap'`

**Events**:
- `roadmap-progress`: Progress updates with phase/message
- `roadmap-log`: Log output lines
- `roadmap-complete`: Roadmap generated
- `roadmap-error`: Fatal error
- `roadmap-stopped`: User stopped generation

### Build Agents (Not in Queue)

**Note**: Build agents (planner, coder, QA) are managed separately by `agent-process.ts` and do **not** go through this queue. They have their own spawning mechanism tied to spec/task lifecycle.

## Process State Tracking

Each spawned process is tracked in `AgentState`:

```typescript
interface QueuedProcessInfo {
  taskId: string;           // Project ID or task ID
  process: ChildProcess;    // Node.js ChildProcess instance
  startedAt: Date;          // When process was spawned
  projectPath: string;      // Project directory path
  spawnId: number;          // Unique spawn ID
  queueProcessType: 'ideation' | 'roadmap'; // Process type
}
```

**Key Methods:**
- `addProcess(projectId, info)`: Track spawned process
- `getProcess(projectId)`: Get process info
- `deleteProcess(projectId)`: Remove from tracking
- `generateSpawnId()`: Generate unique spawn ID
- `wasSpawnKilled(spawnId)`: Check if intentionally stopped
- `clearKilledSpawn(spawnId)`: Clear killed flag

## Adding New Agent Types

To add a new agent type to the sequential queue:

### 1. Define Process Type

Add to `QueuedProcessInfo` type in `agent-state.ts`:

```typescript
queueProcessType: 'ideation' | 'roadmap' | 'new-type';
```

### 2. Create Spawn Executor

Add method in `AgentQueueManager`:

```typescript
private async executeNewTypeSpawn(
  spawnId: string,
  projectPath: string,
  args: string[],
  env: Record<string, string>,
  projectId: string,
  cwd: string
): Promise<ChildProcess> {
  // Spawn the process
  const childProcess = spawn(/* ... */);

  // Add to state tracking
  this.state.addProcess(projectId, {
    taskId: projectId,
    process: childProcess,
    startedAt: new Date(),
    projectPath,
    spawnId: parseInt(spawnId, 10),
    queueProcessType: 'new-type'
  });

  return childProcess;
}
```

### 3. Create Spawn Wrapper

Add method in `AgentQueueManager` to enqueue requests:

```typescript
async startNewTypeGeneration(
  projectId: string,
  projectPath: string,
  config: NewTypeConfig
): Promise<void> {
  // Build args
  const args = ['runner.py', '--project', projectPath];

  // Enqueue spawn request
  this.spawnQueue.enqueue({
    id: String(spawnId),
    type: 'new-type',
    projectId,
    projectPath,
    args,
    env: finalEnv,
    cwd,
    onSpawn: async (childProcess) => {
      // Attach event handlers
      childProcess.stdout?.on('data', (data) => { /* ... */ });
      childProcess.on('exit', (code) => { /* ... */ });
    },
    onError: (error) => {
      this.emitter.emit('new-type-error', projectId, error.message);
    }
  });
}
```

### 4. Update SpawnQueue Router

Update constructor in `AgentQueueManager`:

```typescript
this.spawnQueue = new SpawnQueue(async (id, projectPath, args, env, projectId, cwd, type = 'ideation') => {
  if (type === 'roadmap') {
    return this.executeRoadmapSpawn(id, projectPath, args, env, projectId, cwd);
  } else if (type === 'new-type') {
    return this.executeNewTypeSpawn(id, projectPath, args, env, projectId, cwd);
  } else {
    return this.executeIdeationSpawn(id, projectPath, args, env, projectId, cwd);
  }
});
```

### 5. Add Event Emitter Methods

Add stop/status methods:

```typescript
stopNewType(projectId: string): boolean {
  const processInfo = this.state.getProcess(projectId);
  const isNewType = processInfo?.queueProcessType === 'new-type';

  if (isNewType) {
    this.processManager.killProcess(projectId);
    this.emitter.emit('new-type-stopped', projectId);
    return true;
  }
  return false;
}

isNewTypeRunning(projectId: string): boolean {
  const processInfo = this.state.getProcess(projectId);
  return processInfo?.queueProcessType === 'new-type';
}
```

## Rate Limit Detection

The queue system automatically detects API rate limits:

1. **Collect Output**: stdout/stderr collected during process execution
2. **Detect Patterns**: Checks for rate limit error messages
3. **Emit Event**: `sdk-rate-limit` event with detection info
4. **Auto-Switch**: Profile scorer automatically switches to next available profile

**Detection**:
```typescript
const rateLimitDetection = detectRateLimit(allOutput);
if (rateLimitDetection.isRateLimited) {
  const rateLimitInfo = createSDKRateLimitInfo('ideation', rateLimitDetection, { projectId });
  this.emitter.emit('sdk-rate-limit', rateLimitInfo);
}
```

## Python Environment Management

Agents require a Python environment with dependencies:

1. **Pre-flight Check**: `ensurePythonEnvReady()` checks if venv is ready
2. **Venv Creation**: If needed, creates venv and installs dependencies
3. **Python Path**: Uses configured Python path (or bundled Python)
4. **PYTHONPATH**: Bundled site-packages + autoBuildSource for imports

**Environment Variables**:
```typescript
const finalEnv = {
  ...process.env,
  ...pythonEnv,           // Bundled packages
  ...combinedEnv,         // auto-claude/.env
  ...profileEnv,          // OAuth token
  ...apiProfileEnv,       // API profile config
  PYTHONPATH: combinedPythonPath,
  PYTHONUNBUFFERED: '1',
  PYTHONUTF8: '1'
};
```

## Progress Persistence

Roadmap generation persists progress to disk for recovery:

- **File**: `.auto-claude/roadmap/generation_progress.json`
- **Debounced**: 300ms debounce (3-4 writes/sec max)
- **Leading + Trailing**: Immediate first write, final state on completion
- **Recovery**: Process can recover after app restart

**Progress Data**:
```json
{
  "phase": "analyzing",
  "progress": 45,
  "message": "Analyzing codebase...",
  "started_at": "2025-02-15T10:30:00Z",
  "last_update_at": "2025-02-15T10:35:00Z",
  "is_running": true
}
```

## Debug Logging

All operations are logged for debugging:

```typescript
debugLog('[Agent Queue] Starting ideation generation:', { projectId, projectPath, config });
debugLog('[Agent Queue] Generated spawn ID:', spawnId);
debugLog('[Agent Queue] Ideation process spawned:', { spawnId, projectId, pid });
```

**Enable Debug Logs**:
- Dev mode: Logs always visible
- Production: Set `DEBUG=auto-claude:*` environment variable

## Error Handling

### Spawn Errors

If process spawn fails:
1. `onError` callback invoked
2. Error event emitted to renderer
3. Queue continues to next item

**Example**:
```typescript
onError: (error) => {
  debugError('[Agent Queue] Failed to spawn ideation process:', error);
  this.emitter.emit('ideation-error', projectId, error.message);
}
```

### Process Errors

If process errors after spawn:
1. `process.on('error')` handler invoked
2. Process removed from state tracking
3. Error event emitted to renderer

### Exit Codes

- **Code 0**: Success
- **Code ≠ 0**: Failure (check for rate limits)

## Testing

### Manual Testing

```bash
# Start app in dev mode
npm run dev

# Trigger multiple agents simultaneously:
# 1. Open 3 projects
# 2. Click "Generate Ideas" on all 3 quickly
# 3. Click "Generate Roadmap" on 2 projects
# 4. Monitor console - should see sequential execution
# 5. Check ~/.claude.json - should be valid JSON
# 6. No .backup files should be created
```

### Automated Testing

```bash
# Run frontend tests
cd apps/frontend
npm test

# Typecheck
npm run typecheck

# Lint
npm run lint
```

## Files

- **agent-queue.ts**: Main queue manager, spawns ideation/roadmap agents
- **spawn-queue.ts**: FIFO queue for sequential spawning
- **agent-state.ts**: Process state tracking
- **agent-events.ts**: Event emission and progress parsing
- **agent-process.ts**: Process lifecycle management (build agents)
- **types.ts**: TypeScript type definitions

## Related Documentation

- [ARCHITECTURE.md](../../../../../../shared_docs/ARCHITECTURE.md): Overall architecture
- [apps/frontend/CONTRIBUTING.md](../../../../../../apps/frontend/CONTRIBUTING.md): Frontend contributing guide
- [CLAUDE.md](../../../../../../CLAUDE.md): Project instructions

## Troubleshooting

### Agents Not Starting

**Symptom**: Click "Generate Ideas" but nothing happens

**Checks**:
1. Check Python path is configured in settings
2. Check autoBuildSource path is set
3. Check runner files exist (`ideation_runner.py`, `roadmap_runner.py`)
4. Check debug logs for errors

### JSON Corruption

**Symptom**: `~/.claude.json` is invalid JSON

**Checks**:
1. Check if queue is being used (should be sequential)
2. Check for concurrent spawns (shouldn't happen)
3. Check backup files (.backup, .backup.1)
4. Restore from backup: `cp ~/.claude.json.backup ~/.claude.json`

### Rate Limiting

**Symptom**: Agents fail with rate limit errors

**Solution**:
1. System automatically switches to next available profile
2. Add more Claude profiles in settings
3. Wait for rate limit to reset (1 minute)

### Process Won't Stop

**Symptom**: Click "Stop" but process keeps running

**Checks**:
1. Check process ID in debug logs
2. Check if `wasIntentionallyStopped` flag is set
3. Check if process is tracked in AgentState
4. Manual kill: `kill <PID>` (macOS/Linux) or `taskkill /PID <PID>` (Windows)
