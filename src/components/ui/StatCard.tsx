import React, { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: ReactNode;
  color?: 'blue' | 'emerald' | 'amber' | 'purple' | 'red' | 'indigo' | 'gray';
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  subtitle,
  color = 'blue',
  onClick,
  className = '',
}) => {
  const colorStyles = {
    blue: {
      iconBg: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400',
    },
    emerald: {
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400',
    },
    amber: {
      iconBg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900 text-amber-600 dark:text-amber-400',
    },
    purple: {
      iconBg: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-900 text-purple-600 dark:text-purple-400',
    },
    red: {
      iconBg: 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-900 text-red-600 dark:text-red-400',
    },
    indigo: {
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400',
    },
    gray: {
      iconBg: 'bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300',
    },
  }[color];

  const content = (
    <div className="flex items-center justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-gray-500 dark:text-slate-400 truncate">
          {title}
        </p>
        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 mt-1 tracking-tight">
          {value}
        </p>
        {subtitle && (
          <div className="text-xs text-gray-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
            {subtitle}
          </div>
        )}
      </div>
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ml-4 ${colorStyles.iconBg}`}
      >
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm hover:shadow-md hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all duration-150 cursor-pointer ${className}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm ${className}`}
    >
      {content}
    </div>
  );
};
