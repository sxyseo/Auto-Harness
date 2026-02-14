import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Search,
  Users,
  X,
  Filter,
  Check,
  ArrowUpDown,
  Clock,
  MessageSquare,
  CircleDot,
  CircleX,
} from 'lucide-react';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Separator } from '../../ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { useTranslation } from 'react-i18next';
import type { IssueFilterBarProps, IssueStatusFilter, IssueSortOption } from '../types';
import { cn } from '../../../lib/utils';

// Status options for GitHub issue state
const STATUS_OPTIONS: Array<{
  value: IssueStatusFilter;
  labelKey: string;
  icon: typeof CircleDot;
  color: string;
  bgColor: string;
}> = [
  { value: 'open', labelKey: 'issues.filterOpen', icon: CircleDot, color: 'text-green-500', bgColor: 'bg-green-500/20' },
  { value: 'closed', labelKey: 'issues.filterClosed', icon: CircleX, color: 'text-purple-500', bgColor: 'bg-purple-500/20' },
];

// Sort options
const SORT_OPTIONS: Array<{
  value: IssueSortOption;
  labelKey: string;
  icon: typeof Clock;
}> = [
  { value: 'newest', labelKey: 'issues.sort.newest', icon: Clock },
  { value: 'oldest', labelKey: 'issues.sort.oldest', icon: Clock },
  { value: 'most_commented', labelKey: 'issues.sort.mostCommented', icon: MessageSquare },
];

/**
 * Multi-select filter dropdown (same pattern as PRFilterBar)
 */
