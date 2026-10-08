import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Users,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Eye,
  X,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Plus,
  Edit2,
  GitPullRequest,
  Flame,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import AdminWorkDetailModal from '../../components/AdminWorkDetailModal';
import WorkEntryFormModal from '../../components/WorkEntryFormModal';
import EditWorkEntryModal from '../../components/EditWorkEntryModal';
import WorkEntryDetailModal from '../../components/WorkEntryDetailModal';
import ProgressUpdateModal from '../../components/ProgressUpdateModal';
import ProblemReportModal from '../../components/ProblemReportModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import {
  CodeRedAlertBanner,
  IssueKeyTag,
  IssueTypeBadge,
  WorkPriorityBadge,
} from '../../components/WorkIssueBadge';
import WorkFilterToolbar, {
  WorkFilterState,
  DEFAULT_WORK_FILTERS,
} from '../../components/WorkFilterToolbar';
import MilestoneChangeRequestReviewModal from '../../components/MilestoneChangeRequestReviewModal';
import { MilestoneChangeRequest } from '../../types/work';
import { PageHeader } from '../../components/ui';

interface WorkCycle {
  id: string;
  quarter: number;
  year: number;
  status: string;
}

interface UserWorkData {
  user_id: string;
  user_name: string;
  department: string;
  work_id: string;
  issue_key?: string;
  issue_type?: any;
  project_name: string;
  work_title: string;
  assigned_by: string;
  priority: any;
  admin_status: string;
  completion_percentage: number;
  latest_status: string;
  open_problems_count: number;
  pending_milestone_requests_count?: number;
  blocked_by_code_red_count?: number;
  last_updated: string;
  days_since_update: number;
}

interface Statistics {
  totalUsers: number;
  usersWithWork: number;
  usersWithoutWork: number;
  delayedWorkCount: number;
  highImpactProblemsCount: number;
  openSupportRequests: Record<string, number>;
  codeRedCount?: number;
  pendingMilestoneRequestsCount?: number;
}

