import { useCallback } from 'react';
import { useProjectStore } from '../../../stores/project-store';
import { usePhase4Store } from '../../../stores/github/phase4-store';
import type { MetricsTimeWindow } from '../../../../shared/types/metrics';

export function useMetrics() {
  const projectId = useProjectStore((s) => s.activeProject?.id ?? null);
  const metrics = usePhase4Store((s) => s.metrics);
  const timeWindow = usePhase4Store((s) => s.metricsTimeWindow);
  const isLoading = usePhase4Store((s) => s.metricsLoading);
  const error = usePhase4Store((s) => s.metricsError);

  const store = usePhase4Store;

  const computeMetrics = useCallback(async (overrideWindow?: MetricsTimeWindow) => {
    if (!projectId) return;

    const tw = overrideWindow ?? timeWindow;
    if (overrideWindow) {
      store.getState().setMetricsTimeWindow(tw);
    }

    store.getState().setMetricsLoading(true);
    try {
      const result = await globalThis.window.electronAPI.github.computeMetrics(projectId, tw);
      store.getState().setMetrics(result);
    } catch (err) {
      store.getState().setMetricsError(
        err instanceof Error ? err.message : 'Failed to compute metrics',
      );
    }
  }, [projectId, timeWindow]);

  const setTimeWindow = useCallback((tw: MetricsTimeWindow) => {
    store.getState().setMetricsTimeWindow(tw);
    // Auto-recompute on window change
    if (projectId) {
      store.getState().setMetricsLoading(true);
      globalThis.window.electronAPI.github.computeMetrics(projectId, tw)
        .then((result) => store.getState().setMetrics(result))
        .catch((err: unknown) => store.getState().setMetricsError(
          err instanceof Error ? err.message : 'Failed to compute metrics',
        ));
    }
  }, [projectId]);

  return {
    metrics,
    timeWindow,
    isLoading,
    error,
    computeMetrics,
    setTimeWindow,
  };
}
