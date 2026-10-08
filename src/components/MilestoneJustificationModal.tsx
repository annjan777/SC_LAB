import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Link as LinkIcon,
  Flame,
  Search,
  Info,
} from 'lucide-react';
import { WorkMilestone, LinkableWork } from '../types/work';
import { api } from '../lib/api';

interface MilestoneJustificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestone: WorkMilestone | null;
  newStatus: 'completed' | 'delayed' | 'pending' | 'in_progress';
  workId: string;
  isAdmin?: boolean;
  onConfirm: (justification: string, linkedWorkId?: string) => Promise<void>;
}

export default function MilestoneJustificationModal({
  isOpen,
  onClose,
  milestone,
  newStatus,
  workId,
  isAdmin,
  onConfirm,
}: MilestoneJustificationModalProps) {
  const [justification, setJustification] = useState('');
  const [linkedWorkId, setLinkedWorkId] = useState('');
  const [linkableWorks, setLinkableWorks] = useState<LinkableWork[]>([]);
  const [loadingLinkables, setLoadingLinkables] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isDelay = newStatus === 'delayed';
  const isComplete = newStatus === 'completed';

  useEffect(() => {
    if (isOpen && milestone) {
      setJustification(milestone.justification || '');
      setLinkedWorkId(milestone.justification_linked_work_id || '');
      setError('');
      loadLinkables();
    }
  }, [isOpen, milestone]);

  const loadLinkables = async () => {
    setLoadingLinkables(true);
    try {
      const { data: linkablesData } = await api.get<LinkableWork[]>('/api/work/linkable');
      const list = Array.isArray(linkablesData) ? linkablesData : [];
      // Filter out the current work item so it can't link to itself
      setLinkableWorks(list.filter((w) => w.id !== workId));
    } catch (err: any) {
      console.error('Failed to load linkable works', err);
    } finally {
      setLoadingLinkables(false);
    }
  };

  if (!isOpen || !milestone) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim()) {
      setError('A detailed justification is mandatory for this milestone status update.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onConfirm(justification.trim(), linkedWorkId || undefined);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update milestone status');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredWorks = linkableWorks.filter((w) => {
    const q = searchTerm.toLowerCase();
    return (
      w.work_title.toLowerCase().includes(q) ||
      (w.issue_key && w.issue_key.toLowerCase().includes(q)) ||
      w.project_name.toLowerCase().includes(q) ||
      (w.user_name && w.user_name.toLowerCase().includes(q))
    );
  });

  const selectedWork = linkableWorks.find((w) => w.id === linkedWorkId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div
          className={`p-5 flex items-center justify-between border-b ${
            isDelay
              ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-500/20'
              : isComplete
              ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-500/20'
              : 'bg-gray-50 border-gray-200 dark:bg-slate-800/40 dark:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isDelay
                  ? 'bg-amber-100 text-amber-600 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30'
                  : isComplete
                  ? 'bg-emerald-100 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'
                  : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
              }`}
            >
              {isDelay ? (
                <AlertTriangle className="w-5 h-5" />
              ) : isComplete ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Clock className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">
                {isDelay
                  ? 'Milestone Delay Justification'
                  : isComplete
                  ? 'Milestone Completion Justification'
                  : 'Milestone Status Update'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Audit trail requires documentation for milestone status changes.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Supervisor Review Notice for Delays */}
          {isDelay && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                {isAdmin ? (
                  <>
                    <span className="font-bold">Admin Direct Action:</span> As an administrator, your milestone status update and justification will be applied and approved directly into the audit record without requiring supervisor approval.
                  </>
                ) : (
                  <>
                    <span className="font-bold">Supervisor Review Workflow:</span> Delay justifications enter a <strong>Pending Approval</strong> state. The milestone will stay marked as Delayed until your supervisor approves the justification.
                  </>
                )}
              </div>
            </div>
          )}

          {/* Current Milestone Summary */}
          <div className="bg-gray-50 border border-gray-200 dark:bg-slate-800/60 dark:border-slate-700/60 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-1">
              Target Milestone
            </div>
            <div className="text-sm font-semibold text-gray-900 dark:text-slate-200">
              {milestone.milestone_description || milestone.title}
            </div>
            <div className="text-xs text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-2">
              <span>Target: {milestone.target_date}</span>
              <span>•</span>
              <span className="capitalize">
                New Status:{' '}
                <strong
                  className={
                    isDelay ? 'text-amber-600 dark:text-amber-400' : isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-slate-300'
                  }
                >
                  {newStatus}
                </strong>
              </span>
            </div>
          </div>

          {/* Justification Textarea */}
          <div>
            <label htmlFor="milestone-justification" className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
              Justification & Explanation <span className="text-rose-500 dark:text-rose-400">*</span>
            </label>
            <textarea
              id="milestone-justification"
              required
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder={
                isDelay
                  ? 'Detail the exact cause of this delay (e.g. equipment breakdown, delayed procurement, or Code-Red emergency work)...'
                  : 'Describe the milestone deliverable, outcome, and verification steps...'
              }
              className="w-full bg-white border border-gray-300 text-gray-900 placeholder-gray-400 dark:bg-slate-800/90 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
              This reason will be logged in the immutable audit feed and visible to supervisors.
            </p>
          </div>

          {/* Optional Linked Work / Blocker Task */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="milestone-link-search" className="text-xs font-semibold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Link Cause / Blocker Work Item</span>
                <span className="text-[10px] text-gray-500 dark:text-slate-400 font-normal">(Optional)</span>
              </label>
              {linkedWorkId && (
                <button
                  type="button"
                  onClick={() => setLinkedWorkId('')}
                  className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline"
                >
                  Clear link
                </button>
              )}
            </div>

            {selectedWork && (
              <div className="mb-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">[{selectedWork.issue_key}]</span>
                  <span className="text-gray-900 dark:text-slate-200 truncate">{selectedWork.work_title}</span>
                  {selectedWork.priority === 'code_red' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/40">
                      🚨 CODE-RED
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 dark:text-slate-400 absolute left-3 top-3" />
              <input
                id="milestone-link-search"
                type="text"
                placeholder="Search other tasks or Code-Red emergencies by key or title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-gray-300 text-gray-900 placeholder-gray-400 dark:bg-slate-800/60 dark:border-slate-700/80 dark:text-slate-200 dark:placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="mt-2 max-h-36 overflow-y-auto space-y-1.5 border border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-950/40 rounded-xl p-1">
              {loadingLinkables ? (
                <div className="p-3 text-center text-xs text-gray-500 dark:text-slate-500">Loading works...</div>
              ) : filteredWorks.length === 0 ? (
                <div className="p-3 text-center text-xs text-gray-500 dark:text-slate-500">No matching works found</div>
              ) : (
                filteredWorks.slice(0, 8).map((w) => {
                  const isSelected = w.id === linkedWorkId;
                  const isCodeRed = w.priority === 'code_red';
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setLinkedWorkId(isSelected ? '' : w.id)}
                      className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-blue-100 border border-blue-400 text-blue-900 dark:bg-blue-600/30 dark:border-blue-500/50 dark:text-white'
                          : isCodeRed
                          ? 'bg-red-50 border border-red-200 hover:bg-red-100 text-gray-900 dark:bg-red-950/40 dark:border-red-500/30 dark:hover:bg-red-950/70 dark:text-slate-200'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">[{w.issue_key}]</span>
                        <span className="truncate">{w.work_title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {isCodeRed && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 dark:bg-red-600/30 dark:text-red-300 dark:border-red-500/40 animate-pulse">
                            <Flame className="w-3 h-3 text-red-500 dark:text-red-400" />
                            CODE-RED
                          </span>
                        )}
                        <span className="text-[10px] text-gray-500 dark:text-slate-500 truncate max-w-[80px]">
                          {w.user_name}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-start gap-1.5 mt-2 text-[11px] text-gray-500 dark:text-slate-400">
              <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span>
                Linking a task automatically records a dependency link (e.g. &quot;delayed by Code-Red&quot;
                or &quot;is blocked by&quot;) and notifies the administration.
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-gray-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-slate-300 dark:hover:text-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 text-white ${
                isDelay
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'
              }`}
            >
              {submitting
                ? 'Saving...'
                : isDelay
                ? isAdmin
                  ? 'Apply Delay Record Directly'
                  : 'Submit Delay Justification for Supervisor Approval'
                : 'Confirm Justification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
