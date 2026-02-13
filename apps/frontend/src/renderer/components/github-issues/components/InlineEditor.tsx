import { useState, useRef, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '../../ui/button';

interface InlineEditorProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  onCancel?: () => void;
  maxLength?: number;
  counterThreshold?: number;
  required?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  multiline?: boolean;
}

export function InlineEditor({
  value,
  onSave,
  onCancel,
  maxLength,
  counterThreshold,
  required,
  disabled,
  ariaLabel,
  multiline,
}: InlineEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  function startEditing() {
    setDraft(value);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setDraft(value);
    setError(null);
    onCancel?.();
  }

  async function save() {
    if (required && draft.trim() === '') {
      setError('This field is required');
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
      setError(null);
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  }

  const showCounter =
    counterThreshold !== undefined && draft.length >= counterThreshold;

  if (!editing) {
    return (
      <div className="flex items-center gap-2 group">
        <span className="text-sm">{value || '\u00A0'}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={startEditing}
          disabled={disabled}
          aria-label={`Edit ${ariaLabel}`}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  const sharedProps = {
    value: draft,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      const newValue = maxLength
        ? e.target.value.slice(0, maxLength)
        : e.target.value;
      setDraft(newValue);
      if (error) setError(null);
    },
    onKeyDown: handleKeyDown,
    'aria-label': ariaLabel,
    maxLength,
    disabled: saving,
    className:
      'w-full rounded-md border border-border bg-card px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
  };

  return (
    <div className="space-y-1">
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          rows={3}
          {...sharedProps}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          {...sharedProps}
        />
      )}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {showCounter && maxLength && (
        <p className="text-xs text-muted-foreground">
          {draft.length}/{maxLength}
        </p>
      )}
    </div>
  );
}
