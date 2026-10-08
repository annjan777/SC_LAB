import React from 'react';
import {
  CheckSquare,
  FlaskConical,
  Target,
  Wrench,
  AlertCircle,
  ShoppingCart,
  Flame,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Copy,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { IssueType, WorkPriority } from '../types/work';

export const ISSUE_TYPE_CONFIG: Record<
  IssueType,
  { label: string; icon: React.ElementType; badgeClass: string; iconClass: string }
> = {
  task: {
    label: 'Task',
    icon: CheckSquare,
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    iconClass: 'text-blue-400',
  },
  experiment: {
    label: 'Experiment',
    icon: FlaskConical,
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    iconClass: 'text-purple-400',
  },
  milestone: {
    label: 'Milestone',
    icon: Target,
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    iconClass: 'text-amber-400',
  },
  equipment_maintenance: {
    label: 'Maintenance',
    icon: Wrench,
    badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    iconClass: 'text-orange-400',
  },
  bug_incident: {
    label: 'Bug / Incident',
    icon: AlertCircle,
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    iconClass: 'text-rose-400',
  },
  procurement_task: {
    label: 'Procurement',
    icon: ShoppingCart,
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    iconClass: 'text-emerald-400',
  },
};

export const PRIORITY_CONFIG: Record<
  WorkPriority,
  { label: string; icon: React.ElementType; badgeClass: string; iconClass: string }
> = {
  code_red: {
    label: 'CODE-RED',
    icon: Flame,
    badgeClass:
      'bg-red-500/20 text-red-300 border-red-500/40 shadow-sm shadow-red-500/20 ring-1 ring-red-500/40 animate-pulse font-semibold',
    iconClass: 'text-red-400 fill-red-500/20 animate-bounce',
  },
  high: {
    label: 'High',
    icon: ArrowUp,
    badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    iconClass: 'text-orange-400',
  },
  medium: {
    label: 'Medium',
    icon: ArrowRight,
    badgeClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    iconClass: 'text-yellow-400',
  },
  low: {
    label: 'Low',
    icon: ArrowDown,
    badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    iconClass: 'text-slate-400',
  },
};

export function IssueTypeBadge({
  type = 'task',
  showLabel = true,
  className = '',
}: {
  type?: IssueType;
  showLabel?: boolean;
  className?: string;
}) {
  const config = ISSUE_TYPE_CONFIG[type] || ISSUE_TYPE_CONFIG.task;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${config.badgeClass} ${className}`}
      title={`Issue Type: ${config.label}`}
    >
      <Icon className={`w-3.5 h-3.5 ${config.iconClass}`} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

export function WorkPriorityBadge({
  priority = 'medium',
  className = '',
}: {
  priority?: WorkPriority;
  className?: string;
}) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-medium border ${config.badgeClass} ${className}`}
    >
      <Icon className={`w-3.5 h-3.5 ${config.iconClass}`} />
      <span>{config.label}</span>
    </span>
  );
}

export function IssueKeyTag({
  issueKey,
  onClick,
  className = '',
}: {
  issueKey?: string;
  onClick?: () => void;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  if (!issueKey) return null;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(issueKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-xs font-semibold bg-primary-500/15 text-primary-400 border border-primary-500/30 hover:bg-primary-500/25 transition-all ${
        onClick ? 'cursor-pointer hover:underline' : ''
      } ${className}`}
    >
      <span>{issueKey}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10"
        title="Copy issue key"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      </button>
    </span>
  );
}

export function CodeRedAlertBanner({
  activeWorks,
  onViewWork,
}: {
  activeWorks: Array<{ id: string; issue_key?: string; work_title: string; user_name?: string }>;
  onViewWork?: (workId: string) => void;
}) {
  if (!activeWorks || activeWorks.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-red-950/80 via-rose-950/70 to-red-950/80 border-2 border-red-500/40 rounded-xl p-4 shadow-lg shadow-red-950/40 mb-6 relative overflow-hidden backdrop-blur-sm">
      <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 opacity-10 pointer-events-none">
        <Flame className="w-44 h-44 text-red-500" />
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/50 flex items-center justify-center shrink-0 animate-pulse">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-black tracking-wider uppercase bg-red-600 text-white rounded font-mono animate-pulse">
                CRITICAL EMERGENCY
              </span>
              <h3 className="text-base font-bold text-red-100">
                Active Code-Red Priority Task ({activeWorks.length})
              </h3>
            </div>
            <p className="text-xs text-red-200/80 mt-0.5">
              Code-Red tasks take absolute precedence. Dependent milestones are flagged and delayed until resolution.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeWorks.map((work) => (
            <button
              key={work.id}
              onClick={() => onViewWork && onViewWork(work.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-900/60 hover:bg-red-800 text-red-100 border border-red-500/30 transition-all hover:scale-[1.02]"
            >
              <Flame className="w-3.5 h-3.5 text-red-400" />
              <span className="font-mono font-bold text-red-300">[{work.issue_key || 'CODE-RED'}]</span>
              <span className="max-w-[140px] truncate">{work.work_title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
