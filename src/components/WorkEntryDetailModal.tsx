import { useState, useEffect } from 'react';
import { X, Edit2, Trash2, AlertCircle, CheckCircle2, Clock, Calendar, TrendingUp, MessageSquare } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

import { unescapeHtml } from '../utils/formatters';

interface WorkEntryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  workId: string;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateProgress: () => void;
  onReportProblem: () => void;
  onRefresh: () => void;
}

interface WorkDetails {
  id: string;
  project_name: string;
  assigned_by: string;
  work_title: string;
  description: string;
  start_date: string;
  end_date: string;
  priority: string;
  admin_status: string;
  created_at: string;
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
  progress_notes: string;
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

interface AdminComment {
  id: string;
  comment_text: string;
  created_at: string;
  is_read_by_user: boolean;
  admin_profile: {
    full_name: string;
  };
}

export default function WorkEntryDetailModal({
  isOpen,
  onClose,
  workId,
  onEdit,
  onDelete,
  onUpdateProgress,
  onReportProblem,
  onRefresh
}: WorkEntryDetailModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [work, setWork] = useState<WorkDetails | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [adminComments, setAdminComments] = useState<AdminComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'milestones' | 'progress' | 'problems' | 'comments'>('overview');

  useEffect(() => {
    if (isOpen && workId) {
      fetchWorkDetails();
    }
  }, [isOpen, workId]);

  const fetchWorkDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: workData, error: workError } = await api.get('/api/work/' + workId);

      if (workError) {
        console.error('Error fetching work data:', workError);
        throw workError;
      }
      if (!workData) {
        console.error('Work not found:', workId);
        setError('Work entry not found');
        return;
      }
      setWork(workData as WorkDetails);

      const [milestonesResult, progressResult, problemsResult, commentsResult] = await Promise.all([
        api.get('/api/work/' + workId + '/milestones', { order: 'target_date', ascending: 'true' }),
        api.get('/api/work/' + workId + '/progress', { order: 'update_date', ascending: 'false' }),
        api.get('/api/work/' + workId + '/problems', { order: 'reported_date', ascending: 'false' }),
        api.get('/api/work/' + workId + '/comments', { order: 'created_at', ascending: 'false' }),
      ]);

      setMilestones(Array.isArray(milestonesResult.data) ? milestonesResult.data : []);
      setProgressUpdates(Array.isArray(progressResult.data) ? progressResult.data : []);
      setProblems(Array.isArray(problemsResult.data) ? problemsResult.data : []);

      const commentsData = Array.isArray(commentsResult.data) ? commentsResult.data : [];
      setAdminComments(commentsData);

