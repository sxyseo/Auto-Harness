/**
 * Provider Factory
 *
 * Creates Vercel AI SDK provider instances from configuration.
 * Maps provider names to the correct @ai-sdk/* constructor and handles
 * per-provider options (thinking tokens, strict JSON, Azure deployments).
 *
 * See apps/desktop/src/main/ai/providers/factory.ts for the TypeScript implementation.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createAzure } from '@ai-sdk/azure';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createXai } from '@ai-sdk/xai';
import type { LanguageModel } from 'ai';

import { MODEL_PROVIDER_MAP } from '../config/types';
import { type ProviderConfig, SupportedProvider } from './types';

// =============================================================================
// OAuth Token Detection
// =============================================================================

/**
 * Detects if a credential is an Anthropic OAuth token vs an API key.
 * OAuth access tokens start with 'sk-ant-oa' prefix.
 * API keys start with 'sk-ant-api' prefix.
 */
function isOAuthToken(token: string | undefined): boolean {
  if (!token) return false;
  return token.startsWith('sk-ant-oa') || token.startsWith('sk-ant-ort');
}

// =============================================================================
// Codex OAuth Fetch Interceptor
// =============================================================================

/**
 * Creates a custom fetch function for Codex OAuth.
 * Strips the dummy API key, injects the real OAuth token,
 * and rewrites the URL to the Codex API endpoint.
 */
function createCodexFetch(): typeof globalThis.fetch {
  const debug = process.env.DEBUG === 'true' || process.argv.includes('--debug');

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Dynamic import to avoid loading Electron APIs at module level
    const { ensureValidCodexToken } = await import('../auth/codex-oauth');

    // 1. Get valid OAuth token
    const token = await ensureValidCodexToken();
    if (!token) {
      throw new Error('Codex OAuth: No valid token available. Please re-authenticate.');
    }

    // 2. Build headers — strip dummy Authorization, inject real token
    const headers = new Headers(init?.headers);
    headers.delete('authorization');
    headers.delete('Authorization');
    headers.set('Authorization', `Bearer ${token}`);

    // 3. Rewrite URL to Codex endpoint
    const CODEX_API_ENDPOINT = 'https://chatgpt.com/backend-api/codex/responses';
    let url: string;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input instanceof Request) {
      url = input.url;
    } else {
      url = String(input);
    }

    const originalUrl = url;
    const parsedUrl = new URL(url);
    if (parsedUrl.pathname.includes('/chat/completions') || parsedUrl.pathname.includes('/v1/responses')) {
      url = CODEX_API_ENDPOINT;
    }

    if (debug) {
      console.log(`[CodexFetch] ${originalUrl} → ${url} (token: ${token.slice(0, 10)}...)`);
    }

    return globalThis.fetch(url, {
      ...init,
      headers,
    });
  };
}

// =============================================================================
// Provider Instance Creators
// =============================================================================

/**
 * Creates a provider SDK instance (not a model) for the given config.
 * Each provider has its own constructor with different auth options.
 */
