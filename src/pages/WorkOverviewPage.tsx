import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  Eye,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Activity,
  AlertCircle,
  Flame,
  Link as LinkIcon,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  AssignedWork,
  WorkMilestone,
  ProgressUpdate,
  WorkProblem,
} from '../types/work';
import {
  IssueKeyTag,
  IssueTypeBadge,
  WorkPriorityBadge,
  CodeRedAlertBanner,
} from '../components/WorkIssueBadge';
import WorkFilterToolbar, {
  WorkFilterState,
  DEFAULT_WORK_FILTERS,
} from '../components/WorkFilterToolbar';
import MilestoneJustificationModal from '../components/MilestoneJustificationModal';
import WorkEntryFormModal from '../components/WorkEntryFormModal';
import ProgressUpdateModal from '../components/ProgressUpdateModal';
import ProblemReportModal from '../components/ProblemReportModal';
import WorkEntryDetailModal from '../components/WorkEntryDetailModal';
import EditWorkEntryModal from '../components/EditWorkEntryModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { unescapeHtml } from '../utils/formatters';
import { PageHeader, Button } from '../components/ui';

export default function WorkOverviewPage() {
  const { user, profile, hasPermission } = useAuth();
  const navigate = useNavigate();

  // Redirect admins and super_admins to team overview
  useEffect(() => {
    if (profile?.user_role === 'admin' || profile?.user_role === 'super_admin') {
      navigate('/admin/work-overview', { replace: true });
    }
  }, [profile, navigate]);

  const [works, setWorks] = useState<AssignedWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showProblemModal, setShowProblemModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedWork, setSelectedWork] = useState<AssignedWork | null>(null);
  const [expandedWork, setExpandedWork] = useState<string | null>(null);
  const [workProgress, setWorkProgress] = useState<Record<string, ProgressUpdate>>({});
  const [workProblems, setWorkProblems] = useState<Record<string, WorkProblem[]>>({});
  const [workMilestones, setWorkMilestones] = useState<Record<string, WorkMilestone[]>>({});
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Jira-grade Custom Filters
  const [filters, setFilters] = useState<WorkFilterState>(DEFAULT_WORK_FILTERS);

  // Milestone Justification Modal state for inline milestone transitions
  const [justificationModalOpen, setJustificationModalOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<WorkMilestone | null>(null);
  const [milestoneTargetStatus, setMilestoneTargetStatus] = useState<
    'completed' | 'delayed' | 'pending' | 'in_progress'
  >('completed');
  const [milestoneWorkId, setMilestoneWorkId] = useState<string>('');

  const canCreateWork = hasPermission('create_work');
  const hasEditPerm = hasPermission('edit_work');
  const canEditWork = (work: AssignedWork) =>
    hasEditPerm ||
    work.user_id === user?.id ||
    Boolean(work.assigned_by_user_id && work.assigned_by_user_id === user?.id) ||
    Boolean(work.assigned_by && user?.email && work.assigned_by.trim().toLowerCase() === user.email.trim().toLowerCase());
  const canDeleteWork = hasPermission('delete_work');

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetWorkId = params.get('workId');
    if (targetWorkId && works.length > 0) {
      const found = works.find((w) => w.id === targetWorkId);
      if (found) {
        setSelectedWork(found);
        setShowDetailModal(true);
      }
    }
  }, [works]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch all work entries for the logged-in user (backend filters by user_id)
      const { data: worksData } = await api.get<AssignedWork[]>('/api/work');
      const workList = Array.isArray(worksData) ? worksData : [];
      setWorks(workList);

      await Promise.all(
        workList.map(async (work) => {
          try {
            const [progRes, probRes, mileRes] = await Promise.all([
              api.get(`/api/work/${work.id}/progress`, {
                order: 'update_date',
                ascending: 'false',
                limit: '1',
              }),
              api.get(`/api/work/${work.id}/problems`, {
                order: 'reported_date',
                ascending: 'false',
              }),
              api.get(`/api/work/${work.id}/milestones`, {
                order: 'target_date',
                ascending: 'true',
              }),
            ]);

            const latestProgress = Array.isArray(progRes.data)
              ? progRes.data[0]
              : progRes.data;
            if (latestProgress) {
              setWorkProgress((prev) => ({ ...prev, [work.id]: latestProgress }));
            }
            if (probRes.data) {
              setWorkProblems((prev) => ({ ...prev, [work.id]: probRes.data }));
            }
            if (mileRes.data) {
              setWorkMilestones((prev) => ({ ...prev, [work.id]: mileRes.data }));
            }
          } catch (err) {
            console.error(`Error loading sub-resources for work ${work.id}:`, err);
          }
        })
      );
    } catch (error) {
      console.error('Error fetching work data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWork = async () => {
    if (!selectedWork) return;
    try {
      setDeleteLoading(true);
      const { error } = await api.delete(`/api/work/${selectedWork.id}`);
      if (error) throw error;
      setShowDeleteModal(false);
      setSelectedWork(null);
      await fetchData();
    } catch (error) {
      console.error('Error deleting work:', error);
      alert('Failed to delete work entry. Please try again.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Milestone transition with justification & blocker linking
  const handleOpenMilestoneModal = (
    milestone: WorkMilestone,
    targetStatus: 'completed' | 'delayed',
    workId: string
  ) => {
    setSelectedMilestone(milestone);
    setMilestoneTargetStatus(targetStatus);
    setMilestoneWorkId(workId);
    setJustificationModalOpen(true);
  };

  const handleConfirmMilestoneJustification = async (
    justificationText: string,
    linkedWorkId?: string
  ) => {
    if (!selectedMilestone || !milestoneWorkId) return;
    const isCompleted = milestoneTargetStatus === 'completed';
    const { error } = await api.put(
      `/api/work/${milestoneWorkId}/milestones/${selectedMilestone.id}`,
      {
        status: milestoneTargetStatus,
        is_completed: isCompleted,
        justification: justificationText,
        justification_linked_work_id: linkedWorkId || null,
      }
    );
    if (error) {
      throw error;
    }
    await fetchData();
  };

  const handleResetMilestoneToPending = async (milestone: WorkMilestone, workId: string) => {
    if (!confirm(`Reset milestone "${milestone.title || milestone.milestone_description}" to Incomplete?`)) {
      return;
    }
    try {
      const { error } = await api.put(`/api/work/${workId}/milestones/${milestone.id}`, {
        status: 'pending',
        is_completed: false,
        justification: 'Status reset to pending/incomplete',
      });
      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      console.error('Error resetting milestone:', err);
      alert('Failed to reset milestone');
    }
  };

  // Active Code-Red tasks & blocked tasks
  const activeCodeRedWorks = useMemo(
    () => works.filter((w) => w.priority === 'code_red'),
    [works]
  );

  const blockedByCodeRedWorks = useMemo(
    () => works.filter((w) => (w.blocked_by_code_red_count || 0) > 0),
    [works]
  );

  const totalPendingChangeRequests = useMemo(
    () => works.reduce((sum, w) => sum + (w.pending_milestone_requests_count || 0), 0),
    [works]
  );

  const stats = useMemo(() => {
    const totalWorks = works.length;
    const avgCompletion =
      works.length > 0
        ? Math.round(
            works.reduce(
              (sum, work) => sum + (workProgress[work.id]?.completion_percentage || 0),
              0
            ) / works.length
          )
        : 0;
    const openProblems = Object.values(workProblems)
      .flat()
      .filter((p) => !p.is_resolved).length;
    const completedWorks = works.filter(
      (w) => workProgress[w.id]?.status === 'completed'
    ).length;
    return { totalWorks, avgCompletion, openProblems, completedWorks };
  }, [works, workProgress, workProblems]);

  // Jira-grade filtering
  const filteredWorks = useMemo(() => {
    return works.filter((work) => {
      const progress = workProgress[work.id];
      const status = progress?.status || 'not_started';

      // 1. Text Search across key, title, project, description
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase().trim();
        const matchesKey = (work.issue_key || '').toLowerCase().includes(q);
        const matchesTitle = (work.work_title || '').toLowerCase().includes(q);
        const matchesProject = (work.project_name || '').toLowerCase().includes(q);
        const matchesDesc = (work.description || '').toLowerCase().includes(q);
        if (!matchesKey && !matchesTitle && !matchesProject && !matchesDesc) {
          return false;
        }
      }

      // 2. Issue Type filter
      if (filters.issueType && filters.issueType !== 'all' && (work.issue_type || 'task') !== filters.issueType) {
        return false;
      }

      // 3. Priority filter
      if (filters.priority && filters.priority !== 'all' && work.priority !== filters.priority) {
        return false;
      }

      // 4. Status filter
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'not_started') {
          if (progress && progress.status !== 'not_started') return false;
        } else if (status !== filters.status && work.admin_status !== filters.status) {
          return false;
        }
      }

      // 5. Quick Toggles
      if (filters.codeRedOnly && work.priority !== 'code_red') {
        return false;
      }
      if (
        filters.delayedOnly &&
        status !== 'delayed' &&
        (work.blocked_by_code_red_count || 0) === 0
      ) {
        return false;
      }
      if (
        filters.pendingApprovalOnly &&
        (work.pending_milestone_requests_count || 0) === 0
      ) {
        return false;
      }

      return true;
    });
  }, [works, workProgress, filters]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
      case 'in_progress':
        return 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
      case 'delayed':
        return 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800';
      case 'not_started':
        return 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700';
      default:
        return 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300';
    }
  };

  const getProgressBarColor = (pct: number) => {
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 50) return 'bg-blue-500';
    if (pct >= 25) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-slate-400">Loading your lab work entries...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <WorkEntryFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchData}
      />

      {selectedWork && (
        <>
          <WorkEntryDetailModal
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedWork(null);
              const params = new URLSearchParams(window.location.search);
              if (params.has('workId')) {
                params.delete('workId');
                const newQuery = params.toString();
                navigate({ search: newQuery ? `?${newQuery}` : '' }, { replace: true });
              }
            }}
            workId={selectedWork.id}
            onEdit={() => {
              setShowDetailModal(false);
              setShowEditModal(true);
            }}
            onDelete={canDeleteWork ? () => {
              setShowDetailModal(false);
              setShowDeleteModal(true);
            } : undefined}
            onUpdateProgress={() => {
              setShowDetailModal(false);
              setShowProgressModal(true);
            }}
            onReportProblem={() => {
              setShowDetailModal(false);
              setShowProblemModal(true);
            }}
            onRefresh={fetchData}
          />
          <EditWorkEntryModal
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setSelectedWork(null);
            }}
            workId={selectedWork.id}
            onSuccess={() => {
              fetchData();
              setShowEditModal(false);
              setSelectedWork(null);
            }}
          />
          <DeleteConfirmationModal
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={handleDeleteWork}
            title="Delete Work Entry"
            message={`Are you sure you want to delete "${selectedWork.work_title}"? This will permanently remove the work entry and all associated milestones, progress updates, and problems.`}
            loading={deleteLoading}
          />
          <ProgressUpdateModal
            isOpen={showProgressModal}
            onClose={() => {
              setShowProgressModal(false);
              setSelectedWork(null);
            }}
            workId={selectedWork.id}
            workTitle={selectedWork.work_title}
            currentProgress={workProgress[selectedWork.id]?.completion_percentage || 0}
            onSuccess={fetchData}
          />
          <ProblemReportModal
            isOpen={showProblemModal}
            onClose={() => {
              setShowProblemModal(false);
              setSelectedWork(null);
            }}
            workId={selectedWork.id}
            workTitle={selectedWork.work_title}
            onSuccess={fetchData}
          />
        </>
      )}

      {/* Milestone Justification Modal */}
      <MilestoneJustificationModal
        isOpen={justificationModalOpen}
        onClose={() => {
          setJustificationModalOpen(false);
          setSelectedMilestone(null);
          setMilestoneWorkId('');
        }}
        milestone={selectedMilestone}
        newStatus={milestoneTargetStatus}
        workId={milestoneWorkId}
        onConfirm={handleConfirmMilestoneJustification}
      />

      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Lab Work & Issue Tracker"
          action={
            canCreateWork ? (
              <Button
                id="create-work-entry-btn"
                variant="primary"
                onClick={() => setShowCreateModal(true)}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Create New Work Entry
              </Button>
            ) : undefined
          }
        />

        {/* Code-Red Banner if active emergencies exist */}
        {activeCodeRedWorks.length > 0 && (
          <CodeRedAlertBanner
            activeWorks={activeCodeRedWorks}
            onViewWork={(id) => {
              const target = works.find((w) => w.id === id);
              if (target) {
                setSelectedWork(target);
                setShowDetailModal(true);
              }
            }}
          />
        )}

        {/* Milestone Governance Alert if user has change requests pending */}
        {totalPendingChangeRequests > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl p-4 flex items-start gap-3 shadow-sm">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                {totalPendingChangeRequests} Milestone Change Request{totalPendingChangeRequests > 1 ? 's' : ''} Pending Admin Approval
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                To prevent accidental timeline shifts, milestone edits are locked and queued for supervisor/admin review.
                Your current milestones remain active and visible until approved.
              </p>
            </div>
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors">
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 dark:bg-blue-950/60 p-2.5 rounded-lg">
                <ClipboardList className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium uppercase tracking-wide">
                  Active Work Items
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{stats.totalWorks}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-950/60 p-2.5 rounded-lg">
                <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium uppercase tracking-wide">
                  Avg Completion
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{stats.avgCompletion}%</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors">
            <div className="flex items-center gap-3">
              <div className="bg-amber-50 dark:bg-amber-950/60 p-2.5 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium uppercase tracking-wide">
                  Open Problems
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{stats.openProblems}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors">
            <div className="flex items-center gap-3">
              <div className="bg-purple-50 dark:bg-purple-950/60 p-2.5 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400 font-medium uppercase tracking-wide">
                  Completed Works
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{stats.completedWorks}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Jira-Grade Filter Toolbar */}
        <WorkFilterToolbar
          filters={filters}
          onChange={setFilters}
          totalCount={works.length}
          filteredCount={filteredWorks.length}
          codeRedCount={activeCodeRedWorks.length}
          pendingApprovalCount={totalPendingChangeRequests}
        />

        {/* Work Entries Container */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-colors">

          {filteredWorks.length === 0 ? (
            <div className="p-16 text-center">
              <Clock className="h-14 w-14 text-gray-200 dark:text-slate-700 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">
                {works.length === 0 ? 'No Work Entries Yet' : 'No matching work entries'}
              </h3>
              <p className="text-gray-500 dark:text-slate-400 text-sm max-w-md mx-auto">
                {works.length === 0
                  ? 'Once the work tracking period starts, create your first lab entry to track experiments, milestones, and dependencies.'
                  : 'Try adjusting your search query, issue type, or clear active filters in the toolbar above.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-800">
              {filteredWorks.map((work) => {
                const progress = workProgress[work.id];
                const problems = workProblems[work.id] || [];
                const milestones = workMilestones[work.id] || [];
                const isExpanded = expandedWork === work.id;
                const openProblemsCount = problems.filter((p) => !p.is_resolved).length;
                const completedMilestonesCount = milestones.filter((m) => m.is_completed).length;
                const pct = progress?.completion_percentage || 0;
                const isCodeRed = work.priority === 'code_red';
                const isBlockedByCodeRed = (work.blocked_by_code_red_count || 0) > 0;
                const hasPendingChange = (work.pending_milestone_requests_count || 0) > 0;

                return (
                  <div
                    key={work.id}
                    className={`p-6 transition-colors ${
                      isCodeRed
                        ? 'bg-red-50/40 dark:bg-red-950/20 hover:bg-red-50/60 dark:hover:bg-red-950/30 border-l-4 border-l-red-600'
                        : isBlockedByCodeRed
                        ? 'bg-orange-50/30 dark:bg-orange-950/20 hover:bg-orange-50/50 dark:hover:bg-orange-950/30 border-l-4 border-l-orange-500'
                        : 'hover:bg-gray-50/60 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          setSelectedWork(work);
                          setShowDetailModal(true);
                        }}
                      >
                        {/* Badges Bar: Key + Type + Priority + Alerts */}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <IssueKeyTag
                            issueKey={work.issue_key}
                            onClick={() => {
                              setSelectedWork(work);
                              setShowDetailModal(true);
                            }}
                          />
                          <IssueTypeBadge type={work.issue_type || 'task'} />
                          <WorkPriorityBadge priority={work.priority} />
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                              progress?.status || 'not_started'
                            )}`}
                          >
                            {(progress?.status || 'not_started')
                              .replace('_', ' ')
                              .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                          </span>

                          {(progress?.status === 'delayed' || (work.unapproved_delayed_milestones_count ?? 0) > 0) && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700 animate-pulse">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                              Delayed by {work.user_name || 'Assignee'}
                            </span>
                          )}

                          {isBlockedByCodeRed && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700 animate-pulse">
                              <Flame className="w-3 h-3 text-red-600 dark:text-red-400" />
                              Delayed by Code-Red
                            </span>
                          )}

                          {hasPendingChange && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedWork(work);
                                setShowDetailModal(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/70 dark:hover:bg-amber-900/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 transition cursor-pointer"
                              title="Click to view submitted milestone revision request"
                            >
                              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>Milestone Edit Pending Review</span>
                            </button>
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1 hover:text-blue-600 dark:hover:text-blue-400 transition">
                          {work.work_title}
                        </h3>

                        {/* Subtitle / Meta */}
                        <p className="text-sm text-gray-500 dark:text-slate-400 mb-2">
                          <span className="font-medium text-gray-700 dark:text-slate-300">Project:</span>{' '}
                          {work.project_name}
                          {work.user_id !== user?.id && work.user_name && (
                            <>
                              {' '}
                              · <span className="font-medium text-gray-700 dark:text-slate-300">Assigned To:</span>{' '}
                              {work.user_name}
                            </>
                          )}
                          {work.assigned_by && (
                            <>
                              {' '}
                              · <span className="font-medium text-gray-700 dark:text-slate-300">Assigned by:</span>{' '}
                              {work.assigned_by}
                            </>
                          )}
                        </p>

                        {work.description && (
                          <p className="text-sm text-gray-600 dark:text-slate-300 mb-3 line-clamp-2">
                            {unescapeHtml(work.description)}
                          </p>
                        )}

                        {/* Progress Bar */}
                        {progress && (
                          <div className="mb-2 max-w-xl">
                            <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1">
                              <span className="font-medium">{pct}% Complete</span>
                              <span>
                                {new Date(work.start_date).toLocaleDateString()} –{' '}
                                {new Date(work.end_date).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-slate-800 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${getProgressBarColor(
                                  pct
                                )}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Meta chips */}
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-slate-400 mt-2">
                          <span>
                            {completedMilestonesCount}/{milestones.length} Milestones
                          </span>
                          {openProblemsCount > 0 && (
                            <span className="text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {openProblemsCount} open problem{openProblemsCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          {!progress && (
                            <span className="text-gray-400 dark:text-slate-500">
                              {new Date(work.start_date).toLocaleDateString()} –{' '}
                              {new Date(work.end_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedWork(work);
                            setShowDetailModal(true);
                          }}
                          className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition"
                          title="View Details, Dependencies & Activity"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canEditWork(work) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWork(work);
                              setShowEditModal(true);
                            }}
                            className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition"
                            title="Edit Work & Submit Milestone Changes"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {canDeleteWork && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWork(work);
                              setShowDeleteModal(true);
                            }}
                            className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedWork(isExpanded ? null : work.id);
                          }}
                          className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition ml-1"
                          title={isExpanded ? 'Collapse' : 'Expand Milestones'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Milestones & Problems */}
                    {isExpanded && (
                      <div className="mt-5 pt-5 border-t border-gray-100 dark:border-slate-800">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Milestones Column */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-gray-800 dark:text-slate-200">
                                Milestones ({milestones.length})
                              </h4>
                              <span className="text-xs text-gray-500 dark:text-slate-400">
                                Click checkbox to complete with justification
                              </span>
                            </div>

                            {milestones.length === 0 ? (
                              <p className="text-sm text-gray-400 dark:text-slate-500">No milestones defined</p>
                            ) : (
                              <div className="space-y-2.5">
                                {milestones.map((m) => {
                                  const isMCompleted = m.is_completed || m.status === 'completed';
                                  const isMDelayed = m.status === 'delayed';

                                  return (
                                    <div
                                      key={m.id}
                                      className={`p-3 rounded-lg border transition-all ${
                                        isMCompleted
                                          ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                                          : isMDelayed
                                          ? 'bg-red-50/60 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                                          : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700'
                                      }`}
                                    >
                                      <div className="flex items-start gap-3">
                                        {/* Milestone Checkbox Button */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (isMCompleted) {
                                              handleResetMilestoneToPending(m, work.id);
                                            } else {
                                              handleOpenMilestoneModal(m, 'completed', work.id);
                                            }
                                          }}
                                          title={
                                            isMCompleted
                                              ? 'Click to reset to incomplete'
                                              : 'Click to mark completed with justification'
                                          }
                                          className={`mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                                            isMCompleted
                                              ? 'bg-emerald-600 border-emerald-600 text-white'
                                              : 'border-gray-400 dark:border-slate-500 hover:border-emerald-500 bg-white dark:bg-slate-800'
                                          }`}
                                        >
                                          {isMCompleted && <CheckCircle2 className="h-3.5 w-3.5" />}
                                        </button>

                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between gap-2">
                                            <p
                                              className={`text-sm font-medium ${
                                                isMCompleted
                                                  ? 'line-through text-gray-500 dark:text-slate-500'
                                                  : 'text-gray-900 dark:text-slate-100'
                                              }`}
                                            >
                                              {m.title || m.milestone_description}
                                            </p>
                                            {isMDelayed && (
                                              m.justification_status === 'approved' ? (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 inline-flex items-center gap-1">
                                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                  DELAYED · JUSTIFIED
                                                </span>
                                              ) : m.justification_status === 'rejected' ? (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 inline-flex items-center gap-1">
                                                  <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />
                                                  DELAYED · UNJUSTIFIED
                                                </span>
                                              ) : m.justification_status === 'pending' ? (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 inline-flex items-center gap-1">
                                                  <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                                  DELAYED · PENDING APPROVAL
                                                </span>
                                              ) : !m.justification ? (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 inline-flex items-center gap-1 animate-pulse">
                                                  <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />
                                                  OVERDUE · DELAYED
                                                </span>
                                              ) : (
                                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 inline-flex items-center gap-1">
                                                  <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                                  DELAYED · PENDING APPROVAL
                                                </span>
                                              )
                                            )}
                                          </div>

                                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-slate-400 mt-1">
                                            <span>
                                              Target: {new Date(m.target_date).toLocaleDateString()}
                                            </span>
                                            {m.expected_outcome && (
                                              <span>Outcome: {m.expected_outcome}</span>
                                            )}
                                          </div>

                                          {/* Justification Box if present */}
                                          {m.justification && (
                                            <div
                                              className={`mt-2 text-xs border rounded p-2.5 ${
                                                m.justification_status === 'approved'
                                                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                                                  : m.justification_status === 'rejected'
                                                  ? 'bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-950 dark:text-red-200'
                                                  : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200'
                                              }`}
                                            >
                                              <div className="flex items-center justify-between gap-1 mb-1">
                                                <span className="font-bold text-[11px] uppercase tracking-wider text-gray-700 dark:text-slate-300">
                                                  Status Justification
                                                </span>
                                                {m.justification_status === 'approved' ? (
                                                  <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded">
                                                    Justified
                                                  </span>
                                                ) : m.justification_status === 'rejected' ? (
                                                  <span className="text-[9px] font-bold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/60 px-1.5 py-0.5 rounded">
                                                    Rejected
                                                  </span>
                                                ) : (
                                                  <span className="text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                                                    Pending Approval
                                                  </span>
                                                )}
                                              </div>
                                              <p className="italic">&ldquo;{m.justification}&rdquo;</p>
                                              {(m.linked_work_title || m.linked_work_key) && (
                                                <div className="mt-1.5 flex items-center gap-1 text-blue-700 dark:text-blue-400 font-medium">
                                                  <LinkIcon className="w-3 h-3 shrink-0" />
                                                  <span>
                                                    Linked Cause: [{m.linked_work_key || 'Issue'}]{' '}
                                                    {m.linked_work_title}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          )}

                                          {/* Delay action toggle if not completed */}
                                          {!isMCompleted && (
                                            <div className="mt-2 flex items-center gap-2">
                                              {isMDelayed && !m.justification && !m.justification_status ? (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleOpenMilestoneModal(m, 'delayed', work.id)
                                                  }
                                                  className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 px-2.5 py-1 rounded-md border border-amber-300 dark:border-amber-700 font-bold inline-flex items-center gap-1 transition"
                                                >
                                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                                  <span>Provide Delay Justification</span>
                                                </button>
                                              ) : isMDelayed && m.justification_status === 'rejected' ? (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleOpenMilestoneModal(m, 'delayed', work.id)
                                                  }
                                                  className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 px-2.5 py-1 rounded-md border border-red-300 dark:border-red-700 font-bold inline-flex items-center gap-1 transition"
                                                >
                                                  <AlertTriangle className="w-3 h-3 text-red-600" />
                                                  <span>Submit Revised Justification</span>
                                                </button>
                                              ) : !isMDelayed ? (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleOpenMilestoneModal(m, 'delayed', work.id)
                                                  }
                                                  className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium hover:underline"
                                                >
                                                  Flag as Delayed...
                                                </button>
                                              ) : null}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Problems Column */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-gray-800 dark:text-slate-200">
                                Problems & Blockers ({problems.length})
                              </h4>
                            </div>

                            {problems.length === 0 ? (
                              <p className="text-sm text-gray-400 dark:text-slate-500">No problems reported</p>
                            ) : (
                              <div className="space-y-2">
                                {problems.map((p) => (
                                  <div
                                    key={p.id}
                                    className={`p-3 rounded-lg border ${
                                      p.impact_level === 'high'
                                        ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                                        : p.impact_level === 'medium'
                                        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                                        : 'bg-gray-50 dark:bg-slate-800/60 border-gray-200 dark:border-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span
                                            className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                              p.impact_level === 'high'
                                                ? 'bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300'
                                                : p.impact_level === 'medium'
                                                ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300'
                                                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                                            }`}
                                          >
                                            {p.impact_level.toUpperCase()}
                                          </span>
                                          <span className="text-xs text-gray-500 dark:text-slate-400">
                                            {p.category}
                                          </span>
                                        </div>
                                        <p className="text-sm text-gray-800 dark:text-slate-200">{p.description}</p>
                                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                                          Reported: {new Date(p.reported_date).toLocaleDateString()}
                                        </p>
                                      </div>
                                      {p.is_resolved && (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Bottom Actions Bar */}
                        <div className="mt-5 flex flex-wrap gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWork(work);
                              setShowDetailModal(true);
                            }}
                            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition font-medium"
                          >
                            View Full Details & Audit Trail
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWork(work);
                              setShowProgressModal(true);
                            }}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                          >
                            Update Progress
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWork(work);
                              setShowProblemModal(true);
                            }}
                            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                          >
                            Report Problem
                          </button>
                          {canEditWork(work) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedWork(work);
                                setShowEditModal(true);
                              }}
                              className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium"
                            >
                              Edit Work / Request Milestone Change
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
