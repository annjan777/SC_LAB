import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Users, Clock, TrendingUp, AlertCircle, CheckCircle2, Eye, X, ShoppingCart, ChevronDown, ChevronUp, ClipboardList, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import AdminWorkDetailModal from '../../components/AdminWorkDetailModal';
import WorkEntryFormModal from '../../components/WorkEntryFormModal';

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
  project_name: string;
  work_title: string;
  assigned_by: string;
  priority: string;
  admin_status: string;
  completion_percentage: number;
  latest_status: string;
  open_problems_count: number;
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
}

export default function AdminWorkOverviewPage() {
  const { user, profile, hasPermission } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only admin-role users should access Team Work Overview
    if (profile !== null && profile?.user_role !== 'admin') {
      navigate('/work-overview', { replace: true });
    }
  }, [profile, navigate]);

  const [activeCycle, setActiveCycle] = useState<WorkCycle | null>(null);
  const [showCreateWorkModal, setShowCreateWorkModal] = useState(false);
  const [workData, setWorkData] = useState<UserWorkData[]>([]);
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
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    project: '',
    status: '',
    priority: '',
    search: '',
    user: '',
  });
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [activeCardFilter, setActiveCardFilter] = useState<string | null>(null);
  const [showNoWorkModal, setShowNoWorkModal] = useState(false);
  const [showSupportRequestsModal, setShowSupportRequestsModal] = useState(false);
  const [usersWithoutWork, setUsersWithoutWork] = useState<any[]>([]);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Get overview data from admin endpoint (no cycle filtering)
      const { data: overview } = await api.get('/api/admin/work/overview');

      if (overview) {
        setWorkData(overview.workData || []);
        setMyWorkSummary(overview.myWorkSummary || { totalWorks: 0, avgCompletion: 0, openProblems: 0 });
        setUsersWithoutWork(overview.usersWithoutWork || []);
        setStatistics(overview.statistics || {
          totalUsers: 0,
          usersWithWork: 0,
          usersWithoutWork: 0,
          delayedWorkCount: 0,
          highImpactProblemsCount: 0,
          openSupportRequests: { supervisor: 0, admin: 0, facility_spoc: 0, procurement: 0 },
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
      return true;
    }
    if (activeCardFilter === 'delayed') {
      if (work.latest_status !== 'delayed') return false;
    }
    if (activeCardFilter === 'highImpactProblems') {
      if (work.open_problems_count === 0) return false;
    }

    if (filters.project && !work.project_name.toLowerCase().includes(filters.project.toLowerCase())) {
      return false;
    }
    if (filters.status && work.latest_status !== filters.status) {
      return false;
    }
    if (filters.priority && work.priority !== filters.priority) {
      return false;
    }
    if (filters.user && work.user_name !== filters.user) {
      return false;
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        work.user_name.toLowerCase().includes(searchLower) ||
        work.work_title.toLowerCase().includes(searchLower) ||
        work.project_name.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const groupedByUser = filteredData.reduce((acc, work) => {
    if (!acc[work.user_id]) {
      acc[work.user_id] = {
        userId: work.user_id,
        userName: work.user_name,
        department: work.department,
        works: [],
        hasDelayed: false,
        hasStaleUpdates: false,
        problemsCount: 0,
        avgProgress: 0,
      };
    }
    acc[work.user_id].works.push(work);
    if (work.latest_status === 'delayed') acc[work.user_id].hasDelayed = true;
    if (work.days_since_update >= 14) acc[work.user_id].hasStaleUpdates = true;
    acc[work.user_id].problemsCount += work.open_problems_count;
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
    avgProgress: Math.round(user.works.reduce((sum, w) => sum + w.completion_percentage, 0) / user.works.length),
  })).sort((a, b) => {
    if (a.hasDelayed && !b.hasDelayed) return -1;
    if (!a.hasDelayed && b.hasDelayed) return 1;
    if (a.hasStaleUpdates && !b.hasStaleUpdates) return -1;
    if (!a.hasStaleUpdates && b.hasStaleUpdates) return 1;
    if (a.problemsCount !== b.problemsCount) return b.problemsCount - a.problemsCount;
    return a.userName.localeCompare(b.userName);
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
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'delayed': return 'bg-red-100 text-red-800';
      case 'not_started': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Work Overview</h1>
          {activeCycle && (
            <p className="text-sm text-gray-600 mt-1">
              Current Cycle: Q{activeCycle.quarter} {activeCycle.year}
            </p>
          )}
        </div>
          <button
            onClick={() => setShowCreateWorkModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="h-5 w-5" />
            Create New Work Entry
          </button>
      </div>



      {myWorkSummary.totalWorks > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg shadow-sm">
          <div
            className="p-4 cursor-pointer"
            onClick={() => setShowMyWorkSection(!showMyWorkSection)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <ClipboardList className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">My Work</h3>
              </div>
              {showMyWorkSection ? (
                <ChevronUp className="h-5 w-5 text-gray-600" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-600" />
              )}
            </div>
          </div>

          {showMyWorkSection && (
            <div className="px-4 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <p className="text-xs text-gray-600">Active Work Items</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{myWorkSummary.totalWorks}</p>
                </div>

                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <p className="text-xs text-gray-600">Avg Completion</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{myWorkSummary.avgCompletion}%</p>
                </div>

                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <p className="text-xs text-gray-600">Open Problems</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{myWorkSummary.openProblems}</p>
                </div>

                <div className="bg-white rounded-lg p-4 border border-blue-200 flex items-center justify-center">
                  <button
                    onClick={() => setShowCreateWorkModal(true)}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Work Entry</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <button
          onClick={() => {
            if (activeCardFilter === 'usersWithWork') {
              setActiveCardFilter(null);
            } else {
              setActiveCardFilter('usersWithWork');
            }
          }}
          className={`bg-white border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer text-left ${
            activeCardFilter === 'usersWithWork' ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Users with Work</p>
              <p className="text-xl font-bold text-gray-900">
                {statistics.usersWithWork}/{statistics.totalUsers}
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setShowNoWorkModal(true)}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-600">No Work Entries</p>
              <p className="text-xl font-bold text-gray-900">{statistics.usersWithoutWork}</p>
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
          className={`bg-white border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer text-left ${
            activeCardFilter === 'delayed' ? 'ring-2 ring-orange-500 border-orange-500' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-lg">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Delayed Work</p>
              <p className="text-xl font-bold text-gray-900">{statistics.delayedWorkCount}</p>
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
          className={`bg-white border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer text-left ${
            activeCardFilter === 'highImpactProblems' ? 'ring-2 ring-red-500 border-red-500' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-600">High Impact Problems</p>
              <p className="text-xl font-bold text-gray-900">{statistics.highImpactProblemsCount}</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setShowSupportRequestsModal(true)}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-600">Support Requests</p>
              <p className="text-xl font-bold text-gray-900">
                {Object.values(statistics.openSupportRequests).reduce((a, b) => a + b, 0)}
              </p>
            </div>
          </div>
        </button>
      </div>

      {activeCardFilter && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">
              {activeCardFilter === 'usersWithWork' && 'Showing all users with work assignments'}
              {activeCardFilter === 'delayed' && 'Showing only delayed work entries'}
              {activeCardFilter === 'highImpactProblems' && 'Showing work with high impact problems'}
            </span>
          </div>
          <button
            onClick={() => setActiveCardFilter(null)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear Filter
          </button>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Auto-Flag Alerts</h3>
        <div className="space-y-2">
          {workData.filter(w => w.days_since_update >= 14).length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
              <span className="text-gray-700">
                {workData.filter(w => w.days_since_update >= 14).length} work item(s) with no update in 14+ days
              </span>
            </div>
          )}
          {statistics.delayedWorkCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-gray-700">
                {statistics.delayedWorkCount} work item(s) marked as delayed
              </span>
            </div>
          )}
          {statistics.highImpactProblemsCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-gray-700">
                {statistics.highImpactProblemsCount} high-impact problem(s) open
              </span>
            </div>
          )}
          {workData.filter(w => w.days_since_update >= 14).length === 0 &&
           statistics.delayedWorkCount === 0 &&
           statistics.highImpactProblemsCount === 0 && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <span>No critical alerts at this time</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Who is Working on What</h2>
          <button
            onClick={toggleExpandAll}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {expandAll ? 'Collapse All' : 'Expand All'}
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input
              type="text"
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="px-3 py-2 h-[42px] bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            {(hasPermission('manage_work_cycles') || hasPermission('manage_users')) && (
              <select
                value={filters.user}
                onChange={(e) => setFilters({ ...filters, user: e.target.value })}
                className="px-3 py-2 h-[42px] bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">All Users</option>
                {Array.from(new Set(workData.map(w => w.user_name))).sort().map(userName => (
                  <option key={userName} value={userName}>{userName}</option>
                ))}
              </select>
            )}
            <input
              type="text"
              placeholder="Filter by project..."
              value={filters.project}
              onChange={(e) => setFilters({ ...filters, project: e.target.value })}
              className="px-3 py-2 h-[42px] bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 h-[42px] bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">All Statuses</option>
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="delayed">Delayed</option>
              <option value="completed">Completed</option>
            </select>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="px-3 py-2 h-[42px] bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {groupedUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No work entries found
            </div>
          ) : (
            groupedUsers.map((user) => (
              <div
                key={user.userId}
                className={`border-2 rounded-lg overflow-hidden transition-all ${
                  user.hasDelayed
                    ? 'border-red-400 shadow-md'
                    : user.hasStaleUpdates
                    ? 'border-orange-400 shadow-md'
                    : 'border-gray-200'
                }`}
              >
                <div
                  onClick={() => toggleUser(user.userId)}
                  className="bg-gradient-to-r from-gray-50 to-white p-4 cursor-pointer hover:from-gray-100 hover:to-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">{user.userName}</h3>
                        <p className="text-sm text-gray-600">{user.department}</p>
                      </div>
                      <div className="flex items-center gap-4 ml-8">
                        <div className="text-center">
                          <p className="text-xs text-gray-500">Total Items</p>
                          <p className="text-lg font-bold text-gray-900">{user.works.length}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500">Avg Progress</p>
                          <p className="text-lg font-bold text-blue-600">{user.avgProgress}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500">Problems</p>
                          <p className={`text-lg font-bold ${user.problemsCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {user.problemsCount}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {user.hasDelayed && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                          Delayed Work
                        </span>
                      )}
                      {user.hasStaleUpdates && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded">
                          Stale Updates
                        </span>
                      )}
                      {expandedUsers.has(user.userId) ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {expandedUsers.has(user.userId) && (
                  <div className="bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-y border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Work Title</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Problems</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flags</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {user.works.map((work) => (
                            <tr key={work.work_id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">{work.project_name}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{work.work_title}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadgeColor(work.latest_status)}`}>
                                  {work.latest_status.replace('_', ' ').toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-20 bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-blue-600 h-2 rounded-full"
                                      style={{ width: `${work.completion_percentage}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs text-gray-600">{work.completion_percentage}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 text-xs font-medium rounded ${getPriorityBadgeColor(work.priority)}`}>
                                  {work.priority.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {work.open_problems_count > 0 ? (
                                  <span className="text-red-600 font-medium">{work.open_problems_count}</span>
                                ) : (
                                  <span className="text-gray-400">0</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {work.days_since_update >= 14 && (
                                    <div className="w-2 h-2 bg-orange-500 rounded-full" title="No update in 14+ days"></div>
                                  )}
                                  {work.latest_status === 'delayed' && (
                                    <div className="w-2 h-2 bg-red-500 rounded-full" title="Delayed status"></div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setSelectedWorkId(work.work_id)}
                                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
                                  title="View details"
                                >
                                  <Eye className="h-4 w-4" />
                                  <span>View</span>
                                </button>
                              </td>
                            </tr>
                          ))}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[600px] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Users Without Work Assignments</h2>
              <button
                onClick={() => setShowNoWorkModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[450px]">
              {usersWithoutWork.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <p className="text-gray-600">All users have work assignments!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {usersWithoutWork.map((user) => (
                    <div key={user.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{user.full_name}</h3>
                          <p className="text-sm text-gray-600">{user.department || 'No department'}</p>
                        </div>
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">No Work</span>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Support Requests Breakdown</h2>
              <button
                onClick={() => setShowSupportRequestsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Supervisor Support</p>
                      <p className="text-sm text-gray-600">Requests requiring supervisor action</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">{statistics.openSupportRequests.supervisor}</span>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-lg">
                      <Users className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Admin Support</p>
                      <p className="text-sm text-gray-600">Requests requiring admin action</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">{statistics.openSupportRequests.admin}</span>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="bg-orange-100 p-2 rounded-lg">
                      <Users className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Facility SPOC</p>
                      <p className="text-sm text-gray-600">Facility-related support requests</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">{statistics.openSupportRequests.facility_spoc}</span>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <ShoppingCart className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Procurement</p>
                      <p className="text-sm text-gray-600">Purchase-related support requests</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-gray-900">{statistics.openSupportRequests.procurement}</span>
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">Total Open Requests</span>
                    <span className="text-2xl font-bold text-gray-900">
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
          onClose={() => setSelectedWorkId(null)}
          onUpdate={fetchData}
        />
      )}

      <WorkEntryFormModal
        isOpen={showCreateWorkModal}
        onClose={() => setShowCreateWorkModal(false)}
        onSuccess={() => {
          setShowCreateWorkModal(false);
          fetchData();
        }}
      />
    </div>
  );
}
