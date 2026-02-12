/**
 * Pure validation functions for GitHub issue mutations.
 * No I/O, no side effects — safe for use in both main and renderer processes.
 */
import {
  TITLE_MAX_LENGTH,
  BODY_MAX_LENGTH,
  LABEL_PATTERN,
  GITHUB_LOGIN_PATTERN,
} from '../constants/mutations';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateTitle(title: string): ValidationResult {
  if (!title.trim()) {
    return { valid: false, error: 'Title cannot be empty' };
  }
  if (title.length > TITLE_MAX_LENGTH) {
    return { valid: false, error: `Title exceeds ${TITLE_MAX_LENGTH} characters` };
  }
  return { valid: true };
}

export function validateBody(body: string | null): ValidationResult {
  if (body === null) {
    return { valid: true };
  }
  if (body.length > BODY_MAX_LENGTH) {
    return { valid: false, error: `Body exceeds ${BODY_MAX_LENGTH} characters` };
  }
  return { valid: true };
}

export function validateLabel(label: string): ValidationResult {
  if (!label.trim()) {
    return { valid: false, error: 'Label cannot be empty' };
  }
  if (!LABEL_PATTERN.test(label)) {
    return { valid: false, error: 'Label contains invalid characters' };
  }
  return { valid: true };
}

export function validateLogin(login: string): ValidationResult {
  if (!login) {
    return { valid: false, error: 'Login cannot be empty' };
  }
  if (!GITHUB_LOGIN_PATTERN.test(login)) {
    return { valid: false, error: 'Login contains invalid characters' };
  }
  return { valid: true };
}

export function validateIssueNumber(issueNumber: number): ValidationResult {
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    return { valid: false, error: 'Issue number must be a positive integer' };
  }
  return { valid: true };
}
