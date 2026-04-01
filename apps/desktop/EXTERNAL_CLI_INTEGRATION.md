# External CLI Client Integration - Implementation Guide

## Summary

The multi-client UI has been fully built, but the backend integration to actually **invoke external CLI tools** was missing. This document describes what has been implemented and what remains to complete the integration.

## What Has Been Implemented

### 1. Client Configuration Resolver (`src/main/ai/config/client-config.ts`)
- Resolves which client to use for each pipeline phase
- Checks `multiClientEnabled` setting and `phaseClientMapping`
- Returns provider or external CLI client based on configuration

### 2. External CLI Invoker (`src/main/ai/external/invoker.ts`)
- Spawns external CLI processes (codex, claude-code, custom CLIs)
- Streams output back to agent session
- Returns results compatible with internal session runner
- Supports CLI-specific features (YOLO mode, capabilities)

### 3. Agent Worker Integration (`src/main/ai/agent/worker.ts`)
- Modified `runSingleSession()` to check for external CLI configuration
- When external CLI is configured, invokes it instead of internal SDK

### 4. Type Definitions (`src/main/ai/agent/types.ts`)
- Added `settings` field to `SerializableSessionConfig`
- Passes multi-client configuration to worker thread

## What Remains to Be Done

### Critical Missing Piece: Settings Injection

The agent worker needs to receive the app settings when it's spawned. Currently, the `settings` field in `SerializableSessionConfig` is `undefined` because the code that creates the worker configuration doesn't pass it.

**Where this needs to be fixed:**

The worker configuration is built in the task execution code. Look for where `SerializableSessionConfig` objects are created (likely in IPC handlers or the agent manager). You need to add the settings field:

```typescript
// Find code that looks like this:
const sessionConfig: SerializableSessionConfig = {
  agentType: 'coder',
  systemPrompt: prompt,
  initialMessages: [...],
  // ... other fields
};

// Add settings:
const sessionConfig: SerializableSessionConfig = {
  agentType: 'coder',
  systemPrompt: prompt,
  initialMessages: [...],
  // ... other fields
  settings: {
    multiClientEnabled: appSettings.multiClientEnabled,
    phaseClientMapping: appSettings.phaseClientMapping,
    externalCliClients: appSettings.externalCliClients,
  },
};
```

### How to Find Where to Add Settings

1. Search for where `AgentExecutorConfig` is created
2. Look for where `SerializableSessionConfig` objects are built
3. Add the `settings` field with the app's multi-client configuration

### Example Places to Check:

- `src/main/ipc-handlers/task/execution-handlers.ts` (if it exists)
- `src/main/ai/agent/agent-process.ts` (task execution logic)
- IPC handlers that start tasks (e.g., `execute-task`, `start-agent`)

## How to Test After Integration

Once settings are properly passed to the worker:

1. **Configure Multi-Client Mode in Settings**
   - Enable "Multi-Client Mode"
   - Add an external CLI client (e.g., CodeX)
   - Map phases to use the external CLI

2. **Run a Task**
   - Start a task from the Kanban board
   - Check the agent debug logs for: `[EXTERNAL_CLI] Invoking <client-name> for phase <phase>`
   - Verify the external CLI is actually being called

3. **Verify Tool Calls**
   - Check task logs for actual tool executions (Read, Write, Edit, Bash)
   - Confirm files are being modified
   - Verify real code generation is happening

## Debug Logging

The external CLI invoker logs its activity:

- `[EXTERNAL_CLI] Invoking <client-name> for phase <phase>` - External CLI is being used
- `[SESSION] Starting <agent-type> session (phase: <phase>)` - Internal SDK is being used

If you see the second log but not the first, settings are not being passed correctly.

## Configuration Example

In your app settings (`~/.config/auto-claude/settings.json` or equivalent):

```json
{
  "multiClientEnabled": true,
  "phaseClientMapping": {
    "spec": { "type": "provider", "provider": "anthropic", "modelId": "claude-sonnet-4-6" },
    "planning": { "type": "provider", "provider": "anthropic", "modelId": "claude-sonnet-4-6" },
    "coding": { "type": "cli", "cliId": "codex-cli" },
    "qa": { "type": "cli", "cliId": "codex-cli" }
  },
  "externalCliClients": [
    {
      "id": "codex-cli",
      "name": "CodeX CLI",
      "type": "codex",
      "executable": "/usr/local/bin/codex",
      "capabilities": {
        "supportsTools": true,
        "supportsThinking": false,
        "supportsStreaming": true,
        "supportsVision": false
      }
    }
  ]
}
```

## Notes

- The multi-client UI is fully functional (settings can be configured)
- The worker thread correctly checks for external CLI configuration
- The only missing piece is passing settings when creating the worker
- Once settings are passed, external CLIs will be invoked automatically
