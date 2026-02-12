import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';

interface CommentFormProps {
  onSubmit: (body: string) => Promise<void>;
  isSubmitting?: boolean;
  disabled?: boolean;
}

export function CommentForm({
  onSubmit,
  isSubmitting,
  disabled,
}: CommentFormProps) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (body.trim() === '') {
      setError('Comment cannot be empty');
      return;
    }

    setError(null);
    await onSubmit(body);
    setBody('');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          if (error) setError(null);
        }}
        placeholder="Write a comment..."
        rows={3}
        disabled={disabled || isSubmitting}
        aria-label="Comment"
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
      />
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="sm"
        disabled={disabled || isSubmitting}
        className="gap-1.5"
      >
        {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {isSubmitting ? 'Submitting...' : 'Comment'}
      </Button>
    </form>
  );
}
