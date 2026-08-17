import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, AlertTriangle, CheckCircle2, Clock,
  Edit2, Trash2, Eye, Search, ChevronDown, ChevronUp,
  ClipboardList, Activity, AlertCircle
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import WorkEntryFormModal from '../components/WorkEntryFormModal';
import ProgressUpdateModal from '../components/ProgressUpdateModal';
import ProblemReportModal from '../components/ProblemReportModal';
import WorkEntryDetailModal from '../components/WorkEntryDetailModal';
import EditWorkEntryModal from '../components/EditWorkEntryModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

import { unescapeHtml } from '../utils/formatters';

interface AssignedWork {
  id: string;
  project_name: string;
  assigned_by: string;
  work_title: string;
  description: string;
  start_date: string;
  end_date: string;
  priority: 'low' | 'medium' | 'high';
  admin_status: string;
  created_at: string;
}

interface ProgressUpdate {
  id: string;
  status: string;
  completion_percentage: number;
  update_date: string;
  progress_notes: string;
}

interface WorkProblem {
  id: string;
  category: string;
  description: string;
  impact_level: 'low' | 'medium' | 'high';
  is_resolved: boolean;
  reported_date: string;
}

interface WorkMilestone {
  id: string;
  milestone_description: string;
  target_date: string;
  expected_outcome: string;
  is_completed: boolean;
}

