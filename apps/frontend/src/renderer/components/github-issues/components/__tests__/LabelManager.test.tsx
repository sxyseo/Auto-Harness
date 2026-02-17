/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { LabelManager } from '../LabelManager';

// Create test i18n instance
const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common'],
  resources: {
    en: {
      common: {
        'labels.manage': 'Label manager',
        'labels.removeNamed': 'Remove label {{name}}',
        'labels.add': 'Add label',
        'labels.filter': 'Filter labels...',
        'labels.available': 'Available labels',
        'labels.noMatch': 'No matching labels'
      }
    }
  }
});

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={testI18n}>{ui}</I18nextProvider>);
}

const repoLabels = [
  { name: 'bug', color: 'fc2929' },
  { name: 'feature', color: '0e8a16' },
  { name: 'docs', color: '0075ca' },
];

describe('LabelManager', () => {
  it('renders current labels', () => {
    renderWithI18n(
      <LabelManager
        currentLabels={['bug', 'feature']}
        repoLabels={repoLabels}
        onAddLabel={vi.fn()}
        onRemoveLabel={vi.fn()}
      />,
    );
    expect(screen.getByText('bug')).toBeDefined();
    expect(screen.getByText('feature')).toBeDefined();
  });

  it('remove button fires onRemoveLabel', () => {
    const onRemoveLabel = vi.fn();
    renderWithI18n(
      <LabelManager
        currentLabels={['bug']}
        repoLabels={repoLabels}
        onAddLabel={vi.fn()}
        onRemoveLabel={onRemoveLabel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove label bug' }));
    expect(onRemoveLabel).toHaveBeenCalledWith('bug');
  });

  it('add button toggles dropdown', () => {
    renderWithI18n(
      <LabelManager
        currentLabels={[]}
        repoLabels={repoLabels}
        onAddLabel={vi.fn()}
        onRemoveLabel={vi.fn()}
      />,
    );
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));
    expect(screen.getByRole('listbox')).toBeDefined();
  });

  it('type-ahead filter works', () => {
    renderWithI18n(
      <LabelManager
        currentLabels={[]}
        repoLabels={repoLabels}
        onAddLabel={vi.fn()}
        onRemoveLabel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));
    const filterInput = screen.getByRole('textbox', { name: 'Filter labels...' });
    fireEvent.change(filterInput, { target: { value: 'doc' } });

    expect(screen.getByText('docs')).toBeDefined();
    expect(screen.queryByText('bug')).toBeNull();
    expect(screen.queryByText('feature')).toBeNull();
  });

  it('selecting fires onAddLabel', () => {
    const onAddLabel = vi.fn();
    renderWithI18n(
      <LabelManager
        currentLabels={[]}
        repoLabels={repoLabels}
        onAddLabel={onAddLabel}
        onRemoveLabel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));
    fireEvent.click(screen.getByText('bug'));
    expect(onAddLabel).toHaveBeenCalledWith('bug');
  });

  it('Enter key on option fires onAddLabel', () => {
    const onAddLabel = vi.fn();
    renderWithI18n(
      <LabelManager
        currentLabels={[]}
        repoLabels={repoLabels}
        onAddLabel={onAddLabel}
        onRemoveLabel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));
    const option = screen.getByRole('option', { name: /bug/ });
    fireEvent.keyDown(option, { key: 'Enter' });
    expect(onAddLabel).toHaveBeenCalledWith('bug');
  });

  it('Space key on option fires onAddLabel', () => {
    const onAddLabel = vi.fn();
    renderWithI18n(
      <LabelManager
        currentLabels={[]}
        repoLabels={repoLabels}
        onAddLabel={onAddLabel}
        onRemoveLabel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));
    const option = screen.getByRole('option', { name: /bug/ });
    fireEvent.keyDown(option, { key: ' ' });
    expect(onAddLabel).toHaveBeenCalledWith('bug');
  });

  it('Escape key closes dropdown', () => {
    renderWithI18n(
      <LabelManager
        currentLabels={[]}
        repoLabels={repoLabels}
        onAddLabel={vi.fn()}
        onRemoveLabel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));
    expect(screen.getByRole('listbox')).toBeDefined();
    const option = screen.getByRole('option', { name: /bug/ });
    fireEvent.keyDown(option, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Enter key does not fire onAddLabel for already-applied label', () => {
    const onAddLabel = vi.fn();
    renderWithI18n(
      <LabelManager
        currentLabels={['bug']}
        repoLabels={repoLabels}
        onAddLabel={onAddLabel}
        onRemoveLabel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));
    const option = screen.getByRole('option', { selected: true });
    fireEvent.keyDown(option, { key: 'Enter' });
    expect(onAddLabel).not.toHaveBeenCalled();
  });

  it('aria-label present on container', () => {
    const { container } = renderWithI18n(
      <LabelManager
        currentLabels={[]}
        repoLabels={repoLabels}
        onAddLabel={vi.fn()}
        onRemoveLabel={vi.fn()}
      />,
    );
    const el = container.querySelector('[aria-label="Label manager"]');
    expect(el).not.toBeNull();
  });
});
