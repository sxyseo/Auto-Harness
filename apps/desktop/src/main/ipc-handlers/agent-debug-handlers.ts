/**
 * Agent Debug Logging Handlers
 * ============================
 *
 * IPC handlers for the agent debug logging system.
 * Provides real-time access to agent activities, errors, and states.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { IPCResult, LogLevel } from '../../shared/types';
import { agentDebugLogger } from '../agent-debug-logger';

/**
 * Register agent debug logging handlers
 */
export function registerAgentDebugHandlers(getMainWindow: () => BrowserWindow | null): void {
  /**
   * Get recent debug logs
   */
  ipcMain.handle(
    IPC_CHANNELS.AGENT_DEBUG_GET_LOGS,
    async (_, options?: { agentId?: string; taskId?: string; count?: number }): Promise<IPCResult> => {
      try {
        const count = options?.count || 100;

        let logs;
        if (options?.agentId) {
          logs = agentDebugLogger.getLogsForAgent(options.agentId, count);
        } else if (options?.taskId) {
          logs = agentDebugLogger.getLogsForTask(options.taskId, count);
        } else {
          logs = agentDebugLogger.getRecentLogs(count);
        }

        return { success: true, data: logs };
      } catch (error) {
        console.error('[AGENT_DEBUG_GET_LOGS] Failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get debug logs'
        };
      }
    }
  );

  /**
   * Get all agent states
   */
  ipcMain.handle(
    IPC_CHANNELS.AGENT_DEBUG_GET_STATES,
    async (): Promise<IPCResult> => {
      try {
        const states = agentDebugLogger.getAgentStates();
        return { success: true, data: states };
      } catch (error) {
        console.error('[AGENT_DEBUG_GET_STATES] Failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get agent states'
        };
      }
    }
  );

  /**
   * Set debug log level
   */
  ipcMain.handle(
    IPC_CHANNELS.AGENT_DEBUG_SET_LEVEL,
    async (_, level: LogLevel): Promise<IPCResult> => {
      try {
        agentDebugLogger.setLogLevel(level);
        return { success: true };
      } catch (error) {
        console.error('[AGENT_DEBUG_SET_LEVEL] Failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to set log level'
        };
      }
    }
  );

  /**
   * Clear debug log buffer
   */
  ipcMain.handle(
    IPC_CHANNELS.AGENT_DEBUG_CLEAR,
    async (): Promise<IPCResult> => {
      try {
        agentDebugLogger.clearLogs();
        return { success: true };
      } catch (error) {
        console.error('[AGENT_DEBUG_CLEAR] Failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to clear logs'
        };
      }
    }
  );

  // Configure the logger with the main window getter
  agentDebugLogger.configure(getMainWindow);

  console.log('[AgentDebug] Agent debug logging handlers registered');
}
