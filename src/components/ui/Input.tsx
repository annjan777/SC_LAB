import React, { InputHTMLAttributes, forwardRef, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-gray-400 dark:text-slate-500">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full h-10 px-3.5 ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''} bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 text-sm rounded-lg border ${
              error
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-slate-700 focus:ring-blue-500 focus:border-blue-500'
            } placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition-all duration-150 disabled:opacity-60 disabled:bg-gray-100 dark:disabled:bg-slate-800/50 ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center text-gray-400 dark:text-slate-500">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
