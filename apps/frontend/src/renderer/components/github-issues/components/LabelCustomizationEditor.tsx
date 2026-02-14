/**
 * LabelCustomizationEditor — shared UI for customizing label prefix, suffix,
 * color, and description for both workflow (ac:*) and investigation (auto-claude:*) labels.
 */

import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';

export interface LabelRow {
  key: string;
  displayName: string;
  suffix: string;
  color: string;
  description: string;
}

export interface LabelCustomizationEditorProps {
  prefix: string;
  onPrefixChange: (prefix: string) => void;
  labels: LabelRow[];
  onLabelChange: (key: string, field: 'suffix' | 'color' | 'description', value: string) => void;
  onReset: () => void;
  /** i18n namespace path for customization keys (e.g. "common:labelSync.customization" or "settings:investigationSettings.labelCustomization") */
  i18nPrefix: string;
}

export function LabelCustomizationEditor({
  prefix,
  onPrefixChange,
  labels,
  onLabelChange,
  onReset,
  i18nPrefix,
}: LabelCustomizationEditorProps) {
  const { t } = useTranslation(['common', 'settings']);

  return (
    <div className="space-y-3">
      {/* Prefix input */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-foreground w-14 shrink-0">
          {t(`${i18nPrefix}.prefix`, 'Prefix')}
        </span>
        <Input
          value={prefix}
          onChange={(e) => onPrefixChange(e.target.value)}
          placeholder={t(`${i18nPrefix}.prefixPlaceholder`, 'e.g. ac:')}
          className="h-7 text-xs w-32"
          aria-label={t(`${i18nPrefix}.prefix`, 'Prefix')}
        />
      </div>

      {/* Label table */}
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-24">
                {t(`${i18nPrefix}.preview`, 'Preview')}
              </th>
              <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-28">
                {t(`${i18nPrefix}.suffix`, 'Name')}
              </th>
              <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-16">
                {t(`${i18nPrefix}.color`, 'Color')}
              </th>
              <th className="text-left px-2 py-1.5 font-medium text-muted-foreground">
                {t(`${i18nPrefix}.labelDescription`, 'Description')}
              </th>
            </tr>
          </thead>
          <tbody>
            {labels.map((label) => (
              <tr key={label.key} className="border-b border-border last:border-b-0">
                {/* Preview swatch */}
                <td className="px-2 py-1.5">
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                    style={{
                      backgroundColor: `#${label.color}20`,
                      color: `#${label.color}`,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: `#${label.color}` }}
                    />
                    <span className="truncate max-w-[80px]">
                      {prefix}{label.suffix}
                    </span>
                  </span>
                </td>
                {/* Suffix input */}
                <td className="px-2 py-1.5">
                  <Input
                    value={label.suffix}
                    onChange={(e) => onLabelChange(label.key, 'suffix', e.target.value)}
                    className="h-6 text-xs"
                  />
                </td>
                {/* Color picker */}
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      value={`#${label.color}`}
                      onChange={(e) => onLabelChange(label.key, 'color', e.target.value.replace('#', ''))}
                      className="w-6 h-6 rounded cursor-pointer border border-border p-0"
                    />
                  </div>
                </td>
                {/* Description input */}
                <td className="px-2 py-1.5">
                  <Input
                    value={label.description}
                    onChange={(e) => onLabelChange(label.key, 'description', e.target.value)}
                    className="h-6 text-xs"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reset button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
        onClick={onReset}
      >
        <RotateCcw className="h-3 w-3" />
        {t(`${i18nPrefix}.resetDefaults`, 'Reset to defaults')}
      </Button>
    </div>
  );
}