export default function AdminWorkOverviewPage() {
  const { user, profile, hasPermission } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only admin and super_admin users should access Team Work Overview
    if (profile !== null && profile?.user_role !== 'admin' && profile?.user_role !== 'super_admin') {
      navigate('/work-overview', { replace: true });
    }
  }, [profile, navigate]);

  const [activeCycle, setActiveCycle] = useState<WorkCycle | null>(null);
  const [workData, setWorkData] = useState<UserWorkData[]>([]);
  const [pendingMilestoneRequests, setPendingMilestoneRequests] = useState<MilestoneChangeRequest[]>([]);
  const [activeCodeRedWorks, setActiveCodeRedWorks] = useState<any[]>([]);
  const [selectedChangeRequest, setSelectedChangeRequest] = useState<MilestoneChangeRequest | null>(null);
  const [customFilters, setCustomFilters] = useState<WorkFilterState>(DEFAULT_WORK_FILTERS);

  const [myWorkSummary, setMyWorkSummary] = useState<{
    totalWorks: number;
    avgCompletion: number;
    openProblems: number;
  }>({ totalWorks: 0, avgCompletion: 0, openProblems: 0 });
  const [showMyWorkSection, setShowMyWorkSection] = useState(true);
  const [statistics, setStatistics] = useState<Statistics>({
    totalUsers: 0,
    usersWithWork: 0,
    usersWithoutWork: 0,
    delayedWorkCount: 0,
    highImpactProblemsCount: 0,
    openSupportRequests: { supervisor: 0, admin: 0, facility_spoc: 0, procurement: 0 },
    codeRedCount: 0,
    pendingMilestoneRequestsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [showCreateWorkModal, setShowCreateWorkModal] = useState(false);
  const [activeCardFilter, setActiveCardFilter] = useState<string | null>(null);
  const [showNoWorkModal, setShowNoWorkModal] = useState(false);
  const [showSupportRequestsModal, setShowSupportRequestsModal] = useState(false);
  const [usersWithoutWork, setUsersWithoutWork] = useState<any[]>([]);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);
  const [showEditWorkModal, setShowEditWorkModal] = useState(false);
  const [workIdToEdit, setWorkIdToEdit] = useState<string | null>(null);

  const [selectedUserWork, setSelectedUserWork] = useState<UserWorkData | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showProblemModal, setShowProblemModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const hasEditPerm = hasPermission('edit_work') || profile?.user_role === 'admin' || profile?.user_role === 'super_admin';
  const isWorkOwnerOrSupervisor = (work: UserWorkData) =>
    work.user_id === user?.id ||
    Boolean((work as any).assigned_by_user_id && (work as any).assigned_by_user_id === user?.id) ||
    Boolean(work.assigned_by && user?.email && work.assigned_by.trim().toLowerCase() === user.email.trim().toLowerCase());
  const canEditWork = (work: UserWorkData) => hasEditPerm || isWorkOwnerOrSupervisor(work);

  useEffect(() => {
    fetchData();
    const params = new URLSearchParams(window.location.search);
    const targetWorkId = params.get('workId');
    if (targetWorkId) {
      setSelectedWorkId(targetWorkId);
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get overview data from admin endpoint
      const { data: overview } = await api.get('/api/admin/work/overview');

      if (overview) {
        const rawWorks = overview.workData || [];
        setWorkData(rawWorks);
        setExpandedUsers((prev) => {
          const next = new Set(prev);
          rawWorks.forEach((w: any) => {
            if (w.user_id) next.add(w.user_id);
          });
          return next;
        });
        setMyWorkSummary(overview.myWorkSummary || { totalWorks: 0, avgCompletion: 0, openProblems: 0 });
        setUsersWithoutWork(overview.usersWithoutWork || []);
        setPendingMilestoneRequests(overview.pendingMilestoneRequests || []);
        setActiveCodeRedWorks(overview.activeCodeRedWorks || []);
        setStatistics(overview.statistics || {
          totalUsers: 0,
          usersWithWork: 0,
          usersWithoutWork: 0,
          delayedWorkCount: 0,
          highImpactProblemsCount: 0,
          openSupportRequests: { supervisor: 0, admin: 0, facility_spoc: 0, procurement: 0 },
          codeRedCount: 0,
          pendingMilestoneRequestsCount: 0,
        });
      }
    } catch (error) {
      console.error('Error fetching work overview:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = workData.filter(work => {
    if (activeCardFilter === 'usersWithWork') {
      // no-op
    } else if (activeCardFilter === 'delayed') {
      if (work.latest_status !== 'delayed') return false;
    } else if (activeCardFilter === 'highImpactProblems') {
      if (work.open_problems_count === 0) return false;
    }

    if (customFilters.codeRedOnly && work.priority !== 'code_red') {
      return false;
    }

    if (customFilters.delayedOnly && work.latest_status !== 'delayed' && (work.blocked_by_code_red_count ?? 0) === 0) {
      return false;
    }

    if (customFilters.pendingApprovalOnly && (work.pending_milestone_requests_count ?? 0) === 0) {
      return false;
    }

    if (customFilters.issueType !== 'all' && (work.issue_type || 'task') !== customFilters.issueType) {
      return false;
    }

    if (customFilters.priority !== 'all' && work.priority !== customFilters.priority) {
      return false;
    }

    if (customFilters.status !== 'all') {
      if (work.latest_status !== customFilters.status && work.admin_status !== customFilters.status) {
        return false;
      }
    }

    if (customFilters.search) {
      const q = customFilters.search.toLowerCase();
      const match =
        (work.issue_key && work.issue_key.toLowerCase().includes(q)) ||
        (work.work_title && work.work_title.toLowerCase().includes(q)) ||
        (work.project_name && work.project_name.toLowerCase().includes(q)) ||
        (work.user_name && work.user_name.toLowerCase().includes(q)) ||
        (work.department && work.department.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  const groupedByUser = filteredData.reduce((acc, work) => {
    const uId = work.user_id || 'unassigned';
    if (!acc[uId]) {
      acc[uId] = {
        userId: uId,
        userName: work.user_name || 'Team Member',
        department: work.department || '',
        works: [],
        hasDelayed: false,
        hasStaleUpdates: false,
        problemsCount: 0,
        avgProgress: 0,
      };
    }
    acc[uId].works.push(work);
    if (work.latest_status === 'delayed') acc[uId].hasDelayed = true;
    if (work.days_since_update >= 14) acc[uId].hasStaleUpdates = true;
    acc[uId].problemsCount += (work.open_problems_count || 0);
    return acc;
  }, {} as Record<string, {
    userId: string;
    userName: string;
    department: string;
    works: UserWorkData[];
    hasDelayed: boolean;
    hasStaleUpdates: boolean;
    problemsCount: number;
    avgProgress: number;
  }>);

  const groupedUsers = Object.values(groupedByUser).map(user => ({
    ...user,
    avgProgress: user.works.length > 0 ? Math.round(user.works.reduce((sum, w) => sum + (Number(w.completion_percentage) || 0), 0) / user.works.length) : 0,
  })).sort((a, b) => {
    if (a.hasDelayed && !b.hasDelayed) return -1;
    if (!a.hasDelayed && b.hasDelayed) return 1;
    if (a.hasStaleUpdates && !b.hasStaleUpdates) return -1;
    if (!a.hasStaleUpdates && b.hasStaleUpdates) return 1;
    if (a.problemsCount !== b.problemsCount) return b.problemsCount - a.problemsCount;
    return (a.userName || '').localeCompare(b.userName || '');
  });

  const toggleUser = (userId: string) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const toggleExpandAll = () => {
    if (expandAll) {
      setExpandedUsers(new Set());
    } else {
      setExpandedUsers(new Set(groupedUsers.map(u => u.userId)));
    }
    setExpandAll(!expandAll);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800';
      case 'in_progress':
        return 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800';
      case 'delayed':
        return 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800';
      case 'not_started':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800';
      case 'medium':
        return 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800';
      case 'low':
        return 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading work overview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Work Overview"
        action={
          activeCycle ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Current Cycle: Q{activeCycle.quarter} {activeCycle.year}
            </span>
          ) : undefined
        }
      />

      {/* Code-Red Emergency Alert Banner */}
      <CodeRedAlertBanner
        activeWorks={activeCodeRedWorks}
        onViewWork={(id) => {
          setSelectedWorkId(id);
          setShowDetailModal(true);
        }}
      />

      {/* Pending Milestone Change Requests Panel */}
      {pendingMilestoneRequests.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/40 border-2 border-amber-500/40 rounded-2xl p-5 shadow-lg shadow-amber-950/30 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
                <GitPullRequest className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500 text-slate-950">
                    ACTION REQUIRED
                  </span>
                  <h3 className="text-base font-bold text-slate-100">
                    Pending Milestone Edit Requests ({pendingMilestoneRequests.length})
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Users requested revisions to milestones. Unapproved milestone shifts or deletions are held pending your approval.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingMilestoneRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-xl bg-slate-800/90 border border-slate-700 text-xs flex flex-col justify-between gap-3 hover:border-amber-400/50 transition-all shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono font-bold text-primary-400">[{req.issue_key}]</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(req.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="font-bold text-slate-100 line-clamp-1">{req.work_title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    By <strong>{req.requester_name}</strong> {req.requester_department ? `(${req.requester_department})` : ''}
                  </div>
                  <div className="text-slate-300 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 mt-2 line-clamp-2 italic">
                    &ldquo;{req.reason}&rdquo;
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedChangeRequest(req)}
                  className="w-full py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 text-center transition-all flex items-center justify-center gap-1.5 shadow"
                >
                  <GitPullRequest className="w-3.5 h-3.5" />
                  <span>Review Request ({req.proposed_milestones?.length || 0} Milestones)</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-slate-800 dark:to-slate-850 border border-blue-200 dark:border-slate-700 rounded-xl shadow-sm">
          <div
            className="p-4 cursor-pointer"
            onClick={() => setShowMyWorkSection(!showMyWorkSection)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <ClipboardList className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">My Work</h3>
              </div>
              {showMyWorkSection ? (
                <ChevronUp className="h-5 w-5 text-gray-600 dark:text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-600 dark:text-slate-400" />
              )}
            </div>
          </div>

          {showMyWorkSection && (
            <div className="px-4 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-blue-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <p className="text-xs text-gray-600 dark:text-slate-400">Active Work Items</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{myWorkSummary.totalWorks}</p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-blue-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-emerald-400" />
                    <p className="text-xs text-gray-600 dark:text-slate-400">Avg Completion</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{myWorkSummary.avgCompletion}%</p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-blue-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <p className="text-xs text-gray-600 dark:text-slate-400">Open Problems</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{myWorkSummary.openProblems}</p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-blue-200 dark:border-slate-700 flex items-center justify-center">
                  <button
                    onClick={() => setShowCreateWorkModal(true)}
                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Work Entry</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        <button
          onClick={() => {
            if (activeCardFilter === 'usersWithWork') {
              setActiveCardFilter(null);
            } else {
              setActiveCardFilter('usersWithWork');
            }
          }}
          className={`bg-white dark:bg-slate-900 border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer text-left ${
            activeCardFilter === 'usersWithWork'
              ? 'ring-2 ring-blue-500 border-blue-500'
              : 'border-gray-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-950/60 p-2 rounded-lg">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-slate-400">Users with Work</p>
              <p className="text-xl font-bold text-gray-900 dark:text-slate-100">
                {statistics.usersWithWork}/{statistics.totalUsers}
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setShowNoWorkModal(true)}
          className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <div className="bg-red-100 dark:bg-red-950/60 p-2 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-slate-400">No Work Entries</p>
              <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{statistics.usersWithoutWork}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => {
            if (activeCardFilter === 'delayed') {
              setActiveCardFilter(null);
            } else {
              setActiveCardFilter('delayed');
            }
          }}
          className={`bg-white dark:bg-slate-900 border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer text-left ${
            activeCardFilter === 'delayed'
              ? 'ring-2 ring-orange-500 border-orange-500'
              : 'border-gray-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 dark:bg-orange-950/60 p-2 rounded-lg">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-slate-400">Delayed Work</p>
              <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{statistics.delayedWorkCount}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => {
            if (activeCardFilter === 'highImpactProblems') {
              setActiveCardFilter(null);
            } else {
              setActiveCardFilter('highImpactProblems');
            }
          }}
          className={`bg-white dark:bg-slate-900 border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer text-left ${
            activeCardFilter === 'highImpactProblems'
              ? 'ring-2 ring-red-500 border-red-500'
              : 'border-gray-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="bg-red-100 dark:bg-red-950/60 p-2 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-slate-400">High Impact Problems</p>
              <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{statistics.highImpactProblemsCount}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setShowSupportRequestsModal(true)}
          className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 dark:bg-purple-950/60 p-2 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-600 dark:text-slate-400">Support Requests</p>
              <p className="text-xl font-bold text-gray-900 dark:text-slate-100">
                {Object.values(statistics.openSupportRequests || {}).reduce((a, b) => a + b, 0)}
              </p>
            </div>
          </div>
        </button>
      </div>

      {activeCardFilter && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
              {activeCardFilter === 'usersWithWork' && 'Showing all users with work assignments'}
              {activeCardFilter === 'delayed' && 'Showing only delayed work entries'}
              {activeCardFilter === 'highImpactProblems' && 'Showing work with high impact problems'}
            </span>
          </div>
          <button
            onClick={() => setActiveCardFilter(null)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-3">Auto-Flag Alerts</h3>
        <div className="space-y-2">
          {workData.filter(w => w.days_since_update >= 14).length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
              <span className="text-gray-700 dark:text-slate-300">
                {workData.filter(w => w.days_since_update >= 14).length} work item(s) with no update in 14+ days
              </span>
            </div>
          )}
          {statistics.delayedWorkCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-gray-700 dark:text-slate-300">
                {statistics.delayedWorkCount} work item(s) marked as delayed
              </span>
            </div>
          )}
          {statistics.highImpactProblemsCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-gray-700 dark:text-slate-300">
                {statistics.highImpactProblemsCount} high-impact problem(s) open
              </span>
            </div>
          )}
          {workData.filter(w => w.days_since_update >= 14).length === 0 &&
           statistics.delayedWorkCount === 0 &&
           statistics.highImpactProblemsCount === 0 && (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>No critical alerts at this time</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg transition-colors">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Who is Working on What</h2>
          <button
            onClick={toggleExpandAll}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
          >
            {expandAll ? 'Collapse All' : 'Expand All'}
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-850/50">
          <WorkFilterToolbar
            filters={customFilters}
            onChange={setCustomFilters}
            totalCount={workData.length}
            filteredCount={filteredData.length}
            codeRedCount={activeCodeRedWorks.length}
            pendingApprovalCount={pendingMilestoneRequests.length}
          />
        </div>

        <div className="p-6 space-y-4">
          {groupedUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-slate-400">
              No work entries found
            </div>
          ) : (
            groupedUsers.map((user) => (
              <div
                key={user.userId}
                className={`border-2 rounded-lg overflow-hidden transition-all ${
                  user.hasDelayed
                    ? 'border-red-400 dark:border-red-600/70 shadow-md shadow-red-950/20'
                    : user.hasStaleUpdates
                    ? 'border-orange-400 dark:border-orange-600/70 shadow-md shadow-orange-950/20'
                    : 'border-gray-200 dark:border-slate-800'
                }`}
              >
                <div
                  onClick={() => toggleUser(user.userId)}
                  className="bg-gradient-to-r from-gray-50 to-white dark:from-slate-800 dark:to-slate-850 dark:bg-slate-850 p-4 cursor-pointer hover:from-gray-100 hover:to-gray-50 dark:hover:from-slate-750 dark:hover:to-slate-800 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-slate-100 text-lg">{user.userName}</h3>
                        <p className="text-sm text-gray-600 dark:text-slate-400">{user.department}</p>
                      </div>
                      <div className="flex items-center gap-4 ml-8">
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-slate-400">Total Items</p>
                          <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{user.works.length}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-slate-400">Avg Progress</p>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{user.avgProgress}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-slate-400">Problems</p>
                          <p className={`text-lg font-bold ${user.problemsCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-emerald-400'}`}>
                            {user.problemsCount}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {user.hasDelayed && (
                        <span className="px-2 py-1 bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800 text-xs font-medium rounded">
                          Delayed Work
                        </span>
                      )}
                      {user.hasStaleUpdates && (
                        <span className="px-2 py-1 bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-800 text-xs font-medium rounded">
                          Stale Updates
                        </span>
                      )}
                      {expandedUsers.has(user.userId) ? (
                        <ChevronUp className="h-5 w-5 text-gray-400 dark:text-slate-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400 dark:text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>

                {expandedUsers.has(user.userId) && (
                  <div className="bg-white dark:bg-slate-900">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-slate-800/80 border-y border-gray-200 dark:border-slate-700">
                          <tr>
                            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Key</th>
                            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Type</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Work Title / Project</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Progress</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Priority</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Alerts / Links</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                          {user.works.map((work) => {
                            const isCodeRed = work.priority === 'code_red';
                            return (
                              <tr
                                key={work.work_id}
                                className={`transition-colors ${
                                  isCodeRed
                                    ? 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30'
                                    : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
                                }`}
                              >
                                <td className="px-3 py-3 whitespace-nowrap">
                                  <IssueKeyTag
                                    issueKey={work.issue_key}
                                    onClick={() => {
                                      setSelectedUserWork(work);
                                      setSelectedWorkId(work.work_id);
                                      setShowDetailModal(true);
                                    }}
                                  />
                                </td>
                                <td className="px-3 py-3 whitespace-nowrap">
                                  <IssueTypeBadge type={work.issue_type} showLabel={false} />
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-sm text-gray-900 dark:text-slate-100">{work.work_title}</div>
                                  <div className="text-xs text-gray-500 dark:text-slate-400">{work.project_name}</div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadgeColor(work.latest_status)}`}>
                                    {work.latest_status.replace('_', ' ').toUpperCase()}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                                      <div
                                        className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full"
                                        style={{ width: `${work.completion_percentage}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-xs text-gray-600 dark:text-slate-400 font-semibold">{work.completion_percentage}%</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <WorkPriorityBadge priority={work.priority} />
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {work.latest_status === 'delayed' && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700 animate-pulse">
                                        <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />
                                        Delayed by {work.user_name || 'Assignee'}
                                      </span>
                                    )}
                                    {isCodeRed && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white animate-pulse">
                                        <Flame className="w-3 h-3" />
                                        CODE-RED
                                      </span>
                                    )}
                                    {(work.blocked_by_code_red_count ?? 0) > 0 && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                        🚨 Code-Red Blocked
                                      </span>
                                    )}
                                    {(work.pending_milestone_requests_count ?? 0) > 0 && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                                        📋 Edit Pending
                                      </span>
                                    )}
                                    {work.days_since_update >= 14 && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-800">
                                        14d+ stale
                                      </span>
                                    )}
                                    {work.open_problems_count > 0 && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800">
                                        {work.open_problems_count} problem(s)
                                      </span>
                                    )}
                                  </div>
                                </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      if (isWorkOwnerOrSupervisor(work)) {
                                        setSelectedUserWork(work);
                                        setShowDetailModal(true);
                                      } else {
                                        setSelectedWorkId(work.work_id);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors cursor-pointer"
                                    title="View details"
                                  >
                                    <Eye className="h-4 w-4" />
                                    <span>View</span>
                                  </button>
                                  {canEditWork(work) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setWorkIdToEdit(work.work_id);
                                        setShowEditWorkModal(true);
                                      }}
                                      className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors border-l border-gray-200 dark:border-slate-700 pl-2 ml-1 cursor-pointer"
                                      title="Edit"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                      <span>Edit</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {showNoWorkModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[600px] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Users Without Work Assignments</h2>
              <button
                onClick={() => setShowNoWorkModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[450px]">
              {usersWithoutWork.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <p className="text-gray-600 dark:text-slate-400">All users have work assignments!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {usersWithoutWork.map((user) => (
                    <div key={user.id} className="p-4 border border-gray-200 dark:border-slate-800 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/50 transition">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-slate-100">{user.full_name}</h3>
                          <p className="text-sm text-gray-600 dark:text-slate-400">{user.department || 'No department'}</p>
                        </div>
                        <span className="px-2 py-1 bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800 text-xs rounded font-medium">No Work</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSupportRequestsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Support Requests Breakdown</h2>
              <button
                onClick={() => setShowSupportRequestsModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/40">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 dark:bg-blue-950/60 p-2 rounded-lg">
                      <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-slate-100">Supervisor Support</p>
                      <p className="text-sm text-gray-600 dark:text-slate-400">Requests requiring supervisor action</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-gray-900 dark:text-slate-100">{statistics.openSupportRequests.supervisor}</span>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/40">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 dark:bg-purple-950/60 p-2 rounded-lg">
                      <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-slate-100">Admin Support</p>
                      <p className="text-sm text-gray-600 dark:text-slate-400">Requests requiring admin action</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-gray-900 dark:text-slate-100">{statistics.openSupportRequests.admin}</span>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/40">
                  <div className="flex items-center gap-3">
                    <div className="bg-orange-100 dark:bg-orange-950/60 p-2 rounded-lg">
                      <Users className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-slate-100">Facility SPOC</p>
                      <p className="text-sm text-gray-600 dark:text-slate-400">Facility-related support requests</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-gray-900 dark:text-slate-100">{statistics.openSupportRequests.facility_spoc}</span>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/40">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 dark:bg-emerald-950/60 p-2 rounded-lg">
                      <ShoppingCart className="w-5 h-5 text-green-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-slate-100">Procurement</p>
                      <p className="text-sm text-gray-600 dark:text-slate-400">Purchase-related support requests</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-gray-900 dark:text-slate-100">{statistics.openSupportRequests.procurement}</span>
                </div>

                <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900 dark:text-slate-100">Total Open Requests</span>
                    <span className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                      {Object.values(statistics.openSupportRequests).reduce((a, b) => a + b, 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {selectedWorkId && (
        <AdminWorkDetailModal
          workId={selectedWorkId}
          onClose={() => {
            setSelectedWorkId(null);
            const params = new URLSearchParams(window.location.search);
            if (params.has('workId')) {
              params.delete('workId');
              const newQuery = params.toString();
              navigate({ search: newQuery ? `?${newQuery}` : '' }, { replace: true });
            }
            fetchData();
          }}
        />
      )}

      {selectedUserWork && (
        <>
          <WorkEntryDetailModal
            workId={selectedUserWork.work_id}
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedUserWork(null);
              const params = new URLSearchParams(window.location.search);
              if (params.has('workId')) {
                params.delete('workId');
                const newQuery = params.toString();
                navigate({ search: newQuery ? `?${newQuery}` : '' }, { replace: true });
              }
              fetchData();
            }}
            onEdit={() => {
              setShowDetailModal(false);
              setWorkIdToEdit(selectedUserWork.work_id);
              setShowEditWorkModal(true);
            }}
            onDelete={() => {
              setShowDetailModal(false);
              setShowDeleteModal(true);
            }}
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
          <DeleteConfirmationModal
            isOpen={showDeleteModal}
            onClose={() => { setShowDeleteModal(false); setSelectedUserWork(null); }}
            onConfirm={async () => {
              try {
                setDeleteLoading(true);
                await api.delete(`/api/work/${selectedUserWork.work_id}`);
                setShowDeleteModal(false);
                setSelectedUserWork(null);
                fetchData();
              } catch (error) {
                console.error('Failed to delete work entry:', error);
                alert('Failed to delete work entry');
              } finally {
                setDeleteLoading(false);
              }
            }}
            title="Delete Work Entry"
            message={`Are you sure you want to delete "${selectedUserWork.work_title}"? This will permanently remove the work entry and all associated milestones, progress updates, and problems.`}
            loading={deleteLoading}
          />
          <ProgressUpdateModal
            isOpen={showProgressModal}
            onClose={() => { setShowProgressModal(false); setSelectedUserWork(null); }}
            workId={selectedUserWork.work_id}
            workTitle={selectedUserWork.work_title}
            currentProgress={selectedUserWork.completion_percentage || 0}
            onSuccess={fetchData}
          />
          <ProblemReportModal
            isOpen={showProblemModal}
            onClose={() => { setShowProblemModal(false); setSelectedUserWork(null); }}
            workId={selectedUserWork.work_id}
            workTitle={selectedUserWork.work_title}
            onSuccess={fetchData}
          />
        </>
      )}

      <WorkEntryFormModal
        isOpen={showCreateWorkModal}
        onClose={() => setShowCreateWorkModal(false)}
        onSuccess={() => {
          setShowCreateWorkModal(false);
          fetchData();
        }}
      />

      {showEditWorkModal && workIdToEdit && (
        <EditWorkEntryModal
          isOpen={showEditWorkModal}
          onClose={() => {
            setShowEditWorkModal(false);
            setWorkIdToEdit(null);
          }}
          workId={workIdToEdit}
          onSuccess={() => {
            setShowEditWorkModal(false);
            setWorkIdToEdit(null);
            fetchData();
          }}
        />
      )}

      {/* Admin Milestone Change Request Review Modal */}
      <MilestoneChangeRequestReviewModal
        isOpen={Boolean(selectedChangeRequest)}
        onClose={() => setSelectedChangeRequest(null)}
        request={selectedChangeRequest}
        onReviewed={() => {
          setSelectedChangeRequest(null);
          fetchData();
        }}
      />
    </div>
  );
}
