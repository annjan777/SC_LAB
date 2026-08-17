import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Check, X, AlertCircle, Plus, Edit2, Trash2, Search } from 'lucide-react';

interface LeaveRequest {
  id: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  reason: string;
  status: string;
  requested_by: string;
  created_at: string;
  user_profiles: {
    full_name: string;
    department: string;
  };
}

export default function AdminLeavesPage() {
  const { profile, hasPermission } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [remarks, setRemarks] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [filters, setFilters] = useState({ search: '', user: '', date: '', sortBy: 'newest' });

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<LeaveRequest | null>(null);

  const [formData, setFormData] = useState({
    leave_type: 'casual',
    from_date: '',
    to_date: '',
    reason: '',
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);

    // Members without view_leaves only get their own requests, via the self-service
    // endpoint — the admin endpoint (all requests, cross-user) is RBAC-restricted to elevated roles.
    const endpoint = hasPermission('view_leaves') ? '/api/admin/leave-requests' : '/api/leave-requests';
    const { data, error } = await api.get(endpoint, { order: 'created_at', ascending: 'false' });

    if (error) {
      console.error('Error fetching leave requests:', error);
      setError(`Failed to load leave requests: ${typeof error === 'string' ? error : error.message}`);
      setRequests([]);
    } else if (data) {
      setRequests(data as any);
    }

    setLoading(false);
  };

  const approveRequest = async (requestId: string) => {
    const { error } = await api.put('/api/admin/leave-requests/' + requestId + '/approve', {});

    if (error) {
      console.error('Error approving leave request:', error);
      setError(`Failed to approve request: ${typeof error === 'string' ? error : error.message}`);
    } else {
      fetchRequests();
    }
  };

  const rejectRequest = async () => {
    if (!selectedRequest) return;

    const { error } = await api.put('/api/admin/leave-requests/' + selectedRequest.id + '/reject', {
      admin_remarks: remarks,
    });

    if (error) {
      console.error('Error rejecting leave request:', error);
      setError(`Failed to reject request: ${typeof error === 'string' ? error : error.message}`);
    } else {
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRemarks('');
      fetchRequests();
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (new Date(formData.to_date) < new Date(formData.from_date)) {
      setError('End date must be after start date');
      setSubmitting(false);
      return;
    }

    try {
      const endpoint = hasPermission('view_leaves') ? '/api/admin/leave-requests' : '/api/leave-requests';
      if (editingRequest) {
        const { error } = await api.put(endpoint + '/' + editingRequest.id, formData);
        if (error) throw error;
      } else {
        const { error } = await api.post(endpoint, {
          ...formData,
          status: 'pending',
        });
        if (error) throw error;
      }

      setShowForm(false);
      setEditingRequest(null);
      setFormData({
        leave_type: 'casual',
        from_date: '',
        to_date: '',
        reason: '',
      });
      await fetchRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to save request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (request: LeaveRequest) => {
    setEditingRequest(request);
    setFormData({
      leave_type: request.leave_type,
      from_date: request.from_date.split('T')[0],
      to_date: request.to_date.split('T')[0],
      reason: request.reason,
    });
    setShowForm(true);
  };

  const confirmDelete = (request: LeaveRequest) => {
    setRequestToDelete(request);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!requestToDelete) return;
    try {
      const { error } = await api.delete('/api/admin/leave-requests/' + requestToDelete.id);
      if (error) throw error;
      setShowDeleteModal(false);
      setRequestToDelete(null);
      await fetchRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to delete request');
      setShowDeleteModal(false);
      setRequestToDelete(null);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const calculateDays = (fromDate: string, toDate: string) => {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diffTime = Math.abs(to.getTime() - from.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {hasPermission('approve_leaves') ? 'Leave Approvals' : 'Leave Requests'}
          </h1>
          <p className="text-gray-600 mt-2">
            {hasPermission('approve_leaves') ? 'Review and approve leave requests' : 'Submit and track your leave applications'}
          </p>
        </div>
        {hasPermission('create_leave_request') && (
          <button
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                setEditingRequest(null);
              } else {
                setEditingRequest(null);
                setFormData({
                  leave_type: 'casual',
                  from_date: '',
                  to_date: '',
                  reason: '',
                });
                setShowForm(true);
              }
            }}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            <span>{showForm ? 'Cancel' : 'New Request'}</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-red-900 font-semibold mb-1">Error Loading Data</h3>
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={fetchRequests}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {['pending', 'approved', 'rejected'].map((status) => {
          const count = requests.filter((r) => r.status === status).length;
          return (
            <div key={status} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-600 capitalize mb-1">{status}</p>
              <p className="text-3xl font-bold text-gray-900">{count}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-8">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Search leave type or reason..."
                className="w-full pl-10 pr-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {hasPermission('approve_leaves') && (
            <div className="flex-1 w-full relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
              <select
                value={filters.user}
                onChange={(e) => setFilters(prev => ({ ...prev, user: e.target.value }))}
                className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Employees</option>
                {Array.from(new Set(requests.map(r => r.user_profiles?.full_name))).filter(Boolean).map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1 w-full relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
              className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex-1 w-full relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
              className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="status">Status</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>

          {(filters.search || filters.user || filters.date || filters.sortBy !== 'newest') && (
            <button
              onClick={() => setFilters({ search: '', user: '', date: '', sortBy: 'newest' })}
              className="px-4 py-2 h-[42px] text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 whitespace-nowrap transition"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {(() => {
          const filteredRequests = requests.filter(request => {
            const matchSearch = !filters.search || 
              request.leave_type.toLowerCase().includes(filters.search.toLowerCase()) ||
              request.reason.toLowerCase().includes(filters.search.toLowerCase());
            
            const matchUser = !filters.user || request.user_profiles?.full_name === filters.user;
            
            let matchDate = true;
            if (filters.date) {
              const filterD = new Date(filters.date);
              const fromD = new Date(request.from_date);
              const toD = new Date(request.to_date);
              filterD.setHours(0,0,0,0);
              fromD.setHours(0,0,0,0);
              toD.setHours(0,0,0,0);
              matchDate = filterD >= fromD && filterD <= toD;
            }
            
            return matchSearch && matchUser && matchDate;
          });

          filteredRequests.sort((a, b) => {
            switch (filters.sortBy) {
              case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
              case 'status': {
                const statusOrder: Record<string, number> = {
                  pending: 1,
                  approved: 2,
                  rejected: 3,
                };
                return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
              }
              case 'name': return (a.user_profiles?.full_name || '').localeCompare(b.user_profiles?.full_name || '');
              case 'newest':
              default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
          });

          if (filteredRequests.length === 0) {
            return (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No leave requests match your filters</p>
              </div>
            );
          }

          return filteredRequests.map((request) => (
            <div
              key={request.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {request.user_profiles.full_name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {request.user_profiles.department || 'No department'} •{' '}
                      {calculateDays(request.from_date, request.to_date)} day(s)
                    </p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                    request.status
                  )}`}
                >
                  {request.status}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Leave Type</p>
                  <p className="font-medium text-gray-900 capitalize">
                    {request.leave_type.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">From Date</p>
                  <p className="font-medium text-gray-900">
                    {new Date(request.from_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">To Date</p>
                  <p className="font-medium text-gray-900">
                    {new Date(request.to_date).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">Reason</p>
                <p className="text-gray-700">{request.reason}</p>
              </div>

              {request.status === 'pending' && (
                <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
                  {hasPermission('approve_leaves') ? (
                    <>
                      <button
                        onClick={() => approveRequest(request.id)}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRequest(request);
                          setShowRejectModal(true);
                        }}
                        className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEdit(request)}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => confirmDelete(request)}
                        className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="text-xs text-gray-400 mt-4">
                Submitted on {new Date(request.created_at).toLocaleString()}
              </div>
            </div>
          ));
        })()}
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Reject Leave Request</h3>
            <p className="text-gray-600 mb-4">Optionally provide remarks for this rejection:</p>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              placeholder="Enter remarks (optional)..."
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedRequest(null);
                  setRemarks('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={rejectRequest}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && requestToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
              <h2 className="text-xl font-bold text-gray-900">Confirm Delete</h2>
            </div>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete this leave request? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setRequestToDelete(null);
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {editingRequest ? 'Edit Leave Request' : 'Submit New Leave Request'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Leave Type *</label>
                  <select
                    value={formData.leave_type}
                    onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="casual">Casual Leave</option>
                    <option value="medical">Medical Leave</option>
                    <option value="academic">Academic Leave</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">From Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.from_date}
                    onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">To Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.to_date}
                    onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason *</label>
                <textarea
                  required
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Please provide the reason for your leave..."
                />
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingRequest(null);
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition"
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
