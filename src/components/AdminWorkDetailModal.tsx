import { useEffect, useState } from 'react';
import { X, Calendar, User, Flag, AlertTriangle, CheckCircle2, Clock, MessageSquare, Target, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

import { unescapeHtml } from '../utils/formatters';

interface AdminWorkDetailModalProps {
  workId: string;
  onClose: () => void;
  onUpdate?: () => void;
}

interface WorkDetails {
  id: string;
  user_id: string;
  project_name: string;
  work_title: string;
  description: string;
  assigned_by: string;
  start_date: string;
  end_date: string;
  priority: string;
  admin_status: string;
  created_at: string;
  user_profiles: {
    full_name: string;
    department: string;
    email: string;
  };
}

interface Milestone {
  id: string;
  milestone_description: string;
  target_date: string;
  expected_outcome: string;
  is_completed: boolean;
  completed_at: string | null;
}

interface ProgressUpdate {
  id: string;
  update_date: string;
  status: string;
  completion_percentage: number;
  progress_notes: string | null;
}

interface Problem {
  id: string;
  category: string;
  description: string;
  impact_level: string;
  reported_date: string;
  is_resolved: boolean;
  resolution_date: string | null;
  mitigation_actions: MitigationAction[];
}

interface MitigationAction {
  id: string;
  proposed_mitigation: string;
  support_required_from: string;
  urgency_level: string;
  status: string;
}

interface Comment {
  id: string;
  comment_text: string;
  created_at: string;
  admin_id: string;
  user_profiles: {
    full_name: string;
  };
}

export default function AdminWorkDetailModal({ workId, onClose, onUpdate }: AdminWorkDetailModalProps) {
  const { user } = useAuth();
  const [workDetails, setWorkDetails] = useState<WorkDetails | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchWorkDetails();
  }, [workId]);

  const fetchWorkDetails = async () => {
    try {
      setLoading(true);

      const [workResult, milestonesResult, progressResult, problemsResult, commentsResult] = await Promise.all([
        api.get('/api/work/' + workId),
        api.get('/api/work/' + workId + '/milestones', { order: 'target_date', ascending: 'true' }),
        api.get('/api/work/' + workId + '/progress', { order: 'update_date', ascending: 'false' }),
        api.get('/api/work/' + workId + '/problems', { order: 'reported_date', ascending: 'false' }),
        api.get('/api/admin/work/' + workId + '/comments', { order: 'created_at', ascending: 'false' }),
      ]);

      if (workResult.data) {
        setWorkDetails(workResult.data as WorkDetails);
      }
      setMilestones(Array.isArray(milestonesResult.data) ? milestonesResult.data : []);
      setProgressUpdates(Array.isArray(progressResult.data) ? progressResult.data : []);
      setProblems(Array.isArray(problemsResult.data) ? problemsResult.data : []);
      setComments(Array.isArray(commentsResult.data) ? commentsResult.data : []);
    } catch (error) {
      console.error('Error fetching work details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      setSubmittingComment(true);

      const { error } = await api.post('/api/admin/work/' + workId + '/comments', {
        comment_text: newComment.trim(),
      });

      if (error) throw new Error(typeof error === 'string' ? error : (error as any).message || 'Failed to add comment');

      setNewComment('');
      await fetchWorkDetails();
      onUpdate?.();
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUpdateAdminStatus = async (newStatus: string) => {
    try {
      setUpdatingStatus(true);

      const { error } = await api.put('/api/admin/work/' + workId + '/status', { admin_status: newStatus });

      if (error) throw new Error(typeof error === 'string' ? error : (error as any).message || 'Failed to update status');

      await fetchWorkDetails();
      onUpdate?.();
    } catch (error) {
      console.error('Error updating admin status:', error);
      alert('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'in_progress': return 'text-blue-600 bg-blue-50';
      case 'delayed': return 'text-red-600 bg-red-50';
      case 'not_started': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getAdminStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'needs_attention': return 'text-red-600 bg-red-50';
      case 'on_track': return 'text-blue-600 bg-blue-50';
      case 'pending': return 'text-amber-600 bg-amber-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-8 max-w-4xl w-full">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!workDetails) {
    return null;
  }

  const latestProgress = progressUpdates[0];
  const completedMilestones = milestones.filter(m => m.is_completed).length;
  const totalMilestones = milestones.length;
  const openProblems = problems.filter(p => !p.is_resolved).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-6xl w-full my-8">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-lg">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Work Details</h2>
            <p className="text-sm text-gray-600 mt-1">{workDetails.work_title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Progress</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {latestProgress?.completion_percentage || 0}%
              </p>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-900">Milestones</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {completedMilestones}/{totalMilestones}
              </p>
            </div>

            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium text-red-900">Open Problems</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{openProblems}</p>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-5 w-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">Comments</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">{comments.length}</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900">{workDetails.user_profiles.full_name}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <span className="text-gray-900">{workDetails.user_profiles.department || 'N/A'}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <span className="text-gray-900">{workDetails.user_profiles.email || 'N/A'}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                <span className="text-gray-900">{workDetails.project_name}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned By</label>
                <span className="text-gray-900">{workDetails.assigned_by}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${getPriorityColor(workDetails.priority)}`}>
                  {workDetails.priority.toUpperCase()}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900">{new Date(workDetails.start_date).toLocaleDateString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900">{new Date(workDetails.end_date).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <p className="text-gray-900 whitespace-pre-wrap">{unescapeHtml(workDetails.description)}</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Status</h3>
            <div className="flex items-center gap-4">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getAdminStatusColor(workDetails.admin_status)}`}>
                {workDetails.admin_status.replace('_', ' ').toUpperCase()}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdateAdminStatus('pending')}
                  disabled={updatingStatus || workDetails.admin_status === 'pending'}
                  className="px-3 py-1 text-sm bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Pending
                </button>
                <button
                  onClick={() => handleUpdateAdminStatus('on_track')}
                  disabled={updatingStatus || workDetails.admin_status === 'on_track'}
                  className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  On Track
                </button>
                <button
                  onClick={() => handleUpdateAdminStatus('needs_attention')}
                  disabled={updatingStatus || workDetails.admin_status === 'needs_attention'}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Needs Attention
                </button>
                <button
                  onClick={() => handleUpdateAdminStatus('completed')}
                  disabled={updatingStatus || workDetails.admin_status === 'completed'}
                  className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Completed
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Milestones</h3>
            {milestones.length === 0 ? (
              <p className="text-gray-500 text-sm">No milestones defined</p>
            ) : (
              <div className="space-y-3">
                {milestones.map((milestone) => (
                  <div key={milestone.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="mt-1">
                      {milestone.is_completed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <Clock className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${milestone.is_completed ? 'text-gray-600 line-through' : 'text-gray-900'}`}>
                        {milestone.milestone_description}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{milestone.expected_outcome}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-gray-500">
                          Target: {new Date(milestone.target_date).toLocaleDateString()}
                        </span>
                        {milestone.is_completed && milestone.completed_at && (
                          <span className="text-xs text-green-600">
                            Completed: {new Date(milestone.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress Updates</h3>
            {progressUpdates.length === 0 ? (
              <p className="text-gray-500 text-sm">No progress updates yet</p>
            ) : (
              <div className="space-y-3">
                {progressUpdates.map((update) => (
                  <div key={update.id} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(update.status)}`}>
                        {update.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {update.completion_percentage}%
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(update.update_date).toLocaleString()}
                      </span>
                    </div>
                    {update.progress_notes && (
                      <p className="text-sm text-gray-700 mt-1">{update.progress_notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Problems & Mitigation Actions</h3>
            {problems.length === 0 ? (
              <p className="text-gray-500 text-sm">No problems reported</p>
            ) : (
              <div className="space-y-4">
                {problems.map((problem) => (
                  <div key={problem.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getImpactColor(problem.impact_level)}`}>
                          {problem.impact_level.toUpperCase()} IMPACT
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {problem.category.toUpperCase()}
                        </span>
                        {problem.is_resolved && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            RESOLVED
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(problem.reported_date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-900 mb-3">{problem.description}</p>

                    {problem.mitigation_actions && problem.mitigation_actions.length > 0 && (
                      <div className="mt-3 pl-4 border-l-2 border-gray-200">
                        <p className="text-sm font-medium text-gray-700 mb-2">Mitigation Actions:</p>
                        <div className="space-y-2">
                          {problem.mitigation_actions.map((action: MitigationAction) => (
                            <div key={action.id} className="bg-gray-50 rounded p-3">
                              <p className="text-sm text-gray-900 mb-2">{action.proposed_mitigation}</p>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                  Support: {action.support_required_from.replace('_', ' ').toUpperCase()}
                                </span>
                                <span className={`px-2 py-0.5 rounded ${action.urgency_level === 'high' ? 'bg-red-100 text-red-700' : action.urgency_level === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {action.urgency_level.toUpperCase()} URGENCY
                                </span>
                                <span className={`px-2 py-0.5 rounded ${action.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                  {action.status.toUpperCase()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Comments</h3>

            <div className="mb-4">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment for the user..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
              />
              <button
                onClick={handleAddComment}
                disabled={submittingComment || !newComment.trim()}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submittingComment ? 'Adding...' : 'Add Comment'}
              </button>
            </div>

            {comments.length === 0 ? (
              <p className="text-gray-500 text-sm">No comments yet</p>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {comment.user_profiles.full_name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{comment.comment_text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
