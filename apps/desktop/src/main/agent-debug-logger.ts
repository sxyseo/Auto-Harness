/**
 * Agent Debug Logger
 * ==================
 *
 * Centralized real-time logging system for all agent activities.
 * Provides visibility into what each agent is doing, errors, and status.
 *
 * Features:
 * - Real-time event streaming to UI
 * - Configurable log levels (debug, info, warn, error)
 * - Agent-specific filtering
 * - Performance metrics
 */

import { EventEmitter } from 'events';
import path from 'path';
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { safeSendToRenderer } from './ipc-handlers/utils';
import { IPC_CHANNELS } from '../shared/constants';
import type { BrowserWindow } from 'electron';

// =============================================================================
// Types
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AgentDebugEvent {
  timestamp: string;
  level: LogLevel;
  agentId: string;
  agentType: string;
  category: 'lifecycle' | 'tool_call' | 'thinking' | 'error' | 'progress' | 'system';
  message: string;
  details?: Record<string, unknown>;
  taskId?: string;
  projectId?: string;
}

export interface AgentDebugConfig {
  enableConsole: boolean;
  enableFile: boolean;
  enableUI: boolean;
  minLevel: LogLevel;
  logFilePath?: string;
}

// =============================================================================
// Agent Debug Logger
// =============================================================================

class AgentDebugLogger extends EventEmitter {
  private config: AgentDebugConfig;
  private logBuffer: AgentDebugEvent[] = [];
  private readonly MAX_BUFFER_SIZE = 1000;
  private getMainWindow: (() => BrowserWindow | null) | null = null;
  private agentStates: Map<string, { lastActivity: string; status: string }> = new Map();
  private logDirectory: string | null = null; // Configurable log directory

  constructor() {
    super();
    this.config = {
      enableConsole: true,
      enableFile: true,
      enableUI: true,
      minLevel: 'info', // Default to info level
    };
  }

  configure(getMainWindow: () => BrowserWindow | null): void {
    this.getMainWindow = getMainWindow;
  }

  /**
   * Set the log level
   */
  setLogLevel(level: LogLevel): void {
    this.config.minLevel = level;
    this.info('system', 'logger', `Log level changed to: ${level}`, {}, undefined, undefined);
  }

  /**
   * Enable or disable console logging
   */
  setConsoleEnabled(enabled: boolean): void {
    this.config.enableConsole = enabled;
  }

  /**
   * Set the log directory path (for main process initialization)
   * Call this from the main process with app.getPath('userData')
   */
  setLogDirectory(logDir: string): void {
    this.logDirectory = logDir;
  }

  /**
   * Get current agent states
   */
  getAgentStates(): Record<string, { lastActivity: string; status: string }> {
    return Object.fromEntries(this.agentStates);
  }

  /**
   * Log a debug event
   */
  debug(
    agentType: string,
    agentId: string,
    message: string,
    details?: Record<string, unknown>
  ): void {
    this.log('debug', agentType, agentId, 'system', message, details);
  }

  /**
   * Log an info event
   */
  info(
    category: AgentDebugEvent['category'],
    agentType: string,
    agentId: string,
    message: string,
    details?: Record<string, unknown>,
    taskId?: string,
    projectId?: string
  ): void {
    this.log('info', agentType, agentId, category, message, { ...details, taskId, projectId });
  }

  /**
   * Log a warning
   */
  warn(
    agentType: string,
    agentId: string,
    message: string,
    details?: Record<string, unknown>,
    taskId?: string,
    projectId?: string
  ): void {
    this.log('warn', agentType, agentId, 'system', message, { ...details, taskId, projectId });
  }

  /**
   * Log an error
   */
  error(
    agentType: string,
    agentId: string,
    message: string,
    details?: Record<string, unknown>
  ): void {
    this.log('error', agentType, agentId, 'error', message, details);
  }

  /**
   * Log agent lifecycle event (start, stop, etc.)
   */
  lifecycle(
    agentType: string,
    agentId: string,
    event: string,
    details?: Record<string, unknown>
  ): void {
    this.log('info', agentType, agentId, 'lifecycle', event, details);
  }

  /**
   * Log tool call
   */
  toolCall(
    agentType: string,
    agentId: string,
    toolName: string,
    args?: Record<string, unknown>,
    taskId?: string,
    projectId?: string
  ): void {
    this.log('debug', agentType, agentId, 'tool_call', `Calling ${toolName}`, {
      tool: toolName,
      args: this.sanitizeArgs(args),
      taskId,
      projectId,
    });
  }

  /**
   * Log tool result
   */
  toolResult(
    agentType: string,
    agentId: string,
    toolName: string,
    success: boolean,
    duration?: number,
    taskId?: string
  ): void {
    this.log(
      success ? 'debug' : 'error',
      agentType,
      agentId,
      'tool_call',
      `${toolName} ${success ? 'completed' : 'failed'}${duration ? ` in ${duration}ms` : ''}`,
      {
        tool: toolName,
        success,
        duration,
        taskId,
      }
    );
  }

