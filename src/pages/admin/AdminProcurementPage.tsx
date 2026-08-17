import { useEffect, useState, FormEvent } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { ShoppingCart, Check, X, Package, Truck, FileText, AlertCircle, Eye, ExternalLink, Boxes, Hash, Clock, Calendar, IndianRupee, User, Plus, Filter, Search } from 'lucide-react';

interface PurchaseRequest {
  id: string;
  item_name: string;
  category: string;
  quantity: number;
  purpose: string;
  estimated_cost: number;
  vendor_name?: string;
  link?: string;
  manufacturer_part_no?: string;
  volume?: string;
  duration_of_consumption?: string;
  project_code?: string;
  status: string;
  requested_by: string;
  rejection_reason: string | null;
  approved_by?: string;
  approved_at?: string;
  attachment_url?: string;
  created_at: string;
  updated_at: string;
  user_profiles: {
    full_name: string;
    email?: string;
    department?: string;
  };
  approver_name?: string;
}

interface ProcurementDetails {
  id?: string;
  approved_cost: number | null;
  vendor_contact: string;
  po_number: string;
  order_date: string;
  expected_delivery_date: string;
  dispatch_date: string;
  tracking_id: string;
  remarks: string;
}

export default function AdminProcurementPage() {
  const { profile, hasPermission } = useAuth();
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showProcurementModal, setShowProcurementModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState({ search: '', user: '', date: '', sortBy: 'newest' });
  const [formData, setFormData] = useState({
    item_name: '',
    category: 'Chemicals',
    quantity: 1,
    purpose: '',
    estimated_cost: '',
    vendor_name: '',
    link: '',
    manufacturer_part_no: '',
    volume: '',
    duration_of_consumption: '',
    project_code: '',
  });

  const [procurementDetails, setProcurementDetails] = useState<ProcurementDetails>({
    approved_cost: null,
    vendor_contact: '',
    po_number: '',
    order_date: '',
    expected_delivery_date: '',
    dispatch_date: '',
    tracking_id: '',
    remarks: '',
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    setError('');

    // Members without view_procurement only get their own requests, via the self-service
    // endpoint — the admin endpoint (all requests, cross-user) is RBAC-restricted to elevated roles.
    const endpoint = hasPermission('view_procurement') ? '/api/admin/purchase-requests' : '/api/purchase-requests';
    const { data, error: fetchError } = await api.get(endpoint, { order: 'created_at', ascending: 'false' });

    if (fetchError) {
      console.error('Error fetching purchase requests:', fetchError);
      setError(`Failed to load purchase requests: ${typeof fetchError === 'string' ? fetchError : fetchError.message}`);
      setRequests([]);
    } else if (data) {
      setRequests(data);
    }

    setLoading(false);
  };

  const handleCreateRequest = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    const canApprove = hasPermission('approve_procurement');
    const status = canApprove ? 'approved' : 'submitted';
    const approved_at = canApprove ? new Date().toISOString() : undefined;
    const successMsg = canApprove 
      ? 'Purchase request created and auto-approved successfully!' 
      : 'Purchase request created successfully!';

    try {
      const endpoint = hasPermission('view_procurement') ? '/api/admin/purchase-requests' : '/api/purchase-requests';
      const { error: insertError } = await api.post(endpoint, {
        ...formData,
        estimated_cost: parseFloat(formData.estimated_cost),
        status,
        approved_at,
      });

      if (insertError) throw insertError;

      setSuccess(successMsg);
      setShowCreateForm(false);
      setFormData({
        item_name: '',
        category: 'Chemicals',
        quantity: 1,
        purpose: '',
        estimated_cost: '',
        vendor_name: '',
        link: '',
        manufacturer_part_no: '',
        volume: '',
        duration_of_consumption: '',
        project_code: '',
      });
      fetchRequests();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const approveRequest = async (requestId: string) => {
    setError('');
    setSuccess('');

    const { error: updateError } = await api.put('/api/admin/purchase-requests/' + requestId + '/approve', {});

    if (!updateError) {
      setSuccess('Request approved successfully');
      fetchRequests();
    } else {
      setError(typeof updateError === 'string' ? updateError : updateError.message);
    }
  };

  const rejectRequest = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      setError('Rejection reason is required');
      return;
    }

    setError('');
    setSuccess('');

    const { error: updateError } = await api.put('/api/admin/purchase-requests/' + selectedRequest.id + '/reject', {
      rejection_reason: rejectionReason,
    });

    if (!updateError) {
      setSuccess('Request rejected');
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectionReason('');
      fetchRequests();
    } else {
      setError(typeof updateError === 'string' ? updateError : updateError.message);
    }
  };

  const updateStatus = async () => {
    if (!selectedRequest || !newStatus) return;

    setError('');
    setSuccess('');

    try {
      const { error: updateError } = await api.put('/api/admin/purchase-requests/' + selectedRequest.id + '/status', {
        status: newStatus,
      });

      if (updateError) throw updateError;

      setSuccess(`Status updated to ${newStatus.replace(/_/g, ' ')}`);

      setShowStatusModal(false);
      setSelectedRequest(null);
      setNewStatus('');
      fetchRequests();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const saveProcurementDetails = async () => {
    if (!selectedRequest) return;

    setError('');
    setSuccess('');

    try {
      const { error: saveError } = await api.post('/api/admin/purchase-requests/' + selectedRequest.id + '/procurement', procurementDetails);

      if (saveError) throw saveError;

      setSuccess('Procurement details saved successfully');
      setShowProcurementModal(false);
      setSelectedRequest(null);
      resetProcurementDetails();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openProcurementModal = async (request: PurchaseRequest) => {
    setSelectedRequest(request);

    const { data } = await api.get('/api/admin/purchase-requests/' + request.id + '/procurement');

    if (data) {
      setProcurementDetails({
        id: data.id,
        approved_cost: data.approved_cost,
        vendor_contact: data.vendor_contact || '',
        po_number: data.po_number || '',
        order_date: data.order_date || '',
        expected_delivery_date: data.expected_delivery_date || '',
        dispatch_date: data.dispatch_date || '',
        tracking_id: data.tracking_id || '',
        remarks: data.remarks || '',
      });
    } else {
      resetProcurementDetails();
    }

    setShowProcurementModal(true);
  };

  const resetProcurementDetails = () => {
    setProcurementDetails({
      approved_cost: null,
      vendor_contact: '',
      po_number: '',
      order_date: '',
      expected_delivery_date: '',
      dispatch_date: '',
      tracking_id: '',
      remarks: '',
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      submitted: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      ordered: 'bg-purple-100 text-purple-800',
      in_transit: 'bg-yellow-100 text-yellow-800',
      received: 'bg-teal-100 text-teal-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getAvailableStatuses = (currentStatus: string) => {
    const workflow: Record<string, string[]> = {
      approved: ['ordered', 'in_transit', 'received'],
      ordered: ['in_transit', 'received'],
      in_transit: ['received'],
    };
    return workflow[currentStatus] || [];
  };

  const handleCardClick = (request: PurchaseRequest) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedRequest(null);
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
          <h1 className="text-3xl font-bold text-gray-900">Procurement Management</h1>
          <p className="text-gray-600 mt-2">Review and manage purchase requests</p>
        </div>
        <button
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            setError('');
            setSuccess('');
          }}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition font-medium shadow-sm"
        >
          <Plus className="w-5 h-5" />
          <span>New Purchase Request</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {showCreateForm && (
        <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Purchase Request</h2>
          <form onSubmit={handleCreateRequest}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.item_name}
                  onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter product name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="Chemicals">Chemicals</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Appliances">Appliances</option>
                  <option value="Computer Peripherals">Computer Peripherals</option>
                  <option value="Equipments">Equipments</option>
                  <option value="Consumables">Consumables</option>
                  <option value="Others">Others</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Cost (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={formData.estimated_cost}
                  onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name</label>
                <input
                  type="text"
                  value={formData.vendor_name}
                  onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter vendor name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link</label>
                <input
                  type="url"
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer Part No</label>
                <input
                  type="text"
                  value={formData.manufacturer_part_no}
                  onChange={(e) => setFormData({ ...formData, manufacturer_part_no: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Part number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Volume</label>
                <input
                  type="text"
                  value={formData.volume}
                  onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 500ml, 1L"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration of Consumption</label>
                <input
                  type="text"
                  value={formData.duration_of_consumption}
                  onChange={(e) => setFormData({ ...formData, duration_of_consumption: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 6 months"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Code</label>
                <input
                  type="text"
                  value={formData.project_code}
                  onChange={(e) => setFormData({ ...formData, project_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Project code"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purpose <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe the purpose of this purchase..."
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed font-medium transition"
              >
                {submitting ? 'Creating...' : (hasPermission('approve_procurement') ? 'Create & Auto-Approve' : 'Create')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setFormData({
                    item_name: '',
                    category: 'Chemicals',
                    quantity: 1,
                    purpose: '',
                    estimated_cost: '',
                    vendor_name: '',
                    link: '',
                    manufacturer_part_no: '',
                    volume: '',
                    duration_of_consumption: '',
                    project_code: '',
                  });
                }}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {['submitted', 'approved', 'ordered', 'in_transit'].map((status) => {
          const count = requests.filter((r) => r.status === status).length;
          return (
            <div key={status} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-600 capitalize mb-1">{status.replace('_', ' ')}</p>
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
                placeholder="Search items, categories, vendors..."
                className="w-full pl-10 pr-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {hasPermission('approve_procurement') && (
            <div className="flex-1 w-full relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Requested By</label>
              <select
                value={filters.user}
                onChange={(e) => setFilters(prev => ({ ...prev, user: e.target.value }))}
                className="w-full px-4 py-2 h-[42px] border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Users</option>
                {Array.from(new Set(requests.map(r => r.user_profiles?.full_name))).filter(Boolean).map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1 w-full relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Requested Date</label>
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
              request.item_name.toLowerCase().includes(filters.search.toLowerCase()) ||
              request.category.toLowerCase().includes(filters.search.toLowerCase()) ||
              (request.vendor_name && request.vendor_name.toLowerCase().includes(filters.search.toLowerCase()));
            
            const matchUser = !filters.user || request.user_profiles?.full_name === filters.user;
            const matchDate = !filters.date || request.created_at.startsWith(filters.date);
            
            return matchSearch && matchUser && matchDate;
          });

          filteredRequests.sort((a, b) => {
            switch (filters.sortBy) {
              case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
              case 'status': {
                const statusOrder: Record<string, number> = {
                  submitted: 1,
                  ordered: 2,
                  in_transit: 3,
                  received: 4,
                  approved: 5,
                  rejected: 6,
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
                <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No purchase requests match your filters</p>
              </div>
            );
          }

          return filteredRequests.map((request) => (
            <div
              key={request.id}
              onClick={() => handleCardClick(request)}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition cursor-pointer hover:border-blue-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{request.item_name}</h3>
                    <p className="text-sm text-gray-500">
                      Requested by {request.user_profiles.full_name}
                      {request.user_profiles.email ? ` (${request.user_profiles.email})` : ''}
                      {request.user_profiles.department ? ` - ${request.user_profiles.department}` : ''}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                    request.status
                  )}`}
                >
                  {request.status.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                <div>
                  <p className="text-gray-500">Category</p>
                  <p className="font-medium capitalize">{request.category}</p>
                </div>
                <div>
                  <p className="text-gray-500">Quantity</p>
                  <p className="font-medium">{request.quantity}</p>
                </div>
                <div>
                  <p className="text-gray-500">Estimated Cost</p>
                  <p className="font-medium">
                    {request.estimated_cost
                      ? `₹${request.estimated_cost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Vendor</p>
                  <p className="font-medium">{request.vendor_name || 'N/A'}</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-1">Purpose</p>
                <p className="text-sm text-gray-900">{request.purpose}</p>
              </div>

              {request.rejection_reason && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-800 mb-1">Rejection Reason</p>
                  <p className="text-sm text-red-700">{request.rejection_reason}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {(request.status === 'submitted' || request.status === 'draft') && hasPermission('approve_procurement') && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        approveRequest(request.id);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 transition"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRequest(request);
                        setShowRejectModal(true);
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2 transition"
                    >
                      <X className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                  </>
                )}

                {['approved', 'ordered', 'in_transit', 'received'].includes(request.status) && (
                  <>
                    {hasPermission('manage_procurement') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openProcurementModal(request);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Procurement Details</span>
                      </button>
                    )}
                    {hasPermission('approve_procurement') && getAvailableStatuses(request.status).length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRequest(request);
                          setNewStatus(getAvailableStatuses(request.status)[0]);
                          setShowStatusModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 transition"
                      >
                        <Truck className="w-4 h-4" />
                        <span>Update Status</span>
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardClick(request);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center space-x-2 transition ml-auto"
                >
                  <Eye className="w-4 h-4" />
                  <span>View Details</span>
                </button>
              </div>

              <p className="text-xs text-gray-400 mt-4">
                Submitted on {new Date(request.created_at).toLocaleString()}
              </p>
            </div>
          ));
        })()}
      </div>

      {showRejectModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Reject Request</h2>
            <p className="text-gray-600 mb-4">Please provide a reason for rejection:</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter rejection reason..."
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={rejectRequest}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 font-medium"
              >
                Reject
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedRequest(null);
                  setRejectionReason('');
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showProcurementModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full my-8">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Procurement Details</h2>
              <p className="text-gray-600 mt-1">{selectedRequest.item_name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Approved Cost (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={procurementDetails.approved_cost || ''}
                    onChange={(e) => setProcurementDetails({ ...procurementDetails, approved_cost: parseFloat(e.target.value) || null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PO Number
                  </label>
                  <input
                    type="text"
                    value={procurementDetails.po_number}
                    onChange={(e) => setProcurementDetails({ ...procurementDetails, po_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vendor Contact
                  </label>
                  <input
                    type="text"
                    value={procurementDetails.vendor_contact}
                    onChange={(e) => setProcurementDetails({ ...procurementDetails, vendor_contact: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order Date
                  </label>
                  <input
                    type="date"
                    value={procurementDetails.order_date}
                    onChange={(e) => setProcurementDetails({ ...procurementDetails, order_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={procurementDetails.expected_delivery_date}
                    onChange={(e) => setProcurementDetails({ ...procurementDetails, expected_delivery_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dispatch Date
                  </label>
                  <input
                    type="date"
                    value={procurementDetails.dispatch_date}
                    onChange={(e) => setProcurementDetails({ ...procurementDetails, dispatch_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tracking ID
                  </label>
                  <input
                    type="text"
                    value={procurementDetails.tracking_id}
                    onChange={(e) => setProcurementDetails({ ...procurementDetails, tracking_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Remarks
                  </label>
                  <textarea
                    rows={3}
                    value={procurementDetails.remarks}
                    onChange={(e) => setProcurementDetails({ ...procurementDetails, remarks: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={saveProcurementDetails}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Save Details
                </button>
                <button
                  onClick={() => {
                    setShowProcurementModal(false);
                    setSelectedRequest(null);
                    resetProcurementDetails();
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStatusModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Update Status</h2>
            <p className="text-gray-600 mb-4">
              Update status for: <span className="font-semibold">{selectedRequest.item_name}</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">New Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {getAvailableStatuses(selectedRequest.status).map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={updateStatus}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 font-medium"
              >
                Update
              </button>
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedRequest(null);
                  setNewStatus('');
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Request Details</h2>
              <button
                onClick={closeDetailModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {selectedRequest.status === 'rejected' && selectedRequest.rejection_reason && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                  <div className="flex items-start">
                    <AlertCircle className="w-6 h-6 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-lg font-semibold text-red-800 mb-1">Request Rejected</h3>
                      <p className="text-red-700">{selectedRequest.rejection_reason}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-5">
                <div className="flex items-center mb-4">
                  <Package className="w-6 h-6 text-blue-600 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900">Product Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-500 mb-1">Product Name</p>
                    <p className="text-gray-900 font-medium">{selectedRequest.item_name}</p>
                  </div>
                  {selectedRequest.link && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-500 mb-1">Link</p>
                      <a
                        href={selectedRequest.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline flex items-center"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        {selectedRequest.link}
                      </a>
                    </div>
                  )}
                  {selectedRequest.manufacturer_part_no && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Manufacturer Part No</p>
                      <p className="text-gray-900 font-medium">{selectedRequest.manufacturer_part_no}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Category</p>
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                      {selectedRequest.category}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-teal-50 rounded-lg p-5">
                <div className="flex items-center mb-4">
                  <Boxes className="w-6 h-6 text-teal-600 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900">Quantity & Volume</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Quantity</p>
                    <p className="text-gray-900 font-medium text-xl">{selectedRequest.quantity}</p>
                  </div>
                  {selectedRequest.volume && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Volume</p>
                      <p className="text-gray-900 font-medium text-xl">{selectedRequest.volume}</p>
                    </div>
                  )}
                  {selectedRequest.duration_of_consumption && (
                    <div>
                      <div className="flex items-center mb-1">
                        <Clock className="w-4 h-4 text-gray-500 mr-1" />
                        <p className="text-sm text-gray-500">Duration of Consumption</p>
                      </div>
                      <p className="text-gray-900 font-medium">{selectedRequest.duration_of_consumption}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-orange-50 rounded-lg p-5">
                <div className="flex items-center mb-4">
                  <Hash className="w-6 h-6 text-orange-600 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900">Project & Vendor Details</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedRequest.project_code && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Project Code</p>
                      <p className="text-gray-900 font-medium">{selectedRequest.project_code}</p>
                    </div>
                  )}
                  {selectedRequest.vendor_name && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Vendor Name</p>
                      <p className="text-gray-900 font-medium">{selectedRequest.vendor_name}</p>
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <p className="text-sm text-gray-500 mb-1">Purpose</p>
                    <p className="text-gray-900">{selectedRequest.purpose}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-5">
                <div className="flex items-center mb-4">
                  <IndianRupee className="w-6 h-6 text-green-600 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900">Financial Details</h3>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Estimated Price</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{selectedRequest.estimated_cost.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-5">
                <div className="flex items-center mb-4">
                  <FileText className="w-6 h-6 text-blue-600 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900">Status Information</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">Current Status</p>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        selectedRequest.status
                      )}`}
                    >
                      {selectedRequest.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {(selectedRequest.status === 'approved' || selectedRequest.status === 'rejected') && selectedRequest.approver_name && (
                    <div className="flex items-start pt-2 border-t border-blue-200">
                      <User className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">{selectedRequest.status === 'approved' ? 'Approved By' : 'Rejected By'}</p>
                        <p className="text-gray-900 font-medium">{selectedRequest.approver_name}</p>
                        {selectedRequest.approved_at && (
                          <p className="text-sm text-gray-500 mt-1">
                            {new Date(selectedRequest.approved_at).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-5">
                <div className="flex items-center mb-4">
                  <User className="w-6 h-6 text-gray-600 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900">Requester Information</h3>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Requested By</p>
                  <p className="text-gray-900 font-medium">{selectedRequest.user_profiles.full_name}</p>
                  {selectedRequest.user_profiles.email && (
                    <p className="text-sm text-gray-600 mt-1">Email: {selectedRequest.user_profiles.email}</p>
                  )}
                  {selectedRequest.user_profiles.department && (
                    <p className="text-sm text-gray-600 mt-1">Department: {selectedRequest.user_profiles.department}</p>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 rounded-lg p-5">
                <div className="flex items-center mb-4">
                  <Calendar className="w-6 h-6 text-amber-600 mr-3" />
                  <h3 className="text-lg font-semibold text-gray-900">Timeline</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-500">Created</p>
                    <p className="text-gray-900 font-medium">
                      {new Date(selectedRequest.created_at).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                  <div className="flex justify-between">
                    <p className="text-sm text-gray-500">Last Updated</p>
                    <p className="text-gray-900 font-medium">
                      {new Date(selectedRequest.updated_at).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {selectedRequest.attachment_url && (
                <div className="bg-gray-50 rounded-lg p-5">
                  <div className="flex items-center mb-2">
                    <FileText className="w-6 h-6 text-gray-600 mr-3" />
                    <h3 className="text-lg font-semibold text-gray-900">Attachment</h3>
                  </div>
                  <a
                    href={selectedRequest.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    View Attachment
                  </a>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
              <button
                onClick={closeDetailModal}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
