import React, { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  actionIcon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionText,
  onAction,
  actionIcon,
  children,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 transition-colors ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 flex items-center justify-center text-gray-400 dark:text-slate-500 mb-4 shadow-sm">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1.5 max-w-sm">
          {description}
        </p>
      )}
      {actionText && onAction && (
        <div className="mt-5">
          <Button variant="primary" onClick={onAction} leftIcon={actionIcon}>
            {actionText}
          </Button>
        </div>
      )}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
};
