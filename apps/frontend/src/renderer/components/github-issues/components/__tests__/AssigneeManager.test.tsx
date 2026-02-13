/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssigneeManager } from '../AssigneeManager';

const collaborators = ['alice', 'bob', 'charlie'];

describe('AssigneeManager', () => {
  it('renders current assignees', () => {
    render(
      <AssigneeManager
        currentAssignees={[
          { login: 'alice', avatarUrl: 'https://example.com/alice.png' },
          { login: 'bob' },
        ]}
        collaborators={collaborators}
        onAddAssignee={vi.fn()}
        onRemoveAssignee={vi.fn()}
      />,
    );
    expect(screen.getByText('alice')).toBeDefined();
    expect(screen.getByText('bob')).toBeDefined();
  });

  it('remove button fires onRemoveAssignee', () => {
    const onRemoveAssignee = vi.fn();
    render(
      <AssigneeManager
        currentAssignees={[{ login: 'alice' }]}
        collaborators={collaborators}
        onAddAssignee={vi.fn()}
        onRemoveAssignee={onRemoveAssignee}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove assignee alice' }),
    );
    expect(onRemoveAssignee).toHaveBeenCalledWith('alice');
  });

  it('assign button opens dropdown', () => {
    render(
      <AssigneeManager
        currentAssignees={[]}
        collaborators={collaborators}
        onAddAssignee={vi.fn()}
        onRemoveAssignee={vi.fn()}
      />,
    );
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    expect(screen.getByRole('listbox')).toBeDefined();
  });

  it('selecting fires onAddAssignee', () => {
    const onAddAssignee = vi.fn();
    render(
      <AssigneeManager
        currentAssignees={[]}
        collaborators={collaborators}
        onAddAssignee={onAddAssignee}
        onRemoveAssignee={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    fireEvent.click(screen.getByText('alice'));
    expect(onAddAssignee).toHaveBeenCalledWith('alice');
  });

  it('Enter key on option fires onAddAssignee', () => {
    const onAddAssignee = vi.fn();
    render(
      <AssigneeManager
        currentAssignees={[]}
        collaborators={collaborators}
        onAddAssignee={onAddAssignee}
        onRemoveAssignee={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    const option = screen.getByRole('option', { name: /alice/ });
    fireEvent.keyDown(option, { key: 'Enter' });
    expect(onAddAssignee).toHaveBeenCalledWith('alice');
  });

  it('Space key on option fires onAddAssignee', () => {
    const onAddAssignee = vi.fn();
    render(
      <AssigneeManager
        currentAssignees={[]}
        collaborators={collaborators}
        onAddAssignee={onAddAssignee}
        onRemoveAssignee={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    const option = screen.getByRole('option', { name: /alice/ });
    fireEvent.keyDown(option, { key: ' ' });
    expect(onAddAssignee).toHaveBeenCalledWith('alice');
  });

  it('Escape key closes dropdown', () => {
    render(
      <AssigneeManager
        currentAssignees={[]}
        collaborators={collaborators}
        onAddAssignee={vi.fn()}
        onRemoveAssignee={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    expect(screen.getByRole('listbox')).toBeDefined();
    const option = screen.getByRole('option', { name: /alice/ });
    fireEvent.keyDown(option, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Enter key does not fire onAddAssignee for already-assigned user', () => {
    const onAddAssignee = vi.fn();
    render(
      <AssigneeManager
        currentAssignees={[{ login: 'alice' }]}
        collaborators={collaborators}
        onAddAssignee={onAddAssignee}
        onRemoveAssignee={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    const option = screen.getByRole('option', { selected: true });
    fireEvent.keyDown(option, { key: 'Enter' });
    expect(onAddAssignee).not.toHaveBeenCalled();
  });

  it('aria-label present on container', () => {
    const { container } = render(
      <AssigneeManager
        currentAssignees={[]}
        collaborators={collaborators}
        onAddAssignee={vi.fn()}
        onRemoveAssignee={vi.fn()}
      />,
    );
    const el = container.querySelector('[aria-label="Assignee manager"]');
    expect(el).not.toBeNull();
  });
});
