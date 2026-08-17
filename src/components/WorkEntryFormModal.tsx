import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface WorkEntryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Milestone {
  milestone_description: string;
  target_date: string;
  expected_outcome: string;
}

export default function WorkEntryFormModal({ isOpen, onClose, onSuccess }: WorkEntryFormModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [showCustomSupervisor, setShowCustomSupervisor] = useState(false);

  const [formData, setFormData] = useState({
    project_name: '',
    assigned_by: '',
    custom_assigned_by: '',
    work_title: '',
    description: '',
    start_date: '',
    end_date: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    initial_status: 'not_started' as 'not_started' | 'in_progress' | 'delayed' | 'completed',
    initial_percentage: 0,
  });

  const [milestones, setMilestones] = useState<Milestone[]>([
    { milestone_description: '', target_date: '', expected_outcome: '' }
  ]);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/api/users', { order: 'full_name', ascending: 'true' });
      if (data) {
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleAssignedByChange = (value: string) => {
    if (value === 'others') {
      setShowCustomSupervisor(true);
      setFormData({ ...formData, assigned_by: '', custom_assigned_by: '' });
    } else {
      setShowCustomSupervisor(false);
      const selectedUser = users.find(u => u.id === value);
      setFormData({ ...formData, assigned_by: selectedUser?.full_name || '', custom_assigned_by: '' });
    }
  };

  if (!isOpen) return null;

  const handleAddMilestone = () => {
    setMilestones([...milestones, { milestone_description: '', target_date: '', expected_outcome: '' }]);
  };

  const handleRemoveMilestone = (index: number) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter((_, i) => i !== index));
    }
  };

  const handleMilestoneChange = (index: number, field: keyof Milestone, value: string) => {
    const updated = [...milestones];
    updated[index][field] = value;
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
        ? formData.custom_assigned_by
        : formData.assigned_by;

      if (!assignedByValue) {
        setError('Please select or enter who this work is assigned by.');
        setLoading(false);
        return;
      }

      const { error: workError } = await api.post('/api/work', {
        project_name: formData.project_name || null,
        assigned_by: assignedByValue,
        work_title: formData.work_title || null,
        description: formData.description || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        priority: formData.priority,
        initial_status: formData.initial_status,
        initial_percentage: formData.initial_percentage,
        milestones: validMilestones,
      });

      if (workError) throw new Error(typeof workError === 'string' ? workError : (workError as any).message || 'Failed to create work entry');

      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      console.error('Error creating work entry:', err);
      setError(err.message || 'Failed to create work entry');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      project_name: '',
      assigned_by: '',
      custom_assigned_by: '',
      work_title: '',
      description: '',
      start_date: '',
      end_date: '',
      priority: 'medium',
      initial_status: 'not_started',
      initial_percentage: 0,
    });
    setMilestones([{ milestone_description: '', target_date: '', expected_outcome: '' }]);
    setShowCustomSupervisor(false);
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Create New Work Entry</h2>
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
              Section A: Assigned Work Details
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
                    value={formData.custom_assigned_by}
                    onChange={(e) => setFormData({ ...formData, custom_assigned_by: e.target.value })}
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
              Section B: Milestone Planner
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

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Section C: Initial Status
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Status
                </label>
                <select
                  value={formData.initial_status}
                  onChange={(e) => setFormData({ ...formData, initial_status: e.target.value as any })}
                  className="w-full px-3 py-2 h-[42px] bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="delayed">Delayed</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Completion Percentage
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.initial_percentage}
                  onChange={(e) => setFormData({ ...formData, initial_percentage: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 h-[42px] bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
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
              {loading ? 'Creating...' : 'Create Work Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
