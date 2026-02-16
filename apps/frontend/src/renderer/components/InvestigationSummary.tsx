import React from 'react';
import { useTranslation } from 'react-i18next';
import { useInvestigationData } from '../hooks/useInvestigationData';
import type { InvestigationData } from '@shared/types/investigation';

interface InvestigationSummaryProps {
  taskId: string;
}

export function InvestigationSummary({ taskId }: InvestigationSummaryProps) {
  const { t } = useTranslation(['tasks', 'common']);
  const { investigation, isLoading, error } = useInvestigationData(taskId);

  if (isLoading) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">{t('tasks:investigation.loading')}</div>;
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 dark:text-red-400">
        {t('tasks:investigation.error')}: {error.message}
      </div>
    );
  }

  if (!investigation) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
      <h4 className="font-semibold mb-2 text-sm text-gray-900 dark:text-gray-100">
        {t('tasks:investigation.title')}
      </h4>

      {/* Root Cause */}
      {investigation.rootCause && (
        <div className="mb-3">
          <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('tasks:investigation.rootCause')}
          </h5>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {investigation.rootCause.rootCause}
          </p>
        </div>
      )}

      {/* Recommended Fix */}
      {investigation.fixAdvice && investigation.fixAdvice.suggestedApproaches && investigation.fixAdvice.suggestedApproaches.length > 0 && (
        <div className="mb-3">
          <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('tasks:investigation.recommendedFix')}
          </h5>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {investigation.fixAdvice.suggestedApproaches[0]?.description || ''}
          </p>
        </div>
      )}

      {/* Gotchas/Patterns */}
      {(investigation.fixAdvice?.patternsToFollow && investigation.fixAdvice.patternsToFollow.length > 0) && (
        <div className="mb-3">
          <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('tasks:investigation.patterns')}
          </h5>
          <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside">
            {investigation.fixAdvice.patternsToFollow.map((pattern, index) => (
              <li key={index}>{pattern}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Link to full report */}
      <a
        href={`vscode://file/${investigation.reportPath}`}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('tasks:investigation.viewFullReport')} →
      </a>
    </div>
  );
}
