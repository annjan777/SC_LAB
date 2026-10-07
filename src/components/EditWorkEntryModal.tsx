import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Flame, AlertTriangle, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { IssueType, WorkPriority } from '../types/work';

interface EditWorkEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  workId: string;
  onSuccess: () => void;
}

interface Milestone {
  id?: string;
  milestone_description: string;
  target_date: string;
  expected_outcome: string;
  is_completed?: boolean;
}

interface WorkData {
  project_name: string;
  assigned_by: string;
  work_title: string;
  description: string;
  start_date: string;
  end_date: string;
  priority: WorkPriority;
  issue_type: IssueType;
}

export default function EditWorkEntryModal({ isOpen, onClose, workId, onSuccess }: EditWorkEntryModalProps) {
  const { profile, hasPermission } = useAuth();
  const isAdmin =
    profile?.user_role === 'admin' ||
    profile?.user_role === 'super_admin' ||
    hasPermission('manage_work_cycles');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [showCustomSupervisor, setShowCustomSupervisor] = useState(false);
  const [customAssignedBy, setCustomAssignedBy] = useState('');
  const [formData, setFormData] = useState<WorkData>({
    project_name: '',
    assigned_by: '',
    work_title: '',
    description: '',
    start_date: '',
    end_date: '',
    priority: 'medium',
    issue_type: 'task',
  });
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [initialMilestones, setInitialMilestones] = useState<Milestone[]>([]);
  const [deletedMilestoneIds, setDeletedMilestoneIds] = useState<string[]>([]);
  const [milestoneChangeReason, setMilestoneChangeReason] = useState('');

  useEffect(() => {
    if (isOpen && workId) {
      fetchData();
    }
  }, [isOpen, workId]);

  const fetchData = async () => {
    try {
      const { data: usersData } = await api.get('/api/users', { order: 'full_name', ascending: 'true' });
      const userList = Array.isArray(usersData) ? usersData : [];
      setUsers(userList);

      const { data: workData, error: workError } = await api.get<any>('/api/work/' + workId);
      if (workError) throw workError;
      if (!workData) throw new Error('Work not found');

      const assignedByVal = workData.assigned_by || '';
      const matchingUser = userList.find((u: any) => u.full_name === assignedByVal);

      if (assignedByVal && !matchingUser) {
        setShowCustomSupervisor(true);
        setCustomAssignedBy(assignedByVal);
      } else {
        setShowCustomSupervisor(false);
        setCustomAssignedBy('');
      }

      setFormData({
        project_name: workData.project_name || '',
        assigned_by: assignedByVal,
        work_title: workData.work_title || '',
        description: workData.description || '',
        start_date: workData.start_date || '',
        end_date: workData.end_date || '',
        priority: workData.priority || 'medium',
        issue_type: workData.issue_type || 'task',
      });

      const { data: milestonesData, error: milestonesError } = await api.get<any[]>('/api/work/' + workId + '/milestones');
      if (milestonesError) throw milestonesError;
      const mData = Array.isArray(milestonesData) ? milestonesData : [];
      const formatted = mData.length > 0 ? mData.map((m: any) => ({
        id: m.id,
        milestone_description: m.milestone_description || m.title || '',
        target_date: m.target_date ? (typeof m.target_date === 'string' && m.target_date.includes('T') ? m.target_date.split('T')[0] : m.target_date) : '',
        expected_outcome: m.expected_outcome || '',
        is_completed: m.is_completed || m.status === 'completed'
      })) : [{ milestone_description: '', target_date: '', expected_outcome: '' }];
      setMilestones(formatted);
      setInitialMilestones(JSON.parse(JSON.stringify(formatted)));
      setDeletedMilestoneIds([]);
      setMilestoneChangeReason('');
    } catch (err: any) {
      console.error('Error fetching work data:', err);
      setError('Failed to load work data');
    }
  };

  const handleAssignedByChange = (value: string) => {
    if (value === 'others') {
      setShowCustomSupervisor(true);
      setFormData(prev => ({ ...prev, assigned_by: '' }));
      setCustomAssignedBy('');
    } else {
      setShowCustomSupervisor(false);
      const selectedUser = users.find(u => u.id === value);
      setFormData(prev => ({ ...prev, assigned_by: selectedUser?.full_name || '' }));
      setCustomAssignedBy('');
    }
  };

  const handleAddMilestone = () => {
    setMilestones([...milestones, { milestone_description: '', target_date: '', expected_outcome: '' }]);
  };

  const handleRemoveMilestone = (index: number) => {
    const milestone = milestones[index];
    if (milestone.id) {
      setDeletedMilestoneIds([...deletedMilestoneIds, milestone.id]);
    }
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleMilestoneChange = (index: number, field: keyof Milestone, value: string) => {
    const updated = [...milestones];
    updated[index][field] = value as never;
    setMilestones(updated);
  };

  const isMilestonesModified = useMemo(() => {
    if (deletedMilestoneIds.length > 0) return true;
    const valid = milestones.filter(m => m.milestone_description && m.target_date && m.expected_outcome);
    if (valid.length !== initialMilestones.length) return true;
    const initialMap = new Map(initialMilestones.map(m => [m.id, m]));
    return valid.some((m) => {
      if (!m.id) return true;
      const init = initialMap.get(m.id);
      if (!init) return true;
      const curDesc = (init.milestone_description || '').trim();
      const newDesc = (m.milestone_description || '').trim();
      const curDate = (init.target_date || '').slice(0, 10);
      const newDate = (m.target_date || '').slice(0, 10);
      const curOutcome = (init.expected_outcome || '').trim();
      const newOutcome = (m.expected_outcome || '').trim();
      return curDesc !== newDesc || curDate !== newDate || curOutcome !== newOutcome;
    });
  }, [milestones, initialMilestones, deletedMilestoneIds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const validMilestones = milestones.filter(
        m => m.milestone_description && m.target_date && m.expected_outcome
      );

      const projectEndDate = formData.end_date ? formData.end_date.slice(0, 10) : '';
      const projectStartDate = formData.start_date ? formData.start_date.slice(0, 10) : '';

      if (projectEndDate) {
        for (const m of validMilestones) {
          const mDate = m.target_date ? m.target_date.slice(0, 10) : '';
          if (mDate && mDate > projectEndDate) {
            setError(
              `Milestone "${m.milestone_description || 'Milestone'}" target date (${mDate}) cannot be beyond the project target end date (${projectEndDate}).`
            );
            setLoading(false);
            return;
          }
        }
      }

      if (projectStartDate) {
        for (const m of validMilestones) {
          const mDate = m.target_date ? m.target_date.slice(0, 10) : '';
          if (mDate && mDate < projectStartDate) {
            setError(
              `Milestone "${m.milestone_description || 'Milestone'}" target date (${mDate}) cannot be before the project start date (${projectStartDate}).`
            );
            setLoading(false);
            return;
          }
        }
      }

      if (!isAdmin && isMilestonesModified && !milestoneChangeReason.trim()) {
        setError('Please provide a justification for your proposed milestone changes. Non-admin users cannot alter milestones without an approved change request.');
        setLoading(false);
        return;
      }

      const assignedByValue = showCustomSupervisor
        ? customAssignedBy
        : formData.assigned_by;

      const supervisorUser = users.find(u => u.full_name === formData.assigned_by);
      const selectedSupervisorId = showCustomSupervisor ? null : (supervisorUser?.id || null);

      const { error: updateError } = await api.put('/api/work/' + workId, {
        project_name: formData.project_name || null,
        assigned_by: assignedByValue || null,
        assigned_by_user_id: selectedSupervisorId,
        work_title: formData.work_title || null,
        description: formData.description || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        issue_type: formData.issue_type,
        priority: formData.priority,
        deleted_milestone_ids: deletedMilestoneIds,
        milestones: validMilestones,
        milestone_change_reason: milestoneChangeReason.trim() || undefined,
      });

      if (updateError) throw updateError;

      if (!isAdmin && isMilestonesModified) {
        alert(
          'Milestone Change Request Submitted!\n\nYour proposed milestone modifications have been sent to the Administrator for approval. Your current active milestones will remain locked and unchanged until an administrator approves your request.'
        );
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      console.error('Error updating work entry:', err);
      setError(err.response?.data?.error || err.message || 'Failed to update work entry');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      project_name: '',
      assigned_by: '',
      work_title: '',
      description: '',
      start_date: '',
      end_date: '',
      priority: 'medium',
      issue_type: 'task',
    });
    setMilestones([{ milestone_description: '', target_date: '', expected_outcome: '' }]);
    setInitialMilestones([]);
    setDeletedMilestoneIds([]);
    setMilestoneChangeReason('');
    setShowCustomSupervisor(false);
    setCustomAssignedBy('');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-slate-800 shadow-2xl transition-colors">
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">Edit Work Entry</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 pb-2 border-b border-gray-200 dark:border-slate-800">
              Work Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={formData.project_name}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  placeholder="e.g. Smart Materials Laboratory"
                  className="w-full px-3 py-2 h-[42px] bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm placeholder-gray-400 dark:placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Assigned By (Supervisor Name)
                </label>
                <select
                  value={showCustomSupervisor ? 'others' : (users.find(u => u.full_name === formData.assigned_by)?.id || '')}
                  onChange={(e) => handleAssignedByChange(e.target.value)}
                  className="w-full px-3 py-2 h-[42px] bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Select Supervisor</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                  <option value="others">Others</option>
                </select>
                {showCustomSupervisor && (
                  <input
                    type="text"
                    value={customAssignedBy}
                    onChange={(e) => setCustomAssignedBy(e.target.value)}
                    placeholder="Enter custom supervisor name"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-2 text-sm"
                  />
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Work Title
                </label>
                <input
                  type="text"
                  value={formData.work_title}
                  onChange={(e) => setFormData({ ...formData, work_title: e.target.value })}
                  placeholder="e.g. Synthesize novel perovskite crystal thin films"
                  className="w-full px-3 py-2 h-[42px] bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm placeholder-gray-400 dark:placeholder-slate-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  placeholder="Provide scope, targets, and testing methodology..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm placeholder-gray-400 dark:placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3 py-2 h-[42px] bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3 py-2 h-[42px] bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Issue Type
                </label>
                <select
                  value={formData.issue_type}
                  onChange={(e) => setFormData({ ...formData, issue_type: e.target.value as any })}
                  className="w-full px-3 py-2 h-[42px] bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="task">Task (Standard)</option>
                  <option value="experiment">Experiment</option>
                  <option value="milestone">Milestone / Goal</option>
                  <option value="equipment_maintenance">Equipment Maintenance</option>
                  <option value="bug_incident">Bug / Incident</option>
                  <option value="procurement_task">Procurement Task</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Priority Level
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className={`w-full px-3 py-2 h-[42px] border rounded-lg focus:ring-2 focus:border-transparent font-medium text-sm ${
                    formData.priority === 'code_red'
                      ? 'bg-red-50 dark:bg-red-950/50 border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 focus:ring-red-500'
                      : 'bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 focus:ring-blue-500'
                  }`}
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="code_red">🚨 CODE-RED (Critical Emergency / Highest Priority)</option>
                </select>
                {formData.priority === 'code_red' && (
                  <div className="mt-2.5 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs flex items-start gap-2">
                    <Flame className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5 animate-bounce" />
                    <div>
                      <strong>Critical Emergency Activation:</strong> Code-Red priority will trigger immediate notifications to all Lab Administrators. Dependent milestones will be flagged to track clashing schedules and delays.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                Milestones & Deliverables
              </h3>
              {isAdmin ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Admin Direct Edit Mode
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Requires Admin Approval
                </span>
              )}
            </div>

            {!isAdmin && (
              <div className="mb-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-950 dark:text-amber-200">Milestone Change Control Policy</div>
                  <div className="text-amber-800 dark:text-amber-300 mt-0.5">
                    To prevent unverified schedule shifts or deleting uncompleted work, modifying or deleting milestones after initial creation requires Admin approval. Your proposed changes will be submitted as a change request.
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {milestones.map((milestone, index) => (
                <div key={index} className="bg-gray-50 dark:bg-slate-800/60 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium text-gray-900 dark:text-slate-100">Milestone {index + 1}</h4>
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMilestone(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 p-1 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Milestone Description
                      </label>
                      <input
                        type="text"
                        value={milestone.milestone_description}
                        onChange={(e) => handleMilestoneChange(index, 'milestone_description', e.target.value)}
                        placeholder="e.g. Calibrate optical spectrometer"
                        className="w-full px-3 py-2 h-[42px] bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm placeholder-gray-400 dark:placeholder-slate-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Target Date
                      </label>
                      <input
                        type="date"
                        value={milestone.target_date}
                        max={formData.end_date ? formData.end_date.slice(0, 10) : undefined}
                        min={formData.start_date ? formData.start_date.slice(0, 10) : undefined}
                        onChange={(e) => handleMilestoneChange(index, 'target_date', e.target.value)}
                        className="w-full px-3 py-2 h-[42px] bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Expected Outcome
                      </label>
                      <input
                        type="text"
                        value={milestone.expected_outcome}
                        onChange={(e) => handleMilestoneChange(index, 'expected_outcome', e.target.value)}
                        placeholder="e.g. Baseline spectral readings documented"
                        className="w-full px-3 py-2 h-[42px] bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm placeholder-gray-400 dark:placeholder-slate-500"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddMilestone}
                className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm py-1"
              >
                <Plus className="h-4 w-4" />
                Add Another Milestone
              </button>
            </div>

            {!isAdmin && isMilestonesModified && (
              <div className="mt-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <label className="block text-xs font-bold text-amber-950 dark:text-amber-200 mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Reason / Justification for Milestone Revision <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={milestoneChangeReason}
                  onChange={(e) => setMilestoneChangeReason(e.target.value)}
                  placeholder="Explain why these milestone dates or targets are being revised for Admin approval..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
                <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-300">
                  This justification will be sent to the administrator with your proposed milestone modifications.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition text-sm font-medium"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:bg-blue-300 font-medium text-sm shadow-sm"
              disabled={loading}
            >
              {loading
                ? 'Saving...'
                : !isAdmin && isMilestonesModified
                ? 'Submit Milestone Request for Admin Review'
                : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