export default function WorkOverviewPage() {
  const { user, profile, hasPermission } = useAuth();
  const navigate = useNavigate();

  // Redirect admins to team overview
  useEffect(() => {
    if (profile?.user_role === 'admin') {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const canCreateWork = hasPermission('create_work');
  const canEditWork = hasPermission('edit_work');
  const canDeleteWork = hasPermission('delete_work');

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch all work entries for the logged-in user (backend filters by user_id)
      const { data: worksData } = await api.get('/api/work');
      const workList = Array.isArray(worksData) ? worksData : [];
      setWorks(workList);

      for (const work of workList) {
        const { data: progressData } = await api.get(`/api/work/${work.id}/progress`, {
          order: 'update_date', ascending: 'false', limit: '1',
        });
        const latestProgress = Array.isArray(progressData) ? progressData[0] : progressData;
        if (latestProgress) setWorkProgress(prev => ({ ...prev, [work.id]: latestProgress }));

        const { data: problems } = await api.get(`/api/work/${work.id}/problems`, {
          order: 'reported_date', ascending: 'false',
        });
        if (problems) setWorkProblems(prev => ({ ...prev, [work.id]: problems }));

        const { data: milestones } = await api.get(`/api/work/${work.id}/milestones`, {
          order: 'target_date', ascending: 'true',
        });
        if (milestones) setWorkMilestones(prev => ({ ...prev, [work.id]: milestones }));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
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

  const calculateStats = () => {
    const totalWorks = works.length;
    const avgCompletion = works.length > 0
      ? Math.round(works.reduce((sum, work) => sum + (workProgress[work.id]?.completion_percentage || 0), 0) / works.length)
      : 0;
    const openProblems = Object.values(workProblems).flat().filter(p => !p.is_resolved).length;
    const completedWorks = works.filter(w => workProgress[w.id]?.status === 'completed').length;
    return { totalWorks, avgCompletion, openProblems, completedWorks };
  };

  const filteredWorks = works.filter(work => {
    const progress = workProgress[work.id];
    const matchesSearch = !searchQuery ||
      work.work_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      work.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (work.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !filterStatus ||
      (progress?.status === filterStatus) ||
      (!progress && filterStatus === 'not_started');
    const matchesPriority = !filterPriority || work.priority === filterPriority;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border border-red-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border border-amber-200';
      case 'low': return 'bg-blue-100 text-blue-700 border border-blue-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
      case 'in_progress': return 'bg-blue-100 text-blue-700 border border-blue-200';
      case 'delayed': return 'bg-red-100 text-red-700 border border-red-200';
      case 'not_started': return 'bg-gray-100 text-gray-600 border border-gray-200';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getProgressBarColor = (pct: number) => {
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 50) return 'bg-blue-500';
    if (pct >= 25) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const stats = calculateStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your work entries...</p>
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
            onClose={() => { setShowDetailModal(false); setSelectedWork(null); }}
            workId={selectedWork.id}
            onEdit={() => { setShowDetailModal(false); setShowEditModal(true); }}
            onDelete={() => { setShowDetailModal(false); setShowDeleteModal(true); }}
            onUpdateProgress={() => { setShowDetailModal(false); setShowProgressModal(true); }}
            onReportProblem={() => { setShowDetailModal(false); setShowProblemModal(true); }}
            onRefresh={fetchData}
          />
          <EditWorkEntryModal
            isOpen={showEditModal}
            onClose={() => { setShowEditModal(false); setSelectedWork(null); }}
            workId={selectedWork.id}
            onSuccess={() => { fetchData(); setShowEditModal(false); setSelectedWork(null); }}
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
            onClose={() => { setShowProgressModal(false); setSelectedWork(null); }}
            workId={selectedWork.id}
            workTitle={selectedWork.work_title}
            currentProgress={workProgress[selectedWork.id]?.completion_percentage || 0}
            onSuccess={fetchData}
          />
          <ProblemReportModal
            isOpen={showProblemModal}
            onClose={() => { setShowProblemModal(false); setSelectedWork(null); }}
            workId={selectedWork.id}
            workTitle={selectedWork.work_title}
            onSuccess={fetchData}
          />
        </>
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Work Overview</h1>
            <p className="text-sm text-gray-500 mt-1">Track and manage your work tasks</p>
          </div>
          {canCreateWork && (
            <button
              id="create-work-entry-btn"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="h-4 w-4" />
              Create New Work Entry
            </button>
          )}
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 p-2.5 rounded-lg">
                <ClipboardList className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Active Work Items</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalWorks}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 p-2.5 rounded-lg">
                <Activity className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Avg Completion</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgCompletion}%</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="bg-amber-50 p-2.5 rounded-lg">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Open Problems</p>
                <p className="text-2xl font-bold text-gray-900">{stats.openProblems}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="bg-purple-50 p-2.5 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completedWorks}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Work Entries */}
        <div className="bg-white border border-gray-200 rounded-xl">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900">My Work Entries</h2>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="work-search-input"
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
                  />
                </div>
                <select
                  id="work-status-filter"
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="delayed">Delayed</option>
                </select>
                <select
                  id="work-priority-filter"
                  value={filterPriority}
                  onChange={e => setFilterPriority(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Priorities</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          </div>

          {filteredWorks.length === 0 ? (
            <div className="p-16 text-center">
              <Clock className="h-14 w-14 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {works.length === 0 ? 'No Work Entries Yet' : 'No matching entries'}
              </h3>
              <p className="text-gray-500 text-sm">
                {works.length === 0
                  ? 'Once the work tracking period starts, create your first entry to track your progress here.'
                  : 'Try adjusting your search or filters.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredWorks.map((work) => {
                const progress = workProgress[work.id];
                const problems = workProblems[work.id] || [];
                const milestones = workMilestones[work.id] || [];
                const isExpanded = expandedWork === work.id;
                const openProblemsCount = problems.filter(p => !p.is_resolved).length;
                const completedMilestonesCount = milestones.filter(m => m.is_completed).length;
                const pct = progress?.completion_percentage || 0;

                return (
                  <div key={work.id} className="p-6 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => { setSelectedWork(work); setShowDetailModal(true); }}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <h3 className="text-base font-semibold text-gray-900 truncate">{work.work_title}</h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityColor(work.priority)}`}>
                            {work.priority.toUpperCase()}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(progress?.status || 'not_started')}`}>
                            {(progress?.status || 'not_started').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-1">
                          <span className="font-medium text-gray-700">Project:</span> {work.project_name}
                          {work.assigned_by && (
                            <> · <span className="font-medium text-gray-700">Assigned by:</span> {work.assigned_by}</>
                          )}
                        </p>
                        {work.description && (
                          <p className="text-sm text-gray-600 mb-2 whitespace-pre-line">{unescapeHtml(work.description)}</p>
                        )}
                        {progress && (
                          <div className="mb-2">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>{pct}% Complete</span>
                              <span>
                                {new Date(work.start_date).toLocaleDateString()} – {new Date(work.end_date).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${getProgressBarColor(pct)}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                          <span>{completedMilestonesCount}/{milestones.length} Milestones</span>
                          {openProblemsCount > 0 && (
                            <span className="text-red-600 font-medium flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {openProblemsCount} open problem{openProblemsCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          {!progress && (
                            <span className="text-gray-400">
                              {new Date(work.start_date).toLocaleDateString()} – {new Date(work.end_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedWork(work); setShowDetailModal(true); }}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canEditWork && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedWork(work); setShowEditModal(true); }}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {canDeleteWork && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedWork(work); setShowDeleteModal(true); }}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedWork(isExpanded ? null : work.id); }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition ml-1"
                          title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-5 pt-5 border-t border-gray-100">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-800 mb-3">Milestones</h4>
                            {milestones.length === 0 ? (
                              <p className="text-sm text-gray-400">No milestones defined</p>
                            ) : (
                              <div className="space-y-2">
                                {milestones.map((m) => (
                                  <div key={m.id} className="flex items-start gap-2.5 p-3 bg-gray-50 rounded-lg">
                                    <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${m.is_completed ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>
                                      {m.is_completed && <CheckCircle2 className="h-3 w-3 text-white" />}
                                    </div>
                                    <div>
                                      <p className={`text-sm font-medium ${m.is_completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                        {m.milestone_description}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        Target: {new Date(m.target_date).toLocaleDateString()}
                                      </p>
                                      {m.expected_outcome && (
                                        <p className="text-xs text-gray-500">Outcome: {m.expected_outcome}</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-gray-800 mb-3">Problems & Blockers</h4>
                            {problems.length === 0 ? (
                              <p className="text-sm text-gray-400">No problems reported</p>
                            ) : (
                              <div className="space-y-2">
                                {problems.map((p) => (
                                  <div key={p.id} className={`p-3 rounded-lg border ${p.impact_level === 'high' ? 'bg-red-50 border-red-200' :
                                      p.impact_level === 'medium' ? 'bg-amber-50 border-amber-200' :
                                        'bg-gray-50 border-gray-200'
                                    }`}>
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${p.impact_level === 'high' ? 'bg-red-100 text-red-700' :
                                              p.impact_level === 'medium' ? 'bg-amber-100 text-amber-700' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>{p.impact_level.toUpperCase()}</span>
                                          <span className="text-xs text-gray-500">{p.category}</span>
                                        </div>
                                        <p className="text-sm text-gray-800">{p.description}</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                          Reported: {new Date(p.reported_date).toLocaleDateString()}
                                        </p>
                                      </div>
                                      {p.is_resolved && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedWork(work); setShowDetailModal(true); }}
                            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                          >
                            View Full Details
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedWork(work); setShowProgressModal(true); }}
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                          >
                            Update Progress
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedWork(work); setShowProblemModal(true); }}
                            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                          >
                            Report Problem
                          </button>
                          {canEditWork && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedWork(work); setShowEditModal(true); }}
                              className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
                            >
                              Edit Entry
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
