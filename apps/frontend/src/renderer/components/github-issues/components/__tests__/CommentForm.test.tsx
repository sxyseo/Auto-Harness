/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommentForm } from '../CommentForm';

describe('CommentForm', () => {
  it('renders textarea', () => {
    render(<CommentForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Comment' })).toBeDefined();
  });

  it('empty submit shows error', () => {
    render(<CommentForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Comment cannot be empty')).toBeDefined();
  });

  it('submit with text fires onSubmit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CommentForm onSubmit={onSubmit} />);

    const textarea = screen.getByRole('textbox', { name: 'Comment' });
    fireEvent.change(textarea, { target: { value: 'Nice work!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('Nice work!');
    });
  });

  it('aria-label on textarea', () => {
    render(<CommentForm onSubmit={vi.fn()} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea.getAttribute('aria-label')).toBe('Comment');
  });

  it('submitting shows loading state', () => {
    render(<CommentForm onSubmit={vi.fn()} isSubmitting />);
    expect(screen.getByText('Submitting...')).toBeDefined();
  });

  it('after success, textarea clears', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CommentForm onSubmit={onSubmit} />);

    const textarea = screen.getByRole('textbox', {
      name: 'Comment',
    }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'A comment' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('A comment');
    });

    await waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });
});
