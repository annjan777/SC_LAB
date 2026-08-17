import { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/api';

interface ProblemReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workId: string;
  workTitle: string;
  onSuccess: () => void;
}

export default function ProblemReportModal({
  isOpen,
  onClose,
  workId,
  workTitle,
  onSuccess,
}: ProblemReportModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    category: 'technical' as 'technical' | 'resource' | 'administrative' | 'dependency',
    description: '',
    impact_level: 'medium' as 'low' | 'medium' | 'high',
    proposed_mitigation: '',
    support_required_from: 'supervisor' as 'supervisor' | 'admin' | 'facility_spoc' | 'procurement',
    urgency_level: 'medium' as 'low' | 'medium' | 'high',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.description) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      const { error: problemError } = await api.post('/api/work/' + workId + '/problems', {
        category: formData.category,
        description: formData.description,
        impact_level: formData.impact_level,
        proposed_mitigation: formData.proposed_mitigation || null,
        support_required_from: formData.proposed_mitigation ? formData.support_required_from : null,
        urgency_level: formData.proposed_mitigation ? formData.urgency_level : null,
      });

      if (problemError) throw new Error(typeof problemError === 'string' ? problemError : (problemError as any).message || 'Failed to report problem');

      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      console.error('Error reporting problem:', err);
      setError(err.message || 'Failed to report problem');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      category: 'technical',
      description: '',
      impact_level: 'medium',
      proposed_mitigation: '',
      support_required_from: 'supervisor',
      urgency_level: 'medium',
    });
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-lg">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Report Problem</h2>
            <p className="text-sm text-gray-600 mt-1">{workTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <h3 className="text-md font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Problem Details
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="technical">Technical</option>
                    <option value="resource">Resource</option>
                    <option value="administrative">Administrative</option>
                    <option value="dependency">Dependency</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Impact Level <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.impact_level}
                    onChange={(e) => setFormData({ ...formData, impact_level: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Problem Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  placeholder="Describe the problem or blocker you're facing..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-md font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
              Proposed Mitigation & Support
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proposed Mitigation
                </label>
                <textarea
                  value={formData.proposed_mitigation}
                  onChange={(e) => setFormData({ ...formData, proposed_mitigation: e.target.value })}
                  rows={3}
                  placeholder="What do you propose as a solution? What help do you need?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Support Required From
                  </label>
                  <select
                    value={formData.support_required_from}
                    onChange={(e) => setFormData({ ...formData, support_required_from: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                    <option value="facility_spoc">Facility SPOC</option>
                    <option value="procurement">Procurement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Urgency Level
                  </label>
                  <select
                    value={formData.urgency_level}
                    onChange={(e) => setFormData({ ...formData, urgency_level: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
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
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300"
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Report Problem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
