import { useState, useEffect, useMemo } from 'react';
import {
  FolderKanban,
  Search,
  Filter,
  Plus,
  Eye,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  Users,
  ExternalLink,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  LayoutGrid,
  Table as TableIcon,
  RefreshCw,
  Sparkles,
  Link as LinkIcon,
  FileText
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Project,
  RAGStatus,
  PROJECT_CATEGORIES,
  PROJECT_STATUSES,
  RAG_OPTIONS,
} from '../types/project';
import {
  PageHeader,
  Button,
  Card,
  StatCard,
  EmptyState,
} from '../components/ui';
import ProjectFormModal from '../components/ProjectFormModal';
import ProjectDetailModal from '../components/ProjectDetailModal';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import ProposalPreviewModal from '../components/ProposalPreviewModal';

export default function ProjectsPage() {
  const { profile, hasPermission } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ragFilter, setRagFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [selectedProjectForEdit, setSelectedProjectForEdit] = useState<Project | null>(null);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedProjectForDetail, setSelectedProjectForDetail] = useState<Project | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<'achievements' | 'details'>('achievements');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Proposal modal state
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [selectedProjectForProposal, setSelectedProjectForProposal] = useState<Project | null>(null);

  const handleOpenProposal = (project: Project) => {
    setSelectedProjectForProposal(project);
    setProposalModalOpen(true);
  };

  // RBAC permissions
  const canViewProjects = hasPermission('view_projects');
  const canCreateProjects = hasPermission('create_projects');
  const canEditProjects = hasPermission('edit_projects');
  const canDeleteProjects = hasPermission('delete_projects');
  const canAddAchievement = hasPermission('add_project_achievement');

  useEffect(() => {
    fetchProjects();
  }, [statusFilter, ragFilter, categoryFilter]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (ragFilter !== 'all') params.rag_status = ragFilter;
      if (categoryFilter !== 'all') params.category = categoryFilter;

      const { data, error } = await api.get('/api/projects', params);
      if (error) throw error;
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered by search text in client
  const filteredProjects = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.trim().toLowerCase();
    return projects.filter(
      (p) =>
        p.project_title.toLowerCase().includes(q) ||
        (p.project_code && p.project_code.toLowerCase().includes(q)) ||
        p.tracker_id.toLowerCase().includes(q) ||
        (p.funding_agency && p.funding_agency.toLowerCase().includes(q)) ||
        (p.faculty_lead_pi && p.faculty_lead_pi.toLowerCase().includes(q)) ||
        (p.accountable_owner_poc && p.accountable_owner_poc.toLowerCase().includes(q))
    );
  }, [projects, search]);

  // Quick stats calculations
  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.status === 'Active' || p.status === 'In Progress').length;
    const green = projects.filter((p) => p.rag_status === 'Green').length;
    const amber = projects.filter((p) => p.rag_status === 'Amber').length;
    const red = projects.filter((p) => p.rag_status === 'Red').length;
    const closingSoon = projects.filter((p) => {
      if (p.days_to_close !== null && p.days_to_close !== undefined) {
        return p.days_to_close <= 30;
      }
      return false;
    }).length;

    return { total, active, green, amber, red, closingSoon };
  }, [projects]);

  const handleOpenCreate = () => {
    setSelectedProjectForEdit(null);
    setFormModalOpen(true);
  };

  const handleOpenEdit = (project: Project) => {
    setSelectedProjectForEdit(project);
    setFormModalOpen(true);
    setDetailModalOpen(false);
  };

  const handleOpenDetail = (project: Project, tab: 'achievements' | 'details' = 'achievements') => {
    setSelectedProjectForDetail(project);
    setDetailInitialTab(tab);
    setDetailModalOpen(true);
  };

  const handleOpenDelete = (project: Project) => {
    setProjectToDelete(project);
    setDeleteModalOpen(true);
    setDetailModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    try {
      setDeleteLoading(true);
      const { error } = await api.delete(`/api/projects/${projectToDelete.id}`);
      if (error) throw error;
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
      setDeleteModalOpen(false);
      setProjectToDelete(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete project');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleProjectSaved = (saved: Project) => {
    setProjects((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...saved };
        return copy;
      }
      return [saved, ...prev];
    });
    // Also update detail modal if currently viewing this project
    if (selectedProjectForDetail?.id === saved.id) {
      setSelectedProjectForDetail(saved);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Page Header */}
      <PageHeader
        title={
          <div>
            <span>Project Tracker</span>
            <div className="text-xs sm:text-sm font-normal text-gray-500 dark:text-slate-400 mt-0.5">
              End-to-end tracking of laboratory research grants, consultancies, deliverables, and team governance
            </div>
          </div>
        }
        action={
          canCreateProjects ? (
            <Button
              variant="primary"
              onClick={handleOpenCreate}
              className="flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Create Project</span>
            </Button>
          ) : undefined
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FolderKanban}
          title="Total Projects"
          value={stats.total}
          color="blue"
        />
        <StatCard
          icon={TrendingUp}
          title="Active Projects"
          value={stats.active}
          color="emerald"
        />
        <StatCard
          icon={Sparkles}
          title="RAG Breakdown"
          value={`${stats.green}G • ${stats.amber}A • ${stats.red}R`}
          color="purple"
        />
        <StatCard
          icon={AlertTriangle}
          title="Closing Soon / Overdue"
          value={stats.closingSoon}
          color="amber"
        />
      </div>

      {/* Filter & Toolbar */}
      <Card className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-gray-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by project title, code, Tracker ID, funder, or PI..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-medium text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              {PROJECT_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            {/* RAG Filter */}
            <select
              value={ragFilter}
              onChange={(e) => setRagFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-medium text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All RAG</option>
              <option value="Green">Green (On Track)</option>
              <option value="Amber">Amber (Needs Attention)</option>
              <option value="Red">Red (Critical)</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-medium text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {PROJECT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-xl p-0.5 border border-gray-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-medium transition ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:text-slate-400'
                }`}
                title="Table View"
              >
                <TableIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg text-xs font-medium transition ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:text-slate-400'
                }`}
                title="Cards View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={fetchProjects}
              className="p-2 text-gray-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 bg-gray-50 dark:bg-slate-800/80 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl border border-gray-200 dark:border-slate-700 transition"
              title="Refresh projects"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500 dark:text-slate-400">Loading project trackers...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card className="py-16 text-center border-dashed border-gray-300 dark:border-slate-800">
          <FolderKanban className="w-12 h-12 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-700 dark:text-slate-300">
            No projects found
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
            {search || statusFilter !== 'all' || ragFilter !== 'all' || categoryFilter !== 'all'
              ? 'Try adjusting your search criteria or filter options.'
              : 'Get started by creating your first project tracker entry.'}
          </p>
          {canCreateProjects && (
            <Button
              variant="primary"
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Project</span>
            </Button>
          )}
        </Card>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700 dark:text-slate-300">
              <thead className="bg-gray-50/80 dark:bg-slate-800/60 uppercase font-semibold text-[11px] text-gray-500 dark:text-slate-400 border-b border-gray-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Tracker ID</th>
                  <th className="py-3 px-4 min-w-[200px]">Project Code & Title</th>
                  <th className="py-3 px-4">Funding Agency</th>
                  <th className="py-3 px-4 min-w-[150px]">Project Proposal</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">RAG</th>
                  <th className="py-3 px-4">Faculty Lead / PI</th>
                  <th className="py-3 px-4">Team</th>
                  <th className="py-3 px-4">Days to Close (Auto)</th>
                  <th className="py-3 px-4 min-w-[190px]">Achieved to Date</th>
                  <th className="py-3 px-4">Days Since Update</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                {filteredProjects.map((project) => {
                  const rag = RAG_OPTIONS.find((r) => r.value === project.rag_status) || RAG_OPTIONS[0];
                  return (
                    <tr
                      key={project.id}
                      onClick={() => handleOpenDetail(project, 'details')}
                      className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition group cursor-pointer"
                    >
                      {/* Tracker ID */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(project, 'achievements');
                          }}
                          className="font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                          title="Click to view full tracker & achievements"
                        >
                          <span>{project.tracker_id}</span>
                        </button>
                      </td>

                      {/* Code & Title */}
                      <td className="py-3 px-4">
                        <div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(project, 'details');
                            }}
                            className="font-semibold text-gray-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 text-left line-clamp-1 transition"
                          >
                            {project.project_title}
                          </button>
                          {project.project_code && (
                            <span className="text-[11px] font-mono text-gray-400 dark:text-slate-500 block">
                              {project.project_code}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Funding Agency */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-800 dark:text-slate-200">
                          {project.funding_agency || '—'}
                        </span>
                      </td>

                      {/* Project Proposal */}
                      <td className="py-3 px-4">
                        {project.proposal_file_path || project.proposal_filename || project.proposal_link ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenProposal(project);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-900/40 transition group"
                            title="Click to view Project Proposal directly in SC Lab"
                          >
                            <FileText className="w-3.5 h-3.5 group-hover:scale-110 transition-transform flex-shrink-0" />
                            <span className="truncate max-w-[120px]">
                              {project.proposal_filename || 'Proposal'}
                            </span>
                            <Eye className="w-3 h-3 text-blue-500 opacity-70 flex-shrink-0" />
                          </button>
                        ) : (
                          <span className="text-gray-400 dark:text-slate-500 text-xs">—</span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span className="text-gray-600 dark:text-slate-400">
                          {project.category || 'General'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
                          {project.status}
                        </span>
                      </td>

                      {/* RAG Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border ${rag.bg} ${rag.color}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${rag.dot}`} />
                          <span>{project.rag_status}</span>
                        </span>
                      </td>

                      {/* Faculty Lead / PI */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-800 dark:text-slate-200">
                          {project.faculty_lead_pi || '—'}
                        </span>
                      </td>

                      {/* Team */}
                      <td className="py-3 px-4">
                        {Array.isArray(project.team) && project.team.length > 0 ? (
                          <div
                            className="flex items-center -space-x-1.5 cursor-pointer"
                            onClick={() => handleOpenDetail(project, 'details')}
                            title={project.team.map((m) => m.name).join(', ')}
                          >
                            {project.team.slice(0, 3).map((m, idx) => (
                              <div
                                key={idx}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white dark:border-slate-900 ${
                                  m.is_external ? 'bg-amber-600' : 'bg-blue-600'
                                }`}
                              >
                                {m.name.charAt(0).toUpperCase()}
                              </div>
                            ))}
                            {project.team.length > 3 && (
                              <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-slate-900">
                                +{project.team.length - 3}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Days to Close (Auto-calculated) */}
                      <td className="py-3 px-4">
                        {project.days_to_close === null || project.days_to_close === undefined ? (
                          <span className="text-gray-400">—</span>
                        ) : project.days_to_close < 0 ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            {Math.abs(project.days_to_close)}d Overdue
                          </span>
                        ) : project.days_to_close === 0 ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Due Today
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {project.days_to_close}d left
                          </span>
                        )}
                      </td>

                      {/* Achieved to Date (Timeline Button + Snippet) */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenDetail(project, 'achievements')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition flex-shrink-0"
                            title="Open Chat / Timeline"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>{project.achievement_count || 0} updates</span>
                          </button>
                          {project.latest_achievement_text && (
                            <span
                              className="text-[11px] text-gray-500 dark:text-slate-400 truncate max-w-[120px]"
                              title={project.latest_achievement_text}
                            >
                              "{project.latest_achievement_text}"
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Days Since Update (Auto-calculated) */}
                      <td className="py-3 px-4">
                        {project.days_since_update === null || project.days_since_update === undefined ? (
                          <span className="text-gray-400">None</span>
                        ) : project.days_since_update === 0 ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Today</span>
                        ) : (
                          <span className="text-gray-600 dark:text-slate-400">
                            {project.days_since_update}d ago
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(project, 'achievements');
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition"
                            title="View Timeline & Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {canEditProjects && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEdit(project);
                              }}
                              className="p-1.5 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition"
                              title="Edit Project"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {canDeleteProjects && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDelete(project);
                              }}
                              className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition"
                              title="Delete Project"
                            >
                              <Trash2 className="w-4 h-4" />
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
      ) : (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => {
            const rag = RAG_OPTIONS.find((r) => r.value === project.rag_status) || RAG_OPTIONS[0];
            return (
              <Card
                key={project.id}
                onClick={() => handleOpenDetail(project, 'details')}
                className="p-5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500/50 shadow-sm hover:shadow-md transition flex flex-col justify-between cursor-pointer group"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(project, 'achievements');
                          }}
                          className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          title="View achievements timeline"
                        >
                          {project.tracker_id}
                        </button>
                        {project.project_code && (
                          <span className="text-[10px] font-mono text-gray-400 bg-gray-100 dark:bg-slate-800 px-1 rounded">
                            {project.project_code}
                          </span>
                        )}
                      </div>
                      <h3
                        className="text-base font-bold text-gray-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 mt-1 line-clamp-1 transition"
                      >
                        {project.project_title}
                      </h3>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${rag.bg} ${rag.color}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${rag.dot}`} />
                      <span>{project.rag_status}</span>
                    </span>
                  </div>

                  {/* Overview snippet */}
                  {project.overview && (
                    <p className="text-xs text-gray-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {project.overview}
                    </p>
                  )}

                  {/* Meta Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                    {project.funding_agency && (
                      <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 font-medium">
                        {project.funding_agency}
                      </span>
                    )}
                    {(project.proposal_file_path || project.proposal_filename || project.proposal_link) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProposal(project);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-900/40 transition"
                        title="Click to view Project Proposal in SC Lab"
                      >
                        <FileText className="w-3 h-3" />
                        <span className="truncate max-w-[110px]">
                          {project.proposal_filename || 'Proposal'}
                        </span>
                        <Eye className="w-2.5 h-2.5 opacity-70" />
                      </button>
                    )}
                    <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium">
                      {project.status}
                    </span>
                    {project.days_to_close !== null && project.days_to_close !== undefined && (
                      <span
                        className={`px-2 py-0.5 rounded font-medium ${
                          project.days_to_close < 0
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {project.days_to_close < 0
                          ? `${Math.abs(project.days_to_close)}d overdue`
                          : `${project.days_to_close}d to close`}
                      </span>
                    )}
                  </div>

                  {/* Team Members */}
                  {Array.isArray(project.team) && project.team.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-gray-400">Team:</span>
                      <div className="flex items-center -space-x-1">
                        {project.team.slice(0, 4).map((m, idx) => (
                          <div
                            key={idx}
                            title={`${m.name} ${m.is_external ? '(External)' : ''}`}
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white border border-white dark:border-slate-900 ${
                              m.is_external ? 'bg-amber-600' : 'bg-blue-600'
                            }`}
                          >
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                      </div>
                      <span className="text-[11px] text-gray-500">
                        {project.team.length} member{project.team.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}

                  {/* Achieved to Date Snippet */}
                  {project.latest_achievement_text && (
                    <div className="p-2.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-lg text-xs space-y-0.5">
                      <div className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Latest Achievement</span>
                      </div>
                      <p className="text-gray-800 dark:text-slate-300 italic line-clamp-1">
                        "{project.latest_achievement_text}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-4 mt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDetail(project, 'achievements');
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Timeline ({project.achievement_count || 0})</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetail(project, 'details');
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {canEditProjects && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(project);
                        }}
                        className="p-1.5 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg transition"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {canDeleteProjects && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDelete(project);
                        }}
                        className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {formModalOpen && (
        <ProjectFormModal
          isOpen={formModalOpen}
          onClose={() => setFormModalOpen(false)}
          onSuccess={handleProjectSaved}
          project={selectedProjectForEdit}
        />
      )}

      {detailModalOpen && (
        <ProjectDetailModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          project={selectedProjectForDetail}
          onEdit={handleOpenEdit}
          onDelete={handleOpenDelete}
          onProjectUpdated={handleProjectSaved}
          initialTab={detailInitialTab}
        />
      )}

      {deleteModalOpen && projectToDelete && (
        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
          title="Delete Project Tracker Entry"
          message={`Are you sure you want to delete "${projectToDelete.project_title}" (${projectToDelete.tracker_id})? All recorded achievements will be permanently removed.`}
          loading={deleteLoading}
        />
      )}

      {/* In-portal proposal preview modal */}
      {proposalModalOpen && selectedProjectForProposal && (
        <ProposalPreviewModal
          isOpen={proposalModalOpen}
          onClose={() => setProposalModalOpen(false)}
          project={selectedProjectForProposal}
        />
      )}
    </div>
  );
}
