#!/usr/bin/env tsx
/**
 * Auth Resolution Issue Diagnostic
 * ===============================
 *
 * Diagnose why tasks get stuck at 50% with no Worker thread initialization.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

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
 * Check if provider accounts are configured
 */
function checkProviderAccounts() {
  try {
    const settingsPath = join(process.env.HOME || '', 'Library/Application Support/Aperant/settings.json');
    if (!existsSync(settingsPath)) {
      addResult('Provider Accounts', 'warn', 'No settings file found', 'You may not have any provider accounts configured');
      return;
    }

    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    const accounts = settings.providerAccounts || [];

    if (accounts.length === 0) {
      addResult('Provider Accounts', 'fail', 'No provider accounts configured', 'Please add accounts in Settings > Accounts');
    } else {
      addResult('Provider Accounts', 'pass', `Found ${accounts.length} provider accounts`, accounts.map((a: any) => a.provider).join(', '));
    }
  } catch (error) {
    addResult('Provider Accounts', 'fail', 'Failed to check provider accounts', String(error));
  }
}

/**
 * Check for API key in environment
 */
function checkEnvironmentVariables() {
  const apiKeys = {
    'ANTHROPIC_API_KEY': process.env.ANTHROPIC_API_KEY,
    'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
    'ZAI_API_KEY': process.env.ZAI_API_KEY,
  };

  const foundKeys = Object.entries(apiKeys).filter(([_, value]) => value != null);

  if (foundKeys.length === 0) {
    addResult('Environment Variables', 'warn', 'No API keys in environment', 'App may not have valid credentials');
  } else {
    addResult('Environment Variables', 'pass', `Found ${foundKeys.length} API keys in environment`);
  }
}

/**
 * Check recent task logs
 */
function checkTaskLogs() {
  try {
    const autoClaudeDir = '.auto-claude';
    if (!existsSync(autoClaudeDir)) {
      addResult('Task Logs', 'warn', 'No .auto-claude directory found');
      return;
    }

    const specsDir = join(autoClaudeDir, 'specs');
    if (!existsSync(specsDir)) {
      addResult('Task Logs', 'warn', 'No specs directory found');
      return;
    }

    const specs = require('fs').readdirSync(specsDir);
    let logFileCount = 0;
    let hasWorkerInitLogs = false;

    for (const specId of specs) {
      const logFile = join(specsDir, specId, 'task_logs.json');
      if (existsSync(logFile)) {
        logFileCount++;
        try {
          const content = readFileSync(logFile, 'utf-8');
          // Check for worker initialization logs
          if (content.includes('[INIT] Worker thread initialized')) {
            hasWorkerInitLogs = true;
          }
        } catch {
          // Corrupt log file
        }
      }
    }

    if (logFileCount === 0) {
      addResult('Task Logs', 'warn', `No task logs found in ${specs.length} specs`);
    } else {
      addResult('Task Logs', hasWorkerInitLogs ? 'pass' : 'fail',
        `Found ${logFileCount} log files`,
        hasWorkerInitLogs ? 'Worker initialization logs present' : 'NO Worker initialization logs - Worker threads may not be starting'
      );
    }
  } catch (error) {
    addResult('Task Logs', 'fail', 'Error checking task logs', String(error));
  }
}

/**
 * Check worker file exists
 */
function checkWorkerFile() {
  const workerPath = 'out/main/ai/agent/worker.js';
  if (existsSync(workerPath)) {
    const stats = require('fs').statSync(workerPath);
    addResult('Worker File', 'pass', `Worker file exists (${(stats.size / 1024).toFixed(1)}KB)`);
  } else {
    addResult('Worker File', 'fail', 'Worker file missing', 'Run "npm run build" first');
  }
}

/**
 * Main diagnostic runner
 */
function runDiagnostics() {
  console.log('=== Auth Resolution & Worker Initialization Diagnostic ===\n');

  checkProviderAccounts();
  checkEnvironmentVariables();
  checkWorkerFile();
  checkTaskLogs();

  console.log('\n=== Summary ===');
  const fails = results.filter(r => r.status === 'fail').length;
  const warns = results.filter(r => r.status === 'warn').length;
  const passes = results.filter(r => r.status === 'pass').length;

  console.log(`Pass: ${passes}, Warn: ${warns}, Fail: ${fails}`);

  if (fails > 0) {
    console.log('\n❌ Critical issues found - likely cause of task hanging:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`   - ${r.message}: ${r.details}`);
    });
    console.log('\n💡 Most likely issue: Worker thread is not starting.');
    console.log('   This could be due to:');
    console.log('   1. Invalid or missing API credentials');
    console.log('   2. Build output missing (run "npm run build")');
    console.log('   3. Worker file path resolution issue');
    process.exit(1);
  } else if (warns > 0) {
    console.log('\n⚠️  Warnings found - tasks may not work correctly');
    process.exit(0);
  } else {
    console.log('\n✓ All checks passed - issue may be elsewhere');
    process.exit(0);
  }
}

runDiagnostics();
