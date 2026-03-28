/**
 * Memory Knowledge Graph Integration
 *
 * Provides historical hints from the memory system when available.
 * The memory system is implemented in apps/desktop/src/main/ai/memory/.
 *
 * This module wires the context builder to the RetrievalPipeline for
 * semantic memory retrieval during task planning and execution.
 */

import type { Client } from '@libsql/client';
import type { Memory, UniversalPhase } from '../memory/types';
import { EmbeddingService } from '../memory/embedding-service';
import { RetrievalPipeline } from '../memory/retrieval/pipeline';
import { Reranker } from '../memory/retrieval/reranker';
import { MemoryServiceImpl } from '../memory/memory-service';

// ============================================================
// SINGLETON INITIALIZATION
// ============================================================

let _dbClient: Client | null = null;
let _embeddingService: EmbeddingService | null = null;
let _reranker: Reranker | null = null;
let _retrievalPipeline: RetrievalPipeline | null = null;
let _memoryService: MemoryServiceImpl | null = null;
let _initialized = false;

/**
 * Initialize the memory system with the given database client.
 * Called once at startup by the memory IPC handler.
 */
export async function initializeMemorySystem(db: Client): Promise<void> {
  if (_initialized) return;

  _dbClient = db;

  // Initialize embedding service
  _embeddingService = new EmbeddingService(_dbClient);
  await _embeddingService.initialize();

  // Initialize reranker
  _reranker = new Reranker();
  await _reranker.initialize();

  // Initialize retrieval pipeline
  _retrievalPipeline = new RetrievalPipeline(
    _dbClient,
    _embeddingService,
    _reranker,
  );

  // Initialize memory service
  _memoryService = new MemoryServiceImpl(
    _dbClient,
    _embeddingService,
    _retrievalPipeline,
  );

  _initialized = true;
}

/**
 * Returns whether the memory system is currently enabled.
 * True when the memory system has been initialized with a database client.
 */
export function isMemoryEnabled(): boolean {
  return _initialized && _memoryService !== null;
}

/** @deprecated Use isMemoryEnabled instead */
export const isGraphitiEnabled = isMemoryEnabled;

/**
 * Fetch historical hints for a query from the memory knowledge graph.
 *
 * Uses the retrieval pipeline to perform semantic search across
 * all memory types (patterns, decisions, requirements, etc.) and
 * returns them as contextual hints for the current task.
 *
 * @param query       Task description or search query.
 * @param projectId   Project identifier (typically the project root path).
 * @param maxResults  Maximum number of hints to return (default: 5).
 * @param phase       Optional phase for context packing (default: explore).
 * @returns Array of memory hints formatted as key-value objects.
 */
export async function fetchGraphHints(
  query: string,
  projectId: string,
  maxResults = 5,
  phase: UniversalPhase = 'explore',
): Promise<Record<string, unknown>[]> {
  if (!isMemoryEnabled() || !_retrievalPipeline) {
    return [];
  }

  try {
    const result = await _retrievalPipeline.search(query, {
      phase,
      projectId,
      maxResults,
    });

    return result.memories.map((memory) => formatMemoryAsHint(memory));
  } catch {
    return [];
  }
}

/**
 * Fetch memories for PR review context.
 * Specifically targets error_patterns, decisions, and requirements
 * that are relevant to code review tasks.
 *
 * @param prTitle     PR title or description.
 * @param projectId   Project identifier.
 * @param maxResults  Maximum number of hints to return (default: 8).
 * @returns Array of memory hints formatted as key-value objects.
 */
export async function fetchPRReviewHints(
  prTitle: string,
  projectId: string,
  maxResults = 8,
): Promise<Record<string, unknown>[]> {
  if (!isMemoryEnabled() || !_memoryService) {
    return [];
  }

  try {
    const [errorPatterns, decisions, requirements] = await Promise.all([
      _memoryService.search({
        types: ['error_pattern'],
        projectId,
        limit: Math.ceil(maxResults / 3),
        minConfidence: 0.5,
        excludeDeprecated: true,
      }),
      _memoryService.search({
        types: ['decision'],
        projectId,
        limit: Math.ceil(maxResults / 3),
        excludeDeprecated: true,
      }),
      _memoryService.search({
        types: ['requirement'],
        projectId,
        limit: Math.ceil(maxResults / 3),
        excludeDeprecated: true,
      }),
    ]);

    const memories = [...errorPatterns, ...decisions, ...requirements];
    return memories.slice(0, maxResults).map((memory) => formatMemoryAsHint(memory));
  } catch {
    return [];
  }
}

// ============================================================
// PRIVATE HELPERS
// ============================================================

/**
 * Format a Memory object as a hint record for the context builder.
 * Includes type, content, confidence, and file references.
 */
function formatMemoryAsHint(memory: Memory): Record<string, unknown> {
  return {
    type: memory.type,
    content: memory.content,
    confidence: memory.confidence,
    relatedFiles: memory.relatedFiles,
    relatedModules: memory.relatedModules,
    tags: memory.tags,
    source: memory.source,
    citationText: memory.citationText,
  };
}
