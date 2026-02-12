import { describe, it, expect } from 'vitest';
import {
  validateTitle,
  validateBody,
  validateLabel,
  validateLogin,
  validateIssueNumber,
} from '../utils/mutation-validation';
import {
  TITLE_MAX_LENGTH,
  BODY_MAX_LENGTH,
} from '../constants/mutations';

// ============================================
// validateTitle
// ============================================

describe('validateTitle', () => {
  it('rejects empty string', () => {
    const result = validateTitle('');
    expect(result).toEqual({ valid: false, error: 'Title cannot be empty' });
  });

  it('rejects whitespace-only string', () => {
    const result = validateTitle('   \t\n  ');
    expect(result).toEqual({ valid: false, error: 'Title cannot be empty' });
  });

  it('accepts title at max length (256 chars)', () => {
    const title = 'a'.repeat(TITLE_MAX_LENGTH);
    const result = validateTitle(title);
    expect(result).toEqual({ valid: true });
  });

  it('rejects title exceeding max length (257 chars)', () => {
    const title = 'a'.repeat(TITLE_MAX_LENGTH + 1);
    const result = validateTitle(title);
    expect(result).toEqual({
      valid: false,
      error: `Title exceeds ${TITLE_MAX_LENGTH} characters`,
    });
  });

  it('accepts normal string', () => {
    const result = validateTitle('Fix login bug on Windows');
    expect(result).toEqual({ valid: true });
  });

  it('accepts string with special chars (GitHub handles escaping)', () => {
    expect(validateTitle('<script>alert(1)</script>')).toEqual({ valid: true });
    expect(validateTitle('"quotes" and \'quotes\'')).toEqual({ valid: true });
  });
});

// ============================================
// validateBody
// ============================================

describe('validateBody', () => {
  it('accepts null (clearing body is allowed)', () => {
    const result = validateBody(null);
    expect(result).toEqual({ valid: true });
  });

  it('accepts empty string', () => {
    const result = validateBody('');
    expect(result).toEqual({ valid: true });
  });

  it('accepts body at max length (65536 chars)', () => {
    const body = 'x'.repeat(BODY_MAX_LENGTH);
    const result = validateBody(body);
    expect(result).toEqual({ valid: true });
  });

  it('rejects body exceeding max length (65537 chars)', () => {
    const body = 'x'.repeat(BODY_MAX_LENGTH + 1);
    const result = validateBody(body);
    expect(result).toEqual({
      valid: false,
      error: `Body exceeds ${BODY_MAX_LENGTH} characters`,
    });
  });

  it('accepts normal markdown content', () => {
    const body = '## Description\n\nThis is a **bug** report.\n\n```js\nconsole.log("hello");\n```';
    const result = validateBody(body);
    expect(result).toEqual({ valid: true });
  });
});

// ============================================
// validateLabel
// ============================================

describe('validateLabel', () => {
  it('accepts simple label', () => {
    expect(validateLabel('bug')).toEqual({ valid: true });
  });

  it('accepts label with colon separator', () => {
    expect(validateLabel('priority:high')).toEqual({ valid: true });
  });

  it('accepts label with slash', () => {
    expect(validateLabel('auto-claude/triage')).toEqual({ valid: true });
  });

  it('accepts label with dots', () => {
    expect(validateLabel('v2.0.0')).toEqual({ valid: true });
  });

  it('accepts label with spaces', () => {
    expect(validateLabel('good first issue')).toEqual({ valid: true });
  });

  it('rejects label with semicolons', () => {
    const result = validateLabel('invalid;label');
    expect(result).toEqual({
      valid: false,
      error: 'Label contains invalid characters',
    });
  });

  it('rejects label with angle brackets', () => {
    expect(validateLabel('label<script>').valid).toBe(false);
  });

  it('rejects empty string', () => {
    const result = validateLabel('');
    expect(result).toEqual({
      valid: false,
      error: 'Label cannot be empty',
    });
  });

  it('rejects whitespace-only label', () => {
    const result = validateLabel('   ');
    expect(result).toEqual({
      valid: false,
      error: 'Label cannot be empty',
    });
  });
});

// ============================================
// validateLogin
// ============================================

describe('validateLogin', () => {
  it('accepts simple username', () => {
    expect(validateLogin('octocat')).toEqual({ valid: true });
  });

  it('accepts username with hyphens', () => {
    expect(validateLogin('user-name')).toEqual({ valid: true });
  });

  it('accepts single character username', () => {
    expect(validateLogin('a')).toEqual({ valid: true });
  });

  it('rejects username starting with hyphen', () => {
    const result = validateLogin('-invalid');
    expect(result).toEqual({
      valid: false,
      error: 'Login contains invalid characters',
    });
  });

  it('rejects username with consecutive hyphens', () => {
    const result = validateLogin('user--name');
    expect(result).toEqual({
      valid: false,
      error: 'Login contains invalid characters',
    });
  });

  it('rejects username exceeding 39 chars', () => {
    const login = 'a'.repeat(40);
    const result = validateLogin(login);
    expect(result).toEqual({
      valid: false,
      error: 'Login contains invalid characters',
    });
  });

  it('accepts username at max length (39 chars)', () => {
    const login = 'a'.repeat(39);
    expect(validateLogin(login)).toEqual({ valid: true });
  });

  it('rejects empty string', () => {
    const result = validateLogin('');
    expect(result).toEqual({
      valid: false,
      error: 'Login cannot be empty',
    });
  });
});

// ============================================
// validateIssueNumber
// ============================================

describe('validateIssueNumber', () => {
  it('accepts positive integer', () => {
    expect(validateIssueNumber(1)).toEqual({ valid: true });
  });

  it('accepts large positive integer', () => {
    expect(validateIssueNumber(99999)).toEqual({ valid: true });
  });

  it('rejects zero', () => {
    const result = validateIssueNumber(0);
    expect(result).toEqual({
      valid: false,
      error: 'Issue number must be a positive integer',
    });
  });

  it('rejects negative number', () => {
    const result = validateIssueNumber(-1);
    expect(result).toEqual({
      valid: false,
      error: 'Issue number must be a positive integer',
    });
  });

  it('rejects float', () => {
    const result = validateIssueNumber(1.5);
    expect(result).toEqual({
      valid: false,
      error: 'Issue number must be a positive integer',
    });
  });

  it('rejects NaN', () => {
    const result = validateIssueNumber(Number.NaN);
    expect(result).toEqual({
      valid: false,
      error: 'Issue number must be a positive integer',
    });
  });
});