      // Mark unread comments as read
      const unreadIds = commentsData.filter((c: any) => !c.is_read_by_user).map((c: any) => c.id);
      if (unreadIds.length > 0) {
        await api.post('/api/work/' + workId + '/comments/mark-read', { ids: unreadIds });
      }

    } catch (error) {
      console.error('Error fetching work details:', error);
      setError('Failed to load work details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setSubmittingComment(true);
    try {
      const { error } = await api.post(`/api/work/${workId}/comments`, {
        comment_text: newComment,
      });

      if (error) throw error;
      setNewComment('');
      await fetchWorkDetails();
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Failed to add comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleToggleMilestone = async (milestoneId: string, currentStatus: boolean) => {
    try {
      const { error } = await api.put('/api/work/' + workId + '/milestones/' + milestoneId, {
        is_completed: !currentStatus,
        completed_at: !currentStatus ? new Date().toISOString() : null,
      });

      if (error) throw error;
      await fetchWorkDetails();
      onRefresh();
    } catch (error) {
      console.error('Error updating milestone:', error);
    }
  };

  const handleToggleProblem = async (problemId: string, currentStatus: boolean) => {
    try {
      const { error } = await api.put('/api/work/' + workId + '/problems/' + problemId, {
        is_resolved: !currentStatus,
        resolution_date: !currentStatus ? new Date().toISOString() : null,
      });

      if (error) throw error;
      await fetchWorkDetails();
      onRefresh();
    } catch (error) {
      console.error('Error updating problem:', error);
    }
  };

  if (!isOpen) return null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'delayed': return 'bg-red-100 text-red-800';
      case 'not_started': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const latestProgress = progressUpdates[0];
  const completedMilestones = milestones.filter(m => m.is_completed).length;
  const openProblems = problems.filter(p => !p.is_resolved).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-start">
          <div className="flex-1 pr-4">
            <h2 className="text-xl font-bold text-gray-900 mb-2">{work?.work_title}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-1 text-xs font-medium rounded ${getPriorityColor(work?.priority || '')}`}>
                {work?.priority.toUpperCase()}
              </span>
              {latestProgress && (
                <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(latestProgress.status)}`}>
                  {latestProgress.status.replace('_', ' ').toUpperCase()}
                </span>
              )}
              <span className="text-sm text-gray-600">
                {latestProgress?.completion_percentage || 0}% Complete
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
              title="Edit Work Entry"
            >
              <Edit2 className="h-5 w-5" />
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Delete Work Entry"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('milestones')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'milestones'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Milestones ({completedMilestones}/{milestones.length})
            </button>
            <button
              onClick={() => setActiveTab('progress')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'progress'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Progress History ({progressUpdates.length})
            </button>
            <button
              onClick={() => setActiveTab('problems')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'problems'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Problems ({openProblems})
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition ${
                activeTab === 'comments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Admin Comments ({adminComments.length})
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Data</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={fetchWorkDetails}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && work && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-5 w-5 text-blue-600" />
                        <span className="text-sm font-medium text-gray-600">Progress</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{latestProgress?.completion_percentage || 0}%</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <span className="text-sm font-medium text-gray-600">Milestones</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{completedMilestones}/{milestones.length}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <span className="text-sm font-medium text-gray-600">Open Problems</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{openProblems}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Work Details</h3>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-600">Project:</span>
                        <p className="text-gray-900">{work.project_name}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Assigned By:</span>
                        <p className="text-gray-900">{work.assigned_by}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Description:</span>
                        <p className="text-gray-900 whitespace-pre-line">{unescapeHtml(work.description)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm font-medium text-gray-600">Start Date:</span>
                          <p className="text-gray-900">{new Date(work.start_date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-600">End Date:</span>
                          <p className="text-gray-900">{new Date(work.end_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Admin Status:</span>
                        <p className="text-gray-900">{work.admin_status.replace('_', ' ').toUpperCase()}</p>
                      </div>
                    </div>
                  </div>

                  {latestProgress && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Latest Progress</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(latestProgress.status)}`}>
                            {latestProgress.status.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-600">
                            {new Date(latestProgress.update_date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-900">{latestProgress.progress_notes}</p>
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${latestProgress.completion_percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'milestones' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Milestones</h3>
                  </div>
                  {milestones.length === 0 ? (
                    <div className="text-center py-12">
                      <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No milestones defined</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {milestones.map((milestone) => (
                        <div key={milestone.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={milestone.is_completed}
                              onChange={() => handleToggleMilestone(milestone.id, milestone.is_completed)}
                              className="mt-1 h-4 w-4 text-blue-600 rounded cursor-pointer"
                            />
                            <div className="flex-1">
                              <p className={`font-medium ${milestone.is_completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                {milestone.milestone_description}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                Target: {new Date(milestone.target_date).toLocaleDateString()}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                Expected Outcome: {milestone.expected_outcome}
                              </p>
                              {milestone.completed_at && (
                                <p className="text-sm text-green-600 mt-1">
                                  Completed: {new Date(milestone.completed_at).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'progress' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress Timeline</h3>
                  {progressUpdates.length === 0 ? (
                    <div className="text-center py-12">
                      <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No progress updates yet</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                      <div className="space-y-6">
                        {progressUpdates.map((update, index) => (
                          <div key={update.id} className="relative pl-10">
                            <div className={`absolute left-2 w-4 h-4 rounded-full border-2 border-white ${
                              index === 0 ? 'bg-blue-600' : 'bg-gray-400'
                            }`}></div>
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(update.status)}`}>
                                  {update.status.replace('_', ' ').toUpperCase()}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {new Date(update.update_date).toLocaleDateString()} at {new Date(update.update_date).toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl font-bold text-gray-900">{update.completion_percentage}%</span>
                                <div className="flex-1">
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-blue-600 h-2 rounded-full"
                                      style={{ width: `${update.completion_percentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                              {update.progress_notes && (
                                <p className="text-gray-700">{update.progress_notes}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'problems' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Problems & Blockers</h3>
                  {problems.length === 0 ? (
                    <div className="text-center py-12">
                      <CheckCircle2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No problems reported</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {problems.map((problem) => (
                        <div key={problem.id} className={`p-4 rounded-lg border ${
                          problem.impact_level === 'high' ? 'bg-red-50 border-red-200' :
                          problem.impact_level === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                          'bg-gray-50 border-gray-200'
                        }`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                problem.impact_level === 'high' ? 'bg-red-100 text-red-800' :
                                problem.impact_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {problem.impact_level.toUpperCase()}
                              </span>
                              <span className="text-xs text-gray-600">{problem.category}</span>
                              {problem.is_resolved && (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              )}
                            </div>
                            <button
                              onClick={() => handleToggleProblem(problem.id, problem.is_resolved)}
                              className={`text-sm font-medium ${
                                problem.is_resolved ? 'text-gray-600' : 'text-green-600'
                              } hover:underline`}
                            >
                              {problem.is_resolved ? 'Mark as Open' : 'Mark as Resolved'}
                            </button>
                          </div>
                          <p className="text-gray-900 mb-2">{problem.description}</p>
                          <p className="text-xs text-gray-500 mb-3">
                            Reported: {new Date(problem.reported_date).toLocaleDateString()}
                            {problem.resolution_date && ` • Resolved: ${new Date(problem.resolution_date).toLocaleDateString()}`}
                          </p>
                          {problem.mitigation_actions && problem.mitigation_actions.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <h4 className="text-sm font-medium text-gray-900 mb-2">Mitigation Actions:</h4>
                              <div className="space-y-2">
                                {problem.mitigation_actions.map((action: MitigationAction) => (
                                  <div key={action.id} className="bg-white p-3 rounded border border-gray-200">
                                    <p className="text-sm text-gray-900">{action.proposed_mitigation}</p>
                                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                                      <span>Support needed: {action.support_required_from}</span>
                                      <span>•</span>
                                      <span>Urgency: {action.urgency_level}</span>
                                      <span>•</span>
                                      <span className={action.status === 'resolved' ? 'text-green-600' : 'text-yellow-600'}>
                                        {action.status}
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
              )}

              {activeTab === 'comments' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Comments</h3>
                  {adminComments.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                      <MessageSquare className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">No comments yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                      {adminComments.map((comment) => (
                        <div key={comment.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-gray-900">{comment.admin_profile?.full_name || 'Admin'}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(comment.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-gray-700 whitespace-pre-wrap">{comment.comment_text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 border-t border-gray-200 pt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Add a Comment
                    </label>
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      rows={3}
                      placeholder="Type your comment here..."
                    />
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={handleAddComment}
                        disabled={submittingComment || !newComment.trim()}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {submittingComment ? 'Adding...' : 'Add Comment'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition"
            >
              Close
            </button>
            <div className="flex gap-3">
              <button
                onClick={onReportProblem}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Report Problem
              </button>
              <button
                onClick={onUpdateProgress}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Update Progress
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
