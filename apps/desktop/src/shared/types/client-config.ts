/**
 * Multi-client orchestration configuration types
 * Support for external CLI clients and phase-to-client mapping
 */

import type { BuiltinProvider } from './provider-account';

/**
 * Reference to a client (provider or external CLI)
 */
export type ClientReference = ProviderClientReference | ExternalClientReference;

/**
 * Reference to a provider-based AI client
 */
export interface ProviderClientReference {
  type: 'provider';
  provider: BuiltinProvider;
  modelId: string;
}

/**
 * Reference to an external CLI client
 */
export interface ExternalClientReference {
  type: 'cli';
  cliId: string; // References ExternalClientConfig.id
}

/**
 * External CLI client configuration
 */
export interface ExternalClientConfig {
  id: string;
  name: string;
  type: 'codex' | 'claude-code' | 'custom';
  executable: string;
  args?: string[];
  env?: Record<string, string>;
  capabilities: {
    supportsTools: boolean;
    supportsThinking: boolean;
    supportsStreaming: boolean;
    supportsVision: boolean;
    maxTokens?: number;
  };
  yoloMode?: boolean; // YOLO mode: skip all safety prompts
  description?: string;
}

/**
 * Pipeline phase identifiers
 */
export type PipelinePhase = 'spec' | 'planning' | 'coding' | 'qa';

/**
 * Mapping of pipeline phases to clients
 */
export interface PhaseClientMapping {
  spec: ClientReference;
  planning: ClientReference;
  coding: ClientReference;
  qa: ClientReference;
}
