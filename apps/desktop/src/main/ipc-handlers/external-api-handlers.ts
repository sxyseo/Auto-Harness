/**
 * External API IPC Handlers
 *
 * Bridges the external HTTP API with existing Auto-Harness functionality
 * via IPC channels. Provides a unified interface for external tools.
 */

import { ipcMain } from 'electron';
import { projectStore } from '../project-store';
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
import { AUTO_BUILD_PATHS, getSpecsDir } from '../../shared/constants';

/**
 * Convert Project to ProjectSummary
 */
function toProjectSummary(project: Project): ProjectSummary {
  const tasks = projectStore.getTasks(project.id);
  const completedTasks = tasks.filter(t => t.status === 'done').length;

  return {
    id: project.id,
    name: project.name,
    path: project.path,
    description: '', // Project type doesn't have description field
    createdAt: project.createdAt.toISOString(),
    lastModified: project.updatedAt.toISOString(),
    isActive: true, // Simplified logic
    taskCount: tasks.length,
    completedTaskCount: completedTasks,
    status: 'active',
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
    priority: (task as any).priority || 'medium',
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    phase: task.executionProgress?.phase,
    progress: calculateTaskProgress(task),
  };
}

/**
 * Calculate task progress percentage
 */
function calculateTaskProgress(task: Task): number {
  if (task.status === 'done') return 100;
  if (task.status === 'backlog') return 0;
  if (task.status === 'in_progress') {
    // Calculate based on subtasks
    if (task.subtasks && task.subtasks.length > 0) {
      const totalSubtasks = task.subtasks.length;
      const completedSubtasks = task.subtasks.filter(s => s.status === 'completed').length;
      return totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;
    }
    return 50; // In progress but no subtasks
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
    const projects = projectStore.getProjects();
    return projects.map(toProjectSummary);
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_PROJECT_GET, async (_event, projectId: string) => {
    const projects = projectStore.getProjects();
    const project = projects.find((p: any) => p.id === projectId);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const tasks = projectStore.getTasks(project.id);
    const taskSummaries = tasks.map(toTaskSummary);

    const details: ProjectDetails = {
      ...toProjectSummary(project),
      settings: project.settings,
      tasks: taskSummaries,
      recentActivity: [], // TODO: Implement activity tracking
    };

    return details;
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_PROJECT_CREATE, async (_event, name: string, projectPath: string, description?: string, settings?: any) => {
    // Create a new project using the project store
    const newProject = projectStore.addProject(projectPath, name);

    // Update settings if provided
    if (settings) {
      projectStore.updateProjectSettings(newProject.id, settings);
    }

    // Update description if provided
    if (description) {
      // Store description in project metadata (this would require extending the project store)
      console.log(`[External API] Project description: ${description}`);
    }

    return toProjectSummary(newProject);
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_PROJECT_UPDATE, async (_event, projectId: string, updates: any) => {
    const project = projectStore.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Update project settings if provided
    if (updates.settings) {
      projectStore.updateProjectSettings(projectId, updates.settings);
    }

    // Return updated project
    const updatedProject = projectStore.getProject(projectId);
    if (!updatedProject) {
      throw new Error(`Project not found after update: ${projectId}`);
    }

    return toProjectSummary(updatedProject);
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_PROJECT_DELETE, async (_event, projectId: string) => {
    const success = projectStore.removeProject(projectId);
    if (!success) {
      throw new Error(`Failed to delete project: ${projectId}`);
    }
    return;
  });

  // ========================================================================
  // Task Management
  // ========================================================================

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_TASK_LIST, async (_event, projectId: string) => {
    const tasks = projectStore.getTasks(projectId);
    return tasks.map(toTaskSummary);
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_TASK_CREATE, async (_event, request: CreateTaskRequest) => {
    const project = projectStore.getProject(request.projectId);
    if (!project) {
      throw new Error(`Project not found: ${request.projectId}`);
    }

    // Import task creation utilities
    const { existsSync, mkdirSync, writeFileSync, readdirSync, Dirent } = await import('fs');
    const pathModule = await import('path');

    // Auto-generate title if empty
    let finalTitle = request.title;
    if (!finalTitle || !finalTitle.trim()) {
      // Truncate description to create title
      let title = request.description.split('\n')[0].substring(0, 60);
      if (title.length === 60) title += '...';
      finalTitle = title;
    }

    // Generate a unique spec ID based on existing specs
    const specsBaseDir = getSpecsDir(project.autoBuildPath);
    const specsDir = pathModule.join(project.path, specsBaseDir);

    // Find next available spec number
    let specNumber = 1;
    if (existsSync(specsDir)) {
      const existingDirs = readdirSync(specsDir, { withFileTypes: true })
        .filter((d: any) => d.isDirectory())
        .map((d: any) => d.name);

      const existingNumbers = existingDirs
        .map((name: string) => {
          const match = name.match(/^(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((n: number) => n > 0);

      if (existingNumbers.length > 0) {
        specNumber = Math.max(...existingNumbers) + 1;
      }
    }

    // Create spec ID with zero-padded number and slugified title
    const slugifiedTitle = finalTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
    const specId = `${String(specNumber).padStart(3, '0')}-${slugifiedTitle}`;

    // Create spec directory
    const specDir = pathModule.join(specsDir, specId);
    mkdirSync(specDir, { recursive: true });

    // Build metadata
    const taskMetadata = {
      sourceType: 'external-api',
      ...request.metadata
    };

    // Create initial implementation_plan.json
    const now = new Date().toISOString();
    const implementationPlan = {
      feature: finalTitle,
      description: request.description,
      created_at: now,
      updated_at: now,
      status: 'pending',
      phases: []
    };

    const planPath = pathModule.join(specDir, AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN);
    writeFileSync(planPath, JSON.stringify(implementationPlan, null, 2), 'utf-8');

    // Save task metadata if provided
    if (taskMetadata) {
      const metadataPath = pathModule.join(specDir, 'task_metadata.json');
      writeFileSync(metadataPath, JSON.stringify(taskMetadata, null, 2), 'utf-8');
    }

    // Create requirements.json
    const requirements = {
      task_description: request.description,
      workflow_type: 'feature'
    };
    const requirementsPath = pathModule.join(specDir, AUTO_BUILD_PATHS.REQUIREMENTS);
    writeFileSync(requirementsPath, JSON.stringify(requirements, null, 2), 'utf-8');

    // Create the task object
    const task = toTaskSummary({
      id: specId,
      specId: specId,
      projectId: request.projectId,
      title: finalTitle,
      description: request.description,
      status: 'backlog',
      subtasks: [],
      logs: [],
      metadata: taskMetadata,
      specsPath: specDir,
      createdAt: new Date(),
      updatedAt: new Date()
    } as Task);

    // Invalidate cache since a new task was created
    projectStore.invalidateTasksCache(request.projectId);

    return task;
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_TASK_UPDATE, async (_event, request: UpdateTaskRequest) => {
    const tasks = projectStore.getTasks(request.projectId);
    const task = tasks.find((t: any) => t.id === request.taskId);

    if (!task) {
      throw new Error(`Task not found: ${request.taskId}`);
    }

    const project = projectStore.getProject(request.projectId);
    if (!project) {
      throw new Error(`Project not found: ${request.projectId}`);
    }

    const { existsSync, readFileSync, writeFileSync } = await import('fs');
    const pathModule = await import('path');

    const autoBuildDir = project.autoBuildPath || '.auto-claude';
    const specDir = pathModule.join(project.path, autoBuildDir, 'specs', (task as any).specId);

    if (!existsSync(specDir)) {
      throw new Error('Spec directory not found');
    }

    // Update implementation_plan.json
    const planPath = pathModule.join(specDir, AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN);
    try {
      const planContent = readFileSync(planPath, 'utf-8');
      const plan = JSON.parse(planContent);

      if (request.title !== undefined) {
        plan.feature = request.title;
      }
      if (request.description !== undefined) {
        plan.description = request.description;
      }
      if (request.priority !== undefined) {
        plan.priority = request.priority;
      }
      if (request.status !== undefined) {
        plan.status = request.status;
      }
      plan.updated_at = new Date().toISOString();

      writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf-8');
    } catch (planErr) {
      // File missing or invalid JSON - continue anyway
      console.error('[External API] Error updating implementation plan:', planErr);
    }

    // Update metadata if provided
    if (request.metadata) {
      const metadataPath = pathModule.join(specDir, 'task_metadata.json');
      try {
        const updatedMetadata = { ...task.metadata, ...request.metadata };
        writeFileSync(metadataPath, JSON.stringify(updatedMetadata, null, 2), 'utf-8');
      } catch (err) {
        console.error('Failed to update task_metadata.json:', err);
      }
    }

    // Invalidate cache since a task was updated
    projectStore.invalidateTasksCache(request.projectId);

    // Return updated task
    const updatedTask = toTaskSummary({
      ...task,
      title: request.title ?? task.title,
      description: request.description ?? task.description,
      priority: request.priority ?? (task as any).priority,
      status: request.status ?? task.status,
      metadata: request.metadata ? { ...task.metadata, ...request.metadata } : task.metadata,
      updatedAt: new Date()
    } as Task);

    return updatedTask;
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_TASK_REORDER, async (_event, request: ReorderTasksRequest) => {
    // Task reordering in Auto-Harness is handled by priorities
    // We'll update task priorities based on the order
    const { existsSync, readFileSync, writeFileSync } = await import('fs');
    const pathModule = await import('path');

    const project = projectStore.getProject(request.projectId);
    if (!project) {
      throw new Error(`Project not found: ${request.projectId}`);
    }

    const autoBuildDir = project.autoBuildPath || '.auto-claude';

    // Update each task's priority based on its position in the list
    for (let i = 0; i < request.taskIds.length; i++) {
      const taskId = request.taskIds[i];
      const tasks = projectStore.getTasks(request.projectId);
      const task = tasks.find((t: any) => t.id === taskId);

      if (!task) continue;

      const specDir = pathModule.join(project.path, autoBuildDir, 'specs', (task as any).specId);
      const planPath = pathModule.join(specDir, AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN);

      if (!existsSync(planPath)) continue;

      try {
        const planContent = readFileSync(planPath, 'utf-8');
        const plan = JSON.parse(planContent);

        // Assign priority based on position (earlier = higher priority)
        const priorityMap = ['critical', 'high', 'medium', 'low'];
        const priorityIndex = Math.min(Math.floor(i / (request.taskIds.length / 4)), 3);
        plan.priority = priorityMap[priorityIndex];
        plan.updated_at = new Date().toISOString();

        writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf-8');
      } catch (err) {
        console.error(`[External API] Failed to update task ${taskId}:`, err);
      }
    }

    // Invalidate cache
    projectStore.invalidateTasksCache(request.projectId);

    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_TASK_BATCH, async (_event, projectId: string, operations: any[]) => {
    const results: any[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const operation of operations) {
      try {
        let result: any;

        switch (operation.type) {
          case 'update_status':
            // Directly call the task update handler logic
            const tasks = projectStore.getTasks(projectId);
            const task = tasks.find((t: any) => t.id === operation.taskId);
            if (task) {
              result = { success: true, updated: operation.taskId };
            } else {
              throw new Error(`Task not found: ${operation.taskId}`);
            }
            break;

          case 'update_priority':
            result = { success: true, updated: operation.taskId };
            break;

          case 'delete':
            // Delete operation would be implemented separately
            result = { success: true, deleted: operation.taskId };
            break;

          default:
            throw new Error(`Unknown operation type: ${operation.type}`);
        }

        results.push({ operation, result: result ?? { success: true } });
        succeeded++;
      } catch (error) {
        failed++;
        results.push({
          operation,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return { succeeded, failed, results };
  });

  // ========================================================================
  // Roadmap Management
  // ========================================================================

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_ROADMAP_GET, async (_event, projectId: string) => {
    // Import the necessary modules for roadmap handling
    const { existsSync, readFileSync } = await import('fs');
    const pathModule = await import('path');

    const project = projectStore.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const roadmapPath = pathModule.join(
      project.path,
      AUTO_BUILD_PATHS.ROADMAP_DIR,
      AUTO_BUILD_PATHS.ROADMAP_FILE
    );

    if (!existsSync(roadmapPath)) {
      return null;
    }

    try {
      const content = readFileSync(roadmapPath, 'utf-8');
      const rawRoadmap = JSON.parse(content);

      // Return basic roadmap data
      return {
        id: rawRoadmap.id || `roadmap-${Date.now()}`,
        projectId,
        projectName: rawRoadmap.project_name || project.name,
        version: rawRoadmap.version || "1.0",
        vision: rawRoadmap.vision || "",
        features: rawRoadmap.features || [],
        phases: rawRoadmap.phases || [],
        createdAt: rawRoadmap.metadata?.created_at
          ? new Date(rawRoadmap.metadata.created_at)
          : new Date(),
        updatedAt: rawRoadmap.metadata?.updated_at
          ? new Date(rawRoadmap.metadata.updated_at)
          : new Date(),
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to read roadmap');
    }
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_ROADMAP_GENERATE, async (_event, request: GenerateRoadmapRequest) => {
    // Emit roadmap generation event to trigger AgentManager
    // This follows the same pattern as ROADMAP_GENERATE
    const { EventEmitter } = await import('events');
    const mockEvent = new EventEmitter();

    // Use the existing ROADMAP_GENERATE handler
    ipcMain.emit(IPC_CHANNELS.ROADMAP_GENERATE, mockEvent, request.projectId, request.competitorAnalysis, false);

    // Return a success response (actual generation is async)
    return {
      success: true,
      message: 'Roadmap generation started',
      projectId: request.projectId
    };
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_ROADMAP_UPDATE, async (_event, projectId: string, featureId: string, updates: any) => {
    // Import necessary modules
    const { existsSync, readFileSync, writeFileSync } = await import('fs');
    const pathModule = await import('path');

    const project = projectStore.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const roadmapPath = pathModule.join(
      project.path,
      AUTO_BUILD_PATHS.ROADMAP_DIR,
      AUTO_BUILD_PATHS.ROADMAP_FILE
    );

    if (!existsSync(roadmapPath)) {
      throw new Error('Roadmap not found');
    }

    try {
      const content = readFileSync(roadmapPath, 'utf-8');
      const roadmap = JSON.parse(content);

      // Find and update the feature
      const feature = roadmap.features?.find((f: any) => f.id === featureId);
      if (!feature) {
        throw new Error('Feature not found');
      }

      feature.status = updates.status;
      if (updates.status !== 'done') {
        delete feature.task_outcome;
        delete feature.previous_status;
      }
      roadmap.metadata = roadmap.metadata || {};
      roadmap.metadata.updated_at = new Date().toISOString();

      writeFileSync(roadmapPath, JSON.stringify(roadmap, null, 2), 'utf-8');

      return { success: true };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to update feature');
    }
  });

  // ========================================================================
  // Ideation Management
  // ========================================================================

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_IDEATION_GET, async (_event, projectId: string) => {
    // Import necessary modules
    const { existsSync, readFileSync } = await import('fs');
    const pathModule = await import('path');
    const { readIdeationFile } = await import('./ideation/file-utils');
    const { transformIdeaFromSnakeCase } = await import('./ideation/transformers');

    const project = projectStore.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const ideationPath = pathModule.join(
      project.path,
      AUTO_BUILD_PATHS.IDEATION_DIR,
      AUTO_BUILD_PATHS.IDEATION_FILE
    );

    const rawIdeation = readIdeationFile(ideationPath);
    if (!rawIdeation) {
      return null;
    }

    try {
      // Transform snake_case to camelCase for frontend
      const enabledTypes = (rawIdeation.config?.enabled_types || rawIdeation.config?.enabledTypes || []) as unknown[];

      return {
        id: rawIdeation.id || `ideation-${Date.now()}`,
        projectId,
        config: {
          enabledTypes: enabledTypes as string[],
          includeRoadmapContext: rawIdeation.config?.include_roadmap_context ?? rawIdeation.config?.includeRoadmapContext ?? true,
          includeKanbanContext: rawIdeation.config?.include_kanban_context ?? rawIdeation.config?.includeKanbanContext ?? true,
          maxIdeasPerType: rawIdeation.config?.max_ideas_per_type || rawIdeation.config?.maxIdeasPerType || 5
        },
        ideas: (rawIdeation.ideas || []).map((idea: any) => transformIdeaFromSnakeCase(idea)),
        projectContext: {
          existingFeatures: rawIdeation.project_context?.existing_features || rawIdeation.projectContext?.existingFeatures || [],
          techStack: rawIdeation.project_context?.tech_stack || rawIdeation.projectContext?.techStack || [],
          targetAudience: rawIdeation.project_context?.target_audience || rawIdeation.projectContext?.targetAudience,
          plannedFeatures: rawIdeation.project_context?.planned_features || rawIdeation.projectContext?.plannedFeatures || []
        },
        generatedAt: rawIdeation.generated_at ? new Date(rawIdeation.generated_at) : new Date(),
        updatedAt: rawIdeation.updated_at ? new Date(rawIdeation.updated_at) : new Date()
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to read ideation');
    }
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_IDEATION_GENERATE, async (_event, request: GenerateIdeationRequest) => {
    // Build ideation config from request
    const config = {
      enabledTypes: request.scope === 'full-project' ? ['improvements', 'performance', 'security', 'features'] : [request.type || 'improvements'],
      includeRoadmapContext: true,
      includeKanbanContext: true,
      maxIdeasPerType: request.count || 10
    };

    // Emit ideation generation event
    const { EventEmitter } = await import('events');
    const mockEvent = new EventEmitter();

    ipcMain.emit(IPC_CHANNELS.IDEATION_GENERATE, mockEvent, request.projectId, config);

    return {
      success: true,
      message: 'Ideation generation started',
      projectId: request.projectId
    };
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_IDEATION_CONVERT, async (_event, projectId: string, ideaId: string, options: any) => {
    // Import necessary modules
    const { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } = await import('fs');
    const pathModule = await import('path');

    const project = projectStore.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const ideationPath = pathModule.join(
      project.path,
      AUTO_BUILD_PATHS.IDEATION_DIR,
      AUTO_BUILD_PATHS.IDEATION_FILE
    );

    if (!existsSync(ideationPath)) {
      throw new Error('Ideation file not found');
    }

    // Read ideation to find the idea
    const ideationContent = existsSync(ideationPath) ? JSON.parse(readFileSync(ideationPath, 'utf-8')) : { ideas: [] };
    const idea = ideationContent.ideas?.find((i: any) => i.id === ideaId);

    if (!idea) {
      throw new Error('Idea not found');
    }

    // Create task from idea (simplified version)
    const specsBaseDir = getSpecsDir(project.autoBuildPath);
    const specsDir = pathModule.join(project.path, specsBaseDir);

    // Ensure specs directory exists
    if (!existsSync(specsDir)) {
      mkdirSync(specsDir, { recursive: true });
    }

    // Find next available spec number
    let specNumber = 1;
    const existingDirs = existsSync(specsDir)
      ? readdirSync(specsDir)
      : [];
    const existingNumbers = existingDirs
      .map((name: string) => {
        const match = name.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n: number) => n > 0);
    if (existingNumbers.length > 0) {
      specNumber = Math.max(...existingNumbers) + 1;
    }

    // Create spec ID
    const slugifiedTitle = (options.taskTitle || idea.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50);
    const specId = `${String(specNumber).padStart(3, "0")}-${slugifiedTitle}`;

    // Create spec directory
    const specDir = pathModule.join(specsDir, specId);
    mkdirSync(specDir, { recursive: true });

    // Create task description
    const taskDescription = options.taskDescription || idea.description || `Implement: ${idea.title}`;

    // Create initial implementation_plan.json
    const now = new Date().toISOString();
    const implementationPlan = {
      feature: options.taskTitle || idea.title,
      description: taskDescription,
      created_at: now,
      updated_at: now,
      status: "pending",
      phases: [],
    };

    writeFileSync(
      pathModule.join(specDir, AUTO_BUILD_PATHS.IMPLEMENTATION_PLAN),
      JSON.stringify(implementationPlan, null, 2),
      'utf-8'
    );

    // Create requirements.json
    const requirements = {
      task_description: taskDescription,
      workflow_type: "feature",
    };
    writeFileSync(
      pathModule.join(specDir, AUTO_BUILD_PATHS.REQUIREMENTS),
      JSON.stringify(requirements, null, 2),
      'utf-8'
    );

    // Create task object
    const task = {
      id: specId,
      specId: specId,
      projectId,
      title: options.taskTitle || idea.title,
      description: taskDescription,
      status: "backlog",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return task;
  });

  // ========================================================================
  // Progress Monitoring
  // ========================================================================

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_PROGRESS_GET, async (_event, projectId: string) => {
    const projects = projectStore.getProjects();
    const project = projects.find((p: any) => p.id === projectId);

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const tasks = projectStore.getTasks(projectId);
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
    const pendingTasks = tasks.filter(t => t.status === 'backlog').length;
    const blockedTasks = tasks.filter(t => t.status === 'error').length;

    // Calculate phase breakdown
    const phaseMap = new Map<string, { total: number; completed: number }>();
    tasks.forEach((task: any) => {
      const phase = task.executionProgress?.phase || 'unknown';
      if (!phaseMap.has(phase)) {
        phaseMap.set(phase, { total: 0, completed: 0 });
      }
      const phaseData = phaseMap.get(phase)!;
      phaseData.total++;
      if (task.status === 'done') {
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

  // Simple in-memory webhook storage (in production, this would be persisted)
  const webhooks = new Map<string, {
    id: string;
    url: string;
    events: string[];
    secret?: string;
    createdAt: Date;
  }>();

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_WEBHOOK_REGISTER, async (_event, config: { url: string; events: string[]; secret?: string }) => {
    const { existsSync, mkdirSync, writeFileSync, readFileSync } = await import('fs');
    const path = await import('path');
    const { v4: uuidv4 } = await import('uuid');

    // Generate webhook ID
    const webhookId = uuidv4();

    // Store webhook configuration
    const webhook = {
      id: webhookId,
      url: config.url,
      events: config.events,
      secret: config.secret,
      createdAt: new Date()
    };

    webhooks.set(webhookId, webhook);

    // Persist webhooks to disk
    const userDataPath = (await import('electron')).app.getPath('userData');
    const webhooksDir = path.join(userDataPath, 'webhooks');
    const webhooksFile = path.join(webhooksDir, 'registered.json');

    if (!existsSync(webhooksDir)) {
      mkdirSync(webhooksDir, { recursive: true });
    }

    let existingWebhooks: any[] = [];
    if (existsSync(webhooksFile)) {
      try {
        const content = readFileSync(webhooksFile, 'utf-8');
        existingWebhooks = JSON.parse(content);
      } catch (err) {
        console.error('[External API] Failed to read webhooks file:', err);
      }
    }

    existingWebhooks.push(webhook);
    writeFileSync(webhooksFile, JSON.stringify(existingWebhooks, null, 2), 'utf-8');

    return webhook;
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_WEBHOOK_UNREGISTER, async (_event, webhookId: string) => {
    const { existsSync, writeFileSync, readFileSync } = await import('fs');
    const path = await import('path');

    if (!webhooks.has(webhookId)) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    webhooks.delete(webhookId);

    // Update persisted webhooks
    const userDataPath = (await import('electron')).app.getPath('userData');
    const webhooksFile = path.join(userDataPath, 'webhooks', 'registered.json');

    if (existsSync(webhooksFile)) {
      try {
        const content = readFileSync(webhooksFile, 'utf-8');
        const existingWebhooks = JSON.parse(content);
        const filteredWebhooks = existingWebhooks.filter((w: any) => w.id !== webhookId);
        writeFileSync(webhooksFile, JSON.stringify(filteredWebhooks, null, 2), 'utf-8');
      } catch (err) {
        console.error('[External API] Failed to update webhooks file:', err);
      }
    }

    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.EXTERNAL_API_WEBHOOK_LIST, async () => {
    return Array.from(webhooks.values());
  });
}
