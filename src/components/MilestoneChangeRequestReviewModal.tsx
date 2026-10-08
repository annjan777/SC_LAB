import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  User,
  Clock,
  ArrowRight,
  GitPullRequest,
  GitCompare,
  Columns,
  PlusCircle,
  MinusCircle,
  RefreshCw,
  Info,
} from 'lucide-react';
import { MilestoneChangeRequest } from '../types/work';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import ErrorBoundary from './ErrorBoundary';

interface MilestoneChangeRequestReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: MilestoneChangeRequest | null;
  onReviewed: () => void;
}

interface ChangeDiffItem {
  type: 'added' | 'removed' | 'rescheduled' | 'modified' | 'unchanged';
  title: string;
  previousTitle?: string;
  previousDate?: string;
  newDate?: string;
  dateShiftDays?: number;
  previousOutcome?: string;
  newOutcome?: string;
  status?: string;
}

function parseMilestonesList(raw: any): any[] {
  if (!raw) return [];
  let list = raw;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list.filter((item) => item !== null && typeof item === 'object');
}

function getMilestoneTitle(m: any): string {
  if (!m) return 'Untitled Milestone';
  return String(m.milestone_description || m.title || 'Untitled Milestone');
}

function getMilestoneDate(m: any): string {
  if (!m || !m.target_date) return '';
  return String(m.target_date).slice(0, 10);
}

function getMilestoneOutcome(m: any): string {
  if (!m || m.expected_outcome === undefined || m.expected_outcome === null) return '';
  return String(m.expected_outcome).trim();
}

