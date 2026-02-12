import { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';

interface LabelManagerProps {
  currentLabels: string[];
  repoLabels: Array<{ name: string; color: string }>;
  onAddLabel: (label: string) => void;
  onRemoveLabel: (label: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

const MAX_LABELS = 100;

export function LabelManager({
  currentLabels,
  repoLabels,
  onAddLabel,
  onRemoveLabel,
  disabled,
  isLoading,
}: LabelManagerProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');

  const atLimit = currentLabels.length >= MAX_LABELS;

  const filteredLabels = repoLabels.filter((label) =>
    label.name.toLowerCase().includes(search.toLowerCase()),
  );

  function toggleDropdown() {
    setDropdownOpen((prev) => !prev);
    setSearch('');
  }

  return (
    <div className="space-y-2" aria-label="Label manager">
      {/* Current labels */}
      <div className="flex flex-wrap gap-1.5">
        {currentLabels.map((label) => {
          const repoLabel = repoLabels.find((rl) => rl.name === label);
          return (
            <Badge key={label} variant="outline" className="gap-1 text-xs">
              {repoLabel && (
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: `#${repoLabel.color}` }}
                />
              )}
              {label}
              {!disabled && (
                <button
                  type="button"
                  className="ml-0.5 hover:text-destructive"
                  onClick={() => onRemoveLabel(label)}
                  aria-label={`Remove label ${label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          );
        })}
      </div>

      {/* Add label button */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={toggleDropdown}
        disabled={disabled || atLimit || isLoading}
        aria-label="Add label"
      >
        <Plus className="h-3 w-3" />
        Add Label
      </Button>

      {/* Dropdown */}
      {dropdownOpen && (
        <div className="border border-border rounded-md bg-popover shadow-md p-1 max-h-48 overflow-y-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter labels..."
            className="w-full px-2 py-1 text-xs border-b border-border bg-transparent focus:outline-none"
            aria-label="Filter labels"
          />
          <ul role="listbox" aria-label="Available labels">
            {filteredLabels.map((label) => {
              const isApplied = currentLabels.includes(label.name);
              return (
                <li key={label.name} role="option" aria-selected={isApplied}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-accent rounded-sm text-left"
                    onClick={() => {
                      if (!isApplied) {
                        onAddLabel(label.name);
                      }
                    }}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `#${label.color}` }}
                    />
                    <span className="flex-1">{label.name}</span>
                    {isApplied && <Check className="h-3 w-3 text-primary" />}
                  </button>
                </li>
              );
            })}
            {filteredLabels.length === 0 && (
              <li className="px-2 py-1.5 text-xs text-muted-foreground">
                No matching labels
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
