import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';

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
  priority: 'low' | 'medium' | 'high';
}

export default function EditWorkEntryModal({ isOpen, onClose, workId, onSuccess }: EditWorkEntryModalProps) {
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
  });
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [deletedMilestoneIds, setDeletedMilestoneIds] = useState<string[]>([]);

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

      const { data: workData, error: workError } = await api.get('/api/work/' + workId);

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
      });

      const { data: milestonesData, error: milestonesError } = await api.get('/api/work/' + workId + '/milestones', { order: 'target_date', ascending: 'true' });

      if (milestonesError) throw milestonesError;

      const mData = Array.isArray(milestonesData) ? milestonesData : [];
      setMilestones(mData.length > 0 ? mData : [{ milestone_description: '', target_date: '', expected_outcome: '' }]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const validMilestones = milestones.filter(
        m => m.milestone_description && m.target_date && m.expected_outcome
      );

      const assignedByValue = showCustomSupervisor
        ? customAssignedBy
        : formData.assigned_by;

      const { error: workError } = await api.put('/api/work/' + workId, {
        project_name: formData.project_name || null,
        assigned_by: assignedByValue || null,
        work_title: formData.work_title || null,
        description: formData.description || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        priority: formData.priority,
        deleted_milestone_ids: deletedMilestoneIds,
        milestones: validMilestones,
      });

      if (workError) throw new Error(typeof workError === 'string' ? workError : (workError as any).message || 'Failed to update work entry');

      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      console.error('Error updating work entry:', err);
      setError(err.message || 'Failed to update work entry');
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
    });
    setMilestones([{ milestone_description: '', target_date: '', expected_outcome: '' }]);
    setDeletedMilestoneIds([]);
    setShowCustomSupervisor(false);
    setCustomAssignedBy('');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Edit Work Entry</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Work Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={formData.project_name}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  className="w-full px-3 py-2 h-[42px] bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assigned By (Supervisor Name)
                </label>
                <select
                  value={showCustomSupervisor ? 'others' : (users.find(u => u.full_name === formData.assigned_by)?.id || '')}
                  onChange={(e) => handleAssignedByChange(e.target.value)}
                  className="w-full px-3 py-2 h-[42px] bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-2"
                  />
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Title
                </label>
                <input
                  type="text"
                  value={formData.work_title}
                  onChange={(e) => setFormData({ ...formData, work_title: e.target.value })}
                  className="w-full px-3 py-2 h-[42px] bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3 py-2 h-[42px] bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3 py-2 h-[42px] bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full px-3 py-2 h-[42px] bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Milestones
            </h3>

            <div className="space-y-4">
              {milestones.map((milestone, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium text-gray-900">Milestone {index + 1}</h4>
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMilestone(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Milestone Description
                      </label>
                      <input
                        type="text"
                        value={milestone.milestone_description}
                        onChange={(e) => handleMilestoneChange(index, 'milestone_description', e.target.value)}
                        className="w-full px-3 py-2 h-[42px] bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Target Date
                      </label>
                      <input
                        type="date"
                        value={milestone.target_date}
                        onChange={(e) => handleMilestoneChange(index, 'target_date', e.target.value)}
                        className="w-full px-3 py-2 h-[42px] bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expected Outcome
                      </label>
                      <input
                        type="text"
                        value={milestone.expected_outcome}
                        onChange={(e) => handleMilestoneChange(index, 'expected_outcome', e.target.value)}
                        className="w-full px-3 py-2 h-[42px] bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddMilestone}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                <Plus className="h-4 w-4" />
                Add Another Milestone
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
