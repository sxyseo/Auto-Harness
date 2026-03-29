/**
 * Enhanced Debug Logger
 *
 * Provides detailed, structured logging for debugging complex issues.
 * Logs execution flow, API requests/responses, errors, and state changes.
 *
 * Only active when:
 * - Beta version is detected, OR
 * - DEBUG environment variable is set
 *
 * NOTE: This logger uses console.log instead of electron-log to avoid
 * conflicts with app-logger.ts which already initializes electron-log.
 * This prevents "Attempted to register a second handler for '__ELECTRON_LOG__'" error.
 */

// Simple logger using console (no electron-log dependency)
const simpleLog = {
  info: (...args: unknown[]) => console.log('[INFO]', ...args),
  warn: (...args: unknown[]) => console.warn('[WARN]', ...args),
  error: (...args: unknown[]) => console.error('[ERROR]', ...args),
  debug: (...args: unknown[]) => console.debug('[DEBUG]', ...args)
};

const log = simpleLog;

// Check if debug logging is enabled
const isDebugEnabled = (): boolean => {
  // Check if this is a beta version by inspecting package.json
  try {
    const packagePath = require('../../package.json');
    return process.env.DEBUG === 'true' ||
           (packagePath.version && packagePath.version.includes('-beta'));
  } catch {
    return process.env.DEBUG === 'true';
  }
};

// Safe stringify that handles circular references and large objects
function safeStringify(obj: unknown, maxDepth = 3): string {
  const seen = new WeakSet();

  const stringify = (val: unknown, depth = 0): string => {
    if (depth > maxDepth) return '[Max depth reached]';

    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'string') return `"${val}"`;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return String(val);

    if (val instanceof Error) {
      return `[Error: ${val.message}]`;
    }

    if (val instanceof Date) {
      return `[Date: ${val.toISOString()}]`;
    }

    if (typeof val === 'function') return '[Function]';

    if (seen.has(val as object)) return '[Circular]';

    if (Array.isArray(val)) {
      if (val.length === 0) return '[]';
      seen.add(val as object);
      const items = val.map(item => stringify(item, depth + 1));
      seen.delete(val as object);
      return `[${items.join(', ')}]`;
    }

    if (typeof val === 'object') {
      if (Object.keys(val).length === 0) return '{}';
      seen.add(val as object);
      const entries = Object.entries(val).map(([k, v]) => {
        return `${k}: ${stringify(v, depth + 1)}`;
      });
      seen.delete(val as object);
      return `{${entries.join(', ')}}`;
    }

    return String(val);
  };

  try {
    return safeStringify(obj);
  } catch (error) {
    return `[Unstringifiable: ${typeof obj}]`;
  }
}

// Truncate long strings
function truncate(str: string, maxLength = 500): string {
  if (str.length <= maxLength) return str;
  return `${str.substring(0, maxLength)}... [truncated, total: ${str.length} chars]`;
}

// Sanitize sensitive data
function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['apiKey', 'token', 'password', 'secret', 'authorization'];
  const sanitized = { ...data };

  for (const key of Object.keys(sanitized)) {
    for (const sensitive of sensitiveKeys) {
      if (key.toLowerCase().includes(sensitive)) {
        const value = sanitized[key];
        if (typeof value === 'string') {
          sanitized[key] = `${value.substring(0, 8)}...[REDACTED]`;
        }
      }
    }
  }

  return sanitized;
}

/**
 * Debug logger class with structured logging
 */
export class DebugLogger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private log(level: 'info' | 'warn' | 'error' | 'debug', category: string, message: string, data?: unknown) {
    if (!isDebugEnabled()) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.context}] [${category}]`;

    let output = `${prefix} ${message}`;

    if (data !== undefined) {
      const sanitized = data instanceof Object ? sanitize(data as Record<string, unknown>) : data;
      const dataStr = safeStringify(sanitized);
      output += `\n${dataStr}`;
    }

    log[level](output);
  }

  /** Log a function entry */
  enter(functionName: string, params?: Record<string, unknown>) {
    this.log('debug', 'ENTER', `→ ${functionName}`, params);
  }

  /** Log a function exit */
  exit(functionName: string, result?: unknown) {
    this.log('debug', 'EXIT', `← ${functionName}`, result);
  }

  /** Log a function error */
  exitWithError(functionName: string, error: unknown) {
    this.log('error', 'ERROR', `✗ ${functionName} failed`, {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error
    });
  }

  /** Log an info message */
  info(category: string, message: string, data?: unknown) {
    this.log('info', 'INFO', message, data);
  }

  /** Log a warning */
  warn(category: string, message: string, data?: unknown) {
    this.log('warn', 'WARN', message, data);
  }

  /** Log an error */
  error(category: string, message: string, data?: unknown) {
    this.log('error', 'ERROR', message, data);
  }

  /** Log a debug message */
  debug(category: string, message: string, data?: unknown) {
    this.log('debug', 'DEBUG', message, data);
  }

  /** Log API request */
  logApiRequest(provider: string, endpoint: string, model: string, options?: Record<string, unknown>) {
    this.info('API_REQUEST', `→ ${provider} ${endpoint} (model: ${model})`, {
      endpoint,
      model,
      options: options ? {
        ...options,
        headers: options?.headers ? '[headers redacted]' : undefined
      } : undefined
    });
  }

  /** Log API response */
  logApiResponse(provider: string, endpoint: string, statusCode: number, duration: number, data?: {
    usage?: unknown;
    model?: string;
    body?: unknown;
  }) {
    this.info('API_RESPONSE', `← ${provider} ${endpoint} (${statusCode}) [${duration}ms]`, {
      statusCode,
      duration,
      data: data ? {
        ...data,
        body: data?.body ? truncate(JSON.stringify(data.body)) : undefined
      } : undefined
    });
  }

  /** Log API error */
  logApiError(provider: string, endpoint: string, error: unknown, duration?: number) {
    this.error('API_ERROR', `✗ ${provider} ${endpoint} ${duration ? `[${duration}ms]` : ''}`, {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: truncate(error.stack || 'no stack')
      } : error
    });
  }

  /** Log state change */
  logStateChange(from: string, to: string, context?: Record<string, unknown>) {
    this.info('STATE_CHANGE', `${from} → ${to}`, context);
  }

  /** Log authentication flow */
  logAuthStep(step: string, provider?: string, details?: Record<string, unknown>) {
    this.info('AUTH', step, { provider, ...details });
  }
}

/**
 * Create a debug logger instance for a specific context
 */
export function createDebugLogger(context: string): DebugLogger {
  return new DebugLogger(context);
}

// Re-export convenience function
export const debugLog = (enabled: boolean) => (context: string, category: string, message: string, data?: unknown) => {
  if (!enabled) return;
  const logger = createDebugLogger(context);
  logger.info(category, message, data);
};

// Default export for easy importing
export default DebugLogger;
