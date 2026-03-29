/**
 * Agent Debug Panel
 * ==================
 *
 * Real-time agent activity monitoring panel.
 * Shows all agent events, errors, and status in one place.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { RefreshCw, Trash2, Filter, Bug } from 'lucide-react';
import type { AgentDebugEvent } from '@shared/types';
import { cn } from '../../lib/utils';

interface AgentDebugPanelProps {
  taskId?: string;
}

const LEVEL_COLORS: Record<string, string> = {
  debug: 'text-gray-400',
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

const CATEGORY_COLORS: Record<string, string> = {
  lifecycle: 'bg-purple-500/20 text-purple-400',
  tool_call: 'bg-blue-500/20 text-blue-400',
  thinking: 'bg-gray-500/20 text-gray-400',
  error: 'bg-red-500/20 text-red-400',
  progress: 'bg-green-500/20 text-green-400',
  system: 'bg-yellow-500/20 text-yellow-400',
};

export function AgentDebugPanel({ taskId }: AgentDebugPanelProps) {
  const [logs, setLogs] = useState<AgentDebugEvent[]>([]);
  const [agentStates, setAgentStates] = useState<Record<string, { lastActivity: string; status: string }>>({});
  const [logLevel, setLogLevel] = useState<'debug' | 'info' | 'warn' | 'error'>('info');
  const [filter, setFilter] = useState<'all' | 'errors' | 'tools' | 'lifecycle'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Load initial logs
  const loadLogs = useCallback(async () => {
    try {
      const result = await window.electronAPI.agentDebug.getLogs({
        taskId,
        count: 500,
      });
      if (result.success) {
        setLogs(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load agent debug logs:', error);
    }
  }, [taskId]);

  // Load agent states
  const loadStates = useCallback(async () => {
    try {
      const result = await window.electronAPI.agentDebug.getStates();
      if (result.success) {
        setAgentStates(result.data || {});
      }
    } catch (error) {
      console.error('Failed to load agent states:', error);
    }
  }, []);

  // Clear logs
  const clearLogs = useCallback(async () => {
    try {
      await window.electronAPI.agentDebug.clear();
      setLogs([]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }, []);

  // Set log level
  const setLogLevelHandler = useCallback(async (level: typeof logLevel) => {
    try {
      await window.electronAPI.agentDebug.setLogLevel(level);
      setLogLevel(level);
    } catch (error) {
      console.error('Failed to set log level:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadLogs();
    loadStates();

    // Set up event listener for real-time updates
    const handleDebugEvent = (_event: Electron.IpcRendererEvent, data: AgentDebugEvent) => {
      setLogs((prev) => [...prev, data]);

      // Auto-scroll to bottom if enabled
      if (autoScroll && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    };

    window.electronAPI.agentDebug.onDebugEvent(handleDebugEvent);

    // Refresh states periodically
    const interval = setInterval(loadStates, 5000);

    return () => {
      window.electronAPI.agentDebug.removeDebugEventListener(handleDebugEvent);
      clearInterval(interval);
    };
  }, [loadLogs, loadStates, autoScroll]);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    // Level filter
    const levels = ['debug', 'info', 'warn', 'error'];
    const levelIndex = levels.indexOf(logLevel);
    const logLevelIndex = levels.indexOf(log.level);
    if (logLevelIndex < levelIndex) return false;

    // Category filter
    if (filter === 'errors' && log.category !== 'error') return false;
    if (filter === 'tools' && log.category !== 'tool_call') return false;
    if (filter === 'lifecycle' && log.category !== 'lifecycle') return false;

    return true;
  });

  return (
    <Card className="flex flex-col h-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Bug className="h-5 w-5 text-purple-400" />
          <h3 className="font-semibold">Agent Debug Log</h3>
          {isActive && (
            <Badge variant="outline" className="animate-pulse">
              Live
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={logLevel} onValueChange={setLogLevelHandler}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="debug">Debug</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warn">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="errors">Errors</SelectItem>
              <SelectItem value="tools">Tools</SelectItem>
              <SelectItem value="lifecycle">Lifecycle</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(autoScroll && 'bg-accent')}
          >
            Auto Scroll
          </Button>

          <Button variant="ghost" size="sm" onClick={loadLogs}>
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="sm" onClick={clearLogs}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="logs" className="h-full flex flex-col">
          <div className="px-4 pt-2">
            <TabsList>
              <TabsTrigger value="logs">Activity Log</TabsTrigger>
              <TabsTrigger value="states">Agent States</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="logs" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full" ref={scrollRef}>
              <div className="p-4 space-y-2 font-mono text-xs">
                {filteredLogs.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No logs yet. Start an agent to see real-time activity.
                  </div>
                ) : (
                  filteredLogs.map((log, index) => (
                    <div
                      key={index}
                      className={cn(
                        'flex gap-2 p-2 rounded hover:bg-accent/50 transition-colors',
                        log.level === 'error' && 'bg-destructive/10 border border-destructive/20'
                      )}
                    >
                      {/* Timestamp */}
                      <span className="text-muted-foreground shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>

                      {/* Level */}
                      <span className={cn('shrink-0', LEVEL_COLORS[log.level])}>
                        {log.level.toUpperCase()}
                      </span>

                      {/* Agent */}
                      <span className="text-purple-400 shrink-0">
                        {log.agentType}:{log.agentId.slice(-8)}
                      </span>

                      {/* Category */}
                      <Badge variant="outline" className={CATEGORY_COLORS[log.category]}>
                        {log.category}
                      </Badge>

                      {/* Message */}
                      <span className="flex-1 text-foreground/90 break-all">
                        {log.message}
                      </span>

                      {/* Details */}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <span className="text-muted-foreground shrink-0">
                          {JSON.stringify(log.details, null, 0)}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="states" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                {Object.keys(agentStates).length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No active agents
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(agentStates).map(([agentId, state]) => (
                      <div
                        key={agentId}
                        className="p-3 rounded bg-accent/50 border border-border"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm">{agentId}</span>
                          <Badge
                            variant={state.status === 'running' ? 'default' : 'secondary'}
                          >
                            {state.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Last activity: {new Date(state.lastActivity).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}