  /**
   * Log thinking/content
   */
  thinking(
    agentType: string,
    agentId: string,
    content: string,
    taskId?: string
  ): void {
    this.log('debug', agentType, agentId, 'thinking', content.substring(0, 200), {
      taskId,
      fullLength: content.length,
    });
  }

  /**
   * Log progress update
   */
  progress(
    agentType: string,
    agentId: string,
    phase: string,
    progress: number,
    message: string,
    taskId?: string,
    projectId?: string
  ): void {
    this.log('info', agentType, agentId, 'progress', message, {
      phase,
      progress,
      taskId,
      projectId,
    });
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private log(
    level: LogLevel,
    agentType: string,
    agentId: string,
    category: AgentDebugEvent['category'],
    message: string,
    details?: Record<string, unknown>,
    taskId?: string,
    projectId?: string
  ): void {
    // Check log level
    if (!this.shouldLog(level)) {
      return;
    }

    const event: AgentDebugEvent = {
      timestamp: new Date().toISOString(),
      level,
      agentId,
      agentType,
      category,
      message,
      details: { ...details, taskId, projectId },
      taskId,
      projectId,
    };

    // Update agent state
    this.agentStates.set(agentId, {
      lastActivity: event.timestamp,
      status: this.inferStatus(category, message),
    });

    // Add to buffer
    this.addToBuffer(event);

    // Console logging
    if (this.config.enableConsole) {
      this.logToConsole(event);
    }

    // File logging
    if (this.config.enableFile) {
      this.logToFile(event);
    }

    // UI streaming
    if (this.config.enableUI) {
      this.sendToUI(event);
    }

    // Emit for legacy consumers
    this.emit('agent-debug', event);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.minLevel);
    const eventLevelIndex = levels.indexOf(level);
    return eventLevelIndex >= currentLevelIndex;
  }

  private inferStatus(category: AgentDebugEvent['category'], message: string): string {
    if (category === 'lifecycle') {
      if (message.includes('started') || message.includes('initialized')) return 'running';
      if (message.includes('stopped') || message.includes('exited')) return 'stopped';
      if (message.includes('error') || message.includes('failed')) return 'error';
    }
    if (category === 'error') return 'error';
    if (category === 'progress') return 'running';
    return 'active';
  }

  private sanitizeArgs(args?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!args) return undefined;

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args)) {
      // Truncate long strings
      if (typeof value === 'string' && value.length > 200) {
        sanitized[key] = value.substring(0, 200) + '...[truncated]';
      } else if (key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')) {
        // Redact sensitive fields
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private addToBuffer(event: AgentDebugEvent): void {
    this.logBuffer.push(event);
    if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
      this.logBuffer.shift();
    }
  }

  private logToConsole(event: AgentDebugEvent): void {
    const prefix = `[${event.agentType}:${event.agentId}]`;
    const message = `${prefix} ${event.message}`;

    switch (event.level) {
      case 'debug':
        console.debug(message, event.details || '');
        break;
      case 'info':
        console.info(message, event.details || '');
        break;
      case 'warn':
        console.warn(message, event.details || '');
        break;
      case 'error':
        console.error(message, event.details || '');
        break;
    }
  }

  private logToFile(event: AgentDebugEvent): void {
    try {
      // Use configured log directory, or fallback to current working directory
      const logDir = this.logDirectory || path.join(process.cwd(), 'logs');
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }

      const logFile = path.join(logDir, 'agent-debug.log');
      const logLine = JSON.stringify(event) + '\n';
      appendFileSync(logFile, logLine, 'utf-8');
    } catch (error) {
      // Don't fail if we can't write to file
      console.error('[AgentDebugLogger] Failed to write to log file:', error);
    }
  }

  private sendToUI(event: AgentDebugEvent): void {
    if (!this.getMainWindow) return;

    const mainWindow = this.getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) return;

    safeSendToRenderer(
      this.getMainWindow,
      IPC_CHANNELS.AGENT_DEBUG_EVENT,
      event
    );
  }

  /**
   * Get recent log events
   */
  getRecentLogs(count: number = 100): AgentDebugEvent[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Get logs filtered by agent
   */
  getLogsForAgent(agentId: string, count: number = 100): AgentDebugEvent[] {
    return this.logBuffer
      .filter(event => event.agentId === agentId)
      .slice(-count);
  }

  /**
   * Get logs filtered by task
   */
  getLogsForTask(taskId: string, count: number = 100): AgentDebugEvent[] {
    return this.logBuffer
      .filter(event => event.taskId === taskId)
      .slice(-count);
  }

  /**
   * Clear the log buffer
   */
  clearLogs(): void {
    this.logBuffer = [];
    this.info('system', 'logger', 'Log buffer cleared', {}, undefined, undefined);
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const agentDebugLogger = new AgentDebugLogger();
