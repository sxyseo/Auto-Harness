/**
 * Client Configuration Resolver
 * =============================
 *
 * Resolves which AI client to use for a given phase based on multi-client settings.
 *
 * When multi-client mode is enabled, supports:
 * - Provider-based clients (Anthropic, OpenAI, etc.)
 * - External CLI clients (CodeX, Claude Code CLI, custom CLIs)
 *
 * The build orchestrator and agent worker use this to determine whether to:
 * - Use the internal Vercel AI SDK implementation (provider clients)
 * - Spawn an external CLI process (codex, claude-code, etc.)
 */

import type { ProviderAccount } from '../../../shared/types/provider-account';
import type { PhaseClientMapping, ExternalClientConfig, PipelinePhase } from '../../../shared/types/client-config';
import type { AppSettings } from '../../../shared/types/settings';

// =============================================================================
// Types
// =============================================================================

/**
 * Resolved client for a phase
 */
export interface ResolvedPhaseClient {
  /** Client type */
  type: 'provider' | 'cli';
  /** Provider account (if type is 'provider') */
  providerAccount?: ProviderAccount;
  /** Model ID (if type is 'provider') */
  modelId?: string;
  /** External CLI config (if type is 'cli') */
  externalClient?: ExternalClientConfig;
  /** Whether this is the default fallback (no explicit mapping configured) */
  isDefault: boolean;
}

/**
 * Resolution options
 */
export interface ClientResolutionOptions {
  /** Current app settings (contains multi-client config) */
  settings: Pick<AppSettings, 'multiClientEnabled' | 'phaseClientMapping' | 'externalCliClients'>;
  /** Provider queue (for provider-based resolution) */
  providerQueue?: ProviderAccount[];
  /** Default model ID to use if multi-client is disabled */
  defaultModelId: string;
}

// =============================================================================
// Client Resolution
// =============================================================================

/**
 * Resolve the client to use for a given pipeline phase.
 *
 * Resolution logic:
 * 1. If multi-client mode is disabled → use default provider
 * 2. If phase is mapped in phaseClientMapping:
 *    - Provider reference → resolve from apiProfiles
 *    - CLI reference → resolve from externalCliClients
 * 3. If no mapping exists → use default provider
 */
export function resolvePhaseClient(
  phase: PipelinePhase,
  options: ClientResolutionOptions,
): ResolvedPhaseClient {
  const { settings, providerQueue, defaultModelId } = options;

  // Multi-client mode disabled → use default provider
  if (!settings.multiClientEnabled) {
    return resolveDefaultProvider(providerQueue, defaultModelId);
  }

  // No phase mapping configured → use default provider
  if (!settings.phaseClientMapping) {
    return resolveDefaultProvider(providerQueue, defaultModelId);
  }

  const clientRef = settings.phaseClientMapping[phase];
  if (!clientRef) {
    return resolveDefaultProvider(providerQueue, defaultModelId);
  }

  // Resolve based on reference type
  if (clientRef.type === 'provider') {
    return resolveProviderClient(clientRef, providerQueue);
  } else if (clientRef.type === 'cli') {
    return resolveExternalClient(clientRef, settings.externalCliClients ?? []);
  }

  // Fallback to default
  return resolveDefaultProvider(providerQueue, defaultModelId);
}

/**
 * Resolve a provider-based client from the reference
 */
function resolveProviderClient(
  clientRef: { type: 'provider'; provider: string; modelId: string },
  providerQueue: ProviderAccount[] | undefined,
): ResolvedPhaseClient {
  // Try to find matching profile in provider queue
  const queued = providerQueue?.find(p => p.provider === clientRef.provider);

  if (queued) {
    return {
      type: 'provider',
      providerAccount: queued,
      modelId: clientRef.modelId,
      isDefault: false,
    };
  }

  // Not found - this is an error state, but return what we have
  return {
    type: 'provider',
    providerAccount: undefined,
    modelId: clientRef.modelId,
    isDefault: false,
  };
}

/**
 * Resolve an external CLI client from the reference
 */
function resolveExternalClient(
  clientRef: { type: 'cli'; cliId: string },
  externalClients: ExternalClientConfig[],
): ResolvedPhaseClient {
  const client = externalClients.find(c => c.id === clientRef.cliId);

  if (!client) {
    // CLI client not found - this is an error state
    return {
      type: 'cli',
      externalClient: undefined,
      isDefault: false,
    };
  }

  return {
    type: 'cli',
    externalClient: client,
    isDefault: false,
  };
}

/**
 * Resolve the default provider (used when multi-client is disabled or no mapping exists)
 */
function resolveDefaultProvider(
  providerQueue: ProviderAccount[] | undefined,
  defaultModelId: string,
): ResolvedPhaseClient {
  // Use first available from queue
  if (providerQueue && providerQueue.length > 0) {
    return {
      type: 'provider',
      providerAccount: providerQueue[0],
      modelId: defaultModelId,
      isDefault: true,
    };
  }

  // No queue available - still return a provider reference
  // The caller will need to handle credential resolution
  return {
    type: 'provider',
    providerAccount: undefined,
    modelId: defaultModelId,
    isDefault: true,
  };
}

/**
 * Check if a resolved client is an external CLI
 */
export function isExternalCliClient(client: ResolvedPhaseClient): client is ResolvedPhaseClient & { type: 'cli'; externalClient: ExternalClientConfig } {
  return client.type === 'cli' && client.externalClient !== undefined;
}

/**
 * Check if a resolved client is a provider
 */
export function isProviderClient(client: ResolvedPhaseClient): client is ResolvedPhaseClient & { type: 'provider' } {
  return client.type === 'provider';
}
