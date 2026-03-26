import { Card, CardContent } from './ui/card';
import { Skeleton } from './ui/skeleton';
import { cn } from '../lib/utils';

interface TaskCardSkeletonProps {
  /** Whether to show the description skeleton lines */
  showDescription?: boolean;
  /** Whether to show the progress section skeleton */
  showProgress?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * TaskCardSkeleton - Loading placeholder for TaskCard component
 * Matches the exact layout structure of TaskCard for seamless loading states
 */
export function TaskCardSkeleton({
  showDescription = true,
  showProgress = true,
  className,
}: TaskCardSkeletonProps) {
  return (
    <Card className={cn('card-surface task-card-enhanced cursor-pointer', className)}>
      <CardContent className="p-4">
        {/* Title - matches h3 with line-clamp-2 */}
        <Skeleton className="h-10 w-full" />

        {/* Description - matches p with mt-2, line-clamp-2 */}
        {showDescription && (
          <>
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="mt-1 h-4 w-3/4" />
          </>
        )}

        {/* Metadata badges - matches mt-2.5 flex flex-wrap gap-1.5 */}
        <div className={cn('flex flex-wrap gap-1.5', showDescription ? 'mt-2.5' : 'mt-3')}>
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>

        {/* Progress section - matches mt-4 */}
        {showProgress && (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        )}

        {/* Footer - matches mt-4 flex items-center justify-between */}
        <div className="mt-4 flex items-center justify-between">
          {/* Time - matches Clock icon + span */}
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-3 w-3 rounded-sm" />
            <Skeleton className="h-3 w-16" />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-7 w-16 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
