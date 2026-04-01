/**
 * Agent Debug Types
 * ==================
 *
 * Types for the agent debug logging system.
 */

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
