/**
 * External HTTP API Server
 *
 * Provides a RESTful HTTP and WebSocket API for external tools
 * like OpenCLaw to control Auto-Harness programmatically.
 *
 * Features:
 * - RESTful API for CRUD operations
 * - WebSocket for real-time updates
 * - API key authentication
 * - Rate limiting
 * - CORS support
 * - Webhook support
 */

import http from 'http';
import { WebSocketServer } from 'ws';
import type { AddressInfo } from 'net';
import { URL } from 'url';

import type {
  ProjectSummary,
  ProjectDetails,
  TaskSummary,
  CreateTaskRequest,
  UpdateTaskRequest,
  ReorderTasksRequest,
  GenerateRoadmapRequest,
  GenerateIdeationRequest,
  DevelopmentProgress,
  ApiError,
  PaginatedResponse,
  WebhookConfig,
} from '../../../shared/types/external-api';
import type { ExternalApiConfig } from '../../../shared/types/external-api';

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_PORT = 3456;
const DEFAULT_RATE_LIMIT = 100; // requests per minute

// =============================================================================
// HTTP API Server
// =============================================================================

export class ExternalApiServer {
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private port: number;
  private config: ExternalApiConfig;
  private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();
  private webhookConfigs: Map<string, WebhookConfig> = new Map();

  constructor(config: ExternalApiConfig, port: number = DEFAULT_PORT) {
    this.config = config;
    this.port = port;
  }

  /**
   * Start the HTTP and WebSocket server
   */
  async start(): Promise<void> {
    if (this.server) {
      throw new Error('External API server is already running');
    }

    this.server = http.createServer((req, res) => this.handleRequest(req, res));

    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws, req) => {
      this.handleWebSocketConnection(ws, req);
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(this.port, () => {
        console.log(`External API server listening on port ${this.port}`);
        resolve();
      });

      this.server!.on('error', (error: Error) => {
        console.error('External API server error:', error);
        reject(error);
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.wss?.close();
      this.server!.close(() => {
        this.server = null;
        this.wss = null;
        resolve();
      });
    });
  }

  /**
   * Get server port
   */
  getPort(): number {
    if (!this.server) {
      return 0;
    }
    const address = this.server.address() as AddressInfo;
    return address.port;
  }

  // =============================================================================
  // HTTP Request Handler
  // =============================================================================

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      // CORS handling
      this.setCorsHeaders(req, res);

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Rate limiting
      if (!this.checkRateLimit(req, res)) {
        return;
      }

      // Authentication
      if (!this.authenticateRequest(req, res)) {
        return;
      }

      // Parse URL and method
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const path = url.pathname;
      const method = req.method?.toUpperCase() || 'GET';

