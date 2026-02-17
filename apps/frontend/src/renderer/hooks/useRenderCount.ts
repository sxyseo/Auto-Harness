import { useRef, useEffect } from 'react';

/**
 * Hook to track component render count for performance monitoring (dev only).
 * Usage: useRenderCount('GitHubIssues', 5000);
 */
export function useRenderCount(componentName: string, logInterval = 100) {
  const renderCount = useRef(0);
  const lastLogTime = useRef(Date.now());

  // Always increment (minimal overhead)
  renderCount.current += 1;

  useEffect(() => {
    // Only log in development
    if (import.meta.env.PROD) {
      return;
    }

    const now = Date.now();
    const elapsed = now - lastLogTime.current;

    if (elapsed >= logInterval) {
      console.log(
        `[Performance] ${componentName} rendered ${renderCount.current} times in ${elapsed}ms ` +
        `(${Math.round(renderCount.current / (elapsed / 1000))} renders/sec)`
      );
      renderCount.current = 0;
      lastLogTime.current = now;
    }
  });

  return renderCount.current;
}