function createProviderInstance(config: ProviderConfig) {
  const { provider, apiKey, baseURL, headers } = config;

  switch (provider) {
    case SupportedProvider.Anthropic: {
      // OAuth tokens use authToken (Authorization: Bearer) + required beta header
      // API keys use apiKey (x-api-key header)
      if (isOAuthToken(apiKey)) {
        return createAnthropic({
          authToken: apiKey,
          baseURL,
          headers: {
            ...headers,
            'anthropic-beta': 'claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14',
          },
        });
      }
      return createAnthropic({
        apiKey,
        baseURL,
        headers,
      });
    }

    case SupportedProvider.OpenAI: {
      // Codex OAuth: use custom fetch to inject token + rewrite URL
      if (config.codexOAuth) {
        return createOpenAI({
          apiKey: apiKey ?? 'codex-oauth-placeholder',
          baseURL,
          headers,
          fetch: createCodexFetch(),
        });
      }
      return createOpenAI({
        apiKey,
        baseURL,
        headers,
      });
    }

    case SupportedProvider.Google:
      return createGoogleGenerativeAI({
        apiKey,
        baseURL,
        headers,
      });

    case SupportedProvider.Bedrock:
      return createAmazonBedrock({
        region: config.region ?? 'us-east-1',
        apiKey,
      });

    case SupportedProvider.Azure:
      return createAzure({
        apiKey,
        baseURL,
        headers,
      });

    case SupportedProvider.Mistral:
      return createMistral({
        apiKey,
        baseURL,
        headers,
      });

    case SupportedProvider.Groq:
      return createGroq({
        apiKey,
        baseURL,
        headers,
      });

    case SupportedProvider.XAI:
      return createXai({
        apiKey,
        baseURL,
        headers,
      });

    case SupportedProvider.Ollama:
      return createOpenAICompatible({
        name: 'ollama',
        apiKey: apiKey ?? 'ollama',
        baseURL: baseURL ?? 'http://localhost:11434/v1',
        headers,
      });

    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unsupported provider: ${_exhaustive}`);
    }
  }
}

// =============================================================================
// Model Creation Options
// =============================================================================

/** Options for creating a language model */
export interface CreateProviderOptions {
  /** Provider configuration */
  config: ProviderConfig;
  /** Full model ID (e.g., 'claude-sonnet-4-5-20250929') */
  modelId: string;
}

// =============================================================================
// Provider Factory
// =============================================================================

/**
 * Creates a LanguageModel instance for the given provider + model combination.
 *
 * Handles per-provider quirks:
 * - Azure uses deployment-based routing via `.chat()`
 * - Ollama uses OpenAI-compatible adapter
 *
 * @param options - Provider config and model ID
 * @returns A configured LanguageModel instance
 */
export function createProvider(options: CreateProviderOptions): LanguageModel {
  const { config, modelId } = options;
  const instance = createProviderInstance(config);

  // Azure uses deployment names, not model IDs
  if (config.provider === SupportedProvider.Azure) {
    const deploymentName = config.deploymentName ?? modelId;
    return (instance as ReturnType<typeof createAzure>).chat(deploymentName);
  }

  // OpenAI uses .chat() for chat models
  if (config.provider === SupportedProvider.OpenAI) {
    return (instance as ReturnType<typeof createOpenAI>).chat(modelId);
  }

  // Generic path: call provider instance as function with model ID
  return (instance as ReturnType<typeof createAnthropic>)(modelId);
}

// =============================================================================
// Provider Detection
// =============================================================================

/**
 * Detects the provider for a model ID based on its prefix.
 * Uses MODEL_PROVIDER_MAP for prefix-based matching.
 *
 * @param modelId - Full model ID (e.g., 'claude-sonnet-4-5-20250929', 'gpt-4o')
 * @returns The detected provider, or undefined if no match
 */
export function detectProviderFromModel(modelId: string): SupportedProvider | undefined {
  for (const [prefix, provider] of Object.entries(MODEL_PROVIDER_MAP)) {
    if (modelId.startsWith(prefix)) {
      return provider;
    }
  }
  return undefined;
}

/**
 * Creates a LanguageModel from a model ID, auto-detecting the provider.
 * Useful when only a model ID is known (e.g., from user settings).
 *
 * @param modelId - Full model ID
 * @param overrides - Optional provider config overrides (apiKey, baseURL, etc.)
 * @returns A configured LanguageModel instance
 * @throws If the provider cannot be detected from the model ID
 */
export function createProviderFromModelId(
  modelId: string,
  overrides?: Partial<Omit<ProviderConfig, 'provider'>>,
): LanguageModel {
  const provider = detectProviderFromModel(modelId);
  if (!provider) {
    throw new Error(
      `Cannot detect provider for model "${modelId}". ` +
        `Known prefixes: ${Object.keys(MODEL_PROVIDER_MAP).join(', ')}`,
    );
  }

  return createProvider({
    config: {
      provider,
      ...overrides,
    },
    modelId,
  });
}
