/**
 * Tests for unified OAuth + API profile swap logic (Issue #1798)
 *
 * Tests the core changes that wire the unified swap infrastructure into
 * actual execution paths:
 * - getBestAvailableUnifiedAccount() in ClaudeProfileManager
 * - Removal of isAPIProfile gate in UsageMonitor
 * - Spawn-time swap respects active API profile (rate-limit-detector)
 * - Swap cooldown to prevent rapid back-and-forth
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Shared mock state ---
const mockAPIProfiles = [
  {
    id: 'api-glm-1',
    name: 'GLM API',
    baseUrl: 'https://api.z.ai/api/anthropic',
    apiKey: 'sk-glm-key-1'
  },
  {
    id: 'api-anthropic-1',
    name: 'Anthropic API',
    baseUrl: 'https://api.anthropic.com',
    apiKey: 'sk-ant-key-1'
  }
];

const mockLoadProfilesFile = vi.fn(async () => ({
  profiles: [...mockAPIProfiles],
  activeProfileId: null as string | null,
  version: 1
}));

vi.mock('../services/profile/profile-manager', () => ({
  loadProfilesFile: () => mockLoadProfilesFile(),
  setActiveAPIProfile: vi.fn()
}));

// Mock profile-scorer to control availability
vi.mock('../claude-profile/profile-scorer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../claude-profile/profile-scorer')>();
  return {
    ...actual,
    checkProfileAvailability: vi.fn(() => ({ available: true }))
  };
});

// Mock profile-utils with importOriginal to keep CLAUDE_PROFILES_DIR
vi.mock('../claude-profile/profile-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../claude-profile/profile-utils')>();
  return {
    ...actual,
    getEmailFromConfigDir: vi.fn(() => 'test@example.com')
  };
});

// Mock credential-utils
vi.mock('../claude-profile/credential-utils', () => ({
  getCredentialsFromKeychain: vi.fn(() => ({
    token: 'mock-token',
    email: 'test@example.com'
  })),
  clearKeychainCache: vi.fn(),
  normalizeWindowsPath: vi.fn((p: string) => p),
  updateProfileSubscriptionMetadata: vi.fn()
}));

// Mock token-refresh
vi.mock('../claude-profile/token-refresh', () => ({
  refreshOAuthToken: vi.fn(),
  isTokenExpired: vi.fn(() => false),
  getTokenExpirationTime: vi.fn(() => null),
  initializeTokenRefresh: vi.fn(),
  stopTokenRefresh: vi.fn(),
  scheduleTokenRefresh: vi.fn()
}));

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/fake/user-data'),
    getAppPath: vi.fn(() => '/fake/app-path')
  }
}));

// Mock usage-monitor
vi.mock('../claude-profile/usage-monitor', () => ({
  getUsageMonitor: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    start: vi.fn(),
    stop: vi.fn()
  })),
  UsageMonitor: { getInstance: vi.fn() }
}));

import { ClaudeProfileManager } from '../claude-profile-manager';
import { checkProfileAvailability } from '../claude-profile/profile-scorer';

describe('getBestAvailableUnifiedAccount', () => {
  let manager: ClaudeProfileManager;

  const mockAutoSwitchSettings = {
    enabled: true,
    proactiveSwapEnabled: true,
    usageCheckInterval: 30000,
    sessionThreshold: 95,
    weeklyThreshold: 99
  };

  const mockOAuthProfiles = [
    {
      id: 'oauth-1',
      name: 'OAuth Profile 1',
      isAuthenticated: true,
      isDefault: true,
      usage: { sessionUsagePercent: 50, weeklyUsagePercent: 30 }
    },
    {
      id: 'oauth-2',
      name: 'OAuth Profile 2',
      isAuthenticated: true,
      isDefault: false,
      usage: { sessionUsagePercent: 20, weeklyUsagePercent: 10 }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new ClaudeProfileManager();

    // Override internal state
    vi.spyOn(manager, 'getAccountPriorityOrder').mockReturnValue([]);
    vi.spyOn(manager, 'getAutoSwitchSettings').mockReturnValue(mockAutoSwitchSettings as any);
    vi.spyOn(manager, 'getProfilesSortedByAvailability').mockReturnValue(mockOAuthProfiles as any);

    // Default: all profiles available
    vi.mocked(checkProfileAvailability).mockReturnValue({ available: true });

    // Default: API profiles available
    mockLoadProfilesFile.mockResolvedValue({
      profiles: [...mockAPIProfiles],
      activeProfileId: null,
      version: 1
    });
  });

  it('should return OAuth profile when both available and no priority set', async () => {
    const result = await manager.getBestAvailableUnifiedAccount('excluded-id');

    expect(result).not.toBeNull();
    expect(result!.type).toBe('oauth');
    expect(result!.id).toBe('oauth-1');
  });

  it('should return API profile when it has higher priority', async () => {
    vi.spyOn(manager, 'getAccountPriorityOrder').mockReturnValue([
      'api-api-glm-1',    // API first
      'oauth-oauth-1',    // OAuth second
      'oauth-oauth-2'
    ]);

    const result = await manager.getBestAvailableUnifiedAccount('excluded-id');

    expect(result).not.toBeNull();
    expect(result!.type).toBe('api');
    expect(result!.id).toBe('api-glm-1');
    expect(result!.name).toBe('GLM API');
  });

  it('should exclude the specified profile ID', async () => {
    const result = await manager.getBestAvailableUnifiedAccount('oauth-1');

    expect(result).not.toBeNull();
    expect(result!.id).not.toBe('oauth-1');
  });

  it('should exclude additional profile IDs', async () => {
    const result = await manager.getBestAvailableUnifiedAccount('oauth-1', ['oauth-2']);

    // Both OAuth excluded, should fall through to API
    expect(result).not.toBeNull();
    expect(result!.type).toBe('api');
  });

  it('should return null when all profiles are excluded', async () => {
    const result = await manager.getBestAvailableUnifiedAccount(
      'oauth-1',
      ['oauth-2', 'api-glm-1', 'api-anthropic-1']
    );

    expect(result).toBeNull();
  });

  it('should skip API profiles without apiKey', async () => {
    mockLoadProfilesFile.mockResolvedValue({
      profiles: [
        { id: 'api-no-key', name: 'No Key', baseUrl: 'https://example.com', apiKey: '' }
      ],
      activeProfileId: null,
      version: 1
    });

    // Exclude all OAuth
    vi.spyOn(manager, 'getProfilesSortedByAvailability').mockReturnValue([]);

    const result = await manager.getBestAvailableUnifiedAccount();

    expect(result).toBeNull();
  });

  it('should skip unavailable OAuth profiles (rate limited)', async () => {
    // Mock checkProfileAvailability to reject all OAuth profiles
    vi.mocked(checkProfileAvailability).mockReturnValue({
      available: false,
      reason: 'rate limited'
    });

    const result = await manager.getBestAvailableUnifiedAccount();

    // OAuth filtered out, should get API
    expect(result).not.toBeNull();
    expect(result!.type).toBe('api');
  });

  it('should handle API profile loading error gracefully', async () => {
    mockLoadProfilesFile.mockRejectedValue(new Error('File not found'));

    const result = await manager.getBestAvailableUnifiedAccount();

    // Should still return OAuth profile
    expect(result).not.toBeNull();
    expect(result!.type).toBe('oauth');
  });

  it('should sort by priority order correctly with mixed types', async () => {
    vi.spyOn(manager, 'getAccountPriorityOrder').mockReturnValue([
      'oauth-oauth-2',    // OAuth-2 is highest priority
      'api-api-glm-1',    // API second
      'oauth-oauth-1'     // OAuth-1 is lowest
    ]);

    const result = await manager.getBestAvailableUnifiedAccount();

    expect(result).not.toBeNull();
    expect(result!.id).toBe('oauth-2');
    expect(result!.type).toBe('oauth');
  });

  it('should handle empty profiles list', async () => {
    vi.spyOn(manager, 'getProfilesSortedByAvailability').mockReturnValue([]);
    mockLoadProfilesFile.mockResolvedValue({
      profiles: [],
      activeProfileId: null,
      version: 1
    });

    const result = await manager.getBestAvailableUnifiedAccount();

    expect(result).toBeNull();
  });

  it('should include correct priorityIndex in result', async () => {
    vi.spyOn(manager, 'getAccountPriorityOrder').mockReturnValue([
      'api-api-glm-1'
    ]);

    const result = await manager.getBestAvailableUnifiedAccount();

    expect(result).not.toBeNull();
    expect(result!.priorityIndex).toBe(0); // First in priority order
  });

  it('should assign Infinity priorityIndex when not in priority order', async () => {
    vi.spyOn(manager, 'getAccountPriorityOrder').mockReturnValue([]);

    const result = await manager.getBestAvailableUnifiedAccount();

    expect(result).not.toBeNull();
    expect(result!.priorityIndex).toBe(Infinity);
  });

  it('should consider multiple API profiles with correct scoring', async () => {
    vi.spyOn(manager, 'getAccountPriorityOrder').mockReturnValue([
      'api-api-anthropic-1',   // Anthropic API first
      'api-api-glm-1'          // GLM second
    ]);

    // Exclude all OAuth
    vi.spyOn(manager, 'getProfilesSortedByAvailability').mockReturnValue([]);

    const result = await manager.getBestAvailableUnifiedAccount();

    expect(result).not.toBeNull();
    expect(result!.id).toBe('api-anthropic-1');
    expect(result!.type).toBe('api');
    expect(result!.priorityIndex).toBe(0);
  });

  it('should handle both OAuth and API exhausted gracefully', async () => {
    // All OAuth unavailable
    vi.mocked(checkProfileAvailability).mockReturnValue({
      available: false,
      reason: 'rate limited'
    });

    // No API profiles
    mockLoadProfilesFile.mockResolvedValue({
      profiles: [],
      activeProfileId: null,
      version: 1
    });

    const result = await manager.getBestAvailableUnifiedAccount();

    expect(result).toBeNull();
  });

  it('should prefer OAuth when both have same Infinity priority', async () => {
    // No priority order set
    vi.spyOn(manager, 'getAccountPriorityOrder').mockReturnValue([]);

    const result = await manager.getBestAvailableUnifiedAccount('excluded-id');

    // OAuth should come first by default
    expect(result).not.toBeNull();
    expect(result!.type).toBe('oauth');
  });
});

describe('UsageMonitor - isAPIProfile gate removal', () => {
  // Use actual file path since require.resolve doesn't work with mocked modules
  const usageMonitorPath = new URL('../claude-profile/usage-monitor.ts', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

  it('should NOT contain isAPIProfile guard in checkUsageAndSwap swap logic', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(usageMonitorPath, 'utf-8');

    // The old guard "Skipping proactive swap for API profile" should be removed
    expect(source).not.toContain('Skipping proactive swap for API profile');
  });

  it('should NOT contain isAPIProfile guard in handleAuthFailure', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(usageMonitorPath, 'utf-8');

    // The old guard should be removed - handleAuthFailure should work for all profile types
    expect(source).not.toContain('using API profile, skipping swap');
  });

  it('should contain swap cooldown logic', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(usageMonitorPath, 'utf-8');

    // Swap cooldown was added to prevent rapid back-and-forth
    expect(source).toContain('SWAP_COOLDOWN_MS');
    expect(source).toContain('lastSwapTimestamp');
    expect(source).toContain('Swap cooldown active');
  });

  it('should use getBestAvailableUnifiedAccount in performProactiveSwap', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(usageMonitorPath, 'utf-8');

    // performProactiveSwap should use the unified selection instead of inline logic
    expect(source).toContain('getBestAvailableUnifiedAccount');
    // The old inline unified list-building logic should be removed
    expect(source).not.toContain('UnifiedSwapTarget');
  });
});
