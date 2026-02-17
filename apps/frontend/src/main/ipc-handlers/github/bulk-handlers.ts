/**
 * GitHub Bulk Operations IPC handlers.
 * Sequential per-item execution with progress events and error isolation.
 */

import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { IPC_CHANNELS } from '../../../shared/constants/ipc';
import { BULK_INTER_ITEM_DELAY } from '../../../shared/constants/mutations';
import type {
  BulkExecuteParams,
  BulkItemResult,
  BulkOperationResult,
  BulkActionType,
} from '../../../shared/types/mutations';
import { withProject } from './utils/project-middleware';
import { getAugmentedEnv } from '../../env-utils';
import { getToolPath } from '../../cli-tool-manager';
import { createContextLogger } from './utils/logger';
import { validateLabel, validateLogin } from '../../../shared/utils/mutation-validation';

const execFileAsync = promisify(execFile);
const logger = createContextLogger('GitHub Bulk Operations');

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build gh CLI arguments for a single bulk action on one issue.
 * Validates labels and assignees before building arguments.
 */
function buildGhArgs(
  action: BulkActionType,
  issueNumber: number,
  payload?: BulkExecuteParams['payload'],
): string[] {
  const num = String(issueNumber);

  switch (action) {
    case 'close':
      return ['issue', 'close', num];
    case 'reopen':
      return ['issue', 'reopen', num];
    case 'add-label': {
      const labels = payload?.labels ?? [];
      for (const label of labels) {
        const validation = validateLabel(label);
        if (!validation.valid) {
          throw new Error(`Invalid label: ${validation.error}`);
        }
      }
      return ['issue', 'edit', num, '--add-label', labels.join(',')];
    }
    case 'remove-label': {
      const labels = payload?.labels ?? [];
      for (const label of labels) {
        const validation = validateLabel(label);
        if (!validation.valid) {
          throw new Error(`Invalid label: ${validation.error}`);
        }
      }
      return ['issue', 'edit', num, '--remove-label', labels.join(',')];
    }
    case 'add-assignee': {
      const assignees = payload?.assignees ?? [];
      for (const assignee of assignees) {
        const validation = validateLogin(assignee);
        if (!validation.valid) {
          throw new Error(`Invalid assignee: ${validation.error}`);
        }
      }
      return ['issue', 'edit', num, '--add-assignee', assignees.join(',')];
    }
    case 'remove-assignee': {
      const assignees = payload?.assignees ?? [];
      for (const assignee of assignees) {
        const validation = validateLogin(assignee);
        if (!validation.valid) {
          throw new Error(`Invalid assignee: ${validation.error}`);
        }
      }
      return ['issue', 'edit', num, '--remove-assignee', assignees.join(',')];
    }
    default:
      return [];
  }
}

export function registerBulkHandlers(
  getMainWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_BULK_EXECUTE,
    async (_event, params: BulkExecuteParams): Promise<BulkOperationResult> => {
      const { action, issueNumbers, payload } = params;

      // Empty list → immediate empty result
      if (issueNumbers.length === 0) {
        const emptyResult: BulkOperationResult = {
          action,
          totalItems: 0,
          succeeded: 0,
          failed: 0,
          skipped: 0,
          results: [],
        };
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.GITHUB_BULK_COMPLETE, emptyResult);
        }
        return emptyResult;
      }

      return withProject(params.projectId, async (project) => {
        const results: BulkItemResult[] = [];
        let succeeded = 0;
        let failed = 0;
        let skipped = 0;

        for (let i = 0; i < issueNumbers.length; i++) {
          const issueNumber = issueNumbers[i];
          const win = getMainWindow();

          // Send progress event
          if (win && !win.isDestroyed()) {
            win.webContents.send(IPC_CHANNELS.GITHUB_BULK_PROGRESS, {
              action,
              totalItems: issueNumbers.length,
              processedItems: i,
              currentIssueNumber: issueNumber,
            });
          }

          const args = buildGhArgs(action, issueNumber, payload);

          if (args.length === 0) {
            // Skipped (e.g., transition has no gh CLI equivalent)
            results.push({ issueNumber, status: 'skipped' });
            skipped++;
          } else {
            try {
              await execFileAsync(getToolPath('gh'), args, {
                cwd: project.path,
                env: getAugmentedEnv(),
              });
              results.push({ issueNumber, status: 'success' });
              succeeded++;
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              logger.debug(`Bulk action ${action} failed for #${issueNumber}`, errorMsg);
              results.push({ issueNumber, status: 'failed', error: errorMsg });
              failed++;
            }
          }

          // Inter-item delay to avoid rate limits
          if (i < issueNumbers.length - 1) {
            await sleep(BULK_INTER_ITEM_DELAY);
          }
        }

        const result: BulkOperationResult = {
          action,
          totalItems: issueNumbers.length,
          succeeded,
          failed,
          skipped,
          results,
        };

        // Send completion event
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send(IPC_CHANNELS.GITHUB_BULK_COMPLETE, result);
        }

        return result;
      });
    },
  );
}