function FilterDropdown<T extends string>({
  title,
  icon: Icon,
  items,
  selected,
  onChange,
  renderItem,
  renderTrigger,
  searchable = false,
  searchPlaceholder,
  selectedCountLabel,
  noResultsLabel,
  clearLabel,
}: {
  title: string;
  icon: typeof Users;
  items: T[];
  selected: T[];
  onChange: (selected: T[]) => void;
  renderItem?: (item: T) => React.ReactNode;
  renderTrigger?: (selected: T[]) => React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  selectedCountLabel?: string;
  noResultsLabel?: string;
  clearLabel?: string;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const toggleItem = useCallback((item: T) => {
    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item));
    } else {
      onChange([...selected, item]);
    }
  }, [selected, onChange]);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    return items.filter(item =>
      item.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (filteredItems.length === 0) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => prev < filteredItems.length - 1 ? prev + 1 : 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => prev > 0 ? prev - 1 : filteredItems.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredItems.length) {
          toggleItem(filteredItems[focusedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  }, [filteredItems, focusedIndex, toggleItem]);

  useEffect(() => {
    if (focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) { setSearchTerm(''); setFocusedIndex(-1); }
    }}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 w-full justify-start border-dashed bg-transparent",
            selected.length > 0 && "border-solid bg-accent/50"
          )}
        >
          <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className="truncate">{title}</span>
          {selected.length > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                {selected.length}
              </Badge>
              <div className="hidden space-x-1 lg:flex flex-1 truncate">
                {selected.length > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {selectedCountLabel}
                  </Badge>
                ) : (
                  renderTrigger ? renderTrigger(selected) : (
                    selected.map((item) => (
                      <Badge variant="secondary" key={item} className="rounded-sm px-1 font-normal">
                        {item}
                      </Badge>
                    ))
                  )
                )}
              </div>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px] p-0">
        <div className="px-3 py-2 border-b border-border/50">
          <div className="text-xs font-semibold text-muted-foreground mb-1">{title}</div>
          {searchable && (
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                className="h-7 text-xs pl-7 bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-primary/50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </div>
        <div
          className="max-h-[300px] overflow-y-auto custom-scrollbar p-1"
          role="listbox"
          aria-multiselectable="true"
          onKeyDown={handleKeyDown}
          tabIndex={0}
        >
          {filteredItems.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground text-center">{noResultsLabel}</div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = selected.includes(item);
              const isFocused = index === focusedIndex;
              return (
                <div
                  key={item}
                  ref={(el) => { itemRefs.current[index] = el; }}
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent/50",
                    isFocused && "ring-2 ring-primary/50 bg-accent"
                  )}
                  onClick={(e) => { e.preventDefault(); toggleItem(item); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleItem(item); } }}
                  tabIndex={-1}
                >
                  <div className={cn(
                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary/30",
                    isSelected ? "bg-primary border-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                  )}>
                    <Check className="h-3 w-3" />
                  </div>
                  {renderItem ? renderItem(item) : item}
                </div>
              );
            })
          )}
        </div>
        {selected.length > 0 && (
          <div className="p-1 border-t border-border/50 bg-muted/20">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center text-xs h-7 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onChange([])}
            >
              {clearLabel}
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Single-select sort dropdown (same pattern as PRFilterBar)
 */
function SortDropdown({
  value,
  onChange,
  options,
  title,
}: {
  value: IssueSortOption;
  onChange: (value: IssueSortOption) => void;
  options: typeof SORT_OPTIONS;
  title: string;
}) {
  const { t } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const currentOption = options.find((opt) => opt.value === value) || options[0];

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (options.length === 0) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < options.length) {
          onChange(options[focusedIndex].value);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  }, [options, focusedIndex, onChange]);

  return (
    <DropdownMenu
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open) setFocusedIndex(options.findIndex((o) => o.value === value));
        else setFocusedIndex(-1);
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 justify-start border-dashed bg-transparent">
          <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className="truncate">{title}</span>
          <Separator orientation="vertical" className="mx-2 h-4" />
          <Badge variant="secondary" className="rounded-sm px-1 font-normal">
            {t(currentOption.labelKey)}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[180px] p-0">
        <div className="px-3 py-2 border-b border-border/50">
          <div className="text-xs font-semibold text-muted-foreground">{title}</div>
        </div>
        <div className="p-1" role="listbox" tabIndex={0} onKeyDown={handleKeyDown}>
          {options.map((option, index) => {
            const isSelected = value === option.value;
            const isFocused = focusedIndex === index;
            const Icon = option.icon;
            return (
              <div
                key={option.value}
                role="option"
                aria-selected={isSelected}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                  isSelected && "bg-accent/50",
                  isFocused && "bg-accent text-accent-foreground"
                )}
                onClick={() => { onChange(option.value); setIsOpen(false); }}
              >
                <div className={cn(
                  "mr-2 flex h-4 w-4 items-center justify-center rounded-full border border-primary/30",
                  isSelected ? "bg-primary border-primary text-primary-foreground" : "opacity-50"
                )}>
                  {isSelected && <Check className="h-2.5 w-2.5" />}
                </div>
                <Icon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                <span>{t(option.labelKey)}</span>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function IssueFilterBar({
  filters,
  reporters,
  hasActiveFilters,
  onSearchChange,
  onReportersChange,
  onStatusesChange,
  onSortChange,
  onClearFilters,
}: IssueFilterBarProps) {
  const { t } = useTranslation('common');

  const getStatusOption = (value: IssueStatusFilter) =>
    STATUS_OPTIONS.find((opt) => opt.value === value);

  return (
    <div className="px-4 py-2 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-2 h-9">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('issues.searchPlaceholder')}
            value={filters.searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-9 bg-background/50 focus:bg-background transition-colors"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t('issues.clearSearch')}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <Separator orientation="vertical" className="h-5 mx-1" />

        {/* Reporters Filter */}
        <div className="flex-1 max-w-[240px]">
          <FilterDropdown
            title={t('issues.reporters')}
            icon={Users}
            items={reporters}
            selected={filters.reporters}
            onChange={onReportersChange}
            searchable={true}
            searchPlaceholder={t('issues.searchReporters')}
            selectedCountLabel={t('issues.selectedCount', { count: filters.reporters.length })}
            noResultsLabel={t('issues.noResultsFound')}
            clearLabel={t('issues.clearFilters')}
            renderItem={(reporter) => (
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-medium text-primary">
                    {reporter.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <span className="truncate text-sm">{reporter}</span>
              </div>
            )}
          />
        </div>

        {/* Status Filter */}
        <div className="flex-1 max-w-[240px]">
          <FilterDropdown
            title={t('issues.allStatuses')}
            icon={Filter}
            items={STATUS_OPTIONS.map((opt) => opt.value)}
            selected={filters.statuses}
            onChange={onStatusesChange}
            selectedCountLabel={t('issues.selectedCount', { count: filters.statuses.length })}
            noResultsLabel={t('issues.noResultsFound')}
            clearLabel={t('issues.clearFilters')}
            renderItem={(status) => {
              const option = getStatusOption(status);
              if (!option) return null;
              const Icon = option.icon;
              return (
                <div className="flex items-center gap-2">
                  <div className={cn("p-1 rounded-full", option.bgColor)}>
                    <Icon className={cn("h-3 w-3", option.color)} />
                  </div>
                  <span className="text-sm">{t(option.labelKey)}</span>
                </div>
              );
            }}
            renderTrigger={(selected) => (
              selected.map((status) => {
                const option = getStatusOption(status);
                if (!option) return null;
                const Icon = option.icon;
                return (
                  <Badge
                    variant="secondary"
                    key={status}
                    className={cn("rounded-sm px-1 font-normal gap-1", option.bgColor, option.color)}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="truncate max-w-[80px]">{t(option.labelKey)}</span>
                  </Badge>
                );
              })
            )}
          />
        </div>

        {/* Sort Dropdown */}
        <div className="flex-shrink-0">
          <SortDropdown
            value={filters.sortBy}
            onChange={onSortChange}
            options={SORT_OPTIONS}
            title={t('issues.sort.label')}
          />
        </div>

        {/* Reset All */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-8 px-2 lg:px-3 text-muted-foreground hover:text-foreground ml-auto"
          >
            <span className="hidden lg:inline mr-2">{t('issues.reset')}</span>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
