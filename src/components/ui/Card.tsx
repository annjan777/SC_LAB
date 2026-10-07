import React, { HTMLAttributes, forwardRef } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, className = '', hover = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm transition-all duration-150 ${
          hover ? 'hover:shadow-md hover:border-gray-300 dark:hover:border-slate-700' : ''
        } ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-5 py-4 sm:px-6 sm:py-4.5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between gap-4 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={`text-base sm:text-[17px] font-semibold text-gray-900 dark:text-slate-100 leading-snug ${className}`}
        {...props}
      >
        {children}
      </h3>
    );
  }
);
CardTitle.displayName = 'CardTitle';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div ref={ref} className={`p-5 sm:p-6 ${className}`} {...props}>
        {children}
      </div>
    );
  }
);
CardContent.displayName = 'CardContent';
