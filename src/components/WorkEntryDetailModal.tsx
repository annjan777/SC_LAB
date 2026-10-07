import React, { useState, useEffect } from 'react';
import {
  X,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Calendar,
  TrendingUp,
  MessageSquare,
  Link as LinkIcon,
  Activity,
  Plus,
  Flame,
  AlertTriangle,
  GitPullRequest,
  Check,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Info,
  GitCompare,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { unescapeHtml } from '../utils/formatters';
import {
  AssignedWork,
  WorkMilestone,
  WorkDependency,
  AuditLogEntry,
  LinkableWork,
  DependencyType,
  MilestoneChangeRequest,
} from '../types/work';
import {
  IssueKeyTag,
  IssueTypeBadge,
  WorkPriorityBadge,
} from './WorkIssueBadge';
import MilestoneJustificationModal from './MilestoneJustificationModal';
import MilestoneChangeRequestReviewModal from './MilestoneChangeRequestReviewModal';

interface WorkEntryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  workId: string;
  onEdit: () => void;
  onDelete?: () => void;
  onUpdateProgress: () => void;
  onReportProblem: () => void;
  onRefresh: () => void;
}

interface ProgressUpdate {
  id: string;
  update_date: string;
  status: string;
  completion_percentage: number;
  progress_notes: string;
}

interface Problem {
  id: string;
  category: string;
  description: string;
  impact_level: string;
  reported_date: string;
  is_resolved: boolean;
  resolution_date: string | null;
  mitigation_actions: Array<{
    id: string;
    proposed_mitigation: string;
    support_required_from: string;
    urgency_level: string;
    status: string;
  }>;
}

interface AdminComment {
  id: string;
  comment_text: string;
  created_at: string;
  is_read_by_user: boolean;
  admin_profile: {
    full_name: string;
  };
}

