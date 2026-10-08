import React, { InputHTMLAttributes, forwardRef } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, onClear, placeholder = 'Search...', className = '', ...props }, ref) => {
    return (
      <div className={`relative flex items-center w-full ${className}`}>
        <Search className="absolute left-3.5 w-4 h-4 text-gray-400 dark:text-slate-500 pointer-events-none" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full h-10 pl-10 pr-9 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm rounded-lg border border-gray-300 dark:border-slate-700 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150"
          {...props}
        />
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