      // Route handling
      await this.routeRequest(method, path, url, req, res);
    } catch (error) {
      this.sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error', error);
    }
  }

  /**
   * Set CORS headers
   */
  private setCorsHeaders(req: http.IncomingMessage, res: http.ServerResponse): void {
    const origin = req.headers.origin;

    if (this.config.allowedOrigins && origin) {
      if (this.config.allowedOrigins.includes('*') || this.config.allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    } else if (this.config.allowedOrigins?.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    const clientId = this.getClientId(req);
    const now = Date.now();
    const rateLimit = this.config.rateLimit || DEFAULT_RATE_LIMIT;

    let clientData = this.rateLimitMap.get(clientId);

    if (!clientData || now > clientData.resetTime) {
      clientData = { count: 0, resetTime: now + 60000 }; // 1 minute window
      this.rateLimitMap.set(clientId, clientData);
    }

    clientData.count++;

    if (clientData.count > rateLimit) {
      this.sendError(res, 429, 'RATE_LIMIT_EXCEEDED', 'Rate limit exceeded');
      return false;
    }

    return true;
  }

  /**
   * Authenticate request
   */
  private authenticateRequest(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    if (this.config.authMethod === 'none') {
      return true;
    }

    if (this.config.authMethod === 'api-key') {
      const apiKey = req.headers['x-api-key'] as string;

      if (!apiKey) {
        this.sendError(res, 401, 'UNAUTHORIZED', 'API key required');
        return false;
      }

      if (apiKey !== this.config.apiKey) {
        this.sendError(res, 403, 'FORBIDDEN', 'Invalid API key');
        return false;
      }

      return true;
    }

    // Add other auth methods as needed
    return true;
  }

  /**
   * Get client identifier for rate limiting
   */
  private getClientId(req: http.IncomingMessage): string {
    return req.socket.remoteAddress || 'unknown';
  }

  /**
   * Route request to appropriate handler
   */
  private async routeRequest(
    method: string,
    path: string,
    url: URL,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const routes: Record<string, (req: http.IncomingMessage, res: http.ServerResponse, url: URL) => Promise<void>> = {
      // Health check
      'GET /health': async (req, res) => {
        this.sendJson(res, 200, { status: 'ok', version: '1.0.0' });
      },

      // Project Management
      'GET /api/projects': async (req, res) => {
        const projects = await this.getProjects();
        this.sendJson(res, 200, projects);
      },

      'GET /api/projects/:id': async (req, res, url) => {
        const id = this.getPathParam(url, 'api/projects', 'id');
        const project = await this.getProject(id);
        this.sendJson(res, 200, project);
      },

      'POST /api/projects': async (req, res) => {
        // Only if allowWrite is enabled
        if (!this.config.allowWrite) {
          this.sendError(res, 403, 'FORBIDDEN', 'Write operations are disabled');
          return;
        }
        // Implementation here
      },

      // Task Management
      'GET /api/projects/:projectId/tasks': async (req, res, url) => {
        const projectId = this.getPathParam(url, 'api/projects', 'projectId', 'tasks');
        const tasks = await this.getProjectTasks(projectId);
        this.sendJson(res, 200, tasks);
      },

      'POST /api/projects/:projectId/tasks': async (req, res) => {
        if (!this.config.allowWrite) {
          this.sendError(res, 403, 'FORBIDDEN', 'Write operations are disabled');
          return;
        }
        const projectId = this.getPathParam(url, 'api/projects', 'projectId', 'tasks');
        const body = await this.parseJsonBody<CreateTaskRequest>(req);
        const task = await this.createTask(projectId, body);
        this.sendJson(res, 201, task);
      },

      'PATCH /api/projects/:projectId/tasks/:taskId': async (req, res) => {
        if (!this.config.allowWrite) {
          this.sendError(res, 403, 'FORBIDDEN', 'Write operations are disabled');
          return;
        }
        // Implementation here
      },

      'POST /api/tasks/reorder': async (req, res) => {
        if (!this.config.allowWrite) {
          this.sendError(res, 403, 'FORBIDDEN', 'Write operations are disabled');
          return;
        }
        const body = await this.parseJsonBody<ReorderTasksRequest>(req);
        await this.reorderTasks(body);
        this.sendJson(res, 200, { success: true });
      },

      // Roadmap
      'GET /api/projects/:projectId/roadmap': async (req, res, url) => {
        const projectId = this.getPathParam(url, 'api/projects', 'projectId', 'roadmap');
        const roadmap = await this.getRoadmap(projectId);
        this.sendJson(res, 200, roadmap);
      },

      'POST /api/projects/:projectId/roadmap/generate': async (req, res) => {
        if (!this.config.allowWrite) {
          this.sendError(res, 403, 'FORBIDDEN', 'Write operations are disabled');
          return;
        }
        const projectId = this.getPathParam(url, 'api/projects', 'projectId', 'roadmap', 'generate');
        const body = await this.parseJsonBody<GenerateRoadmapRequest>(req);
        const roadmap = await this.generateRoadmap(projectId, body);
        this.sendJson(res, 201, roadmap);
      },

      // Ideation
      'GET /api/projects/:projectId/ideation': async (req, res, url) => {
        const projectId = this.getPathParam(url, 'api/projects', 'projectId', 'ideation');
        const ideation = await this.getIdeation(projectId);
        this.sendJson(res, 200, ideation);
      },

      'POST /api/projects/:projectId/ideation/generate': async (req, res) => {
        if (!this.config.allowWrite) {
          this.sendError(res, 403, 'FORBIDDEN', 'Write operations are disabled');
          return;
        }
        const projectId = this.getPathParam(url, 'api/projects', 'projectId', 'ideation', 'generate');
        const body = await this.parseJsonBody<GenerateIdeationRequest>(req);
        const ideation = await this.generateIdeation(projectId, body);
        this.sendJson(res, 201, ideation);
      },

      // Progress Monitoring
      'GET /api/projects/:projectId/progress': async (req, res, url) => {
        const projectId = this.getPathParam(url, 'api/projects', 'projectId', 'progress');
        const progress = await this.getDevelopmentProgress(projectId);
        this.sendJson(res, 200, progress);
      },
    };

    const routeKey = `${method} ${path}`;
    const handler = routes[routeKey];

    if (handler) {
      await handler(req, res, url);
    } else {
      this.sendError(res, 404, 'NOT_FOUND', 'Route not found');
    }
  }

  // =============================================================================
  // WebSocket Handler
  // =============================================================================

  private handleWebSocketConnection(ws: any, req: http.IncomingMessage): void {
    // Authentication for WebSocket
    if (!this.authenticateWebSocket(ws, req)) {
      ws.close(1008, 'Unauthorized');
      return;
    }

    console.log('WebSocket client connected');

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleWebSocketMessage(ws, message);
      } catch (error) {
        this.sendWebSocketError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    // Send welcome message
    this.sendWebSocketMessage(ws, {
      type: 'connected',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Authenticate WebSocket connection
   */
  private authenticateWebSocket(ws: any, req: http.IncomingMessage): boolean {
    // Check auth in URL query params or headers
    // Implementation here
    return true;
  }

  /**
   * Handle WebSocket message
   */
  private async handleWebSocketMessage(ws: any, message: any): Promise<void> {
    const { type, data } = message;

    switch (type) {
      case 'subscribe':
        // Subscribe to events
        break;

      case 'unsubscribe':
        // Unsubscribe from events
        break;

      case 'ping':
        this.sendWebSocketMessage(ws, { type: 'pong' });
        break;

      default:
        this.sendWebSocketError(ws, `Unknown message type: ${type}`);
    }
  }

  // =============================================================================
  // Data Access Methods (to be implemented)
  // =============================================================================

  private async getProjects(): Promise<ProjectSummary[]> {
    // TODO: Implement via IPC calls to project store
    return [];
  }

  private async getProject(id: string): Promise<ProjectDetails> {
    // TODO: Implement via IPC calls
    throw new Error('Not implemented');
  }

  private async getProjectTasks(projectId: string): Promise<TaskSummary[]> {
    // TODO: Implement via IPC calls
    return [];
  }

  private async createTask(projectId: string, request: CreateTaskRequest): Promise<TaskSummary> {
    // TODO: Implement via IPC calls
    throw new Error('Not implemented');
  }

  private async reorderTasks(request: ReorderTasksRequest): Promise<void> {
    // TODO: Implement via IPC calls
    throw new Error('Not implemented');
  }

  private async getRoadmap(projectId: string): Promise<any> {
    // TODO: Implement via IPC calls
    throw new Error('Not implemented');
  }

  private async generateRoadmap(projectId: string, request: GenerateRoadmapRequest): Promise<any> {
    // TODO: Implement via IPC calls
    throw new Error('Not implemented');
  }

  private async getIdeation(projectId: string): Promise<any> {
    // TODO: Implement via IPC calls
    throw new Error('Not implemented');
  }

  private async generateIdeation(projectId: string, request: GenerateIdeationRequest): Promise<any> {
    // TODO: Implement via IPC calls
    throw new Error('Not implemented');
  }

  private async getDevelopmentProgress(projectId: string): Promise<DevelopmentProgress> {
    // TODO: Implement via IPC calls
    throw new Error('Not implemented');
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  private sendJson(res: http.ServerResponse, statusCode: number, data: any): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  private sendError(res: http.ServerResponse, statusCode: number, code: string, message: string, details?: any): void {
    const error: ApiError = {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    };
    this.sendJson(res, statusCode, { error });
  }

  private async parseJsonBody<T>(req: http.IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error('Invalid JSON body'));
        }
      });
    });
  }

  private getPathParam(url: URL, ...parts: string[]): string {
    const pathParts = url.pathname.split('/').filter(Boolean);
    const searchParts = parts.join('/').split('/').filter(Boolean);

    let pathIndex = 0;
    for (let i = 0; i < searchParts.length; i++) {
      if (pathParts[pathIndex] === searchParts[i]) {
        pathIndex++;
      }
    }

    return pathParts[pathIndex] || '';
  }

  private sendWebSocketMessage(ws: any, message: any): void {
    if (ws.readyState === 1) { // OPEN
      ws.send(JSON.stringify(message));
    }
  }

  private sendWebSocketError(ws: any, error: string): void {
    this.sendWebSocketMessage(ws, {
      type: 'error',
      error,
      timestamp: new Date().toISOString(),
    });
  }
}
