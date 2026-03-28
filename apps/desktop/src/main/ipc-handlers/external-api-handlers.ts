/**
 * External API IPC Handlers
 *
 * Bridges the external HTTP API with existing Auto-Harness functionality
 * via IPC channels. Provides a unified interface for external tools.
 */

import { ipcMain } from 'electron';
import { getProjects } from '../project-store';
import { getTasks } from '../task-state-manager';
import type { Project } from '../../shared/types/project';
import type { Task } from '../../shared/types/task';
import type { Roadmap } from '../../shared/types/roadmap';
import type { IdeationSession } from '../../shared/types/insights';
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
} from '../../shared/types/external-api';
import { IPC_CHANNELS } from '../../shared/constants/ipc';

/**
 * Convert Project to ProjectSummary
 */
function toProjectSummary(project: Project): ProjectSummary {
  const tasks = getTasks(project.id);
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  return {
    id: project.id,
    name: project.name,
    path: project.path,
    description: project.description,
    createdAt: project.createdAt,
    lastModified: project.lastModified,
    isActive: project.id === getProjects().find(p => p.id === project.id)?.id,
    taskCount: tasks.length,
    completedTaskCount: completedTasks,
    status: project.status || 'active',
  };
}

/**
 * Convert Task to TaskSummary
 */
function toTaskSummary(task: Task): TaskSummary {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority || 'medium',
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    phase: task.phase,
    progress: calculateTaskProgress(task),
  };
}

/**
 * Calculate task progress percentage
 */
function calculateTaskProgress(task: Task): number {
  if (task.status === 'completed') return 100;
  if (task.status === 'pending') return 0;
  if (task.status === 'in_progress') {
    // Calculate based on plan progress
    if (task.plan) {
      const totalSubtasks = task.plan.subtasks.length;
      const completedSubtasks = task.plan.subtasks.filter(s => s.status === 'completed').length;
      return totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;
    }
    return 50; // In progress but no plan
  }
  return 0;
}

/**
 * Setup external API IPC handlers
 */
export function setupExternalApiHandlers(): void {
  // ========================================================================
  // Project Management
  // ========================================================================

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_PROJECT_LIST, async () => {
    const projects = getProjects();
    return projects.map(toProjectSummary);
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_PROJECT_GET, async (_event, projectId: string) => {
    const projects = getProjects();
    const project = projects.find(p => p.id === projectId);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const tasks = getTasks(project.id);
    const taskSummaries = tasks.map(toTaskSummary);

    const details: ProjectDetails = {
      ...toProjectSummary(project),
      settings: project.settings,
      tasks: taskSummaries,
      recentActivity: [], // TODO: Implement activity tracking
    };

    return details;
  });

  // ========================================================================
  // Task Management
  // ========================================================================

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_TASK_LIST, async (_event, projectId: string) => {
    const tasks = getTasks(projectId);
    return tasks.map(toTaskSummary);
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_TASK_CREATE, async (_event, request: CreateTaskRequest) => {
    // TODO: Implement task creation via task-state-manager
    throw new Error('Task creation not implemented');
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_TASK_UPDATE, async (_event, request: UpdateTaskRequest) => {
    // TODO: Implement task update via task-state-manager
    throw new Error('Task update not implemented');
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_TASK_REORDER, async (_event, request: ReorderTasksRequest) => {
    // TODO: Implement task reordering
    // This would need to update task priorities/order
    throw new Error('Task reordering not implemented');
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_TASK_BATCH, async (_event, projectId: string, operations: any[]) => {
    // TODO: Implement batch task operations
    throw new Error('Batch operations not implemented');
  });

  // ========================================================================
  // Roadmap Management
  // ========================================================================

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_ROADMAP_GET, async (_event, projectId: string) => {
    // TODO: Implement via roadmap handlers
    throw new Error('Roadmap retrieval not implemented');
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_ROADMAP_GENERATE, async (_event, request: GenerateRoadmapRequest) => {
    // TODO: Implement via roadmap handlers
    throw new Error('Roadmap generation not implemented');
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_ROADMAP_UPDATE, async (_event, projectId: string, featureId: string, updates: any) => {
    // TODO: Implement via roadmap handlers
    throw new Error('Roadmap update not implemented');
  });

  // ========================================================================
  // Ideation Management
  // ========================================================================

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_IDEATION_GET, async (_event, projectId: string) => {
    // TODO: Implement via ideation handlers
    throw new Error('Ideation retrieval not implemented');
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_IDEATION_GENERATE, async (_event, request: GenerateIdeationRequest) => {
    // TODO: Implement via ideation handlers
    throw new Error('Ideation generation not implemented');
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_IDEATION_CONVERT, async (_event, projectId: string, ideaId: string, options: any) => {
    // TODO: Implement idea to task conversion
    throw new Error('Idea conversion not implemented');
  });

  // ========================================================================
  // Progress Monitoring
  // ========================================================================

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_PROGRESS_GET, async (_event, projectId: string) => {
    const projects = getProjects();
    const project = projects.find(p => p.id === projectId);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const tasks = getTasks(projectId);
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const blockedTasks = tasks.filter(t => t.status === 'blocked' || t.status === 'failed').length;

    // Calculate phase breakdown
    const phaseMap = new Map<string, { total: number; completed: number }>();
    tasks.forEach(task => {
      const phase = task.phase || 'unknown';
      if (!phaseMap.has(phase)) {
        phaseMap.set(phase, { total: 0, completed: 0 });
      }
      const phaseData = phaseMap.get(phase)!;
      phaseData.total++;
      if (task.status === 'completed') {
        phaseData.completed++;
      }
    });

    const phaseBreakdown = Array.from(phaseMap.entries()).map(([phase, data]) => ({
      phase,
      total: data.total,
      completed: data.completed,
      progress: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    }));

    const progress: DevelopmentProgress = {
      projectId,
      projectName: project.name,
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      blockedTasks,
      overallProgress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      phaseBreakdown,
      recentActivity: [], // TODO: Implement activity tracking
    };

    return progress;
  });

  // ========================================================================
  // Webhook Management
  // ========================================================================

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_WEBHOOK_REGISTER, async (_event, config: any) => {
    // TODO: Implement webhook registration
    throw new Error('Webhook registration not implemented');
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_WEBHOOK_UNREGISTER, async (_event, webhookId: string) => {
    // TODO: Implement webhook unregistration
    throw new Error('Webhook unregistration not implemented');
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_WEBHOOK_LIST, async () => {
    // TODO: Implement webhook listing
    return [];
  });
}
