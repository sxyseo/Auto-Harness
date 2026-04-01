/**
 * App language tracking module for main process.
 *
 * Tracks the user's in-app language setting (not OS locale) for use in
 * main process code that needs localized strings (e.g., context menus).
 *
 * Updated via IPC when user changes language in settings.
 *
 * IMPORTANT: This module must NOT import electron directly, as it will be
 * bundled into worker threads where electron APIs are not available.
 */

// Current app language, defaults to 'en'
// Updated via setAppLanguage() when renderer notifies of language change
let currentAppLanguage = 'en';

/**
 * Get the current app language.
 * Falls back to 'en' if not set.
 */
export function getAppLanguage(): string {
  return currentAppLanguage;
}

/**
 * Set the current app language.
 * Called by IPC handler when renderer changes language.
 */
export function setAppLanguage(language: string): void {
  currentAppLanguage = language;
}

/**
 * Initialize app language from OS locale as a starting point.
 * The renderer will update this once i18n initializes.
 *
 * This function is safe to call in any context (main process, worker thread, etc).
 * In worker contexts, it simply keeps the default 'en' language.
 */
export function initAppLanguage(): void {
  // Do NOT import electron here - keep this module worker-thread safe
  // The renderer will set the correct language via IPC anyway
  // In main process, language will be initialized separately
  currentAppLanguage = 'en';
}
