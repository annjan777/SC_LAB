import { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../lib/api';

interface ProgressUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  workId: string;
  workTitle: string;
  currentProgress?: number;
  onSuccess: () => void;
}

export default function ProgressUpdateModal({
  isOpen,
  onClose,
  workId,
  workTitle,
  currentProgress = 0,
  onSuccess,
}: ProgressUpdateModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    status: 'in_progress' as 'not_started' | 'in_progress' | 'delayed' | 'completed',
    completion_percentage: currentProgress,
    progress_notes: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: insertError } = await api.post('/api/work/' + workId + '/progress', {
        status: formData.status,
        completion_percentage: formData.completion_percentage,
        progress_notes: formData.progress_notes,
      });

      if (insertError) throw new Error(typeof insertError === 'string' ? insertError : (insertError as any).message || 'Failed to update progress');

      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      console.error('Error updating progress:', err);
      setError(err.message || 'Failed to update progress');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      status: 'in_progress',
      completion_percentage: currentProgress,
      progress_notes: '',
    });
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-lg">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Update Progress</h2>
            <p className="text-sm text-gray-600 mt-1">{workTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="delayed">Delayed</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Completion Percentage: {formData.completion_percentage}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.completion_percentage}
              onChange={(e) => setFormData({ ...formData, completion_percentage: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>

          <div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all"
                style={{ width: `${formData.completion_percentage}%` }}
              ></div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Progress Notes
            </label>
            <textarea
              value={formData.progress_notes}
              onChange={(e) => setFormData({ ...formData, progress_notes: e.target.value })}
              rows={4}
              placeholder="Describe what you've accomplished, any challenges faced, and next steps..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
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
              {loading ? 'Updating...' : 'Update Progress'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