function ReviewModalInner({
  isOpen,
  onClose,
  request,
  onReviewed,
}: MilestoneChangeRequestReviewModalProps) {
  const { profile, hasPermission } = useAuth();
  const isAdmin =
    profile?.user_role === 'admin' ||
    profile?.user_role === 'super_admin' ||
    hasPermission('manage_work_cycles');

  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'diff' | 'side_by_side'>('diff');
  const [fallbackPrevious, setFallbackPrevious] = useState<any[]>([]);
  const [loadingFallback, setLoadingFallback] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && request) {
      setAdminNotes('');
      setError('');
      const prevList = parseMilestonesList(request.previous_milestones);
      if (prevList.length === 0 && request.work_id) {
        setLoadingFallback(true);
        api
          .get(`/api/work/${request.work_id}/milestones`)
          .then((res) => {
            if (Array.isArray(res.data)) {
              setFallbackPrevious(res.data.filter((item) => item && typeof item === 'object'));
            }
          })
          .catch((err) => {
            console.error('Failed to load fallback milestones:', err);
          })
          .finally(() => {
            setLoadingFallback(false);
          });
      } else {
        setFallbackPrevious([]);
      }
    }
  }, [isOpen, request]);

  const previousList = useMemo(() => {
    if (!request) return [];
    const prev = parseMilestonesList(request.previous_milestones);
    if (prev.length > 0) return prev;
    return fallbackPrevious;
  }, [request, fallbackPrevious]);

  const proposedList = useMemo(() => {
    if (!request) return [];
    return parseMilestonesList(request.proposed_milestones);
  }, [request]);

  // Compute structured diff: Earlier vs Now
  const diffItems = useMemo<ChangeDiffItem[]>(() => {
    if (!request) return [];

    const matchedPrevIndices = new Set<number>();
    const matchedPropIndices = new Set<number>();
    const items: ChangeDiffItem[] = [];

    // Pass 1: Match by ID
    proposedList.forEach((prop, pIdx) => {
      if (prop.id) {
        const prevIdx = previousList.findIndex(
          (p, idx) => !matchedPrevIndices.has(idx) && p.id === prop.id
        );
        if (prevIdx !== -1) {
          matchedPrevIndices.add(prevIdx);
          matchedPropIndices.add(pIdx);
          const prev = previousList[prevIdx];

          const prevDate = getMilestoneDate(prev);
          const newDate = getMilestoneDate(prop);
          const dateChanged = Boolean(prevDate && newDate && prevDate !== newDate);
          let dateShiftDays = 0;
          if (dateChanged) {
            const diffTime = new Date(newDate).getTime() - new Date(prevDate).getTime();
            dateShiftDays = Number.isFinite(diffTime)
              ? Math.round(diffTime / (1000 * 60 * 60 * 24))
              : 0;
          }

          const prevTitle = getMilestoneTitle(prev).trim();
          const newTitle = getMilestoneTitle(prop).trim();
          const titleChanged = prevTitle.toLowerCase() !== newTitle.toLowerCase();

          const prevOutcome = getMilestoneOutcome(prev);
          const newOutcome = getMilestoneOutcome(prop);
          const outcomeChanged = prevOutcome !== newOutcome;

          if (dateChanged) {
            items.push({
              type: 'rescheduled',
              title: newTitle || prevTitle || 'Untitled Milestone',
              previousTitle: titleChanged ? prevTitle : undefined,
              previousDate: prevDate,
              newDate,
              dateShiftDays,
              previousOutcome: outcomeChanged ? prevOutcome : undefined,
              newOutcome: outcomeChanged ? newOutcome : undefined,
              status: prop.status || prev.status,
            });
          } else if (titleChanged || outcomeChanged) {
            items.push({
              type: 'modified',
              title: newTitle || prevTitle || 'Untitled Milestone',
              previousTitle: titleChanged ? prevTitle : undefined,
              previousDate: prevDate,
              newDate,
              previousOutcome: outcomeChanged ? prevOutcome : undefined,
              newOutcome: outcomeChanged ? newOutcome : undefined,
              status: prop.status || prev.status,
            });
          } else {
            items.push({
              type: 'unchanged',
              title: newTitle || prevTitle || 'Untitled Milestone',
              previousDate: prevDate,
              newDate,
              status: prop.status || prev.status,
            });
          }
        }
      }
    });

    // Pass 2: Match by normalized title for new/unkeyed entries
    proposedList.forEach((prop, pIdx) => {
      if (!matchedPropIndices.has(pIdx)) {
        const propTitle = getMilestoneTitle(prop).trim().toLowerCase();
        const prevIdx = previousList.findIndex(
          (p, idx) =>
            !matchedPrevIndices.has(idx) &&
            getMilestoneTitle(p).trim().toLowerCase() === propTitle
        );
        if (prevIdx !== -1) {
          matchedPrevIndices.add(prevIdx);
          matchedPropIndices.add(pIdx);
          const prev = previousList[prevIdx];
          const prevDate = getMilestoneDate(prev);
          const newDate = getMilestoneDate(prop);
          const dateChanged = Boolean(prevDate && newDate && prevDate !== newDate);
          let dateShiftDays = 0;
          if (dateChanged) {
            const diffTime = new Date(newDate).getTime() - new Date(prevDate).getTime();
            dateShiftDays = Number.isFinite(diffTime)
              ? Math.round(diffTime / (1000 * 60 * 60 * 24))
              : 0;
          }

          const prevOutcome = getMilestoneOutcome(prev);
          const newOutcome = getMilestoneOutcome(prop);
          const outcomeChanged = prevOutcome !== newOutcome;

          if (dateChanged) {
            items.push({
              type: 'rescheduled',
              title: getMilestoneTitle(prop),
              previousDate: prevDate,
              newDate,
              dateShiftDays,
              previousOutcome: outcomeChanged ? prevOutcome : undefined,
              newOutcome: outcomeChanged ? newOutcome : undefined,
              status: prop.status || prev.status,
            });
          } else if (outcomeChanged) {
            items.push({
              type: 'modified',
              title: getMilestoneTitle(prop),
              previousDate: prevDate,
              newDate,
              previousOutcome: prevOutcome,
              newOutcome: newOutcome,
              status: prop.status || prev.status,
            });
          } else {
            items.push({
              type: 'unchanged',
              title: getMilestoneTitle(prop),
              previousDate: prevDate,
              newDate,
              status: prop.status || prev.status,
            });
          }
        }
      }
    });

    // Pass 3: Remaining proposed are ADDED
    proposedList.forEach((prop, pIdx) => {
      if (!matchedPropIndices.has(pIdx) && prop) {
        items.push({
          type: 'added',
          title: getMilestoneTitle(prop),
          newDate: getMilestoneDate(prop),
          newOutcome: getMilestoneOutcome(prop) || undefined,
          status: prop.status,
        });
      }
    });

    // Pass 4: Remaining previous are REMOVED
    previousList.forEach((prev, pIdx) => {
      if (!matchedPrevIndices.has(pIdx) && prev) {
        items.push({
          type: 'removed',
          title: getMilestoneTitle(prev),
          previousDate: getMilestoneDate(prev),
          previousOutcome: getMilestoneOutcome(prev) || undefined,
          status: prev.status,
        });
      }
    });

    return items;
  }, [request, previousList, proposedList]);

  const diffCounts = useMemo(() => {
    let rescheduled = 0;
    let added = 0;
    let removed = 0;
    let modified = 0;
    let unchanged = 0;

    diffItems.forEach((d) => {
      if (d.type === 'rescheduled') rescheduled++;
      else if (d.type === 'added') added++;
      else if (d.type === 'removed') removed++;
      else if (d.type === 'modified') modified++;
      else if (d.type === 'unchanged') unchanged++;
    });

    return { rescheduled, added, removed, modified, unchanged };
  }, [diffItems]);

  if (!isOpen || !request) return null;

  const handleReview = async (status: 'approved' | 'rejected') => {
    setSubmitting(true);
    setError('');
    try {
      const { error: reviewError } = await api.put(
        `/api/work/${request.work_id}/milestone-change-requests/${request.id}/review`,
        {
          status,
          admin_notes: adminNotes.trim() || undefined,
        }
      );
      if (reviewError) throw reviewError;
      onReviewed();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || `Failed to ${status} request`);
    } finally {
      setSubmitting(false);
    }
  };

  const formattedDate = (() => {
    try {
      return request.created_at ? new Date(request.created_at).toLocaleString() : 'Recent';
    } catch {
      return 'Recent';
    }
  })();

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 flex items-center justify-between border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center shrink-0">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  [{request.issue_key || 'WORK'}]
                </span>
                <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">Review Milestone Change Request</h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Work:{' '}
                <span className="text-gray-700 dark:text-slate-300 font-medium">
                  {request.work_title || request.project_name || 'Work Entry'}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Requester & Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700/60">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Requested By</span>
              </div>
              <div className="text-sm font-bold text-gray-900 dark:text-slate-100">
                {request.requester_name || 'Staff Member'}
              </div>
              {request.requester_email && (
                <div className="text-xs text-gray-500 dark:text-slate-400">{request.requester_email}</div>
              )}
              {request.requester_department && (
                <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                  {request.requester_department}
                </div>
              )}
            </div>

            <div className="p-3.5 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700/60">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Submitted At</span>
              </div>
              <div className="text-sm font-semibold text-gray-800 dark:text-slate-200">{formattedDate}</div>
              <div className="mt-1">
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                  Status: {request.status}
                </span>
              </div>
            </div>
          </div>

          {/* User's Justification */}
          <div className="p-4 bg-gray-50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/80 rounded-xl">
            <div className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
              Requester Justification / Reason:
            </div>
            <div className="text-sm text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-900/60 p-3 rounded-lg border border-gray-200 dark:border-slate-800 whitespace-pre-wrap">
              {request.reason || 'No justification provided.'}
            </div>
          </div>

          {/* Diff & Comparison Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1">
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Milestone Comparison: What It Was Earlier vs What It Is Now</span>
                </h4>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Review the exact differences before approving or rejecting this milestone plan.
                </p>
              </div>

              {/* View toggle */}
              <div className="flex items-center bg-gray-50 dark:bg-slate-800 p-0.5 rounded-lg border border-gray-200 dark:border-slate-700 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('diff')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'diff'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                  }`}
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  <span>Changes Diff</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('side_by_side')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    viewMode === 'side_by_side'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Side-by-Side</span>
                </button>
              </div>
            </div>

            {/* Change Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 text-xs">
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider block">
                  Rescheduled
                </span>
                <span className="text-lg font-bold text-amber-700 dark:text-amber-300">{diffCounts.rescheduled}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 text-xs">
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider block">
                  Newly Added
                </span>
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{diffCounts.added}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/30 text-xs">
                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold uppercase tracking-wider block">
                  Removed
                </span>
                <span className="text-lg font-bold text-rose-700 dark:text-rose-300">{diffCounts.removed}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-700/60 text-xs">
                <span className="text-[11px] text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider block">
                  Unchanged
                </span>
                <span className="text-lg font-bold text-gray-700 dark:text-slate-300">{diffCounts.unchanged}</span>
              </div>
            </div>

            {loadingFallback && (
              <div className="text-center py-4 text-xs text-gray-500 dark:text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Loading original milestone snapshot...</span>
              </div>
            )}

            {/* VIEW MODE 1: CHANGES DIFF */}
            {viewMode === 'diff' && (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {diffItems.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-slate-800/30 border border-gray-200 dark:border-slate-800 rounded-xl text-xs text-gray-500 dark:text-slate-400">
                    No milestone differences detected.
                  </div>
                ) : (
                  diffItems.map((item, idx) => {
                    const isRescheduled = item.type === 'rescheduled';
                    const isAdded = item.type === 'added';
                    const isRemoved = item.type === 'removed';
                    const isModified = item.type === 'modified';
                    const isUnchanged = item.type === 'unchanged';

                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border text-xs transition ${
                          isRescheduled
                            ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-500/30'
                            : isAdded
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/30'
                            : isRemoved
                            ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-500/30'
                            : isModified
                            ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-500/30'
                            : 'bg-gray-50 dark:bg-slate-800/40 border-gray-200 dark:border-slate-700/60 opacity-80'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`font-bold text-sm ${
                                  isRemoved
                                    ? 'line-through text-rose-700 dark:text-rose-300'
                                    : isAdded
                                    ? 'text-emerald-700 dark:text-emerald-300'
                                    : 'text-gray-900 dark:text-slate-100'
                                }`}
                              >
                                {item.title}
                              </span>

                              {/* Diff Badge */}
                              {isRescheduled && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>Rescheduled</span>
                                  {typeof item.dateShiftDays === 'number' && item.dateShiftDays !== 0 && (
                                    <span>
                                      ({item.dateShiftDays > 0 ? `+${item.dateShiftDays}` : item.dateShiftDays}d)
                                    </span>
                                  )}
                                </span>
                              )}

                              {isAdded && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 inline-flex items-center gap-1">
                                  <PlusCircle className="w-3 h-3" />
                                  <span>Newly Added</span>
                                </span>
                              )}

                              {isRemoved && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 inline-flex items-center gap-1">
                                  <MinusCircle className="w-3 h-3" />
                                  <span>Removed from Plan</span>
                                </span>
                              )}

                              {isModified && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/40 inline-flex items-center gap-1">
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Scope Modified</span>
                                </span>
                              )}

                              {isUnchanged && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700">
                                  Unchanged
                                </span>
                              )}
                            </div>

                            {/* Date comparison */}
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              {isRescheduled ? (
                                <div className="flex items-center gap-2 font-mono">
                                  <span className="text-gray-500 dark:text-slate-400 line-through">
                                    Was: {item.previousDate || 'None'}
                                  </span>
                                  <ArrowRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span className="text-amber-700 dark:text-amber-300 font-bold">
                                    Now: {item.newDate}
                                  </span>
                                </div>
                              ) : isAdded ? (
                                <div className="text-emerald-600 dark:text-emerald-400 font-mono">
                                  Target: <strong>{item.newDate}</strong>
                                </div>
                              ) : isRemoved ? (
                                <div className="text-rose-600 dark:text-rose-400 line-through font-mono">
                                  Was Target: {item.previousDate}
                                </div>
                              ) : (
                                <div className="text-gray-500 dark:text-slate-400 font-mono">
                                  Target: {item.newDate || item.previousDate}
                                </div>
                              )}
                            </div>

                            {/* Outcome comparison */}
                            {item.previousOutcome && item.newOutcome && item.previousOutcome !== item.newOutcome ? (
                              <div className="mt-1 p-2 rounded-lg bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 text-[11px] space-y-0.5">
                                <div className="text-gray-500 dark:text-slate-400">
                                  <span className="text-gray-400 dark:text-slate-500 font-semibold">Was:</span> &ldquo;{item.previousOutcome}&rdquo;
                                </div>
                                <div className="text-gray-800 dark:text-slate-200">
                                  <span className="text-blue-600 dark:text-blue-400 font-semibold">Now:</span> &ldquo;{item.newOutcome}&rdquo;
                                </div>
                              </div>
                            ) : (
                              (item.newOutcome || item.previousOutcome) && (
                                <div className="text-gray-500 dark:text-slate-400 text-[11px]">
                                  Outcome: {item.newOutcome || item.previousOutcome}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* VIEW MODE 2: SIDE-BY-SIDE VIEW */}
            {viewMode === 'side_by_side' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-72 overflow-y-auto pr-1">
                {/* Column 1: Earlier / Previous Milestones */}
                <div className="space-y-2">
                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                      Earlier (Original Plan)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300">
                      {previousList.length} Milestones
                    </span>
                  </div>

                  {previousList.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-200 dark:border-slate-800">
                      No previous milestone record.
                    </div>
                  ) : (
                    previousList.map((m: any, idx: number) => {
                      const title = getMilestoneTitle(m);
                      const isStillInProposed = proposedList.some(
                        (p: any) =>
                          Boolean(p) &&
                          ((p.id && m.id && p.id === m.id) ||
                            getMilestoneTitle(p).trim().toLowerCase() ===
                              title.trim().toLowerCase())
                      );

                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border text-xs transition ${
                            !isStillInProposed
                              ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-500/30'
                              : 'bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`font-semibold ${
                                !isStillInProposed ? 'line-through text-rose-700 dark:text-rose-300' : 'text-gray-800 dark:text-slate-200'
                              }`}
                            >
                              {idx + 1}. {title}
                            </span>
                            <span className="text-gray-500 dark:text-slate-400 font-mono text-[11px] shrink-0">
                              {getMilestoneDate(m)}
                            </span>
                          </div>
                          {m.expected_outcome && (
                            <p className="text-gray-500 dark:text-slate-400 text-[11px] mt-1 line-clamp-2">
                              {m.expected_outcome}
                            </p>
                          )}
                          {!isStillInProposed && (
                            <span className="mt-1.5 inline-block text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">
                              [Removed from proposed plan]
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Column 2: Now / Proposed Milestones */}
                <div className="space-y-2">
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-500/40 flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                      Now (Proposed Plan)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                      {proposedList.length} Milestones
                    </span>
                  </div>

                  {proposedList.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-200 dark:border-slate-800">
                      No proposed milestones provided.
                    </div>
                  ) : (
                    proposedList.map((m: any, idx: number) => {
                      const title = getMilestoneTitle(m);
                      const prevMatch = previousList.find(
                        (p: any) =>
                          Boolean(p) &&
                          ((p.id && m.id && p.id === m.id) ||
                            getMilestoneTitle(p).trim().toLowerCase() ===
                              title.trim().toLowerCase())
                      );
                      const isNew = !prevMatch;
                      const isDateChanged = Boolean(
                        prevMatch &&
                          prevMatch.target_date &&
                          m.target_date &&
                          getMilestoneDate(prevMatch) !== getMilestoneDate(m)
                      );

                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border text-xs transition ${
                            isNew
                              ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/30'
                              : isDateChanged
                              ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-500/30'
                              : 'bg-gray-50 dark:bg-slate-800/80 border-gray-200 dark:border-slate-700/80'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`font-semibold ${
                                isNew ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-900 dark:text-slate-100'
                              }`}
                            >
                              {idx + 1}. {title}
                            </span>
                            <span
                              className={`font-mono text-[11px] shrink-0 ${
                                isDateChanged ? 'text-amber-700 dark:text-amber-300 font-bold' : 'text-gray-500 dark:text-slate-400'
                              }`}
                            >
                              {getMilestoneDate(m)}
                            </span>
                          </div>
                          {m.expected_outcome && (
                            <p className="text-gray-500 dark:text-slate-400 text-[11px] mt-1 line-clamp-2">
                              {m.expected_outcome}
                            </p>
                          )}
                          {isNew && (
                            <span className="mt-1.5 inline-block text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                              [Newly Added]
                            </span>
                          )}
                          {isDateChanged && prevMatch && (
                            <span className="mt-1.5 inline-block text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                              [Date Shifted: was {getMilestoneDate(prevMatch)}]
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Admin Feedback / Notes (only for admins) */}
          {isAdmin ? (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                Admin Remarks / Instructions (sent to requester)
              </label>
              <textarea
                rows={2}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add optional reviewer feedback or explanation for approval/rejection..."
                className="w-full bg-gray-50 dark:bg-slate-800/90 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-xs text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-200 dark:focus:border-blue-500"
              />
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-amber-700 dark:text-amber-200 text-xs flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Awaiting Administrator Approval:</strong> Your proposed revision has been submitted. The active milestone plan remains unchanged until an administrator approves this request.
              </span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-gray-50 dark:bg-slate-800/60 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            {isAdmin ? 'Cancel' : 'Close'}
          </button>
          {isAdmin ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleReview('rejected')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-100 dark:bg-rose-600/20 hover:bg-rose-100 dark:hover:bg-rose-600/30 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject Request</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleReview('approved')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve & Apply Plan</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow transition-all cursor-pointer"
            >
              Done Viewing
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined' || !document.body) {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
}

export default function MilestoneChangeRequestReviewModal(
  props: MilestoneChangeRequestReviewModalProps
) {
  if (!props.isOpen || !props.request) return null;

  return (
    <ErrorBoundary
      onReset={props.onClose}
      fallback={
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                Unable to load Review Comparison
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                An unexpected error occurred while parsing the milestone difference.
              </p>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-50 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-700 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      }
    >
      <ReviewModalInner {...props} />
    </ErrorBoundary>
  );
}
