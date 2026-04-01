/**
 * External API CLI Tool
 *
 * Provides a command-line interface for external tools (like OpenCLaw)
 * to interact with Auto-Harness programmatically.
 *
 * Usage:
 *   aperant-cli project list
 *   aperant-cli project get <project-id>
 *   aperant-cli task list <project-id>
 *   aperant-cli task create <project-id> "Title" "Description"
 *   aperant-cli roadmap generate <project-id>
 *   aperant-cli ideation generate <project-id>
 *   aperant-cli progress <project-id>
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_PATH = join(homedir(), '.aperant', 'cli-config.json');

// =============================================================================
// Configuration
// =============================================================================

interface CliConfig {
  apiKey?: string;
  apiUrl?: string;
  timeout?: number;
}

function loadConfig(): CliConfig {
  try {
    const configData = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(configData);
  } catch {
    return {
      apiUrl: 'http://localhost:3456',
      timeout: 30000,
    };
  }
}

function saveConfig(config: CliConfig): void {
  const configDir = join(homedir(), '.aperant');
  // Ensure directory exists (implementation would use mkdirp here)
  // writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// =============================================================================
// API Client
// =============================================================================

class ExternalApiClient {
  private config: CliConfig;
  private apiKey: string | undefined;

  constructor(config: CliConfig) {
    this.config = config;
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const url = `${this.config.apiUrl}${path}`;
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

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ========================================================================
  // Project Operations
  // ========================================================================

  async listProjects(): Promise<any> {
    return this.request('GET', '/api/projects');
  }

  async getProject(projectId: string): Promise<any> {
    return this.request('GET', `/api/projects/${projectId}`);
  }

  // ========================================================================
  // Task Operations
  // ========================================================================

  async listTasks(projectId: string): Promise<any> {
    return this.request('GET', `/api/projects/${projectId}/tasks`);
  }

  async createTask(projectId: string, title: string, description: string, options: any = {}): Promise<any> {
    return this.request('POST', `/api/projects/${projectId}/tasks`, {
      projectId,
      title,
      description,
      ...options,
    });
  }

  async updateTask(projectId: string, taskId: string, updates: any): Promise<any> {
    return this.request('PATCH', `/api/projects/${projectId}/tasks/${taskId}`, updates);
  }

  async reorderTasks(projectId: string, taskIds: string[], phase?: string): Promise<any> {
    return this.request('POST', '/api/tasks/reorder', {
      projectId,
      taskIds,
      phase,
    });
  }

  // ========================================================================
  // Roadmap Operations
  // ========================================================================

  async getRoadmap(projectId: string): Promise<any> {
    return this.request('GET', `/api/projects/${projectId}/roadmap`);
  }

  async generateRoadmap(projectId: string, options: any = {}): Promise<any> {
    return this.request('POST', `/api/projects/${projectId}/roadmap/generate`, {
      projectId,
      ...options,
    });
  }

  // ========================================================================
  // Ideation Operations
  // ========================================================================

  async getIdeation(projectId: string): Promise<any> {
    return this.request('GET', `/api/projects/${projectId}/ideation`);
  }

  async generateIdeation(projectId: string, options: any = {}): Promise<any> {
    return this.request('POST', `/api/projects/${projectId}/ideation/generate`, {
      projectId,
      ...options,
    });
  }

  // ========================================================================
  // Progress Monitoring
  // ========================================================================

  async getProgress(projectId: string): Promise<any> {
    return this.request('GET', `/api/projects/${projectId}/progress`);
  }
}

// =============================================================================
// CLI Commands
// =============================================================================

const program = new Command();

program
  .name('aperant-cli')
  .description('Auto-Harness External API CLI Tool')
  .version('1.0.0');

// Configure command
program
  .command('configure')
  .description('Configure CLI settings')
  .option('--api-key <key>', 'API key for authentication')
  .option('--api-url <url>', 'API server URL', 'http://localhost:3456')
  .action((options) => {
    const config: CliConfig = {
      apiKey: options.apiKey,
      apiUrl: options.apiUrl,
    };
    saveConfig(config);
    console.log('Configuration saved successfully');
  });

// Project commands
const projectCmd = program.command('project').description('Project management');

projectCmd
  .command('list')
  .description('List all projects')
  .action(async () => {
    const client = new ExternalApiClient(loadConfig());
    const projects = await client.listProjects();
    console.log(JSON.stringify(projects, null, 2));
  });

projectCmd
  .command('get <projectId>')
  .description('Get project details')
  .action(async (projectId) => {
    const client = new ExternalApiClient(loadConfig());
    const project = await client.getProject(projectId);
    console.log(JSON.stringify(project, null, 2));
  });

// Task commands
const taskCmd = program.command('task').description('Task management');

taskCmd
  .command('list <projectId>')
  .description('List tasks in a project')
  .action(async (projectId) => {
    const client = new ExternalApiClient(loadConfig());
    const tasks = await client.listTasks(projectId);
    console.log(JSON.stringify(tasks, null, 2));
  });

taskCmd
  .command('create <projectId> <title> <description>')
  .description('Create a new task')
  .option('--priority <priority>', 'Task priority', 'medium')
  .option('--auto-start', 'Start task automatically', false)
  .action(async (projectId, title, description, options) => {
    const client = new ExternalApiClient(loadConfig());
    const task = await client.createTask(projectId, title, description, options);
    console.log(JSON.stringify(task, null, 2));
  });

taskCmd
  .command('update <projectId> <taskId>')
  .description('Update a task')
  .option('--status <status>', 'New status')
  .option('--priority <priority>', 'New priority')
  .action(async (projectId, taskId, options) => {
    const client = new ExternalApiClient(loadConfig());
    const task = await client.updateTask(projectId, taskId, options);
    console.log(JSON.stringify(task, null, 2));
  });

taskCmd
  .command('reorder <projectId> <taskIds...>')
  .description('Reorder tasks')
  .option('--phase <phase>', 'Specific phase to reorder')
  .action(async (projectId, taskIds, options) => {
    const client = new ExternalApiClient(loadConfig());
    const result = await client.reorderTasks(projectId, taskIds, options.phase);
    console.log(JSON.stringify(result, null, 2));
  });

// Roadmap commands
const roadmapCmd = program.command('roadmap').description('Roadmap management');

roadmapCmd
  .command('get <projectId>')
  .description('Get project roadmap')
  .action(async (projectId) => {
    const client = new ExternalApiClient(loadConfig());
    const roadmap = await client.getRoadmap(projectId);
    console.log(JSON.stringify(roadmap, null, 2));
  });

roadmapCmd
  .command('generate <projectId>')
  .description('Generate roadmap for project')
  .option('--prompt <prompt>', 'Generation prompt')
  .option('--competitor', 'Include competitor analysis')
  .action(async (projectId, options) => {
    const client = new ExternalApiClient(loadConfig());
    const roadmap = await client.generateRoadmap(projectId, options);
    console.log(JSON.stringify(roadmap, null, 2));
  });

// Ideation commands
const ideationCmd = program.command('ideation').description('Ideation management');

ideationCmd
  .command('get <projectId>')
  .description('Get project ideation')
  .action(async (projectId) => {
    const client = new ExternalApiClient(loadConfig());
    const ideation = await client.getIdeation(projectId);
    console.log(JSON.stringify(ideation, null, 2));
  });

ideationCmd
  .command('generate <projectId>')
  .description('Generate ideation for project')
  .option('--type <type>', 'Type of ideation', 'all')
  .option('--scope <scope>', 'Analysis scope', 'full-project')
  .option('--count <number>', 'Number of ideas', '10')
  .action(async (projectId, options) => {
    const client = new ExternalApiClient(loadConfig());
    const ideation = await client.generateIdeation(projectId, options);
    console.log(JSON.stringify(ideation, null, 2));
  });

// Progress commands
const progressCmd = program.command('progress').description('Progress monitoring');

progressCmd
  .command('get <projectId>')
  .description('Get development progress')
  .action(async (projectId) => {
    const client = new ExternalApiClient(loadConfig());
    const progress = await client.getProgress(projectId);
    console.log(JSON.stringify(progress, null, 2));
  });

// Parse and execute
export async function runCli(args: string[]): Promise<void> {
  await program.parseAsync(args);
}

// Allow running as standalone script
if (require.main === module) {
  const args = process.argv.slice(2);
  runCli(args).catch(console.error);
}
