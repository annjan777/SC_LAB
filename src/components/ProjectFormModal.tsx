import { useState, useEffect, useRef } from 'react';
import {
  X,
  Users,
  UserPlus,
  Calendar,
  Link as LinkIcon,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Info,
  Upload,
  FileText,
  Trash2,
  Eye,
  Check
} from 'lucide-react';
import { api } from '../lib/api';
import {
  Project,
  ProjectTeamMember,
  RAGStatus,
  PROJECT_CATEGORIES,
  PROJECT_STATUSES,
  RAG_OPTIONS,
  UPDATE_STATUSES,
} from '../types/project';
import { Button } from './ui';
import ProposalPreviewModal from './ProposalPreviewModal';

interface UserOption {
  id: string;
  full_name: string;
  email: string;
  department?: string | null;
}

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedProject: Project) => void;
  project?: Project | null; // null for Create, Project object for Edit
}

export default function ProjectFormModal({
  isOpen,
  onClose,
  onSuccess,
  project,
}: ProjectFormModalProps) {
  const isEditing = !!project;

  // Form states
  const [projectCode, setProjectCode] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [fundingAgency, setFundingAgency] = useState('');
  const [proposalLink, setProposalLink] = useState('');
  const [selectedProposalFile, setSelectedProposalFile] = useState<File | null>(null);
  const [existingProposalFilename, setExistingProposalFilename] = useState<string | null>(null);
  const [existingProposalSize, setExistingProposalSize] = useState<number | null>(null);
  const [existingProposalType, setExistingProposalType] = useState<string | null>(null);
  const [removeExistingProposal, setRemoveExistingProposal] = useState<boolean>(false);
  const [showExternalUrlInput, setShowExternalUrlInput] = useState<boolean>(false);
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<string>(PROJECT_CATEGORIES[0]);
  const [status, setStatus] = useState<string>('Active');
  const [overview, setOverview] = useState('');
  const [planNextPhase, setPlanNextPhase] = useState('');
  const [startDate, setStartDate] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [facultyLeadPi, setFacultyLeadPi] = useState('');
  const [accountableOwnerPoc, setAccountableOwnerPoc] = useState('');
  const [ragStatus, setRagStatus] = useState<RAGStatus>('Green');
  const [lastFunderReview, setLastFunderReview] = useState('');
  const [dataGapsFlags, setDataGapsFlags] = useState('');
  const [lastWeeklyUpdate, setLastWeeklyUpdate] = useState('');
  const [updateStatus, setUpdateStatus] = useState<string>('On Track');
  const [openActions, setOpenActions] = useState<number>(0);
  const [overdueActions, setOverdueActions] = useState<number>(0);
  const [staffOnPayroll, setStaffOnPayroll] = useState<string>('0');

  // Team state (Lab Members + External Members)
  const [teamMembers, setTeamMembers] = useState<ProjectTeamMember[]>([]);
  const [allLabUsers, setAllLabUsers] = useState<UserOption[]>([]);
  const [selectedLabUserId, setSelectedLabUserId] = useState<string>('');
  const [externalMemberName, setExternalMemberName] = useState<string>('');
  const [showAddExternal, setShowAddExternal] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch active lab members from /api/users
  useEffect(() => {
    if (isOpen) {
      api.get('/api/users', { order: 'full_name' }).then(({ data }) => {
        if (Array.isArray(data)) {
          setAllLabUsers(data);
        }
      }).catch(err => {
        console.error('Failed to load lab users:', err);
      });
    }
  }, [isOpen]);

  // Populate form if editing
  useEffect(() => {
    if (project) {
      setProjectCode(project.project_code || '');
      setProjectTitle(project.project_title || '');
      setFundingAgency(project.funding_agency || '');
      setProposalLink(project.proposal_link || '');
      setExistingProposalFilename(project.proposal_filename || null);
      setExistingProposalSize(project.proposal_file_size || null);
      setExistingProposalType(project.proposal_file_type || null);
      setSelectedProposalFile(null);
      setRemoveExistingProposal(false);
      setShowExternalUrlInput(Boolean(project.proposal_link && !project.proposal_filename));
      setCategory(project.category || PROJECT_CATEGORIES[0]);
      setStatus(project.status || 'Active');
      setOverview(project.overview || '');
      setPlanNextPhase(project.plan_next_phase || '');
      setStartDate(project.start_date || '');
      setClosingDate(project.closing_date || '');
      setFacultyLeadPi(project.faculty_lead_pi || '');
      setAccountableOwnerPoc(project.accountable_owner_poc || '');
      setRagStatus(project.rag_status || 'Green');
      setLastFunderReview(project.last_funder_review || '');
      setDataGapsFlags(project.data_gaps_flags || '');
      setLastWeeklyUpdate(project.last_weekly_update || '');
      setUpdateStatus(project.update_status || 'On Track');
      setOpenActions(project.open_actions ?? 0);
      setOverdueActions(project.overdue_actions ?? 0);
      setStaffOnPayroll(project.staff_on_payroll || '0');
      setTeamMembers(Array.isArray(project.team) ? project.team : []);
    } else {
      // Reset defaults
      setProjectCode('');
      setProjectTitle('');
      setFundingAgency('');
      setProposalLink('');
      setExistingProposalFilename(null);
      setExistingProposalSize(null);
      setExistingProposalType(null);
      setSelectedProposalFile(null);
      setRemoveExistingProposal(false);
      setShowExternalUrlInput(false);
      setCategory(PROJECT_CATEGORIES[0]);
      setStatus('Active');
      setOverview('');
      setPlanNextPhase('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setClosingDate('');
      setFacultyLeadPi('');
      setAccountableOwnerPoc('');
      setRagStatus('Green');
      setLastFunderReview('');
      setDataGapsFlags('');
      setLastWeeklyUpdate(new Date().toISOString().split('T')[0]);
      setUpdateStatus('On Track');
      setOpenActions(0);
      setOverdueActions(0);
      setStaffOnPayroll('0');
      setTeamMembers([]);
    }
    setError('');
  }, [project, isOpen]);

  if (!isOpen) return null;

  // Add lab member from dropdown
  const handleAddLabMember = (userId: string) => {
    if (!userId) return;
    const labUser = allLabUsers.find(u => u.id === userId);
    if (!labUser) return;

    if (teamMembers.some(m => m.id === labUser.id)) {
      setError('This lab member is already in the project team');
      return;
    }

    setTeamMembers(prev => [
      ...prev,
      {
        id: labUser.id,
        name: labUser.full_name,
        email: labUser.email,
        is_external: false,
      },
    ]);
    setSelectedLabUserId('');
    setError('');
  };

  // Add external member
  const handleAddExternalMember = () => {
    const trimmed = externalMemberName.trim();
    if (!trimmed) {
      setError('Please enter a name for the external member');
      return;
    }

    if (teamMembers.some(m => m.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A member with this name is already in the team');
      return;
    }

    setTeamMembers(prev => [
      ...prev,
      {
        name: trimmed,
        is_external: true,
      },
    ]);
    setExternalMemberName('');
    setShowAddExternal(false);
    setError('');
  };

  const handleRemoveMember = (index: number) => {
    setTeamMembers(prev => prev.filter((_, i) => i !== index));
  };

  // Calculated days to close preview
  const calculateDaysToClosePreview = () => {
    if (!closingDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const close = new Date(closingDate);
    close.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((close.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysToClosePreview = calculateDaysToClosePreview();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectTitle.trim()) {
      setError('Project Title is required');
      return;
    }

    setLoading(true);
    setError('');

    const payload = {
      project_code: projectCode.trim() || null,
      project_title: projectTitle.trim(),
      funding_agency: fundingAgency.trim() || null,
      proposal_link: proposalLink.trim() || null,
      category,
      status,
      overview: overview.trim() || null,
      plan_next_phase: planNextPhase.trim() || null,
      start_date: startDate || null,
      closing_date: closingDate || null,
      faculty_lead_pi: facultyLeadPi.trim() || null,
      team: teamMembers,
      accountable_owner_poc: accountableOwnerPoc.trim() || null,
      rag_status: ragStatus,
      last_funder_review: lastFunderReview || null,
      data_gaps_flags: dataGapsFlags.trim() || null,
      last_weekly_update: lastWeeklyUpdate || null,
      update_status: updateStatus,
      open_actions: Number(openActions) || 0,
      overdue_actions: Number(overdueActions) || 0,
      staff_on_payroll: String(staffOnPayroll).trim(),
    };

    try {
      let savedProject: Project;
      if (isEditing && project) {
        const { data, error: err } = await api.put(`/api/projects/${project.id}`, payload);
        if (err || !data) throw err || new Error('Failed to update project');
        savedProject = data;
      } else {
        const { data, error: err } = await api.post('/api/projects', payload);
        if (err || !data) throw err || new Error('Failed to create project');
        savedProject = data;
      }

      // If user selected a new proposal document, upload it now
      if (selectedProposalFile) {
        const formData = new FormData();
        formData.append('file', selectedProposalFile);
        const { data: uploadedProject, error: uploadErr } = await api.upload<Project>(
          `/api/projects/${savedProject.id}/proposal-document`,
          formData
        );
        if (uploadErr) {
          console.error('Failed to upload proposal document:', uploadErr);
        } else if (uploadedProject) {
          savedProject = uploadedProject;
        }
      } else if (removeExistingProposal && isEditing && project) {
        await api.delete(`/api/projects/${project.id}/proposal-document`).catch((e) =>
          console.error('Failed to delete proposal file:', e)
        );
      }

      onSuccess(savedProject);
      onClose();
    } catch (err: any) {
      console.error('Submit project error:', err);
      setError(err?.message || 'Failed to save project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl my-8 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              {isEditing ? 'Edit Project Tracker' : 'Create New Project'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              {isEditing
                ? `Tracker ID: ${project?.tracker_id} (system generated)`
                : 'Tracker ID will be generated automatically by the system upon creation'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-600 dark:text-rose-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[78vh] overflow-y-auto">
          {/* Section 1: Core Identifiers */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              <Info className="w-3.5 h-3.5" />
              <span>Project Identification</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tracker ID (Read-only badge) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Tracker ID
                </label>
                <div className="px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-mono text-gray-600 dark:text-slate-400 flex items-center justify-between">
                  <span>{isEditing ? project?.tracker_id : 'Auto (e.g. TRK-001)'}</span>
                  <span className="text-[10px] uppercase tracking-wider font-sans font-semibold text-gray-400 bg-gray-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                    Generated
                  </span>
                </div>
              </div>

              {/* Project Code */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Project Code
                </label>
                <input
                  type="text"
                  value={projectCode}
                  onChange={(e) => setProjectCode(e.target.value)}
                  placeholder="e.g. PRJ-2024-01"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {PROJECT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Project Title */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                Project Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="Full title of the project or initiative"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Funding Agency */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Funding Agency
                </label>
                <input
                  type="text"
                  value={fundingAgency}
                  onChange={(e) => setFundingAgency(e.target.value)}
                  placeholder="e.g. DST, SERB, DRDO, Industry, Internal"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Project Proposal */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300">
                    Project Proposal
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowExternalUrlInput(!showExternalUrlInput)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    <LinkIcon className="w-3 h-3" />
                    <span>{showExternalUrlInput ? 'Hide Web URL link' : 'Or add external web link'}</span>
                  </button>
                </div>

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.docx,.doc,.txt,.xlsx,.pptx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedProposalFile(file);
                      setRemoveExistingProposal(false);
                    }
                  }}
                />

                {selectedProposalFile ? (
                  /* Newly Selected File */
                  <div className="flex items-center justify-between p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 rounded-lg">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                          {selectedProposalFile.name}
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
                          <span>{(selectedProposalFile.size / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                            <Check className="w-3 h-3" /> Ready to upload
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs px-2.5 py-1 text-gray-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 transition"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProposalFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                        title="Remove selection"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : existingProposalFilename && !removeExistingProposal ? (
                  /* Existing Stored File */
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-xl">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                          {existingProposalFilename}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-2">
                          {existingProposalSize && (
                            <span>
                              {existingProposalSize > 1024 * 1024
                                ? `${(existingProposalSize / (1024 * 1024)).toFixed(1)} MB`
                                : `${Math.round(existingProposalSize / 1024)} KB`}
                            </span>
                          )}
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Uploaded</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewModalOpen(true)}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg transition inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 text-xs text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-700 transition"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemoveExistingProposal(true)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                        title="Delete proposal file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Empty state / dropzone */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl p-4 text-center cursor-pointer transition bg-gray-50/50 dark:bg-slate-800/30 hover:bg-blue-50/30 dark:hover:bg-blue-950/10 group"
                  >
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <div className="p-2 bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-full group-hover:scale-110 transition-transform">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div className="text-xs font-semibold text-gray-800 dark:text-slate-200">
                        Click to upload project proposal (.pdf, .docx, .doc)
                      </div>
                      <div className="text-[11px] text-gray-400">
                        Document will be previewable and downloadable directly on SC Lab (max 50MB)
                      </div>
                    </div>
                  </div>
                )}

                {/* Optional Web URL Link */}
                {showExternalUrlInput && (
                  <div className="mt-2.5 relative">
                    <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      type="url"
                      value={proposalLink}
                      onChange={(e) => setProposalLink(e.target.value)}
                      placeholder="https://drive.google.com/... or external proposal URL"
                      className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Status & Health Indicators */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <Shield className="w-3.5 h-3.5" />
              <span>Status & RAG Health</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {PROJECT_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* RAG Status Selector */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  RAG Health
                </label>
                <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-lg border border-gray-200 dark:border-slate-700">
                  {RAG_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRagStatus(opt.value)}
                      className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition ${
                        ragStatus === opt.value
                          ? `${opt.bg} ${opt.color} font-semibold shadow-sm`
                          : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-100'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                      <span>{opt.value}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Update Status */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Update Status
                </label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {UPDATE_STATUSES.map((us) => (
                    <option key={us} value={us}>
                      {us}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Overview & 3-6 Month Plan */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Overview
                </label>
                <textarea
                  rows={3}
                  value={overview}
                  onChange={(e) => setOverview(e.target.value)}
                  placeholder="Summary of objectives, methodology, and core mission"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Plan (next 3–6 months)
                </label>
                <textarea
                  rows={3}
                  value={planNextPhase}
                  onChange={(e) => setPlanNextPhase(e.target.value)}
                  placeholder="Key planned deliverables, experiments, and next milestones"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Schedule & Key Dates */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>Project Timelines</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Start Date */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Closing Date */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Closing Date
                </label>
                <input
                  type="date"
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Days to Close (Calculated automatically) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Days to Close (Auto)
                </label>
                <div className="px-3 py-2 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm font-semibold flex items-center justify-between">
                  {daysToClosePreview === null ? (
                    <span className="text-gray-400">Set closing date</span>
                  ) : daysToClosePreview < 0 ? (
                    <span className="text-rose-600 dark:text-rose-400">{Math.abs(daysToClosePreview)} days overdue</span>
                  ) : daysToClosePreview === 0 ? (
                    <span className="text-amber-600 dark:text-amber-400">Due Today</span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">{daysToClosePreview} days left</span>
                  )}
                  <span className="text-[10px] text-gray-400 uppercase">Computed</span>
                </div>
              </div>

              {/* Last Funder Review */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Last Funder Review
                </label>
                <input
                  type="date"
                  value={lastFunderReview}
                  onChange={(e) => setLastFunderReview(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Last Weekly Update */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Last Weekly Update
                </label>
                <input
                  type="date"
                  value={lastWeeklyUpdate}
                  onChange={(e) => setLastWeeklyUpdate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Data Gaps / Flags */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Data Gaps / Flags
                </label>
                <input
                  type="text"
                  value={dataGapsFlags}
                  onChange={(e) => setDataGapsFlags(e.target.value)}
                  placeholder="Blockers, resource gaps, or risk flags"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Team & Governance */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                <Users className="w-3.5 h-3.5" />
                <span>Team & Governance</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Faculty Lead / PI */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Faculty Lead / PI
                </label>
                <input
                  type="text"
                  value={facultyLeadPi}
                  onChange={(e) => setFacultyLeadPi(e.target.value)}
                  placeholder="e.g. Prof. R. K. Sharma"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Accountable Owner (POC) */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Accountable Owner (POC)
                </label>
                <input
                  type="text"
                  value={accountableOwnerPoc}
                  onChange={(e) => setAccountableOwnerPoc(e.target.value)}
                  placeholder="Project primary point of contact"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Team Members Selection (Lab Members + Add External Member) */}
            <div className="p-4 bg-gray-50/70 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700/80 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-bold text-gray-800 dark:text-slate-200">
                    Project Team Members ({teamMembers.length})
                  </label>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    Select existing SCLAB members or add external contributors
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddExternal(!showAddExternal)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Add External Member</span>
                </button>
              </div>

              {/* Add Lab Member Dropdown */}
              <div className="flex gap-2">
                <select
                  value={selectedLabUserId}
                  onChange={(e) => handleAddLabMember(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">-- Select SCLAB Lab Member to add --</option>
                  {allLabUsers
                    .filter((u) => !teamMembers.some((m) => m.id === u.id))
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name} ({user.email}) {user.department ? `• ${user.department}` : ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* External Member Form (toggleable) */}
              {showAddExternal && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2">
                  <input
                    type="text"
                    value={externalMemberName}
                    onChange={(e) => setExternalMemberName(e.target.value)}
                    placeholder="Enter external member's full name & affiliation"
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddExternalMember();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddExternalMember}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddExternal(false)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Selected Members Chips */}
              {teamMembers.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {teamMembers.map((member, idx) => (
                    <div
                      key={idx}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                        member.is_external
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                      }`}
                    >
                      <span className="font-semibold">{member.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full uppercase font-bold tracking-wider ${
                          member.is_external
                            ? 'bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200'
                            : 'bg-blue-200/60 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200'
                        }`}
                      >
                        {member.is_external ? 'External' : 'Lab Member'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(idx)}
                        className="text-gray-400 hover:text-rose-500 transition ml-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-slate-500 italic pt-1">
                  No members added yet. Add team members using the dropdown above.
                </p>
              )}
            </div>
          </div>

          {/* Section 6: Action Items & Payroll */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Open Actions */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Open Actions
                </label>
                <input
                  type="number"
                  min="0"
                  value={openActions}
                  onChange={(e) => setOpenActions(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Overdue Actions */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Overdue Actions
                </label>
                <input
                  type="number"
                  min="0"
                  value={overdueActions}
                  onChange={(e) => setOverdueActions(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Staff on Payroll */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Staff on Payroll
                </label>
                <input
                  type="text"
                  value={staffOnPayroll}
                  onChange={(e) => setStaffOnPayroll(e.target.value)}
                  placeholder="e.g. 2 JRF, 1 RA or count"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800/80 border border-gray-300 dark:border-slate-700 rounded-lg text-sm text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-slate-800">
            <Button variant="secondary" onClick={onClose} disabled={loading} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEditing ? 'Update Project' : 'Create Project'}
            </Button>
          </div>
        </form>
      </div>

      {/* In-portal proposal preview modal */}
      {project && (
        <ProposalPreviewModal
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
          project={project}
        />
      )}
    </div>
  );
}
