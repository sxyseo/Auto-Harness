import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Shield,
  Zap,
  Scale,
  Building2,
  TestTube,
  FileText,
  Sparkles,
  Info
} from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '../ui/tooltip';
import type {
  ReviewTemplateType,
  ReviewTemplateConfig
} from '../../../main/ipc-handlers/github/types';

interface PRReviewTemplateSelectorProps {
  selectedTemplate: ReviewTemplateConfig | null;
  onTemplateChange: (template: ReviewTemplateConfig) => void;
  disabled?: boolean;
}

/** Built-in template definitions with metadata */
interface TemplateDefinition {
  type: ReviewTemplateType;
  labelKey: string;
  descriptionKey: string;
  icon: React.ElementType;
  defaultEnabled: boolean;
}

const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    type: 'comprehensive',
    labelKey: 'templates.comprehensive.label',
    descriptionKey: 'templates.comprehensive.description',
    icon: Sparkles,
    defaultEnabled: true
  },
  {
    type: 'quick',
    labelKey: 'templates.quick.label',
    descriptionKey: 'templates.quick.description',
    icon: Zap,
    defaultEnabled: false
  },
  {
    type: 'security',
    labelKey: 'templates.security.label',
    descriptionKey: 'templates.security.description',
    icon: Shield,
    defaultEnabled: false
  },
  {
    type: 'quality',
    labelKey: 'templates.quality.label',
    descriptionKey: 'templates.quality.description',
    icon: Scale,
    defaultEnabled: false
  },
  {
    type: 'architecture',
    labelKey: 'templates.architecture.label',
    descriptionKey: 'templates.architecture.description',
    icon: Building2,
    defaultEnabled: false
  },
  {
    type: 'test_coverage',
    labelKey: 'templates.testCoverage.label',
    descriptionKey: 'templates.testCoverage.description',
    icon: TestTube,
    defaultEnabled: false
  },
  {
    type: 'documentation',
    labelKey: 'templates.documentation.label',
    descriptionKey: 'templates.documentation.description',
    icon: FileText,
    defaultEnabled: false
  }
];

/**
 * Template selector component for PR review.
 * Allows users to select from available review templates (comprehensive, security, performance, etc.)
 */
export function PRReviewTemplateSelector({
  selectedTemplate,
  onTemplateChange,
  disabled = false
}: PRReviewTemplateSelectorProps) {
  const { t } = useTranslation('common');

  /** Get currently selected template type */
  const currentTemplateType = selectedTemplate?.templateType ?? 'comprehensive';

  /** Handle template selection change */
  const handleTemplateChange = useCallback(
    (newType: ReviewTemplateType) => {
      const config: ReviewTemplateConfig = {
        templateType: newType
      };
      onTemplateChange(config);
    },
    [onTemplateChange]
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {t('prReview.template.label', 'Review Template')}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p>{t('prReview.template.tooltip', 'Select a review template to customize the type of analysis performed.')}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Template Radio Group */}
        <RadioGroup
          value={currentTemplateType}
          onValueChange={(value) => handleTemplateChange(value as ReviewTemplateType)}
          disabled={disabled}
          className="grid grid-cols-2 gap-2"
        >
          {TEMPLATE_DEFINITIONS.map((template) => {
            const Icon = template.icon;
            const isSelected = currentTemplateType === template.type;

            return (
              <div key={template.type} className="relative">
                <RadioGroupItem
                  value={template.type}
                  id={`template-${template.type}`}
                  className="sr-only"
                />
                <Label
                  htmlFor={`template-${template.type}`}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer
                    transition-all duration-150
                    ${isSelected
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border/50 bg-card hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-primary' : ''}`} />
                  <span className="text-sm font-medium truncate">
                    {t(template.labelKey, template.type.charAt(0).toUpperCase() + template.type.slice(1).replace('_', ' '))}
                  </span>
                </Label>

                {/* Description tooltip on hover */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`
                        absolute -top-1 -right-1 rounded-full
                        ${isSelected ? 'text-primary' : 'text-muted-foreground'}
                      `}
                    >
                      <Info className="h-3 w-3" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p>
                      {t(
                        template.descriptionKey,
                        getDefaultDescription(template.type)
                      )}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </RadioGroup>

        {/* Selected template description */}
        {selectedTemplate && (
          <div className="text-xs text-muted-foreground px-1">
            {t('prReview.template.selected', 'Selected:')}{' '}
            {t(
              TEMPLATE_DEFINITIONS.find(t => t.type === currentTemplateType)?.labelKey ?? '',
              currentTemplateType
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

/** Fallback descriptions when translation keys are missing */
function getDefaultDescription(templateType: ReviewTemplateType): string {
  const descriptions: Record<ReviewTemplateType, string> = {
    comprehensive: 'Full comprehensive review covering all aspects of the code changes.',
    quick: 'Quick review for small, low-risk changes with minimal analysis.',
    security: 'Security-focused review checking for vulnerabilities and secure coding practices.',
    quality: 'Quality and maintainability focused review for code quality improvements.',
    architecture: 'Architecture and structural review for design patterns and system design.',
    test_coverage: 'Review focused on test coverage and testing best practices.',
    documentation: 'Review for documentation changes and docstring quality.'
  };
  return descriptions[templateType] ?? '';
}
