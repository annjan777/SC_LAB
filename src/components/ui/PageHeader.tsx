import React, { ReactNode } from 'react';

export interface PageHeaderProps {
  title: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  action,
  children,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 ${className}`}
    >
      <div>
        <h1 className="text-[26px] sm:text-[28px] font-bold tracking-tight text-gray-900 dark:text-slate-100 leading-tight">
          {title}
        </h1>
      </div>
      {(action || children) && (
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
          {action}
          {children}
        </div>
      )}
    </div>
  );
};
