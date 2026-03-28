/**
 * YOLO Mode Utilities for External CLI Clients
 *
 * Handles converting YOLO mode settings to appropriate CLI flags
 * for different external CLI tools (CodeX, Claude Code, etc.)
 */

import type { ExternalClientConfig } from '@shared/types/client-config';

/**
 * Get YOLO mode command line flags for different CLI types
 *
 * @param client - External client configuration
 * @returns Array of command line arguments to enable YOLO mode
 */
export function getYoloModeFlags(client: ExternalClientConfig): string[] {
  if (!client.yoloMode) {
    return [];
  }

  switch (client.type) {
    case 'claude-code':
      // Claude Code uses --dangerously-skip-permissions for YOLO mode
      return ['--dangerously-skip-permissions'];

    case 'codex':
      // CodeX CLI might use different flags - this is a placeholder
      // Actual flags depend on CodeX CLI implementation
      return ['--yolo', '--skip-confirmations'];

    case 'custom':
      // Custom CLIs - user should specify flags in args if needed
      // But we can provide some common patterns
      return ['--yes', '--skip-confirm'];

    default:
      return [];
  }
}

/**
 * Build complete command line arguments for external CLI
 * Combines user-specified args with YOLO mode flags
 *
 * @param client - External client configuration
 * @returns Complete array of command line arguments
 */
export function buildCliArgs(client: ExternalClientConfig): string[] {
  const userArgs = client.args || [];
  const yoloFlags = getYoloModeFlags(client);

  // Combine user args with YOLO flags
  // YOLO flags typically go at the end to override any conflicting options
  return [...userArgs, ...yoloFlags];
}

/**
 * Check if a client has YOLO mode enabled
 *
 * @param client - External client configuration
 * @returns true if YOLO mode is enabled
 */
export function isYoloModeEnabled(client: ExternalClientConfig): boolean {
  return !!client.yoloMode;
}

/**
 * Get warning message for YOLO mode
 *
 * @param client - External client configuration
 * @returns Warning message string
 */
export function getYoloModeWarning(client: ExternalClientConfig): string {
  if (!client.yoloMode) {
    return '';
  }

  const clientName = client.name;
  const cliType = client.type;

  switch (cliType) {
    case 'claude-code':
      return `${clientName} will run with --dangerously-skip-permissions flag. This bypasses all safety checks and can lead to unintended file modifications.`;

    case 'codex':
      return `${clientName} will run in YOLO mode, skipping all confirmation prompts. Use with extreme caution.`;

    case 'custom':
      return `${clientName} will run with auto-confirmation flags. Review the CLI documentation for specific behavior.`;

    default:
      return `${clientName} is running in YOLO mode - safety checks are disabled.`;
  }
}
