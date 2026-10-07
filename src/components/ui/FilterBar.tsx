import React, { ReactNode } from 'react';
import { SearchInput } from './SearchInput';

export interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchClear?: () => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchValue,
  onSearchChange,
  onSearchClear,
  searchPlaceholder = 'Search...',
  children,
  actions,
  className = '',
}) => {
  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 sm:p-4.5 shadow-sm transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 ${className}`}
    >
      <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {onSearchChange && (
          <div className="w-full sm:w-72 lg:w-80 shrink-0">
            <SearchInput
              value={searchValue || ''}
              onChange={onSearchChange}
              onClear={onSearchClear}
              placeholder={searchPlaceholder}
            />
          </div>
        )}
        {children && (
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 flex-1">
            {children}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-slate-800">
          {actions}
        </div>
      )}
    </div>
  );
};
