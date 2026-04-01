# Task Hang at 50% - Root Cause Analysis

## Problem
Tasks show 50% progress with no logs, appearing to hang.

## Root Cause

### 1. Progress Calculation
The 50% progress is **correct** based on the phase weight system:
```typescript
EXECUTION_PHASE_WEIGHTS = {
  planning: { start: 0, end: 20 },
  coding: { start: 20, end: 80 },
  qa_review: { start: 80, end: 95 }
}
```

When in `coding` phase at 50% phaseProgress:
```
overallProgress = 20 + (80-20) * 0.5 = 50%
```

### 2. Actual Issues
The real problem is **not the progress calculation**, but:

#### A. Worker Thread Initialization Failure
- Worker thread may fail silently without proper error reporting
- No fallback to log the initialization failure

#### B. Log Writing Failures
- TaskLogWriter may fail to write logs due to:
  - Missing directory permissions
  - Disk space issues
  - JSON serialization errors
- Failures are silently caught (non-fatal)

#### C. Phase Detection Gaps
- ProgressTracker relies on tool calls to detect phase transitions
- If the worker stops emitting tool calls, progress appears stuck
- No timeout mechanism to detect stalled workers

#### D. Frontend Polling Issues
- Frontend may not be watching the correct log directory
- Worktree vs main project path confusion
- Polling interval may be too long (1 second)

## Solutions

### Quick Fixes

1. **Add Worker Initialization Logging**
```typescript
// In worker.ts, add at startup:
postLog('[INIT] Worker thread initialized successfully');
postLog(`[INIT] Task ID: ${config.taskId}`);
postLog(`[INIT] Spec Dir: ${config.session.specDir}`);
```

2. **Make Log Writer Failures Visible**
```typescript
// In task-log-writer.ts, change save() to emit errors:
private save(): void {
  try {
    // ... existing save logic
  } catch (error) {
    console.error('[TaskLogWriter] Failed to save logs:', error);
    // Emit to main thread for UI display
    this.emitter?.emit('log-error', error);
  }
}
```

3. **Add Worker Heartbeat**
```typescript
// In worker.ts, add heartbeat every 30 seconds:
setInterval(() => {
  postMessage({
    type: 'heartbeat',
    taskId: config.taskId,
    timestamp: Date.now()
  });
}, 30000);
```

### Long-term Fixes

1. **Implement Worker Timeout**
```typescript
// In agent-process.ts, add timeout detection:
const WORKER_TIMEOUT = 5 * 60 * 1000; // 5 minutes
let lastHeartbeat = Date.now();

const heartbeatCheck = setInterval(() => {
  if (Date.now() - lastHeartbeat > WORKER_TIMEOUT) {
    console.error(`[AgentProcess] Worker timeout for ${taskId}`);
    terminateWorker();
  }
}, 30000);
```

2. **Add Progress Fallback**
```typescript
// If no tool calls for 2 minutes, emit stalled progress:
if (Date.now() - lastToolCallTime > 2 * 60 * 1000) {
  emit('execution-progress', taskId, {
    phase: currentPhase,
    message: 'Waiting for AI response...',
    stalled: true
  });
}
```

3. **Improve Error Reporting**
```typescript
// Catch all worker errors and emit detailed diagnostics:
worker.on('error', (error) => {
  emit('error', taskId, {
    message: error.message,
    stack: error.stack,
    workerConfig: JSON.stringify(config.session)
  });
});
```

## Diagnostic Steps

When you see a task stuck at 50%:

1. **Check if worker is alive:**
   ```bash
   ps aux | grep -i electron | grep -v grep
   ```

2. **Check for log files:**
   ```bash
   find .auto-claude/specs -name "task_logs.json" -mmin -10
   ```

3. **Check recent log entries:**
   ```bash
   cat .auto-claude/specs/TASK_ID/task_logs.json | jq '.phases.coding.entries[-5:]'
   ```

4. **Check for errors in console:**
   - Open DevTools in the app
   - Look for red error messages
   - Check for worker initialization failures

## Implementation Priority

1. **HIGH:** Add worker initialization logging (immediate visibility)
2. **HIGH:** Make log writer failures visible (currently silent)
3. **MEDIUM:** Add worker heartbeat and timeout (detect stalls)
4. **LOW:** Improve progress fallback UX (better messaging)
