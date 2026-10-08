import React from 'react';

export type BadgeVariant =
  | 'blue'
  | 'emerald'
  | 'green'
  | 'amber'
  | 'yellow'
  | 'red'
  | 'purple'
  | 'gray'
  | 'slate'
  | 'indigo'
  | 'teal';

export interface StatusBadgeProps {
  status: string;
  label?: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  children?: React.ReactNode;
  className?: string;
}

// Automatically resolve standard status text to semantic color variant
const resolveVariant = (status: string): BadgeVariant => {
  const s = status.toLowerCase().trim().replace(/[-_]/g, ' ');

  if (
    s.includes('active') ||
    s.includes('approved') ||
    s.includes('operational') ||
    s.includes('completed') ||
    s.includes('delivered') ||
    s.includes('resolved') ||
    s.includes('success')
  ) {
    return 'emerald';
  }

  if (
    s.includes('pending') ||
    s.includes('ordered') ||
    s.includes('in review') ||
    s.includes('waiting') ||
    s.includes('medium') ||
    s.includes('casual')
  ) {
    return 'amber';
  }

  if (
    s.includes('rejected') ||
    s.includes('inactive') ||
    s.includes('cancelled') ||
    s.includes('decommissioned') ||
    s.includes('urgent') ||
    s.includes('high') ||
    s.includes('critical') ||
    s.includes('emergency') ||
    s.includes('code red') ||
    s.includes('danger')
  ) {
    return 'red';
  }

  if (
    s.includes('in progress') ||
    s.includes('in transit') ||
    s.includes('on duty') ||
    s.includes('processing') ||
    s.includes('info')
  ) {
    return 'blue';
  }

  if (
    s.includes('maintenance') ||
    s.includes('medical') ||
    s.includes('reagents')
  ) {
    return 'purple';
  }

  if (s.includes('low')) {
    return 'teal';
  }

  return 'gray';
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  variant,
  size = 'md',
  dot = true,
  children,
  className = '',
}) => {
  const chosenVariant = variant || resolveVariant(status);

  const variantStyles: Record<BadgeVariant, { bg: string; text: string; dotBg: string; border: string }> = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/60',
      text: 'text-blue-700 dark:text-blue-300',
      dotBg: 'bg-blue-500',
      border: 'border-blue-200/80 dark:border-blue-800/60',
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/60',
      text: 'text-emerald-700 dark:text-emerald-300',
      dotBg: 'bg-emerald-500',
      border: 'border-emerald-200/80 dark:border-emerald-800/60',
    },
    green: {
      bg: 'bg-green-50 dark:bg-green-950/60',
      text: 'text-green-700 dark:text-green-300',
      dotBg: 'bg-green-500',
      border: 'border-green-200/80 dark:border-green-800/60',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/60',
      text: 'text-amber-800 dark:text-amber-300',
      dotBg: 'bg-amber-500',
      border: 'border-amber-200/80 dark:border-amber-800/60',
    },
    yellow: {
      bg: 'bg-yellow-50 dark:bg-yellow-950/60',
      text: 'text-yellow-800 dark:text-yellow-300',
      dotBg: 'bg-yellow-500',
      border: 'border-yellow-200/80 dark:border-yellow-800/60',
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-950/60',
      text: 'text-red-700 dark:text-red-300',
      dotBg: 'bg-red-500',
      border: 'border-red-200/80 dark:border-red-800/60',
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-950/60',
      text: 'text-purple-700 dark:text-purple-300',
      dotBg: 'bg-purple-500',
      border: 'border-purple-200/80 dark:border-purple-800/60',
    },
    teal: {
      bg: 'bg-teal-50 dark:bg-teal-950/60',
      text: 'text-teal-700 dark:text-teal-300',
      dotBg: 'bg-teal-500',
      border: 'border-teal-200/80 dark:border-teal-800/60',
    },
    indigo: {
      bg: 'bg-indigo-50 dark:bg-indigo-950/60',
      text: 'text-indigo-700 dark:text-indigo-300',
      dotBg: 'bg-indigo-500',
      border: 'border-indigo-200/80 dark:border-indigo-800/60',
    },
    gray: {
      bg: 'bg-gray-100 dark:bg-slate-800',
      text: 'text-gray-700 dark:text-slate-300',
      dotBg: 'bg-gray-400',
      border: 'border-gray-200 dark:border-slate-700',
    },
    slate: {
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-700 dark:text-slate-300',
      dotBg: 'bg-slate-400',
      border: 'border-slate-200 dark:border-slate-700',
    },
  };

  const style = variantStyles[chosenVariant];
  const sizeStyle =
    size === 'sm'
      ? 'px-2 py-0.5 text-[11px] gap-1.5'
      : 'px-2.5 py-1 text-xs gap-1.5';

  const displayText = children || label || status.replace(/[-_]/g, ' ');

  return (
    <span
      className={`inline-flex items-center font-medium capitalize rounded-full border ${style.bg} ${style.text} ${style.border} ${sizeStyle} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dotBg}`} />}
      <span>{displayText}</span>
    </span>
  );
};
