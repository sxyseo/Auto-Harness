#!/usr/bin/env tsx
/**
 * Task Hang Diagnostic Tool
 * =========================
 *
 * Diagnoses why tasks hang at 50% progress with no logs.
 * Checks for common issues:
 * - Worker thread file exists
 * - Log directory permissions
 * - Task log file creation
 * - Process status
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

interface DiagnosticResult {
  category: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
}

const results: DiagnosticResult[] = [];

function addResult(category: string, status: 'pass' | 'fail' | 'warn', message: string, details?: string) {
  results.push({ category, status, message, details });
  const icon = status === 'pass' ? '✓' : status === 'fail' ? '✗' : '⚠';
  console.log(`${icon} [${category}] ${message}`);
  if (details) console.log(`  Details: ${details}`);
}

/**
 * Check if the worker file exists and is valid
 */
function checkWorkerFile() {
  const workerPaths = [
    'apps/desktop/out/main/ai/agent/worker.js',
    'apps/desktop/src/main/ai/agent/worker.ts',
  ];

  for (const workerPath of workerPaths) {
    if (existsSync(workerPath)) {
      const stats = statSync(workerPath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      addResult('Worker File', 'pass', `Found at ${workerPath}`, `Size: ${sizeKB}KB`);
      return;
    }
  }

  addResult('Worker File', 'fail', 'Worker file not found', 'Tasks cannot execute without the worker thread');
}

/**
 * Check if build output exists
 */
function checkBuildOutput() {
  const buildDir = 'apps/desktop/out';
  if (!existsSync(buildDir)) {
    addResult('Build Output', 'fail', 'Build output directory missing', 'Run "npm run build" first');
    return;
  }

  try {
    const files = readdirSync(buildDir);
    if (files.length === 0) {
      addResult('Build Output', 'warn', 'Build output directory is empty', 'Try rebuilding with "npm run build"');
    } else {
      addResult('Build Output', 'pass', `Build output exists with ${files.length} items`);
    }
  } catch (error) {
    addResult('Build Output', 'fail', 'Cannot read build directory', String(error));
  }
}

/**
 * Check for running Electron processes
 */
function checkElectronProcesses() {
  try {
    const result = execSync('ps aux | grep -i electron | grep -v grep', { encoding: 'utf-8' });
    const processCount = result.trim().split('\n').filter(line => line.trim()).length;

    if (processCount > 0) {
      addResult('Electron Process', 'pass', `Found ${processCount} running Electron process(es)`);
    } else {
      addResult('Electron Process', 'warn', 'No Electron processes running', 'Start the app to test task execution');
    }
  } catch {
    addResult('Electron Process', 'pass', 'No Electron processes running (app not started)');
  }
}

/**
 * Check for task log files
 */
function checkTaskLogs() {
  const autoClaudeDir = '.auto-claude';
  if (!existsSync(autoClaudeDir)) {
    addResult('Task Logs', 'warn', 'No .auto-claude directory found', 'Tasks have not been run yet');
    return;
  }

  try {
    const specsDir = join(autoClaudeDir, 'specs');
    if (!existsSync(specsDir)) {
      addResult('Task Logs', 'warn', 'No specs directory found');
      return;
    }

    const specs = readdirSync(specsDir);
    let logFileCount = 0;
    let emptyLogDirs = 0;

    for (const specId of specs) {
      const logFile = join(specsDir, specId, 'task_logs.json');
      if (existsSync(logFile)) {
        logFileCount++;
        try {
          const content = readFileSync(logFile, 'utf-8');
          const logs = JSON.parse(content);
          const entryCount = Object.values(logs.phases || {}).reduce(
            (sum: number, phase: any) => sum + (phase.entries?.length || 0),
            0
          );
          addResult('Task Logs', 'pass', `Found logs for ${specId}`, `${entryCount} entries`);
        } catch {
          addResult('Task Logs', 'warn', `Corrupt log file for ${specId}`);
        }
      } else {
        emptyLogDirs++;
      }
    }

    if (logFileCount === 0) {
      addResult('Task Logs', 'warn', `No log files found in ${specs.length} spec directories`, 'Tasks may not be writing logs');
    } else {
      addResult('Task Logs', 'pass', `Found ${logFileCount} log files (${emptyLogDirs} dirs without logs)`);
    }
  } catch (error) {
    addResult('Task Logs', 'fail', 'Error checking task logs', String(error));
  }
}

/**
 * Main diagnostic runner
 */
function runDiagnostics() {
  console.log('=== Task Hang Diagnostic Tool ===\n');

  checkBuildOutput();
  checkWorkerFile();
  checkElectronProcesses();
  checkTaskLogs();

  console.log('\n=== Summary ===');
  const fails = results.filter(r => r.status === 'fail').length;
  const warns = results.filter(r => r.status === 'warn').length;
  const passes = results.filter(r => r.status === 'pass').length;

  console.log(`Pass: ${passes}, Warn: ${warns}, Fail: ${fails}`);

  if (fails > 0) {
    console.log('\n❌ Critical issues found - please address the failures above');
    process.exit(1);
  } else if (warns > 0) {
    console.log('\n⚠️  Warnings found - tasks may not work correctly');
    process.exit(0);
  } else {
    console.log('\n✓ All checks passed');
    process.exit(0);
  }
}

runDiagnostics();
