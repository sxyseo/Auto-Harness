export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Re-export GitHub error parser utilities
export {
  parseGitHubError,
  isRateLimitError,
  isAuthError,
  isNetworkError,
  isRecoverableError,
  requiresSettingsAction,
} from './github-error-parser';
