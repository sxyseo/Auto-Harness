/**
 * External CLI Invoker
 * ===================
 *
 * Executes external AI CLI tools (CodeX, Claude Code CLI, custom CLIs) as alternatives
 * to the internal Vercel AI SDK implementation.
 *
 * When a phase is mapped to an external CLI client, this invoker:
 * 1. Spawns the CLI process with the appropriate arguments
 * 2. Streams output back to the agent session
 * 3. Handles tool calls by proxying them through the CLI
 * 4. Returns a structured SessionResult compatible with runAgentSession()
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

import type { ExternalClientConfig } from '../../../shared/types/client-config';
import type { SessionResult, SessionMessage, TokenUsage, StreamEvent } from '../session/types';
import type { ToolContext } from '../tools/types';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for invoking an external CLI
 */
export interface ExternalCliInvocation {
  /** External CLI client configuration */
  client: ExternalClientConfig;
  /** System prompt for the agent */
  systemPrompt: string;
  /** Initial user message */
  initialMessage: string;
  /** Tool context (cwd, projectDir, specDir) */
  toolContext: ToolContext;
  /** Working directory for the CLI */
  cwd: string;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

interface CliLaunchConfig {
  args: string[];
  stdinContent?: string;
}

// =============================================================================
// External CLI Invoker
// =============================================================================

/**
 * Run an external CLI and return a session result.
 *
 * This function:
 * 1. Builds the CLI command and lets the OS resolve the executable via PATH
 * 2. Constructs the command with appropriate arguments
 * 3. Spawns the process and streams output
 * 4. Captures the final response and usage
 * 5. Returns a SessionResult compatible with the internal session runner
 */
export async function invokeExternalCli(
  invocation: ExternalCliInvocation,
  onEvent?: (event: StreamEvent) => void,
): Promise<SessionResult> {
  const { client, systemPrompt, initialMessage, toolContext, cwd, abortSignal } = invocation;

  const startTime = Date.now();

  // Build command arguments
  const launchConfig = buildCliArgs(client, systemPrompt, initialMessage, toolContext);

  // Spawn the CLI process
  const cliProcess = spawn(client.executable, launchConfig.args, {
    cwd,
    env: { ...process.env, ...client.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (launchConfig.stdinContent) {
    cliProcess.stdin.write(launchConfig.stdinContent);
  }
  cliProcess.stdin.end();

  // Track output
  let stdoutOutput = '';
  let stderrOutput = '';
  let toolCallCount = 0;

  // Handle stdout (stream text and tool calls)
  cliProcess.stdout?.on('data', (data: Buffer) => {
    const text = data.toString();
    stdoutOutput += text;

    // Emit text-delta events
    onEvent?.({ type: 'text-delta', text });
  });

  // Handle stderr (error messages)
  cliProcess.stderr?.on('data', (data: Buffer) => {
    const text = data.toString();
    stderrOutput += text;

    // Emit error event for non-empty stderr
    if (text.trim()) {
      onEvent?.({
        type: 'error',
        error: {
          code: 'cli_stderr',
          message: text.trim(),
          retryable: false,
        },
      });
    }
  });

  // Handle process exit
  const { exitCode, spawnError } = await waitForProcessExit(cliProcess);

  // Check if process was aborted
  if (abortSignal?.aborted) {
    cliProcess.kill();
    return {
      outcome: 'cancelled',
      stepsExecuted: 0,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      messages: [],
      toolCallCount: 0,
      durationMs: Date.now() - startTime,
    };
  }

  if (spawnError) {
    const isMissingExecutable = isExecutableNotFoundError(spawnError);
    const errorCode = isMissingExecutable ? 'cli_not_found' : 'cli_spawn_error';
    const errorMessage = isMissingExecutable
      ? `External CLI executable not found: ${client.executable}`
      : `Failed to start external CLI ${client.executable}: ${spawnError.message}`;

    onEvent?.({
      type: 'error',
      error: {
        code: errorCode,
        message: errorMessage,
        retryable: false,
      },
    });

    return {
      outcome: 'error',
      stepsExecuted: 0,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      error: {
        code: errorCode,
        message: errorMessage,
        retryable: false,
      },
      messages: [],
      toolCallCount: 0,
      durationMs: Date.now() - startTime,
    };
  }

  // Parse CLI output to extract tool calls and response
  const { messages, toolCalls } = parseCliOutput(stdoutOutput, client.type);
  toolCallCount = toolCalls;

  // Determine outcome
  let outcome: SessionResult['outcome'] = 'completed';
  if (exitCode !== 0) {
    outcome = 'error';
    return {
      outcome,
      stepsExecuted: 0,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      error: {
        code: 'cli_error',
        message: `CLI exited with code ${exitCode}: ${stderrOutput || stdoutOutput}`,
        retryable: false,
      },
      messages,
      toolCallCount,
      durationMs: Date.now() - startTime,
    };
  }

  // Estimate token usage (CLI tools don't report this)
  const usage = estimateTokenUsage(systemPrompt, initialMessage, stdoutOutput);

  return {
    outcome,
    stepsExecuted: 1, // CLI runs as a single "step"
    usage,
    messages,
    toolCallCount,
    durationMs: Date.now() - startTime,
  };
}

// =============================================================================
// CLI Argument Builders
// =============================================================================

/**
 * Build command-line arguments for different CLI types
 */
function buildCliArgs(
  client: ExternalClientConfig,
  systemPrompt: string,
  userMessage: string,
  toolContext: ToolContext,
): CliLaunchConfig {
  const baseArgs = client.args ?? [];

  switch (client.type) {
    case 'codex':
      return buildCodexArgs(client, systemPrompt, userMessage, toolContext, baseArgs);

    case 'claude-code':
      return buildClaudeCodeArgs(client, systemPrompt, userMessage, toolContext, baseArgs);

    case 'custom':
      return { args: baseArgs }; // Custom CLIs should handle prompts via stdin/env

    default:
      return { args: baseArgs };
  }
}

/**
 * Build arguments for OpenAI Codex CLI
 */
function buildCodexArgs(
  client: ExternalClientConfig,
  systemPrompt: string,
  userMessage: string,
  toolContext: ToolContext,
  baseArgs: string[],
): CliLaunchConfig {
  // The installed Codex CLI uses `codex exec` for non-interactive runs and
  // reads stdin when the prompt argument is `-`.
  const args = baseArgs[0] === 'exec' ? [...baseArgs] : ['exec', ...baseArgs];

  if (!hasAnyFlag(args, ['-C', '--cd'])) {
    args.push('--cd', toolContext.projectDir);
  }

  if (!hasAnyFlag(args, ['--color'])) {
    args.push('--color', 'never');
  }

  if (client.yoloMode && !hasAnyFlag(args, ['--dangerously-bypass-approvals-and-sandbox'])) {
    args.push('--dangerously-bypass-approvals-and-sandbox');
  }

  args.push('-');

  return {
    args,
    stdinContent: buildCodexPrompt(systemPrompt, userMessage),
  };
}

/**
 * Build arguments for Claude Code CLI
 */
function buildClaudeCodeArgs(
  client: ExternalClientConfig,
  systemPrompt: string,
  userMessage: string,
  toolContext: ToolContext,
  baseArgs: string[],
): CliLaunchConfig {
  // Claude Code expects: claude-code --prompt "..." --directory "..."
  const args = [...baseArgs];

  // Add system prompt
  if (client.capabilities.supportsThinking) {
    args.push('--system', systemPrompt);
  }

  // Add user message
  args.push('--prompt', userMessage);

  // Add working directory
  args.push('--directory', toolContext.projectDir);

  // Add YOLO mode if enabled
  if (client.yoloMode) {
    args.push('--yolo');
  }

  return { args };
}

function buildCodexPrompt(systemPrompt: string, userMessage: string): string {
  return [
    'System instructions:',
    systemPrompt,
    '',
    'User request:',
    userMessage,
    '',
  ].join('\n');
}

function hasAnyFlag(args: string[], flags: string[]): boolean {
  return flags.some((flag) => args.includes(flag));
}

async function waitForProcessExit(
  cliProcess: ChildProcessWithoutNullStreams,
): Promise<{ exitCode: number; spawnError: Error | null }> {
  return await new Promise((resolve) => {
    let settled = false;

    cliProcess.once('error', (error) => {
      if (settled) return;
      settled = true;
      resolve({ exitCode: -1, spawnError: error });
    });

    cliProcess.once('close', (code) => {
      if (settled) return;
      settled = true;
      resolve({ exitCode: code ?? -1, spawnError: null });
    });
  });
}

function isExecutableNotFoundError(error: Error): boolean {
  const withCode = error as Error & { code?: string };
  return withCode.code === 'ENOENT' || error.message.includes('ENOENT');
}

// =============================================================================
// Output Parsing
// =============================================================================

/**
 * Parse CLI output to extract messages and count tool calls
 */
function parseCliOutput(
  output: string,
  cliType: ExternalClientConfig['type'],
): { messages: SessionMessage[]; toolCalls: number } {
  // Most CLIs output plain text; treat entire output as assistant message
  const messages: SessionMessage[] = [
    { role: 'assistant', content: output },
  ];

  // Try to detect tool calls in output (format varies by CLI)
  let toolCalls = 0;

  // Look for common patterns like "Running: git add" or "Executing: npm install"
  const toolPatterns = [
    /Running:\s*\S+/g,
    /Executing:\s*\S+/g,
    /Tool:\s*\S+/g,
    /\[TOOL\]\s*\S+/g,
  ];

  for (const pattern of toolPatterns) {
    const matches = output.match(pattern);
    if (matches) {
      toolCalls += matches.length;
    }
  }

  return { messages, toolCalls };
}

/**
 * Estimate token usage (CLIs don't report actual usage)
 */
function estimateTokenUsage(
  systemPrompt: string,
  userMessage: string,
  response: string,
): TokenUsage {
  // Rough estimate: ~4 chars per token
  const promptEstimate = Math.ceil((systemPrompt.length + userMessage.length) / 4);
  const completionEstimate = Math.ceil(response.length / 4);

  return {
    promptTokens: promptEstimate,
    completionTokens: completionEstimate,
    totalTokens: promptEstimate + completionEstimate,
  };
}
