import React from 'react';

export interface ProgressBarProps {
  value: number; // 0 to 100
  color?: 'blue' | 'emerald' | 'amber' | 'red' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  color = 'blue',
  size = 'md',
  showLabel = false,
  className = '',
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  const heightStyles = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  }[size];

  const colorStyles = {
    blue: 'bg-blue-600 dark:bg-blue-500',
    emerald: 'bg-emerald-600 dark:bg-emerald-500',
    amber: 'bg-amber-500 dark:bg-amber-400',
    red: 'bg-red-600 dark:bg-red-500',
    purple: 'bg-purple-600 dark:bg-purple-500',
  }[color];

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">
          <span>Progress</span>
          <span>{Math.round(clampedValue)}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden ${heightStyles}`}>
        <div
          className={`${heightStyles} rounded-full transition-all duration-300 ${colorStyles}`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
};
