/**
 * Agent Debug API Module
 * =======================
 *
 * Preload API for agent debug logging functionality.
 */

import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@shared/constants';
import type { AgentDebugEvent, LogLevel } from '@shared/types';
import type { IPCResult } from '@shared/types';

export const agentDebugAPI = {
  /**
   * Get recent debug logs
   */
  getLogs: (options?: { agentId?: string; taskId?: string; count?: number }) =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_DEBUG_GET_LOGS, options) as Promise<IPCResult<AgentDebugEvent[]>>,

  /**
   * Get all agent states
   */
  getStates: () =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_DEBUG_GET_STATES) as Promise<
      IPCResult<Record<string, { lastActivity: string; status: string }>>
    >,

  /**
   * Set debug log level
   */
  setLogLevel: (level: LogLevel) =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENT_DEBUG_SET_LEVEL, level) as Promise<IPCResult>,

  /**
   * Clear debug log buffer
   */
  clear: () => ipcRenderer.invoke(IPC_CHANNELS.AGENT_DEBUG_CLEAR) as Promise<IPCResult>,

  /**
   * Listen for debug events
   */
  onDebugEvent: (callback: (event: Electron.IpcRendererEvent, data: AgentDebugEvent) => void) => {
    ipcRenderer.on(IPC_CHANNELS.AGENT_DEBUG_EVENT, callback);
  },

  /**
   * Remove debug event listener
   */
  removeDebugEventListener: (callback: (event: Electron.IpcRendererEvent, data: AgentDebugEvent) => void) => {
    ipcRenderer.removeListener(IPC_CHANNELS.AGENT_DEBUG_EVENT, callback);
  },
};
