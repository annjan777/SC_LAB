import { useState, useEffect, useRef } from 'react';
import {
  X,
  Calendar,
  Clock,
  Users,
  Link as LinkIcon,
  ExternalLink,
  Edit2,
  Trash2,
  Send,
  AlertTriangle,
  CheckCircle2,
  Shield,
  FileText,
  Activity,
  MessageSquare,
  Sparkles,
  UserCheck,
  User,
  ArrowRight,
  Download,
  Eye,
  Upload
} from 'lucide-react';
import { api, getStoredToken } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Project,
  ProjectAchievement,
  RAG_OPTIONS,
} from '../types/project';
import { Button } from './ui';
import ProposalPreviewModal from './ProposalPreviewModal';

interface ProjectDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onEdit?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  onProjectUpdated?: (updatedProject: Project) => void;
  initialTab?: 'achievements' | 'details';
}

export default function ProjectDetailModal({
  isOpen,
  onClose,
  project,
  onEdit,
  onDelete,
  onProjectUpdated,
  initialTab = 'achievements',
}: ProjectDetailModalProps) {
  const { user, profile, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'achievements' | 'details'>(initialTab);

  const [achievements, setAchievements] = useState<ProjectAchievement[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(false);
  const [newAchievementText, setNewAchievementText] = useState('');
  const [submittingAchievement, setSubmittingAchievement] = useState(false);
  const [achievementError, setAchievementError] = useState('');
  const [previewProposalOpen, setPreviewProposalOpen] = useState(false);
  const [uploadingProposal, setUploadingProposal] = useState(false);
  const detailProposalInputRef = useRef<HTMLInputElement>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const canEdit = hasPermission('edit_projects');
  const canDelete = hasPermission('delete_projects');
  const canAddAchievement = hasPermission('add_project_achievement');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (isOpen && project) {
      fetchAchievements();
    }
  }, [isOpen, project?.id]);

  useEffect(() => {
    // Scroll chat to bottom when achievements load or new one is posted
    if (activeTab === 'achievements') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [achievements, activeTab]);

  const fetchAchievements = async () => {
    if (!project) return;
    try {
      setAchievementsLoading(true);
      const { data, error } = await api.get(`/api/projects/${project.id}/achievements`);
      if (error) throw error;
      setAchievements(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load achievements:', err);
    } finally {
      setAchievementsLoading(false);
    }
  };

  if (!isOpen || !project) return null;

  const ragConfig = RAG_OPTIONS.find((r) => r.value === project.rag_status) || RAG_OPTIONS[0];

  // Dynamic calculated Days to Close
  const calculateDaysToClose = () => {
    if (!project.closing_date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const close = new Date(project.closing_date);
    close.setHours(0, 0, 0, 0);
    return Math.ceil((close.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Dynamic calculated Days Since Update
  const calculateDaysSinceUpdate = () => {
    if (!project.last_weekly_update) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const updateDate = new Date(project.last_weekly_update);
    updateDate.setHours(0, 0, 0, 0);
    return Math.floor((today.getTime() - updateDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const daysToClose = project.days_to_close ?? calculateDaysToClose();
  const daysSinceUpdate = project.days_since_update ?? calculateDaysSinceUpdate();

  const handlePostAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newAchievementText.trim();
    if (!trimmed) return;

    try {
      setSubmittingAchievement(true);
      setAchievementError('');

      const { data, error } = await api.post(`/api/projects/${project.id}/achievements`, {
        message: trimmed,
      });

      if (error || !data) throw error || new Error('Failed to post achievement');

      // Append to local achievements
      setAchievements((prev) => [...prev, data]);
      setNewAchievementText('');

      // Update project parent state to reflect latest date
      const updatedDate = new Date().toISOString().split('T')[0];
      const updatedProj: Project = {
        ...project,
        last_weekly_update: updatedDate,
        days_since_update: 0,
        achievement_count: (project.achievement_count || 0) + 1,
        latest_achievement_text: trimmed,
        latest_achievement_date: new Date().toISOString(),
      };
      if (onProjectUpdated) {
        onProjectUpdated(updatedProj);
      }
    } catch (err: any) {
      console.error('Post achievement error:', err);
      setAchievementError(err?.message || 'Failed to post achievement');
    } finally {
      setSubmittingAchievement(false);
    }
  };

  const handleDeleteAchievement = async (achId: string) => {
    if (!window.confirm('Are you sure you want to delete this achievement record?')) return;
    try {
      const { error } = await api.delete(`/api/projects/${project.id}/achievements/${achId}`);
      if (error) throw error;
      setAchievements((prev) => prev.filter((a) => a.id !== achId));
    } catch (err: any) {
      alert(err?.message || 'Failed to delete achievement');
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getRelativeTime = (dateStr: string) => {
    try {
      const now = new Date().getTime();
      const past = new Date(dateStr).getTime();
      const diffSecs = Math.floor((now - past) / 1000);
      if (diffSecs < 60) return 'Just now';
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 30) return `${diffDays}d ago`;
      return '';
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl my-8 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {project.tracker_id}
              </span>
              {project.project_code && (
                <span className="px-2 py-0.5 rounded text-xs font-mono text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                  {project.project_code}
                </span>
              )}
              {/* RAG Pill */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ragConfig.bg} ${ragConfig.color}`}
              >
                <span className={`w-2 h-2 rounded-full ${ragConfig.dot}`} />
                <span>RAG: {project.rag_status}</span>
              </span>
              {/* Status Badge */}
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
                {project.status}
              </span>
            </div>

            <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100 mt-1">
              {project.project_title}
            </h1>
            {project.funding_agency && (
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Funding Agency: <strong className="text-gray-700 dark:text-slate-300">{project.funding_agency}</strong>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canEdit && onEdit && (
              <button
                onClick={() => onEdit(project)}
                className="p-2 text-gray-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition"
                title="Edit Project"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {canDelete && onDelete && (
              <button
                onClick={() => onDelete(project)}
                className="p-2 text-gray-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition"
                title="Delete Project"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('achievements')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'achievements'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Achieved to Date (Timeline)</span>
            <span className="px-1.5 py-0.2 rounded-full text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400">
              {achievements.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'details'
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Project Details & Governance</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {/* TAB 1: Achieved to Date Timeline Interface */}
          {activeTab === 'achievements' && (
            <div className="flex flex-col h-full min-h-[460px]">
              {/* Banner */}
              <div className="px-6 py-3 bg-blue-50/50 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-blue-800 dark:text-blue-300">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>
                    <strong>Historical Achievements Timeline:</strong> Post updates as project milestones are achieved.
                    All previous entries are permanently recorded in chronological order.
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-slate-400">
                  Last Weekly Update: {project.last_weekly_update || 'None'}
                </div>
              </div>

              {/* Chat / Timeline Stream */}
              <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-gray-50/40 dark:bg-slate-950/40">
                {achievementsLoading ? (
                  <div className="py-12 text-center text-sm text-gray-500">
                    Loading achievements history...
                  </div>
                ) : achievements.length === 0 ? (
                  <div className="py-16 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-gray-700 dark:text-slate-300">
                      No achievements recorded yet
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                      Post your first achievement update below (e.g., "Prototype testing completed for Module X") to begin tracking project milestones.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 max-w-3xl mx-auto">
                    {achievements.map((ach, idx) => {
                      const isCurrentUser = ach.user_id === user?.id;
                      return (
                        <div
                          key={ach.id}
                          className="flex items-start gap-3 p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm hover:border-blue-200 dark:hover:border-slate-700 transition"
                        >
                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm">
                            {ach.author_name ? ach.author_name.charAt(0).toUpperCase() : 'U'}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-gray-900 dark:text-slate-100">
                                  {ach.author_name}
                                </span>
                                {isCurrentUser && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 dark:text-slate-500" title={formatDateTime(ach.created_at)}>
                                  {getRelativeTime(ach.created_at) || formatDateTime(ach.created_at)}
                                </span>
                                {(isCurrentUser || canEdit || canDelete) && (
                                  <button
                                    onClick={() => handleDeleteAchievement(ach.id)}
                                    className="opacity-40 hover:opacity-100 text-gray-400 hover:text-rose-500 transition p-0.5"
                                    title="Delete update"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <p className="mt-1.5 text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                              {ach.message}
                            </p>

                            <div className="mt-2 text-[11px] text-gray-400 dark:text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{formatDateTime(ach.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                {canAddAchievement ? (
                  <form onSubmit={handlePostAchievement} className="max-w-3xl mx-auto space-y-2">
                    {achievementError && (
                      <p className="text-xs text-rose-500 px-1">{achievementError}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={newAchievementText}
                          onChange={(e) => setNewAchievementText(e.target.value)}
                          placeholder="Post an achievement update (e.g. Prototype testing completed for Module X)..."
                          disabled={submittingAchievement}
                          className="w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-slate-800/90 border border-gray-300 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={submittingAchievement || !newAchievementText.trim()}
                        className="py-3 px-5 rounded-xl shadow-md"
                      >
                        {submittingAchievement ? (
                          'Posting...'
                        ) : (
                          <span className="flex items-center gap-1.5 font-semibold">
                            <span>Post</span>
                            <Send className="w-4 h-4" />
                          </span>
                        )}
                      </Button>
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500 px-1">
                      Press <strong>Enter</strong> to post. Updates are automatically time-stamped and preserved permanently.
                    </p>
                  </form>
                ) : (
                  <div className="p-3 bg-gray-100 dark:bg-slate-800 rounded-xl text-center text-xs text-gray-500 dark:text-slate-400">
                    You do not have permission to post achievement updates. Contact your administrator to request the <strong>add_project_achievement</strong> permission.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Detailed Metadata & Governance */}
          {activeTab === 'details' && (
            <div className="p-6 space-y-6">
              {/* Overview & Plan */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800 rounded-xl space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                    Project Overview
                  </h3>
                  <p className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {project.overview || 'No overview provided.'}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800 rounded-xl space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                    Plan (Next 3–6 Months)
                  </h3>
                  <p className="text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {project.plan_next_phase || 'No upcoming phase plan documented.'}
                  </p>
                </div>
              </div>

              {/* Core Governance Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Faculty Lead / PI */}
                <div className="p-3.5 bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 rounded-xl">
                  <div className="text-xs text-gray-500 dark:text-slate-400">Faculty Lead / PI</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-0.5">
                    {project.faculty_lead_pi || '—'}
                  </div>
                </div>

                {/* Accountable Owner POC */}
                <div className="p-3.5 bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 rounded-xl">
                  <div className="text-xs text-gray-500 dark:text-slate-400">Accountable Owner (POC)</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-0.5">
                    {project.accountable_owner_poc || '—'}
                  </div>
                </div>

                {/* Days to Close */}
                <div className="p-3.5 bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 rounded-xl">
                  <div className="text-xs text-gray-500 dark:text-slate-400">Days to Close (Auto)</div>
                  <div className="text-sm font-bold mt-0.5">
                    {daysToClose === null ? (
                      <span className="text-gray-400">—</span>
                    ) : daysToClose < 0 ? (
                      <span className="text-rose-600 dark:text-rose-400">{Math.abs(daysToClose)} days overdue</span>
                    ) : daysToClose === 0 ? (
                      <span className="text-amber-600 dark:text-amber-400">Due Today</span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400">{daysToClose} days left</span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    Close: {project.closing_date || 'N/A'}
                  </div>
                </div>

                {/* Days Since Update */}
                <div className="p-3.5 bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 rounded-xl">
                  <div className="text-xs text-gray-500 dark:text-slate-400">Days Since Update (Auto)</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-slate-100 mt-0.5">
                    {daysSinceUpdate === null ? (
                      <span className="text-gray-400">No updates</span>
                    ) : daysSinceUpdate === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">Today</span>
                    ) : (
                      <span>{daysSinceUpdate} days ago</span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    Status: {project.update_status || 'On Track'}
                  </div>
                </div>
              </div>

              {/* Secondary Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Project Proposal */}
                <div className="p-3.5 bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 rounded-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                        Project Proposal
                      </div>
                      {(project.proposal_file_path || project.proposal_filename) && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                          {project.proposal_filename?.toLowerCase().endsWith('.docx') ? 'DOCX' : 'PDF'}
                        </span>
                      )}
                    </div>
                    <div className="mt-1">
                      {project.proposal_file_path || project.proposal_filename || project.proposal_link ? (
                        <div>
                          <button
                            type="button"
                            onClick={() => setPreviewProposalOpen(true)}
                            className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 text-left truncate"
                            title="View proposal in SC Lab"
                          >
                            <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">
                              {project.proposal_filename || 'View Proposal'}
                            </span>
                          </button>
                          {project.proposal_file_size && (
                            <span className="text-[11px] text-gray-400">
                              {project.proposal_file_size > 1024 * 1024
                                ? `${(project.proposal_file_size / (1024 * 1024)).toFixed(1)} MB`
                                : `${Math.round(project.proposal_file_size / 1024)} KB`}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No document</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-slate-800/80 flex items-center gap-1.5 flex-wrap">
                    {(project.proposal_file_path || project.proposal_filename || project.proposal_link) && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPreviewProposalOpen(true)}
                          className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const token = getStoredToken();
                            if (project.proposal_file_path || project.proposal_filename) {
                              const url = `/api/projects/${project.id}/proposal-document/download?token=${encodeURIComponent(
                                token || ''
                              )}`;
                              const a = document.createElement('a');
                              a.href = url;
                              a.setAttribute(
                                'download',
                                project.proposal_filename || `${project.tracker_id}_Proposal.pdf`
                              );
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            } else if (project.proposal_link) {
                              window.open(project.proposal_link, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          className="px-2 py-0.5 text-xs font-semibold rounded bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition inline-flex items-center gap-1"
                          title="Download document"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </button>
                      </>
                    )}
                    {canEdit && (
                      <>
                        <input
                          type="file"
                          ref={detailProposalInputRef}
                          accept=".pdf,.docx,.doc,.txt,.xlsx,.pptx"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !project) return;
                            try {
                              setUploadingProposal(true);
                              const formData = new FormData();
                              formData.append('file', file);
                              const { data, error } = await api.upload<Project>(
                                `/api/projects/${project.id}/proposal-document`,
                                formData
                              );
                              if (error || !data) throw error || new Error('Upload failed');
                              if (onProjectUpdated) onProjectUpdated(data);
                            } catch (err) {
                              console.error('Proposal upload error:', err);
                            } finally {
                              setUploadingProposal(false);
                              if (detailProposalInputRef.current) detailProposalInputRef.current.value = '';
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={uploadingProposal}
                          onClick={() => detailProposalInputRef.current?.click()}
                          className="px-2 py-0.5 text-xs font-medium rounded text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition inline-flex items-center gap-1 ml-auto"
                          title={project.proposal_filename ? 'Replace proposal document' : 'Upload proposal document'}
                        >
                          <Upload className="w-3 h-3" />
                          <span>{uploadingProposal ? '...' : project.proposal_filename ? 'Replace' : 'Upload'}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Last Funder Review */}
                <div className="p-3.5 bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 rounded-xl">
                  <div className="text-xs text-gray-500 dark:text-slate-400">Last Funder Review</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-0.5">
                    {project.last_funder_review || '—'}
                  </div>
                </div>

                {/* Action Items */}
                <div className="p-3.5 bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 rounded-xl">
                  <div className="text-xs text-gray-500 dark:text-slate-400">Actions (Open / Overdue)</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-0.5 flex items-center gap-2">
                    <span className="text-blue-600 dark:text-blue-400">{project.open_actions || 0} Open</span>
                    <span>•</span>
                    <span className={project.overdue_actions ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-gray-400'}>
                      {project.overdue_actions || 0} Overdue
                    </span>
                  </div>
                </div>

                {/* Staff on Payroll */}
                <div className="p-3.5 bg-white dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800 rounded-xl">
                  <div className="text-xs text-gray-500 dark:text-slate-400">Staff on Payroll</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 mt-0.5">
                    {project.staff_on_payroll || '0'}
                  </div>
                </div>
              </div>

              {/* Data Gaps / Flags */}
              {project.data_gaps_flags && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Data Gaps & Compliance Flags</span>
                  </div>
                  <p className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap">
                    {project.data_gaps_flags}
                  </p>
                </div>
              )}

              {/* Team Members Breakdown */}
              <div className="p-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-500" />
                    <span>Project Team ({project.team?.length || 0})</span>
                  </h3>
                </div>

                {Array.isArray(project.team) && project.team.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {project.team.map((member, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2.5 p-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-sm"
                      >
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                            member.is_external ? 'bg-amber-600' : 'bg-blue-600'
                          }`}
                        >
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-gray-900 dark:text-slate-100 truncate">
                            {member.name}
                          </div>
                          <div className="text-[10px] text-gray-400 truncate">
                            {member.is_external ? (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">External Member</span>
                            ) : (
                              member.email || 'SCLAB Member'
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No team members assigned.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* In-portal proposal preview modal */}
      {project && (
        <ProposalPreviewModal
          isOpen={previewProposalOpen}
          onClose={() => setPreviewProposalOpen(false)}
          project={project}
        />
      )}
    </div>
  );
}
