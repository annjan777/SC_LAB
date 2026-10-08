import React from 'react';
import {
  Search,
  Filter,
  Flame,
  AlertTriangle,
  GitPullRequest,
  X,
  Layers,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { ISSUE_TYPE_CONFIG } from './WorkIssueBadge';

export interface WorkFilterState {
  search: string;
  issueType: string;
  priority: string;
  status: string;
  codeRedOnly: boolean;
  delayedOnly: boolean;
  pendingApprovalOnly: boolean;
}

export const DEFAULT_WORK_FILTERS: WorkFilterState = {
  search: '',
  issueType: 'all',
  priority: 'all',
  status: 'all',
  codeRedOnly: false,
  delayedOnly: false,
  pendingApprovalOnly: false,
};

interface WorkFilterToolbarProps {
  filters: WorkFilterState;
  onChange: (filters: WorkFilterState) => void;
  totalCount: number;
  filteredCount: number;
  codeRedCount?: number;
  pendingApprovalCount?: number;
}

export default function WorkFilterToolbar({
  filters,
  onChange,
  totalCount,
  filteredCount,
  codeRedCount = 0,
  pendingApprovalCount = 0,
}: WorkFilterToolbarProps) {
  const isFiltered =
    filters.search !== '' ||
    filters.issueType !== 'all' ||
    filters.priority !== 'all' ||
    filters.status !== 'all' ||
    filters.codeRedOnly ||
    filters.delayedOnly ||
    filters.pendingApprovalOnly;

  const handleClear = () => {
    onChange(DEFAULT_WORK_FILTERS);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3 transition-colors">
      {/* Top row: Search input and Dropdown filters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 dark:text-slate-400 absolute left-3.5 top-2.5" />
          <input
            id="filter-search-input"
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search by issue key (SCLAB-1), title, project, assignee..."
            className="w-full bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-lg pl-9 pr-8 py-2 text-xs text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-0.5"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          {/* Issue Type */}
          <div className="relative flex-1 sm:flex-initial">
            <select
              id="filter-issue-type-select"
              value={filters.issueType}
              onChange={(e) => onChange({ ...filters, issueType: e.target.value })}
              className="w-full sm:w-auto bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8 cursor-pointer shadow-sm hover:border-gray-300 dark:hover:border-slate-600 transition"
            >
              <option value="all">All Issue Types</option>
              {Object.entries(ISSUE_TYPE_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
            <Filter className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Priority */}
          <div className="relative flex-1 sm:flex-initial">
            <select
              id="filter-priority-select"
              value={filters.priority}
              onChange={(e) => onChange({ ...filters, priority: e.target.value })}
              className="w-full sm:w-auto bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8 cursor-pointer shadow-sm hover:border-gray-300 dark:hover:border-slate-600 transition"
            >
              <option value="all">All Priorities</option>
              <option value="code_red">🚨 Code-Red</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <Layers className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Status */}
          <div className="relative flex-1 sm:flex-initial">
            <select
              id="filter-status-select"
              value={filters.status}
              onChange={(e) => onChange({ ...filters, status: e.target.value })}
              className="w-full sm:w-auto bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8 cursor-pointer shadow-sm hover:border-gray-300 dark:hover:border-slate-600 transition"
            >
              <option value="all">All Statuses</option>
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="delayed">Delayed</option>
            </select>
            <CheckCircle2 className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Bottom row: Quick Toggle Pills & Match Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick toggle: Code-Red */}
          <button
            type="button"
            onClick={() => onChange({ ...filters, codeRedOnly: !filters.codeRedOnly })}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-all ${
              filters.codeRedOnly
                ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-400/40'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${filters.codeRedOnly ? 'text-white' : 'text-red-500'}`} />
            <span>Code-Red</span>
            {codeRedCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                filters.codeRedOnly ? 'bg-black/25 text-white' : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
              }`}>
                {codeRedCount}
              </span>
            )}
          </button>

          {/* Quick toggle: Delayed / Blocked */}
          <button
            type="button"
            onClick={() => onChange({ ...filters, delayedOnly: !filters.delayedOnly })}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-all ${
              filters.delayedOnly
                ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400/40'
                : 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700'
            }`}
          >
            <AlertTriangle
              className={`w-3.5 h-3.5 ${filters.delayedOnly ? 'text-white' : 'text-amber-500'}`}
            />
            <span>Delayed / Blocked</span>
          </button>

          {/* Quick toggle: Pending Approval */}
          {pendingApprovalCount >= 0 && (
            <button
              type="button"
              onClick={() =>
                onChange({ ...filters, pendingApprovalOnly: !filters.pendingApprovalOnly })
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-all ${
                filters.pendingApprovalOnly
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/40'
                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700'
              }`}
            >
              <GitPullRequest
                className={`w-3.5 h-3.5 ${
                  filters.pendingApprovalOnly ? 'text-white' : 'text-blue-500'
                }`}
              />
              <span>Pending Milestone Review</span>
              {pendingApprovalCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  filters.pendingApprovalOnly ? 'bg-black/25 text-white' : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                }`}>
                  {pendingApprovalCount}
                </span>
              )}
            </button>
          )}

          {/* Clear Filters button */}
          {isFiltered && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors ml-1 font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Counter */}
        <div className="text-gray-500 dark:text-slate-400 text-xs font-normal">
          Showing <span className="font-semibold text-gray-900 dark:text-slate-200">{filteredCount}</span> of{' '}
          <span className="font-semibold text-gray-900 dark:text-slate-200">{totalCount}</span> items
        </div>
      </div>
    </div>
  );
}