export default function WorkEntryDetailModal({
  isOpen,
  onClose,
  workId,
  onEdit,
  onDelete,
  onUpdateProgress,
  onReportProblem,
  onRefresh,
}: WorkEntryDetailModalProps) {
  const { user, profile, hasPermission } = useAuth();
  const isAdmin = profile?.user_role === 'admin' || profile?.user_role === 'super_admin';
  const canDelete = hasPermission('delete_work') || isAdmin;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [work, setWork] = useState<AssignedWork | null>(null);
  const [milestones, setMilestones] = useState<WorkMilestone[]>([]);
  const [changeRequests, setChangeRequests] = useState<MilestoneChangeRequest[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [adminComments, setAdminComments] = useState<AdminComment[]>([]);
  const [dependencies, setDependencies] = useState<WorkDependency[]>([]);
  const [dependents, setDependents] = useState<WorkDependency[]>([]);
  const [activityLogs, setActivityLogs] = useState<AuditLogEntry[]>([]);
  const [reviewingMilestoneId, setReviewingMilestoneId] = useState<string | null>(null);

  const isSupervisor = Boolean(
    (work?.assigned_by_user_id && work.assigned_by_user_id === user?.id) ||
    (work?.assigned_by && user?.email && work.assigned_by.trim().toLowerCase() === user.email.trim().toLowerCase())
  );
  const canReviewJustification = isAdmin || hasPermission('manage_work_cycles') || isSupervisor;

  // Form states
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'milestones' | 'dependencies' | 'activity' | 'progress' | 'problems' | 'comments'
  >('overview');

  // Milestone Justification Modal state
  const [justificationModalOpen, setJustificationModalOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<WorkMilestone | null>(null);
  const [milestoneTargetStatus, setMilestoneTargetStatus] = useState<
    'completed' | 'delayed' | 'pending' | 'in_progress'
  >('completed');
  const [selectedChangeRequest, setSelectedChangeRequest] = useState<MilestoneChangeRequest | null>(null);

  // Add Dependency inline state
  const [showAddDep, setShowAddDep] = useState(false);
  const [depTargetId, setDepTargetId] = useState('');
  const [depType, setDepType] = useState<DependencyType>('blocks');
  const [depNotes, setDepNotes] = useState('');
  const [linkableWorks, setLinkableWorks] = useState<LinkableWork[]>([]);
  const [loadingLinkables, setLoadingLinkables] = useState(false);
  const [submittingDep, setSubmittingDep] = useState(false);

  useEffect(() => {
    if (isOpen && workId) {
      fetchWorkDetails();
    }
  }, [isOpen, workId]);

  const fetchWorkDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: workData, error: workError } = await api.get<AssignedWork>('/api/work/' + workId);
      if (workError || !workData) {
        throw new Error('Work entry not found');
      }
      setWork(workData);

      const [
        milestonesRes,
        progressRes,
        problemsRes,
        commentsRes,
        depsRes,
        activityRes,
        changeRequestsRes,
      ] = await Promise.all([
        api.get<WorkMilestone[]>('/api/work/' + workId + '/milestones'),
        api.get<ProgressUpdate[]>('/api/work/' + workId + '/progress'),
        api.get<Problem[]>('/api/work/' + workId + '/problems'),
        api.get<AdminComment[]>('/api/work/' + workId + '/comments'),
        api.get<{ dependencies: WorkDependency[]; dependents: WorkDependency[] }>(
          '/api/work/' + workId + '/dependencies'
        ),
        api.get<AuditLogEntry[]>('/api/work/' + workId + '/activity'),
        api.get<MilestoneChangeRequest[]>('/api/work/' + workId + '/milestone-change-requests'),
      ]);

      setMilestones(Array.isArray(milestonesRes.data) ? milestonesRes.data : []);
      setProgressUpdates(Array.isArray(progressRes.data) ? progressRes.data : []);
      setProblems(Array.isArray(problemsRes.data) ? problemsRes.data : []);
      setChangeRequests(Array.isArray(changeRequestsRes.data) ? changeRequestsRes.data : []);

      const commentsData = Array.isArray(commentsRes.data) ? commentsRes.data : [];
      setAdminComments(commentsData);

      if (depsRes.data) {
        setDependencies(Array.isArray(depsRes.data.dependencies) ? depsRes.data.dependencies : []);
        setDependents(Array.isArray(depsRes.data.dependents) ? depsRes.data.dependents : []);
      }

      setActivityLogs(Array.isArray(activityRes.data) ? activityRes.data : []);

      // Mark unread comments as read
      const unreadIds = commentsData.filter((c: any) => !c.is_read_by_user).map((c: any) => c.id);
      if (unreadIds.length > 0) {
        await api.post('/api/work/' + workId + '/comments/mark-read', { ids: unreadIds });
      }
    } catch (err: any) {
      console.error('Error fetching work details:', err);
      setError('Failed to load work details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadLinkables = async () => {
    setLoadingLinkables(true);
    try {
      const { data } = await api.get<LinkableWork[]>('/api/work/linkable');
      const list = Array.isArray(data) ? data : [];
      setLinkableWorks(list.filter((w) => w.id !== workId));
    } catch (err) {
      console.error('Failed to load linkables', err);
    } finally {
      setLoadingLinkables(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const { error } = await api.post(`/api/work/${workId}/comments`, {
        comment_text: newComment,
      });
      if (error) throw error;
      setNewComment('');
      await fetchWorkDetails();
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Failed to add comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const openMilestoneJustification = (
    milestone: WorkMilestone,
    targetStatus: 'completed' | 'delayed' | 'pending' | 'in_progress'
  ) => {
    setSelectedMilestone(milestone);
    setMilestoneTargetStatus(targetStatus);
    setJustificationModalOpen(true);
  };

  const handleConfirmMilestoneJustification = async (justification: string, linkedWorkId?: string) => {
    if (!selectedMilestone) return;
    const isCompleted = milestoneTargetStatus === 'completed';
    const { error: mError } = await api.put(
      `/api/work/${workId}/milestones/${selectedMilestone.id}`,
      {
        status: milestoneTargetStatus,
        is_completed: isCompleted,
        justification,
        justification_linked_work_id: linkedWorkId || null,
      }
    );
    if (mError) throw mError;
    await fetchWorkDetails();
    onRefresh();
  };

  const handleResetMilestoneToPending = async (milestoneId: string) => {
    if (!confirm('Reset milestone status to Pending?')) return;
    const { error } = await api.put(`/api/work/${workId}/milestones/${milestoneId}`, {
      status: 'pending',
      is_completed: false,
      justification: 'Status reset to pending',
    });
    if (error) {
      alert((error as any).response?.data?.error || (error as any).message || 'Failed to reset milestone');
      return;
    }
    await fetchWorkDetails();
    onRefresh();
  };

  const handleReviewJustification = async (milestoneId: string, status: 'approved' | 'rejected') => {
    let reviewNotes: string | null = null;
    if (status === 'rejected') {
      const input = prompt(
        'Please enter the reason for rejecting this milestone delay (required for audit):',
        'Delay rejected by supervisor. Immediate resolution or completion required.'
      );
      if (input === null) return;
      reviewNotes = input.trim() || 'Delay rejected by supervisor. Immediate resolution or completion required.';
    } else if (status === 'approved') {
      const input = prompt('Optional supervisor approval remarks (click OK to approve directly):', 'Delay acknowledged and approved by supervisor.');
      if (input === null) return;
      reviewNotes = input.trim() || 'Delay acknowledged and approved by supervisor.';
    }

    try {
      setReviewingMilestoneId(milestoneId);
      const { error: reviewErr } = await api.put(
        `/api/work/${workId}/milestones/${milestoneId}/review-justification`,
        {
          status,
          review_notes: reviewNotes,
        }
      );
      if (reviewErr) throw reviewErr;
      await fetchWorkDetails();
      onRefresh();
    } catch (err: any) {
      console.error('Failed to review milestone justification:', err);
      alert(err.response?.data?.error || err.message || 'Failed to review justification');
    } finally {
      setReviewingMilestoneId(null);
    }
  };

  const handleAddDependency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depTargetId) return;
    setSubmittingDep(true);
    try {
      const { error: depErr } = await api.post(`/api/work/${workId}/dependencies`, {
        depends_on_work_id: depTargetId,
        dependency_type: depType,
        notes: depNotes.trim() || undefined,
      });
      if (depErr) throw depErr;
      setShowAddDep(false);
      setDepTargetId('');
      setDepNotes('');
      await fetchWorkDetails();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to add dependency');
    } finally {
      setSubmittingDep(false);
    }
  };

  const handleRemoveDependency = async (depId: string) => {
    if (!confirm('Are you sure you want to remove this dependency link?')) return;
    try {
      const { error: rmErr } = await api.delete(`/api/work/${workId}/dependencies/${depId}`);
      if (rmErr) throw rmErr;
      await fetchWorkDetails();
    } catch (err: any) {
      alert('Failed to remove dependency');
    }
  };

  if (!isOpen) return null;

  const completedMilestones = milestones.filter((m) => m.status === 'completed' || m.is_completed).length;
  const openProblems = problems.filter((p) => !p.is_resolved).length;
  const latestProgress = progressUpdates[0];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'delayed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'needs_attention':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-800 transition-colors">
        {/* Header Bar */}
        <div className="border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/70 dark:bg-slate-850 shrink-0">
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <IssueKeyTag issueKey={work?.issue_key} />
              <IssueTypeBadge type={work?.issue_type} />
              <WorkPriorityBadge priority={work?.priority} />

              {/* Status Badge: DELAYED takes precedence if unapproved/rejected delays exist */}
              {milestones.some((m) => m.status === 'delayed' && m.justification_status !== 'approved') ? (
                <span className="px-2.5 py-0.5 text-xs font-bold rounded uppercase border bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-200 border-red-300 dark:border-red-800 flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  <span>DELAYED</span>
                </span>
              ) : latestProgress?.status ? (
                <span
                  className={`px-2 py-0.5 text-xs font-semibold rounded uppercase border ${getStatusColor(
                    latestProgress.status
                  )}`}
                >
                  {latestProgress.status.replace('_', ' ')}
                </span>
              ) : work?.admin_status ? (
                <span
                  className={`px-2 py-0.5 text-xs font-semibold rounded uppercase border ${getStatusColor(
                    work.admin_status
                  )}`}
                >
                  {work.admin_status.replace('_', ' ')}
                </span>
              ) : null}

              {/* Delayed by User Badge for immediate visibility */}
              {milestones.some((m) => m.status === 'delayed' && m.justification_status !== 'approved') && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-red-500 dark:text-red-400" />
                  <span>Delayed by {work?.user_name || 'Assignee'}</span>
                </span>
              )}
            </div>

            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 truncate">
              {work?.work_title || work?.project_name || 'Work Entry Details'}
            </h2>
            <div className="text-xs text-gray-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
              <span>Project: <strong className="text-gray-800 dark:text-slate-200">{work?.project_name}</strong></span>
              <span>•</span>
              <span>Assigned To: <strong className="text-gray-800 dark:text-slate-200">{work?.user_name || 'Staff Member'}</strong></span>
              <span>•</span>
              <span>Supervisor: <strong className="text-gray-800 dark:text-slate-200">{work?.assigned_by}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                fetchWorkDetails();
                onRefresh();
              }}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
              title="Refresh Data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={onEdit}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
              title="Edit Work Entry"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            {onDelete && canDelete && (
              <button
                onClick={onDelete}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Delete Work Entry"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Priority & Blocker Notices */}
        {work?.priority === 'code_red' && (
          <div className="bg-red-600 text-white px-6 py-2.5 flex items-center justify-between text-xs font-semibold shadow-inner shrink-0">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 fill-white animate-bounce" />
              <span>
                CRITICAL EMERGENCY (CODE-RED): This task takes precedence over all other milestones.
              </span>
            </div>
            <span className="font-mono text-[11px] opacity-90">
              Active since: {work.code_red_activated_at ? new Date(work.code_red_activated_at).toLocaleDateString() : 'Active'}
            </span>
          </div>
        )}

        {(work?.blocked_by_code_red_count ?? 0) > 0 && work?.priority !== 'code_red' && (
          <div className="bg-amber-500 text-slate-950 px-6 py-2 flex items-center gap-2 text-xs font-bold shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              DEPENDENCY ALERT: This work is currently linked to an active Code-Red task. Expected delays may accumulate.
            </span>
          </div>
        )}

        {(work?.pending_milestone_requests_count ?? 0) > 0 && (
          <div className="bg-blue-600 text-white px-6 py-2 flex items-center gap-2 text-xs font-semibold shrink-0">
            <GitPullRequest className="w-4 h-4 shrink-0" />
            <span>
              PENDING APPROVAL: A milestone revision request has been submitted and is awaiting administrator review.
            </span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-900 overflow-x-auto shrink-0 sticky top-0 z-20">
          <div className="flex gap-6 whitespace-nowrap min-w-max">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-1 border-b-2 font-medium text-xs sm:text-sm transition cursor-pointer ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('milestones')}
              className={`py-3 px-1 border-b-2 font-medium text-xs sm:text-sm transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'milestones'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              <span>Milestones</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 font-bold">
                {completedMilestones}/{milestones.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dependencies')}
              className={`py-3 px-1 border-b-2 font-medium text-xs sm:text-sm transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'dependencies'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Issue Links</span>
              {(dependencies.length > 0 || dependents.length > 0) && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold">
                  {dependencies.length + dependents.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              className={`py-3 px-1 border-b-2 font-medium text-xs sm:text-sm transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'activity'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Audit Feed</span>
              {activityLogs.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold">
                  {activityLogs.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('progress')}
              className={`py-3 px-1 border-b-2 font-medium text-xs sm:text-sm transition cursor-pointer ${
                activeTab === 'progress'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              Progress History ({progressUpdates.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('problems')}
              className={`py-3 px-1 border-b-2 font-medium text-xs sm:text-sm transition cursor-pointer ${
                activeTab === 'problems'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              Problems ({openProblems})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('comments')}
              className={`py-3 px-1 border-b-2 font-medium text-xs sm:text-sm transition cursor-pointer ${
                activeTab === 'comments'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              Comments ({adminComments.length})
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-slate-50/40 dark:bg-slate-900/60">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-900 mb-1">Error Loading Data</h3>
                <p className="text-xs text-gray-600 mb-3">{error}</p>
                <button
                  onClick={fetchWorkDetails}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-semibold"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && work && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                        Completion Progress
                      </span>
                      <p className="text-2xl font-bold text-blue-900 mt-1">
                        {latestProgress ? `${latestProgress.completion_percentage}%` : '0%'}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        {completedMilestones} of {milestones.length} milestones completed
                      </p>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                      <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                        Dependencies & Links
                      </span>
                      <p className="text-2xl font-bold text-amber-900 mt-1">
                        {dependencies.length} Depends / {dependents.length} Blocking
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        {work.blocked_by_code_red_count ? '🚨 Blocked by Code-Red' : 'Active dependency links'}
                      </p>
                    </div>

                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                      <span className="text-xs font-semibold uppercase tracking-wider text-red-700">
                        Open Problems
                      </span>
                      <p className="text-2xl font-bold text-red-900 mt-1">{openProblems}</p>
                      <p className="text-xs text-red-600 mt-1">
                        {problems.length - openProblems} resolved
                      </p>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-gray-200 space-y-4 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                      Work Specifications
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase">Description</span>
                        <p className="text-sm text-gray-900 whitespace-pre-line mt-1 bg-gray-50 p-3 rounded-lg border border-gray-100">
                          {unescapeHtml(work.description) || 'No description provided'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                        <div>
                          <span className="text-xs font-semibold text-gray-500 uppercase">Start Date</span>
                          <p className="text-sm font-medium text-gray-900 mt-0.5">
                            {new Date(work.start_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-gray-500 uppercase">Target End</span>
                          <p className="text-sm font-medium text-gray-900 mt-0.5">
                            {new Date(work.end_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-gray-500 uppercase">Supervisor</span>
                          <p className="text-sm font-medium text-gray-900 mt-0.5">{work.assigned_by}</p>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-gray-500 uppercase">Admin Status</span>
                          <p className="text-sm font-medium text-gray-900 mt-0.5">
                            {work.admin_status.replace('_', ' ').toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {latestProgress && (
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                          Latest Progress Update
                        </h3>
                        <span className="text-xs text-gray-500">
                          {new Date(latestProgress.update_date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        {latestProgress.progress_notes}
                      </p>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Completion</span>
                          <span className="font-bold">{latestProgress.completion_percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-blue-600 h-2.5 rounded-full transition-all"
                            style={{ width: `${latestProgress.completion_percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: MILESTONES */}
              {activeTab === 'milestones' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">Milestones & Verification</h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {isAdmin || hasPermission('manage_work_cycles')
                          ? 'As an Administrator, you can directly edit milestones, reschedule dates, and approve delays without requesting approval.'
                          : 'Status changes (complete or delayed) require justification. Content or schedule revisions require Admin approval.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveTab('overview')}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-750 transition shadow-xs cursor-pointer"
                      >
                        ← Back to Overview
                      </button>
                      {isAdmin || hasPermission('manage_work_cycles') ? (
                      <button
                        type="button"
                        onClick={onEdit}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
                        title="Directly edit milestones without requesting approval"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit Milestones Directly</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onEdit}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Request Milestone Revisions</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Pending Milestone Change Request Banner */}
                  {(() => {
                    const pendingReq = changeRequests.find((r) => r.status === 'pending');
                    if (!pendingReq) return null;
                    return (
                      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2">
                        <div className="flex items-start gap-2.5">
                          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                                  Milestone Revision Request Pending Admin Approval
                                </h4>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-200 text-amber-900 border border-amber-300 font-semibold">
                                  Pending Review
                                </span>
                              </div>

                              {isAdmin || hasPermission('manage_work_cycles') ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedChangeRequest(pendingReq)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                                >
                                  <GitCompare className="w-3.5 h-3.5" />
                                  <span>Review & Compare Changes</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSelectedChangeRequest(pendingReq)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm flex items-center gap-1.5 transition shrink-0 cursor-pointer"
                                >
                                  <GitCompare className="w-3.5 h-3.5" />
                                  <span>View Requested Changes</span>
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                              Submitted by <strong>{pendingReq.requester_name || 'User'}</strong> on{' '}
                              {new Date(pendingReq.created_at).toLocaleDateString()} with{' '}
                              <strong>{pendingReq.proposed_milestones?.length || 0} proposed milestone(s)</strong>.
                            </p>
                            {pendingReq.reason && (
                              <p className="text-xs text-amber-900 dark:text-amber-200 bg-white/70 dark:bg-slate-900/60 p-2 rounded-lg border border-amber-200 dark:border-amber-800 mt-1.5 italic">
                                Reason: &ldquo;{pendingReq.reason}&rdquo;
                              </p>
                            )}
                            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2">
                              Active milestones below remain in effect until this change request is approved by an administrator.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {milestones.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                      <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No milestones defined for this work entry</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {milestones.map((m, idx) => {
                        const isCompleted = m.status === 'completed' || m.is_completed;
                        const isDelayed = m.status === 'delayed';
                        const todayDateStr = new Date().toISOString().split('T')[0];
                        const targetDateStr = m.target_date
                          ? m.target_date.includes('T')
                            ? m.target_date.split('T')[0]
                            : m.target_date
                          : '';
                        const isPastTargetDate = Boolean(targetDateStr && targetDateStr < todayDateStr);

                        return (
                          <div
                            key={m.id || idx}
                            className={`p-4 rounded-xl border transition-all ${
                              isCompleted
                                ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                                : isDelayed
                                ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-800/60'
                                : 'bg-white dark:bg-slate-800/60 border-gray-200 dark:border-slate-700 shadow-sm'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5 border border-gray-200 dark:border-slate-700">
                                  {idx + 1}
                                </span>
                                <div className="space-y-1 flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`text-sm font-bold ${
                                        isCompleted
                                          ? 'line-through text-gray-400 dark:text-slate-500'
                                          : 'text-gray-900 dark:text-slate-100'
                                      }`}
                                    >
                                      {m.milestone_description || m.title}
                                    </span>
                                    {isCompleted ? (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700">
                                        COMPLETED
                                      </span>
                                    ) : isDelayed ? (
                                      m.justification_status === 'approved' ? (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                          <span>DELAYED · APPROVED</span>
                                        </span>
                                      ) : m.justification_status === 'rejected' ? (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border inline-flex items-center gap-1 bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700">
                                          <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />
                                          <span>DELAYED · UNJUSTIFIED (REJECTED)</span>
                                        </span>
                                      ) : m.justification_status === 'pending' ? (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                                          <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 animate-spin-slow" />
                                          <span>DELAYED · PENDING APPROVAL</span>
                                        </span>
                                      ) : !m.justification ? (
                                        canReviewJustification ? (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700">
                                            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                            <span>OVERDUE · DELAYED (APPROVAL REQUIRED)</span>
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border inline-flex items-center gap-1 bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700 animate-pulse">
                                            <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />
                                            <span>OVERDUE · DELAYED (JUSTIFICATION REQUIRED)</span>
                                          </span>
                                        )
                                      ) : (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                                          <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 animate-spin-slow" />
                                          <span>DELAYED · PENDING APPROVAL</span>
                                        </span>
                                      )
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700">
                                        {m.status || 'PENDING'}
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-xs text-gray-600 dark:text-slate-400 flex flex-wrap items-center gap-3">
                                    <span>Target Date: <strong className="text-gray-900 dark:text-slate-200">{targetDateStr || m.target_date}</strong></span>
                                    {m.expected_outcome && (
                                      <span>Outcome: <strong className="text-gray-900 dark:text-slate-200">{m.expected_outcome}</strong></span>
                                    )}
                                  </div>

                                  {/* Overdue Auto-Delayed Notification Banner */}
                                  {isDelayed && !m.justification && !m.justification_status && (
                                    canReviewJustification ? (
                                      <div className="mt-3.5 p-4 rounded-xl border border-amber-500/30 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/25 shadow-sm space-y-3">
                                        <div className="flex items-start gap-3">
                                          <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                                            <Clock className="w-4 h-4" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <span className="font-semibold text-xs text-gray-900 dark:text-slate-100">
                                                Target Date Passed ({targetDateStr || m.target_date}) · Overdue Milestone
                                              </span>
                                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                                                <ShieldAlert className="w-3 h-3 text-amber-500" />
                                                Supervisor Action Needed
                                              </span>
                                            </div>
                                            <p className="text-xs text-gray-600 dark:text-slate-300 mt-1 leading-relaxed">
                                              {m.justification_status === 'rejected'
                                                ? `You have rejected this milestone delay. It remains marked as Delayed until assignee resolves or completes this milestone.`
                                                : `Assignee has not submitted delay justification. As Supervisor, you can approve the delay, reject it as unjustified, or reschedule.`}
                                            </p>
                                          </div>
                                        </div>

                                        <div className="pt-2.5 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-2">
                                          <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">
                                            Supervisor Actions:
                                          </span>
                                          <div className="flex flex-wrap items-center gap-2">
                                            <button
                                              type="button"
                                              disabled={reviewingMilestoneId === m.id}
                                              onClick={() => handleReviewJustification(m.id, 'approved')}
                                              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                                              title="Approve this milestone delay as supervisor"
                                            >
                                              <CheckCircle2 className="w-3.5 h-3.5" />
                                              <span>Approve Delay</span>
                                            </button>
                                            {m.justification_status !== 'rejected' && (
                                              <button
                                                type="button"
                                                disabled={reviewingMilestoneId === m.id}
                                                onClick={() => handleReviewJustification(m.id, 'rejected')}
                                                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                                                title="Reject this delay as unjustified"
                                              >
                                                <X className="w-3.5 h-3.5" />
                                                <span>Reject Delay</span>
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              onClick={onEdit}
                                              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 border border-gray-300 dark:border-slate-600 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                                              title="Reschedule milestone target date"
                                            >
                                              <Calendar className="w-3.5 h-3.5 text-amber-500" />
                                              <span>Reschedule</span>
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="mt-3.5 p-4 rounded-xl border border-rose-500/30 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-950/25 shadow-sm space-y-3">
                                        <div className="flex items-start gap-3">
                                          <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                                            <AlertTriangle className="w-4 h-4" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                              <span className="font-semibold text-xs text-gray-900 dark:text-slate-100">
                                                Target Date Passed ({targetDateStr || m.target_date}) · Automatically Marked Delayed
                                              </span>
                                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30">
                                                Action Required
                                              </span>
                                            </div>
                                            <p className="text-xs text-gray-600 dark:text-slate-300 mt-1 leading-relaxed">
                                              This milestone passed its scheduled completion date. Please provide a delay justification and optional blocker for supervisor approval.
                                            </p>
                                          </div>
                                        </div>
                                        <div className="pt-2.5 border-t border-rose-500/20 flex justify-end">
                                          <button
                                            type="button"
                                            onClick={() => openMilestoneJustification(m, 'delayed')}
                                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                                          >
                                            <AlertTriangle className="w-3.5 h-3.5" />
                                            <span>Provide Delay Justification</span>
                                          </button>
                                        </div>
                                      </div>
                                    )
                                  )}

                                  {/* Justification Box */}
                                  {(m.justification || m.justification_status) && (
                                    <div
                                      className={`mt-2.5 p-3 rounded-xl border text-xs transition-all ${
                                        m.justification_status === 'approved'
                                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                                          : m.justification_status === 'rejected'
                                          ? 'bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-950 dark:text-red-200'
                                          : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200'
                                      }`}
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 pb-1 border-b border-black/5 dark:border-white/5">
                                        <div className="font-bold text-[11px] uppercase tracking-wider text-gray-700 dark:text-slate-300">
                                          Status Justification
                                        </div>

                                        {m.justification_status === 'approved' ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                            Justified (Approved{m.justification_reviewer_name ? ` by ${m.justification_reviewer_name}` : ''})
                                          </span>
                                        ) : m.justification_status === 'rejected' ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700">
                                            <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />
                                            Justification Rejected
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                                            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                            Pending Supervisor Approval
                                          </span>
                                        )}
                                      </div>

                                      {m.justification && (
                                        <p className="italic text-gray-800 dark:text-slate-200 font-medium">
                                          &ldquo;{m.justification}&rdquo;
                                        </p>
                                      )}

                                      {/* Linked Blocker Work */}
                                      {m.justification_linked_work_id && (
                                        <div className="mt-2 flex items-center gap-2 text-xs">
                                          <span className="text-gray-500 dark:text-slate-400 font-medium">Linked Blocker / Cause:</span>
                                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-medium">
                                            <LinkIcon className="w-3 h-3" />
                                            <span className="font-mono font-bold">
                                              [{m.linked_work_key || 'LINKED'}]
                                            </span>
                                            <span>{m.linked_work_title}</span>
                                            {m.linked_work_priority === 'code_red' && (
                                              <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-red-600 text-white animate-pulse">
                                                CODE-RED
                                              </span>
                                            )}
                                          </span>
                                        </div>
                                      )}

                                      {/* Supervisor Feedback Note if reviewed */}
                                      {m.justification_review_notes && (
                                        <div className="mt-2 p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-black/10 dark:border-white/10 text-xs">
                                          <span className="font-semibold text-gray-600 dark:text-slate-400">Supervisor Note: </span>
                                          <span className="text-gray-800 dark:text-slate-200">{m.justification_review_notes}</span>
                                        </div>
                                      )}

                                      {/* Pending Notice for regular users */}
                                      {m.justification_status === 'pending' && !canReviewJustification && (
                                        <div className="mt-2 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-1">
                                          <Info className="w-3.5 h-3.5 shrink-0" />
                                          <span>This milestone remains delayed until approved by supervisor ({work?.assigned_by || 'Supervisor'}).</span>
                                        </div>
                                      )}

                                      {/* Supervisor / Admin Review Action Buttons */}
                                      {canReviewJustification && m.justification_status === 'pending' && (
                                        <div className="mt-3 pt-2.5 border-t border-amber-200 dark:border-amber-800 flex flex-wrap items-center justify-between gap-2">
                                          <span className="text-[11px] font-medium text-amber-900 dark:text-amber-300">
                                            Review delay justification as <strong>{profile?.full_name || 'Supervisor'}</strong>:
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              disabled={reviewingMilestoneId === m.id}
                                              onClick={() => handleReviewJustification(m.id, 'approved')}
                                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                                            >
                                              <CheckCircle2 className="w-3.5 h-3.5" />
                                              <span>Approve Justification</span>
                                            </button>
                                            <button
                                              type="button"
                                              disabled={reviewingMilestoneId === m.id}
                                              onClick={() => handleReviewJustification(m.id, 'rejected')}
                                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 flex items-center gap-1.5 transition disabled:opacity-50"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                              <span>Reject</span>
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {/* If Rejected, allow user to submit revised justification */}
                                      {m.justification_status === 'rejected' && (
                                        <div className="mt-2.5 pt-2 border-t border-red-200 dark:border-red-800 flex flex-wrap items-center justify-between gap-2">
                                          <span className="text-[11px] text-red-800 dark:text-red-300">
                                            The delay justification was not approved. Milestone remains delayed.
                                          </span>
                                          <div className="flex items-center gap-2">
                                            {canReviewJustification && (
                                              <button
                                                type="button"
                                                disabled={reviewingMilestoneId === m.id}
                                                onClick={() => handleReviewJustification(m.id, 'approved')}
                                                className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg transition disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                                                title="Approve this milestone delay as supervisor"
                                              >
                                                <CheckCircle2 className="w-3 h-3" />
                                                <span>Approve Delay</span>
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => openMilestoneJustification(m, 'delayed')}
                                              className="px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition cursor-pointer"
                                            >
                                              Submit Revised Justification
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Linked Blocker Work (if no justification text) */}
                                  {!m.justification && m.justification_linked_work_id && (
                                    <div className="mt-1.5 flex items-center gap-2 text-xs">
                                      <span className="text-gray-500 font-medium">Linked Blocker / Cause:</span>
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                                        <LinkIcon className="w-3 h-3" />
                                        <span className="font-mono font-bold">
                                          [{m.linked_work_key || 'LINKED'}]
                                        </span>
                                        <span>{m.linked_work_title}</span>
                                        {m.linked_work_priority === 'code_red' && (
                                          <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-red-600 text-white animate-pulse">
                                            CODE-RED
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                                {!isCompleted ? (
                                  <button
                                    type="button"
                                    onClick={() => openMilestoneJustification(m, 'completed')}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 transition-all"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Complete</span>
                                  </button>
                                ) : null}

                                {/* Admin / Work Manager: direct Edit button on milestone row */}
                                {(isAdmin || hasPermission('manage_work_cycles')) && (
                                  <button
                                    type="button"
                                    onClick={onEdit}
                                    className="px-2 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-1 transition cursor-pointer"
                                    title="Directly edit milestone dates and outcome"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                )}

                                {/* Admin-only manual override if supervisor needs to flag early delay */}
                                {isAdmin && !isDelayed && !isCompleted ? (
                                  <button
                                    type="button"
                                    onClick={() => openMilestoneJustification(m, 'delayed')}
                                    className="px-2 py-1 rounded text-[11px] font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 flex items-center gap-1 transition-all cursor-pointer"
                                    title="Admin Override: Manually mark delayed before schedule"
                                  >
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    <span>Mark Delayed</span>
                                  </button>
                                ) : null}

                                {((isCompleted || isDelayed) && (!isPastTargetDate || isAdmin)) && (
                                  <button
                                    type="button"
                                    onClick={() => handleResetMilestoneToPending(m.id)}
                                    className="px-2 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                    title="Reset to Pending"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: DEPENDENCIES & ISSUE LINKS */}
              {activeTab === 'dependencies' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">Issue Links & Dependencies</h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Link related tasks, blocking issues, or emergencies affecting this work.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveTab('overview')}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-750 transition shadow-xs cursor-pointer"
                      >
                        ← Back to Overview
                      </button>
                      {!showAddDep && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddDep(true);
                            loadLinkables();
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Link Work Item</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Add Dependency Inline Form */}
                  {showAddDep && (
                    <form
                      onSubmit={handleAddDependency}
                      className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                          Create New Issue Link
                        </h4>
                        <button
                          type="button"
                          onClick={() => setShowAddDep(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Link Relationship Type
                          </label>
                          <select
                            value={depType}
                            onChange={(e) => setDepType(e.target.value as DependencyType)}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs"
                          >
                            <option value="blocks">Blocks this item</option>
                            <option value="is_blocked_by">Is blocked by this item</option>
                            <option value="delayed_by_code_red">🚨 Delayed by Code-Red Emergency</option>
                            <option value="relates_to">Relates to</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Target Work Item
                          </label>
                          <select
                            required
                            value={depTargetId}
                            onChange={(e) => setDepTargetId(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs"
                          >
                            <option value="">Select work to link...</option>
                            {loadingLinkables ? (
                              <option disabled>Loading linkable works...</option>
                            ) : (
                              linkableWorks.map((lw) => (
                                <option key={lw.id} value={lw.id}>
                                  [{lw.issue_key}] ({lw.priority}) {lw.work_title} - {lw.user_name}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Relationship Notes (Optional)
                        </label>
                        <input
                          type="text"
                          value={depNotes}
                          onChange={(e) => setDepNotes(e.target.value)}
                          placeholder="e.g. Waiting for calibration of optical bench before proceeding..."
                          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddDep(false)}
                          className="px-3 py-1.5 text-xs text-gray-700 dark:text-slate-200 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submittingDep}
                          className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                        >
                          {submittingDep ? 'Linking...' : 'Confirm Link'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Outgoing Dependencies (This work depends on) */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Work Items This Task Depends On ({dependencies.length})
                    </h4>
                    {dependencies.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No external dependencies registered.</p>
                    ) : (
                      <div className="space-y-2">
                        {dependencies.map((dep) => (
                          <div
                            key={dep.id}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                              dep.dependency_type === 'delayed_by_code_red' || dep.priority === 'code_red'
                                ? 'bg-red-50/70 border-red-200'
                                : 'bg-white border-gray-200 shadow-sm'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  dep.dependency_type === 'delayed_by_code_red'
                                    ? 'bg-red-600 text-white animate-pulse'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {dep.dependency_type.replace('_', ' ')}
                              </span>
                              <span className="font-mono font-bold text-blue-700">[{dep.issue_key}]</span>
                              <span className="font-semibold text-gray-900 truncate">{dep.work_title}</span>
                              {dep.priority && <WorkPriorityBadge priority={dep.priority} />}
                              {dep.notes && <span className="text-gray-500 italic">({dep.notes})</span>}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveDependency(dep.id)}
                              className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                              title="Unlink"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Incoming Dependents (Other works depending on this) */}
                  <div className="space-y-3 pt-3 border-t border-gray-200">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Other Tasks Blocked / Depending On This Item ({dependents.length})
                    </h4>
                    {dependents.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No other tasks currently depend on this work.</p>
                    ) : (
                      <div className="space-y-2">
                        {dependents.map((dep) => (
                          <div
                            key={dep.id}
                            className="p-3 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <span className="font-mono font-bold text-blue-700">[{dep.issue_key}]</span>
                              <span className="font-semibold text-gray-900 truncate">{dep.work_title}</span>
                              {dep.priority && <WorkPriorityBadge priority={dep.priority} />}
                              {dep.assigned_to_name && (
                                <span className="text-gray-500">Assignee: {dep.assigned_to_name}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: AUDIT FEED & ACTIVITY */}
              {activeTab === 'activity' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200/70 dark:border-slate-800">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Activity Feed & Audit Trail</span>
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Chronological log of milestone changes, approvals, justifications, and priority shifts.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveTab('overview')}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-750 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <span>← Back to Overview</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('milestones')}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-750 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <span>Milestones ({completedMilestones}/{milestones.length})</span>
                      </button>
                    </div>
                  </div>

                  {activityLogs.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-slate-850 rounded-xl border border-gray-200 dark:border-slate-800">
                      <Activity className="h-10 w-10 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 dark:text-slate-400">No activity logs recorded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-gray-200 dark:before:bg-slate-800">
                      {activityLogs.map((log) => (
                        <div key={log.id} className="relative flex items-start gap-3 pl-8">
                          <div className="absolute left-1.5 top-1.5 w-4 h-4 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900 ring-2 ring-blue-100 dark:ring-blue-950" />
                          <div className="flex-1 bg-white dark:bg-slate-850 p-3.5 rounded-xl border border-gray-200 dark:border-slate-800 shadow-xs text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-gray-900 dark:text-slate-100">
                                  {log.user_name || 'System / Admin'}
                                </span>
                                {log.user_role && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 uppercase">
                                    {log.user_role}
                                  </span>
                                )}
                              </div>
                              <span className="text-gray-400 dark:text-slate-500 text-[11px]">
                                {new Date(log.performed_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-gray-800 dark:text-slate-200 font-medium leading-relaxed">{log.remarks}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: PROGRESS HISTORY */}
              {activeTab === 'progress' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200/70 dark:border-slate-800">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">Progress Updates</h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Historical progress logs and completion milestones for this work item.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveTab('overview')}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-750 transition shadow-xs cursor-pointer"
                      >
                        ← Back to Overview
                      </button>
                      <button
                        type="button"
                        onClick={onUpdateProgress}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition cursor-pointer"
                      >
                        Update Progress
                      </button>
                    </div>
                  </div>
                  {progressUpdates.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-slate-850 rounded-xl border border-gray-200 dark:border-slate-800">
                      <TrendingUp className="h-10 w-10 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 dark:text-slate-400">No progress updates recorded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {progressUpdates.map((update) => (
                        <div key={update.id} className="bg-white dark:bg-slate-850 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getStatusColor(update.status)}`}>
                              {update.status.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-slate-400">
                              {new Date(update.update_date).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 dark:text-slate-200">{update.progress_notes}</p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                            <span>Completion:</span>
                            <span className="font-bold text-gray-800 dark:text-slate-100">{update.completion_percentage}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: PROBLEMS */}
              {activeTab === 'problems' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200/70 dark:border-slate-800">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">Reported Problems</h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Blockers, incidents, and issues flagged on this task.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setActiveTab('overview')}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-750 transition shadow-xs cursor-pointer"
                      >
                        ← Back to Overview
                      </button>
                      <button
                        type="button"
                        onClick={onReportProblem}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition cursor-pointer"
                      >
                        Report Problem
                      </button>
                    </div>
                  </div>
                  {problems.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-slate-850 rounded-xl border border-gray-200 dark:border-slate-800">
                      <AlertCircle className="h-10 w-10 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 dark:text-slate-400">No problems reported for this work entry</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {problems.map((problem) => (
                        <div key={problem.id} className="bg-white dark:bg-slate-850 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-xs">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-900 dark:text-slate-100 uppercase">
                              {problem.category}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-slate-400">
                              {new Date(problem.reported_date).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 dark:text-slate-200">{problem.description}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-800">
                              Impact: {problem.impact_level}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              problem.is_resolved ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {problem.is_resolved ? 'Resolved' : 'Open'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: ADMIN COMMENTS */}
              {activeTab === 'comments' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-200/70 dark:border-slate-800">
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-slate-100">Discussion & Supervisor Comments</h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Collaborative feedback, review notes, and guidance.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('overview')}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-750 transition shadow-xs cursor-pointer"
                    >
                      ← Back to Overview
                    </button>
                  </div>

                  <div className="bg-white dark:bg-slate-850 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-xs">
                    <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Add Comment / Supervisor Note
                    </label>
                    <textarea
                      rows={3}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add administrative feedback, observations, or guidance..."
                      className="w-full p-3 border border-gray-300 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        disabled={submittingComment || !newComment.trim()}
                        onClick={handleAddComment}
                        className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-slate-700 cursor-pointer"
                      >
                        {submittingComment ? 'Posting...' : 'Post Comment'}
                      </button>
                    </div>
                  </div>

                  {adminComments.length === 0 ? (
                    <div className="text-center py-10 bg-white dark:bg-slate-850 rounded-xl border border-gray-200 dark:border-slate-800">
                      <MessageSquare className="h-10 w-10 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 dark:text-slate-400">No comments posted yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {adminComments.map((c) => (
                        <div key={c.id} className="bg-white dark:bg-slate-850 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-xs text-xs">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-gray-900 dark:text-slate-100">
                              {c.admin_profile?.full_name || 'Admin'}
                            </span>
                            <span className="text-gray-400 dark:text-slate-500">
                              {new Date(c.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-gray-800 dark:text-slate-200 whitespace-pre-wrap">{c.comment_text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Milestone Justification Modal */}
        <MilestoneJustificationModal
          isOpen={justificationModalOpen}
          onClose={() => {
            setJustificationModalOpen(false);
            setSelectedMilestone(null);
          }}
          milestone={selectedMilestone}
          newStatus={milestoneTargetStatus}
          workId={workId}
          isAdmin={isAdmin}
          onConfirm={handleConfirmMilestoneJustification}
        />

        {/* Milestone Change Request Review Modal */}
        <MilestoneChangeRequestReviewModal
          isOpen={Boolean(selectedChangeRequest)}
          onClose={() => setSelectedChangeRequest(null)}
          request={selectedChangeRequest}
          onReviewed={() => {
            setSelectedChangeRequest(null);
            fetchWorkDetails();
            onRefresh();
          }}
        />
      </div>
    </div>
  );
}
