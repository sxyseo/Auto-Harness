/**
 * External API Interface for OpenCLaw Integration
 *
 * Provides a unified API for external tools (like OpenCLaw) to:
 * - Read and manage projects
 * - Control task lifecycle
 * - Generate and manage Roadmaps
 * - Generate and manage Ideation
 * - Monitor development progress
 * - Reorder tasks
 *
 * This API can be exposed via:
 * 1. HTTP/WebSocket server for web-based tools
 * 2. CLI commands for terminal-based tools
 * 3. IPC for integrated tools
 */

import type { Project, ProjectSettings } from './project';
import type { Task, TaskStatus, TaskMetadata, ImplementationPlan } from './task';
import type { Roadmap, RoadmapFeatureStatus } from './roadmap';
import type { IdeationSession, IdeationConfig, Idea } from './insights';
import type { IPCResult } from './common';

// =============================================================================
// Authentication & Security
// =============================================================================

/**
 * API authentication methods
 */
export type ApiAuthMethod = 'none' | 'api-key' | 'oauth' | 'token';

/**
 * API authentication configuration
 */
export interface ExternalApiConfig {
  /** Authentication method */
  authMethod: ApiAuthMethod;
  /** API key for authentication (if using api-key method) */
  apiKey?: string;
  /** Allowed origins for web API (CORS) */
  allowedOrigins?: string[];
  /** Rate limiting (requests per minute) */
  rateLimit?: number;
  /** Enable write operations (false = read-only) */
  allowWrite: boolean;
  /** Enable dangerous operations (task deletion, project removal, etc.) */
  allowDangerousOps: boolean;
}

// =============================================================================
// Project Management API
// =============================================================================

/**
 * Project list with summary information
 */
export interface ProjectSummary {
  id: string;
  name: string;
  path: string;
  description?: string;
  createdAt: string;
  lastModified?: string;
  isActive: boolean;
  taskCount: number;
  completedTaskCount: number;
  status: 'active' | 'archived' | 'not-initialized';
}

/**
 * Project details with full information
 */
export interface ProjectDetails extends ProjectSummary {
  settings: ProjectSettings;
  tasks: TaskSummary[];
  recentActivity: ActivityEntry[];
}

/**
 * Simplified task information for lists
 */
export interface TaskSummary {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  updatedAt: string;
  phase?: string;
  progress?: number;
}

/**
 * Activity log entry
 */
export interface ActivityEntry {
  timestamp: string;
  type: 'task_created' | 'task_completed' | 'task_started' | 'roadmap_generated' | 'ideation_created';
  description: string;
}

// =============================================================================
// Task Management API
// =============================================================================

/**
 * Task creation request
 */
export interface CreateTaskRequest {
  projectId: string;
  title: string;
  description: string;
  metadata?: TaskMetadata;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  autoStart?: boolean;
}

/**
 * Task update request
 */
export interface UpdateTaskRequest {
  taskId: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  phase?: string;
}

/**
 * Task reordering request
 */
export interface ReorderTasksRequest {
  projectId: string;
  taskIds: string[]; // New order of task IDs
  phase?: string; // Optional: restrict reordering to specific phase
}

/**
 * Task batch operations
 */
export interface TaskBatchRequest {
  projectId: string;
  operations: Array<{
    type: 'update_status' | 'update_priority' | 'delete' | 'archive';
    taskId: string;
    value?: any;
  }>;
}

// =============================================================================
// Roadmap API
// =============================================================================

/**
 * Roadmap generation request
 */
export interface GenerateRoadmapRequest {
  projectId: string;
  prompt?: string;
  competitorAnalysis?: boolean;
  focusAreas?: string[];
  timeframe?: 'short-term' | 'medium-term' | 'long-term';
}

/**
 * Roadmap update request
 */
export interface UpdateRoadmapRequest {
  projectId: string;
  featureId: string;
  updates: {
    title?: string;
    description?: string;
    status?: RoadmapFeatureStatus;
    priority?: 'low' | 'medium' | 'high';
    targetDate?: string;
  };
}

// =============================================================================
// Ideation API
// =============================================================================

/**
 * Ideation generation request
 */
export interface GenerateIdeationRequest {
  projectId: string;
  type: 'improvements' | 'performance' | 'security' | 'features' | 'all';
  scope?: 'full-project' | 'specific-files';
  files?: string[]; // Specific files to analyze (if scope is 'specific-files')
  count?: number; // Number of ideas to generate
}

/**
 * Ideation conversion request
 */
export interface ConvertIdeaToTaskRequest {
  projectId: string;
  ideaId: string;
  taskTitle?: string;
  taskDescription?: string;
  autoStart?: boolean;
}

// =============================================================================
// Monitoring & Progress API
// =============================================================================

/**
 * Development progress overview
 */
export interface DevelopmentProgress {
  projectId: string;
  projectName: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  blockedTasks: number;
  overallProgress: number; // 0-100
  phaseBreakdown: PhaseProgress[];
  recentActivity: ActivityEntry[];
  estimatedCompletion?: string;
}

/**
 * Progress by phase
 */
export interface PhaseProgress {
  phase: string;
  total: number;
  completed: number;
  progress: number; // 0-100
}

/**
 * Real-time task status
 */
export interface TaskStatusUpdate {
  taskId: string;
  status: TaskStatus;
  phase?: string;
  progress: number;
  currentStep?: string;
  logs?: string[];
  error?: string;
  timestamp: string;
}

// =============================================================================
// Webhook & Events API
// =============================================================================

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  url: string;
  events: string[]; // Events to subscribe to
  secret?: string; // HMAC signature for verification
  active: boolean;
}

/**
 * Event types for webhooks
 */
export type ApiEventType =
  | 'task.created'
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'roadmap.generated'
  | 'ideation.created'
  | 'project.added'
  | 'project.removed';

/**
 * Webhook payload
 */
export interface WebhookPayload {
  event: ApiEventType;
  timestamp: string;
  projectId?: string;
  data: any;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Paginated list response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * API error response
 */
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

/**
 * Bulk operation result
 */
export interface BulkOperationResult {
  succeeded: number;
  failed: number;
  results: Array<{
    id: string;
    success: boolean;
    error?: string;
  }>;
}
