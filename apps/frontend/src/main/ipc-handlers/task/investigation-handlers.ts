/**
 * Investigation data handlers for GitHub-sourced tasks
 *
 * Provides access to investigation report data for tasks created from GitHub issues.
 */

import { ipcMain } from 'electron';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { InvestigationData } from '../../../shared/types/investigation';
import { findTaskAndProject } from './shared';

/**
 * Register investigation data handlers
 */
export function registerTaskInvestigationHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.TASK_GET_INVESTIGATION_DATA, async (_event, taskId: string) => {
    try {
      const { task, project } = findTaskAndProject(taskId);

      if (!task || !project || task.metadata?.sourceType !== 'github') {
        return null;
      }

      // Find the spec directory
      const specsDir = path.join(project.path, '.auto-claude', 'specs');
      const specDir = path.join(specsDir, task.specId);

      const reportPath = path.join(specDir, 'investigation_report.json');

      if (!existsSync(reportPath)) {
        return null;
      }

      const reportContent = readFileSync(reportPath, 'utf-8');
      const report = JSON.parse(reportContent);

      // Return structured data for the UI
      return {
        ...report,
        reportPath
      } as InvestigationData;
    } catch (error) {
      console.error('Error loading investigation data:', error);
      return null;
    }
  });
}
