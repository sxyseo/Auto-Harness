/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InlineEditor } from '../InlineEditor';

describe('InlineEditor', () => {
  it('renders display mode with text', () => {
    render(
      <InlineEditor value="Hello world" onSave={vi.fn()} ariaLabel="Title" />,
    );
    expect(screen.getByText('Hello world')).toBeDefined();
  });

  it('click edit button shows input', () => {
    render(
      <InlineEditor value="Hello" onSave={vi.fn()} ariaLabel="Title" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Title' }));
    const input = screen.getByRole('textbox');
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).value).toBe('Hello');
  });

  it('Enter key fires onSave', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <InlineEditor value="Hello" onSave={onSave} ariaLabel="Title" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Title' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Updated' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('Updated');
    });
  });

  it('Escape key reverts to display', () => {
    render(
      <InlineEditor value="Hello" onSave={vi.fn()} ariaLabel="Title" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Title' }));
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Hello')).toBeDefined();
  });

  it('empty + required shows error', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <InlineEditor
        value="Hello"
        onSave={onSave}
        ariaLabel="Title"
        required
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Title' }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText('This field is required')).toBeDefined();
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('character counter appears at threshold', () => {
    render(
      <InlineEditor
        value="Hello"
        onSave={vi.fn()}
        ariaLabel="Title"
        maxLength={20}
        counterThreshold={5}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Title' }));
    expect(screen.getByText('5/20')).toBeDefined();
  });

  it('aria-label on input', () => {
    render(
      <InlineEditor value="Hello" onSave={vi.fn()} ariaLabel="Issue title" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Issue title' }));
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-label')).toBe('Issue title');
  });

  it('disabled disables edit button', () => {
    render(
      <InlineEditor
        value="Hello"
        onSave={vi.fn()}
        ariaLabel="Title"
        disabled
      />,
    );
    const button = screen.getByRole('button', { name: 'Edit Title' });
    expect(button.hasAttribute('disabled')).toBe(true);
  });
});
