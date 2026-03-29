/**
 * OpenCLaw Adapter for Auto-Harness
 *
 * This adapter enables OpenCLaw Mission Control to fully control Auto-Harness,
 * implementing the same API patterns as Mission Control uses for OpenCLaw.
 *
 * Key Features:
 * - Project lifecycle management (create, read, update, delete)
 * - Task orchestration (create, start, stop, reorder, update)
 * - Real-time progress monitoring via WebSocket
 * - Roadmap and Ideation generation
 * - Approval workflows integration
 * - Activity logging and audit trails
 */

import type {
  Project,
  ProjectSettings,
  Task,
  TaskStatus,
  ImplementationPlan,
} from '@shared/types';

import type {
  ProjectSummary,
  ProjectDetails,
  TaskSummary,
  CreateTaskRequest,
  UpdateTaskRequest,
  ReorderTasksRequest,
  DevelopmentProgress,
  ActivityEntry,
  ApiError,
} from '@shared/types/external-api';

// =============================================================================
// OpenCLaw Mission Control Protocol
// =============================================================================

/**
 * OpenCLaw Mission Control API protocol
 * Implements the same patterns as OpenCLaw's backend API
 */
export class OpenClawAdapter {
  private apiBaseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config: { apiBaseUrl?: string; apiKey?: string; timeout?: number }) {
    this.apiBaseUrl = config.apiBaseUrl || 'http://localhost:3456';
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
  }

  // ========================================================================
  // Projects API (OpenCLaw "boards" equivalent)
  // ========================================================================

  /**
   * List all projects (equivalent to Mission Control GET /api/boards)
   */
  async listProjects(): Promise<ProjectSummary[]> {
    return this.request<ProjectSummary[]>('GET', '/api/projects');
  }

  /**
   * Get project details (equivalent to Mission Control GET /api/boards/{id})
   */
  async getProject(projectId: string): Promise<ProjectDetails> {
    return this.request<ProjectDetails>('GET', `/api/projects/${projectId}`);
  }

  /**
   * Create new project (equivalent to Mission Control POST /api/boards)
   */
  async createProject(
    name: string,
    path: string,
    description?: string,
    settings?: Partial<ProjectSettings>
  ): Promise<ProjectSummary> {
    return this.request<ProjectSummary>('POST', '/api/projects', {
      name,
      path,
      description,
      settings,
    });
  }

  /**
   * Update project settings
   */
  async updateProject(
    projectId: string,
    updates: Partial<Project>
  ): Promise<ProjectSummary> {
    return this.request<ProjectSummary>('PATCH', `/api/projects/${projectId}`, updates);
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string): Promise<void> {
    return this.request<void>('DELETE', `/api/projects/${projectId}`);
  }

  // ========================================================================
  // Tasks API (OpenCLaw "tasks" equivalent)
  // ========================================================================

  /**
   * List tasks in a project (equivalent to Mission Control GET /api/tasks)
   */
  async listTasks(projectId: string): Promise<TaskSummary[]> {
    return this.request<TaskSummary[]>('GET', `/api/projects/${projectId}/tasks`);
  }

  /**
   * Get task details
   */
  async getTask(projectId: string, taskId: string): Promise<Task> {
    return this.request<Task>('GET', `/api/projects/${projectId}/tasks/${taskId}`);
  }

  /**
   * Create new task (equivalent to Mission Control POST /api/tasks)
   */
  async createTask(request: CreateTaskRequest): Promise<TaskSummary> {
    return this.request<TaskSummary>('POST', `/api/projects/${request.projectId}/tasks`, {
      title: request.title,
      description: request.description,
      priority: request.priority || 'medium',
      metadata: request.metadata,
    });
  }

  /**
   * Update task (equivalent to Mission Control PATCH /api/tasks/{id})
   */
  async updateTask(projectId: string, taskId: string, updates: UpdateTaskRequest): Promise<TaskSummary> {
    return this.request<TaskSummary>(
      'PATCH',
      `/api/projects/${projectId}/tasks/${taskId}`,
      updates
    );
  }

  /**
   * Start task execution (equivalent to Mission Control POST /api/tasks/{id}/start)
   */
  async startTask(projectId: string, taskId: string): Promise<Task> {
    return this.request<Task>('POST', `/api/projects/${projectId}/tasks/${taskId}/start`);
  }

  /**
   * Stop task execution (equivalent to Mission Control POST /api/tasks/{id}/stop)
   */
  async stopTask(projectId: string, taskId: string): Promise<Task> {
    return this.request<Task>('POST', `/api/projects/${projectId}/tasks/${taskId}/stop`);
  }

  /**
   * Delete task (equivalent to Mission Control DELETE /api/tasks/{id})
   */
  async deleteTask(projectId: string, taskId: string): Promise<void> {
    return this.request<void>('DELETE', `/api/projects/${projectId}/tasks/${taskId}`);
  }

  /**
   * Reorder tasks (Mission Control task dependencies/priorities)
   */
  async reorderTasks(request: ReorderTasksRequest): Promise<void> {
    return this.request<void>('POST', '/api/tasks/reorder', request);
  }

  /**
   * Batch task operations
   */
  async batchTaskOperations(
    projectId: string,
    operations: Array<{
      type: 'update_status' | 'update_priority' | 'start' | 'stop' | 'delete';
      taskId: string;
      value?: any;
    }>
  ): Promise<{ succeeded: number; failed: number; results: any[] }> {
    return this.request('POST', '/api/tasks/batch', { projectId, operations });
  }

  // ========================================================================
  // Roadmap API (Mission Control "roadmap" equivalent)
  // ========================================================================

  /**
   * Get roadmap (equivalent to Mission Control GET /api/roadmaps)
   */
  async getRoadmap(projectId: string): Promise<any> {
    return this.request('GET', `/api/projects/${projectId}/roadmap`);
  }

  /**
   * Generate roadmap (equivalent to Mission Control POST /api/roadmaps/generate)
   */
  async generateRoadmap(
    projectId: string,
    options: {
      prompt?: string;
      competitorAnalysis?: boolean;
      focusAreas?: string[];
      timeframe?: 'short-term' | 'medium-term' | 'long-term';
    }
  ): Promise<any> {
    return this.request('POST', `/api/projects/${projectId}/roadmap/generate`, {
      projectId,
      ...options,
    });
  }

  /**
   * Update roadmap feature
   */
  async updateRoadmapFeature(
    projectId: string,
    featureId: string,
    updates: {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      targetDate?: string;
    }
  ): Promise<any> {
    return this.request('PATCH', `/api/projects/${projectId}/roadmap/features/${featureId}`, updates);
  }

  // ========================================================================
  // Ideation API (Mission Control "ideation" equivalent)
  // ========================================================================

  /**
   * Get ideation (equivalent to Mission Control GET /api/ideations)
   */
  async getIdeation(projectId: string): Promise<any> {
    return this.request('GET', `/api/projects/${projectId}/ideation`);
  }

  /**
   * Generate ideation (equivalent to Mission Control POST /api/ideations/generate)
   */
  async generateIdeation(
    projectId: string,
    options: {
      type?: 'improvements' | 'performance' | 'security' | 'features' | 'all';
      scope?: 'full-project' | 'specific-files';
      files?: string[];
      count?: number;
    }
  ): Promise<any> {
    return this.request('POST', `/api/projects/${projectId}/ideation/generate`, {
      projectId,
      ...options,
    });
  }

  /**
   * Convert ideation to task
   */
  async convertIdeaToTask(
    projectId: string,
    ideaId: string,
    options: {
      taskTitle?: string;
      taskDescription?: string;
      autoStart?: boolean;
    }
  ): Promise<Task> {
    return this.request<Task>(
      'POST',
      `/api/projects/${projectId}/ideation/${ideaId}/convert`,
      options
    );
  }

  // ========================================================================
  // Progress Monitoring (Mission Control "activity" equivalent)
  // ========================================================================

  /**
   * Get development progress (equivalent to Mission Control GET /api/activity)
   */
  async getDevelopmentProgress(projectId: string): Promise<DevelopmentProgress> {
    return this.request<DevelopmentProgress>('GET', `/api/projects/${projectId}/progress`);
  }

  /**
   * Get activity log (Mission Control activity timeline)
   */
  async getActivityLog(
    projectId?: string,
    limit?: number,
    offset?: number
  ): Promise<ActivityEntry[]> {
    const params = new URLSearchParams();
    if (projectId) params.append('projectId', projectId);
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());

    return this.request<ActivityEntry[]>(`GET`, `/api/activity?${params}`);
  }

  // ========================================================================
  // Health & Metrics (Mission Control equivalent)
  // ========================================================================

  /**
   * Health check (equivalent to Mission Control GET /healthz)
   */
  async healthCheck(): Promise<{ status: string; version: string; timestamp: string }> {
    return this.request('GET', '/health');
  }

  /**
   * Get metrics (equivalent to Mission Control GET /api/metrics)
   */
  async getMetrics(): Promise<{
    totalProjects: number;
    activeProjects: number;
    totalTasks: number;
    completedTasks: number;
    activeAgents: number;
    systemLoad: number;
  }> {
    return this.request('GET', '/api/metrics');
  }

  // ========================================================================
  // HTTP Request Helper
  // ========================================================================

  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const url = `${this.apiBaseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const error: ApiError = {
          code: response.status.toString(),
          message: errorData.error?.message || errorData.error || `HTTP ${response.status}`,
          details: errorData,
          timestamp: new Date().toISOString(),
        };
        throw new Error(JSON.stringify(error));
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('{')) {
        // It's already an ApiError
        throw error;
      }
      const apiError: ApiError = {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
        timestamp: new Date().toISOString(),
      };
      throw new Error(JSON.stringify(apiError));
    }
  }
}

// =============================================================================
// WebSocket Event Client
// =============================================================================

export class OpenClawWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private apiKey?: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private eventHandlers: Map<string, (data: any) => void> = new Map();

  constructor(config: { wsUrl?: string; apiKey?: string }) {
    this.url = config.wsUrl || 'ws://localhost:3456';
    this.apiKey = config.apiKey;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('OpenCLaw WebSocket connected');
          this.authenticate();
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket connection closed');
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Subscribe to events
   */
  on(event: string, handler: (data: any) => void): void {
    this.eventHandlers.set(event, handler);
  }

  /**
   * Unsubscribe from events
   */
  off(event: string): void {
    this.eventHandlers.delete(event);
  }

  /**
   * Authenticate with WebSocket server
   */
  private authenticate(): void {
    if (!this.ws || !this.apiKey) return;

    this.ws.send(JSON.stringify({
      type: 'authenticate',
      data: { apiKey: this.apiKey },
    }));
  }

  /**
   * Subscribe to specific events
   */
  subscribe(events: string[]): void {
    if (!this.ws) return;

    this.ws.send(JSON.stringify({
      type: 'subscribe',
      data: { events },
    }));
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(message: any): void {
    const { type, data } = message;
    const handler = this.eventHandlers.get(type);

    if (handler) {
      handler(data);
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * (2 ** this.reconnectAttempts), 30000);

    setTimeout(() => {
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connect();
    }, delay);
  }
}

// =============================================================================
// OpenCLaw Mission Control Integration Service
// =============================================================================

export class OpenClawIntegrationService {
  private adapter: OpenClawAdapter;
  private wsClient: OpenClawWebSocketClient | null = null;

  constructor(config: {
    apiBaseUrl?: string;
    wsUrl?: string;
    apiKey?: string;
  }) {
    this.adapter = new OpenClawAdapter(config);
    if (config.wsUrl) {
      this.wsClient = new OpenClawWebSocketClient(config);
    }
  }

  /**
   * Initialize connection to Auto-Harness
   */
  async initialize(): Promise<void> {
    // Check health
    await this.adapter.healthCheck();

    // Connect WebSocket if configured
    if (this.wsClient) {
      await this.wsClient.connect();
    }
  }

  /**
   * Full project automation workflow
   * Equivalent to OpenCLaw's agent orchestration
   */
  async automateProject(projectId: string): Promise<void> {
    console.log(`Starting full automation for project: ${projectId}`);

    // 1. Analyze project and generate roadmap
    console.log('1. Generating roadmap...');
    const roadmap = await this.adapter.generateRoadmap(projectId, {
      competitorAnalysis: true,
    });

    // 2. Generate ideation
    console.log('2. Generating ideation...');
    const ideation = await this.adapter.generateIdeation(projectId, {
      type: 'all',
      count: 10,
    });

    // 3. Create tasks from roadmap features
    console.log('3. Creating tasks from roadmap...');
    const features = roadmap.features || [];
    const createdTasks = [];

    for (const feature of features) {
      try {
        const task = await this.adapter.createTask({
          projectId,
          title: feature.title,
          description: feature.description,
          priority: this.mapPriority(feature.priority),
          autoStart: false, // Don't auto-start, let operator decide
        });
        createdTasks.push(task);
      } catch (error) {
        console.error(`Failed to create task for feature ${feature.id}:`, error);
      }
    }

    // 4. Create tasks from ideation
    console.log('4. Creating tasks from ideation...');
    const ideas = ideation.ideas || [];

    for (const idea of ideas.slice(0, 5)) { // Top 5 ideas
      try {
        const task = await this.adapter.convertIdeaToTask(projectId, idea.id, {
          autoStart: false,
        });
        createdTasks.push(task);
      } catch (error) {
        console.error(`Failed to convert idea ${idea.id} to task:`, error);
      }
    }

    // 5. Optimize task order
    console.log('5. Optimizing task order...');
    await this.adapter.reorderTasks({
      projectId,
      taskIds: createdTasks.map(t => t.id),
    });

    console.log(`Automation complete! Created ${createdTasks.length} tasks`);
  }

  /**
   * Monitor project progress with real-time updates
   */
  async monitorProject(projectId: string): Promise<void> {
    if (!this.wsClient) {
      throw new Error('WebSocket client not configured');
    }

    return new Promise((resolve, reject) => {
      if (!this.wsClient) {
        reject(new Error('WebSocket client not configured'));
        return;
      }

      // Subscribe to task events
      this.wsClient.subscribe(['task.created', 'task.started', 'task.completed', 'task.failed']);

      // Handle task completion
      this.wsClient.on('task.completed', async (data: any) => {
        if (data.projectId === projectId) {
          console.log(`Task completed: ${data.title}`);

          // Check if all tasks are completed
          const progress = await this.adapter.getDevelopmentProgress(projectId);
          if (progress.overallProgress === 100) {
            console.log('All tasks completed!');
            resolve();
          }
        }
      });

      // Handle task failures
      this.wsClient.on('task.failed', (data: any) => {
        if (data.projectId === projectId) {
          console.error(`Task failed: ${data.title}`, data.error);
        }
      });

      // Start monitoring
      this.wsClient.on('task.progress', (data: any) => {
        if (data.projectId === projectId) {
          console.log(`Task progress: ${data.title} - ${data.progress}%`);
        }
      });
    });
  }

  /**
   * Get project dashboard (OpenCLaw board view)
   */
  async getProjectDashboard(projectId: string): Promise<{
    project: ProjectDetails;
    tasks: TaskSummary[];
    roadmap: any;
    ideation: any;
    progress: DevelopmentProgress;
  }> {
    const [project, tasks, roadmap, ideation, progress] = await Promise.all([
      this.adapter.getProject(projectId),
      this.adapter.listTasks(projectId),
      this.adapter.getRoadmap(projectId).catch(() => null),
      this.adapter.getIdeation(projectId).catch(() => null),
      this.adapter.getDevelopmentProgress(projectId),
    ]);

    return {
      project,
      tasks,
      roadmap,
      ideation,
      progress,
    };
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    if (this.wsClient) {
      this.wsClient.disconnect();
    }
  }

  /**
   * Map OpenCLaw priority to Auto-Harness priority
   */
  private mapPriority(priority: string): 'low' | 'medium' | 'high' | 'critical' {
    const priorityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
      'lowest': 'low',
      'low': 'low',
      'medium': 'medium',
      'high': 'high',
      'highest': 'critical',
      'critical': 'critical',
    };
    return priorityMap[priority] || 'medium';
  }
}

// =============================================================================
// Export factory functions
// =============================================================================

/**
 * Create OpenCLaw adapter instance
 */
export function createOpenClawAdapter(config: {
  apiBaseUrl?: string;
  apiKey?: string;
}): OpenClawAdapter {
  return new OpenClawAdapter(config);
}

/**
 * Create OpenCLaw integration service
 */
export function createOpenClawIntegration(config: {
  apiBaseUrl?: string;
  wsUrl?: string;
  apiKey?: string;
}): OpenClawIntegrationService {
  return new OpenClawIntegrationService(config);
}
