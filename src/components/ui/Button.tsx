import React, { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      leftIcon,
      rightIcon,
      isLoading = false,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    // Base styles: consistent 8px radius, 14px font, semibold, focus rings, flex alignment
    const baseStyles =
      'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed select-none cursor-pointer';

    // Size styles (md is standardized at 40px / h-10)
    const sizeStyles = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 text-sm gap-2',
      lg: 'h-12 px-5 text-base gap-2.5',
    }[size];

    // Variant styles
    const variantStyles = {
      primary:
        'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm focus:ring-blue-500 border border-transparent',
      secondary:
        'bg-gray-100 hover:bg-gray-200 active:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:active:bg-slate-600 text-gray-800 dark:text-slate-100 border border-gray-200 dark:border-slate-700 focus:ring-gray-400',
      outline:
        'bg-transparent hover:bg-gray-50 active:bg-gray-100 dark:hover:bg-slate-800/80 text-gray-700 dark:text-slate-200 border border-gray-300 dark:border-slate-700 focus:ring-blue-500',
      danger:
        'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-sm focus:ring-red-500 border border-transparent',
      success:
        'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm focus:ring-emerald-500 border border-transparent',
      ghost:
        'bg-transparent hover:bg-gray-100 dark:hover:bg-slate-800 active:bg-gray-200 dark:active:bg-slate-700 text-gray-700 dark:text-slate-300 border border-transparent focus:ring-gray-400',
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
