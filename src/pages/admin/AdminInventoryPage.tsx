import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  AlertCircle,
  Package,
  Clock,
  CheckCircle2,
  RotateCcw,
  Bell,
  Check,
  XCircle,
  Building2,
  UserCheck,
} from 'lucide-react';
import {
  InventoryItem,
  InventoryRequest,
  CONSUMABLE_CATEGORIES,
  EQUIPMENT_CATEGORIES,
  getCategoriesForClassification,
} from '../../types/inventory';
import InventoryItemModal from '../../components/InventoryItemModal';
import InventoryIssueModal from '../../components/InventoryIssueModal';
import InventoryReturnModal from '../../components/InventoryReturnModal';
import EquipmentAssignModal from '../../components/EquipmentAssignModal';
import {
  PageHeader,
  Button,
  Select,
  FilterBar,
  TableContainer,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  StatusBadge,
  EmptyState,
} from '../../components/ui';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
}

export default function AdminInventoryPage() {
  const { profile, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'catalog' | 'requests'>('catalog');

  // Catalog State
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [facilities, setFacilities] = useState<Array<{ id: string; name: string; location: string }>>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [classificationFilter, setClassificationFilter] = useState<'all' | 'Equipment' | 'Consumables'>('all');

  // Requests State
  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [requestStatusFilter, setRequestStatusFilter] = useState('all');
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Modals & Actions
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [assigningItem, setAssigningItem] = useState<InventoryItem | null>(null);
  const [issuingRequest, setIssuingRequest] = useState<InventoryRequest | null>(null);
  const [returningRequest, setReturningRequest] = useState<InventoryRequest | null>(null);
  const [triggeringReminders, setTriggeringReminders] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (hasPermission('edit_inventory')) {
      fetchItems();
      fetchUsers();
      fetchRequests();
    }
  }, [profile]);

  const fetchItems = async () => {
    try {
      const [invRes, facRes] = await Promise.all([
        api.get('/api/inventory', { order: 'created_at', ascending: 'false' }),
        api.get('/api/facilities'),
      ]);

      if (invRes.error) throw invRes.error;
      setItems(invRes.data || []);
      if (facRes.data && Array.isArray(facRes.data)) {
        setFacilities(facRes.data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/api/users', { order: 'full_name' });
      if (data && Array.isArray(data)) {
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const { data, error: reqErr } = await api.get('/api/inventory/requests');
      if (reqErr) throw reqErr;
      if (Array.isArray(data)) {
        setRequests(data);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const { error } = await api.delete('/api/inventory/' + id);
      if (error) throw error;
      setSuccess('Item deleted successfully');
      fetchItems();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setShowModal(true);
  };

  const handleApprove = async (reqId: string) => {
    try {
      const { error: err } = await api.put(`/api/inventory/requests/${reqId}/approve`, {});
      if (err) throw err;
      setSuccess('Request approved successfully');
      fetchRequests();
    } catch (e: any) {
      setError(e.message || 'Failed to approve request');
    }
  };

  const handleReject = async (reqId: string) => {
    const reason = prompt('Please provide reason for rejection:');
    if (reason === null) return;
    try {
      const { error: err } = await api.put(`/api/inventory/requests/${reqId}/reject`, { rejection_reason: reason });
      if (err) throw err;
      setSuccess('Request rejected');
      fetchRequests();
    } catch (e: any) {
      setError(e.message || 'Failed to reject request');
    }
  };

  const handleTriggerReturnReminders = async () => {
    setTriggeringReminders(true);
    try {
      const { data, error: err } = await api.post('/api/inventory/requests/trigger-reminders', {});
      if (err) throw err;
      setSuccess(`Reminder check completed: ${data.dueTodayCount} due today, ${data.overdueCount} overdue`);
      fetchRequests();
    } catch (e: any) {
      setError(e.message || 'Failed to trigger reminders');
    } finally {
      setTriggeringReminders(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      item.item_name.toLowerCase().includes(q) ||
      item.serial_number?.toLowerCase().includes(q) ||
      item.asset_tag?.toLowerCase().includes(q) ||
      item.location?.toLowerCase().includes(q) ||
      item.po_number?.toLowerCase().includes(q) ||
      item.vendor_name?.toLowerCase().includes(q) ||
      item.facility_name?.toLowerCase().includes(q);

    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesClassification =
      classificationFilter === 'all' || item.classification === classificationFilter;

    return matchesSearch && matchesCategory && matchesClassification;
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const filteredRequests = requests.filter((r) => {
    if (requestStatusFilter !== 'all') {
      if (requestStatusFilter === 'overdue') {
        const isOver =
          r.status === 'overdue' ||
          (r.status === 'issued' && r.expected_return_date && r.expected_return_date.split('T')[0] < todayStr);
        if (!isOver) return false;
      } else if (r.status !== requestStatusFilter) {
        return false;
      }
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        r.item_name?.toLowerCase().includes(q) ||
        r.requester_name?.toLowerCase().includes(q) ||
        r.purpose?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (!hasPermission('edit_inventory')) {
    return <Navigate to="/dashboard" replace />;
  }

  const pendingRequestsCount = requests.filter((r) => r.status === 'pending').length;
  const overdueRequestsCount = requests.filter(
    (r) =>
      r.status === 'overdue' ||
      (r.status === 'issued' && r.expected_return_date && r.expected_return_date.split('T')[0] < todayStr)
  ).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Inventory Administration"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleTriggerReturnReminders}
              disabled={triggeringReminders}
              leftIcon={<Bell className="w-4 h-4 text-amber-500" />}
            >
              {triggeringReminders ? 'Checking...' : 'Check Return Reminders'}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setEditingItem(null);
                setShowModal(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Item
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center space-x-1 border-b border-gray-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'catalog'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          Catalog Management ({items.length})
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'requests'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          Requests & Loan Processing
          {pendingRequestsCount > 0 && (
            <span className="px-1.5 py-0.5 text-[11px] rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold">
              {pendingRequestsCount}
            </span>
          )}
          {overdueRequestsCount > 0 && (
            <span className="px-1.5 py-0.5 text-[11px] rounded-full bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 font-bold">
              {overdueRequestsCount} Overdue
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 flex items-start text-sm">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl border bg-green-50 dark:bg-emerald-950/40 border-green-200 dark:border-emerald-800 text-green-800 dark:text-emerald-300 flex items-start text-sm">
          <Check className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          {success}
        </div>
      )}

      {/* CATALOG TAB */}
      {activeTab === 'catalog' && (
        <>
          <FilterBar
            searchValue={searchTerm}
            onSearchChange={(e) => setSearchTerm(e.target.value)}
            onSearchClear={() => setSearchTerm('')}
            searchPlaceholder="Search catalog items, PO number, location..."
          >
            <div className="w-full sm:w-48">
              <Select
                value={classificationFilter}
                onChange={(e) => {
                  setClassificationFilter(e.target.value as any);
                  setCategoryFilter('all');
                }}
              >
                <option value="all">All Classifications</option>
                <option value="Equipment">Equipment (Reusable)</option>
                <option value="Consumables">Consumables (Chemicals/Materials)</option>
              </Select>
            </div>

            <div className="w-full sm:w-48">
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {classificationFilter === 'all' ? (
                  <>
                    <optgroup label="Consumables">
                      {CONSUMABLE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Equipment">
                      {EQUIPMENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </optgroup>
                  </>
                ) : (
                  getCategoriesForClassification(classificationFilter as any).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))
                )}
              </Select>
            </div>

            <div className="text-xs text-gray-500 dark:text-slate-400 sm:ml-auto">
              Showing <strong>{filteredItems.length}</strong> items
            </div>
          </FilterBar>

          <TableContainer>
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Item & Classification</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location & Facility</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>PO / Vendor</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Actions</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <TableCell colSpan={8} className="py-12 text-center text-gray-500 dark:text-slate-400">
                      No inventory items found
                    </TableCell>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                            {item.item_name}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                item.classification === 'Consumables'
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                  : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                              }`}
                            >
                              {item.classification || 'Equipment'}
                            </span>
                          </div>
                          {item.asset_tag && (
                            <div className="text-xs text-gray-400 dark:text-slate-500 font-mono">Tag: {item.asset_tag}</div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="capitalize text-gray-700 dark:text-slate-300 text-xs font-medium">
                          {item.category}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          <div className="font-medium text-gray-900 dark:text-slate-100">{item.location || 'Main Lab'}</div>
                          {item.facility_name && (
                            <div className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1 text-[11px]">
                              <Building2 className="w-3 h-3" />
                              {item.facility_name}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <span
                          className={`font-bold text-sm ${
                            item.quantity === 0
                              ? 'text-red-600 dark:text-red-400'
                              : item.quantity < 5
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-gray-900 dark:text-slate-100'
                          }`}
                        >
                          {item.quantity}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs">
                          {item.assigned_to_user_id || item.assigned_to_name ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-medium">
                              Assigned: {item.assigned_to_name || 'User'}
                            </span>
                          ) : (
                            <span className="text-gray-400">Available</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs space-y-0.5 text-gray-600 dark:text-slate-400">
                          {item.po_number && <div className="font-mono text-[11px]">PO: {item.po_number}</div>}
                          {item.vendor_name && <div className="truncate max-w-[120px]">{item.vendor_name}</div>}
                          {!item.po_number && !item.vendor_name && <span className="text-gray-400">-</span>}
                        </div>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={item.condition} size="sm" />
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {item.quantity > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAssigningItem(item)}
                              leftIcon={<UserCheck className="w-3.5 h-3.5 text-blue-600" />}
                            >
                              Assign
                            </Button>
                          )}
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition"
                            title="Edit Item Specifications"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition"
                            title="Delete Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* REQUESTS & PROCESSING TAB */}
      {activeTab === 'requests' && (
        <>
          <FilterBar
            searchValue={searchTerm}
            onSearchChange={(e) => setSearchTerm(e.target.value)}
            onSearchClear={() => setSearchTerm('')}
            searchPlaceholder="Search requests by item, user, purpose..."
          >
            <div className="w-full sm:w-56">
              <Select value={requestStatusFilter} onChange={(e) => setRequestStatusFilter(e.target.value)}>
                <option value="all">All Request Statuses</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved (Awaiting Issue)</option>
                <option value="issued">Issued / Active Loan</option>
                <option value="overdue">Overdue for Return</option>
                <option value="returned">Completed Returns</option>
                <option value="rejected">Rejected</option>
              </Select>
            </div>

            <div className="text-xs text-gray-500 dark:text-slate-400 sm:ml-auto">
              Showing <strong>{filteredRequests.length}</strong> requests
            </div>
          </FilterBar>

          <TableContainer>
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Request Date & User</TableHead>
                  <TableHead>Item Details</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Returnability</TableHead>
                  <TableHead>Return Due / Actual</TableHead>
                  <TableHead>Process Actions</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <tr>
                    <TableCell colSpan={8} className="py-12 text-center text-gray-500 dark:text-slate-400">
                      No requests match filter
                    </TableCell>
                  </tr>
                ) : (
                  filteredRequests.map((req) => {
                    const isDueToday =
                      req.status === 'issued' &&
                      req.expected_return_date &&
                      req.expected_return_date.split('T')[0] === todayStr;
                    const isOverdue =
                      req.status === 'overdue' ||
                      (req.status === 'issued' &&
                        req.expected_return_date &&
                        req.expected_return_date.split('T')[0] < todayStr);

                    return (
                      <TableRow key={req.id}>
                        <TableCell>
                          <div className="text-xs">
                            <div className="font-semibold text-gray-900 dark:text-slate-100">
                              {req.requester_name || 'User'}
                            </div>
                            <div className="text-gray-400 dark:text-slate-500">
                              {new Date(req.request_date).toLocaleDateString()}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs">
                            <div className="font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                              {req.item_name}
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                                  req.classification === 'Consumables'
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                    : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                                }`}
                              >
                                {req.classification || 'Item'}
                              </span>
                            </div>
                            {req.location && (
                              <div className="text-gray-400 dark:text-slate-500">Loc: {req.location}</div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <span className="font-bold text-gray-900 dark:text-slate-100 text-sm">
                            {req.quantity}
                          </span>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs text-gray-600 dark:text-slate-300 max-w-[160px] truncate" title={req.purpose || ''}>
                            {req.purpose || '-'}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs">
                            {req.status === 'pending' && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold">
                                Pending
                              </span>
                            )}
                            {req.status === 'approved' && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold">
                                Approved
                              </span>
                            )}
                            {req.status === 'issued' && !isOverdue && !isDueToday && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-semibold">
                                Issued
                              </span>
                            )}
                            {isDueToday && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold animate-pulse">
                                Due Today
                              </span>
                            )}
                            {isOverdue && (
                              <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 font-bold">
                                Overdue
                              </span>
                            )}
                            {req.status === 'returned' && (
                              <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-semibold">
                                Returned
                              </span>
                            )}
                            {req.status === 'rejected' && (
                              <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 font-semibold">
                                Rejected
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs">
                            {req.status === 'issued' || req.status === 'returned' || req.status === 'overdue' ? (
                              req.is_returnable ? (
                                <span className="text-blue-700 dark:text-blue-300 font-medium">Returnable Loan</span>
                              ) : (
                                <span className="text-amber-700 dark:text-amber-300 font-medium">Non-returnable</span>
                              )
                            ) : (
                              <span className="text-gray-400">TBD on issue</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            {req.expected_return_date && (
                              <div>
                                <span className="text-gray-400">Due:</span>{' '}
                                <span className={isOverdue ? 'font-bold text-red-600 dark:text-red-400' : ''}>
                                  {req.expected_return_date.split('T')[0]}
                                </span>
                              </div>
                            )}
                            {req.actual_return_date && (
                              <div>
                                <span className="text-gray-400">Returned:</span>{' '}
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  {req.actual_return_date.split('T')[0]} ({req.returned_condition || 'good'})
                                </span>
                              </div>
                            )}
                            {!req.expected_return_date && !req.actual_return_date && (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {req.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(req.id)}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
                                  title="Approve Request"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleReject(req.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                                  title="Reject Request"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {(req.status === 'approved' || req.status === 'pending') && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setIssuingRequest(req)}
                                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                              >
                                Issue
                              </Button>
                            )}

                            {(req.status === 'issued' || req.status === 'overdue') && req.is_returnable && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setReturningRequest(req)}
                                leftIcon={<RotateCcw className="w-3.5 h-3.5 text-purple-600" />}
                              >
                                Return
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Add / Edit Inventory Modal */}
      <InventoryItemModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingItem(null);
        }}
        onSuccess={() => {
          setSuccess(editingItem ? 'Item updated successfully' : 'Item added successfully');
          fetchItems();
          fetchRequests();
        }}
        editingItem={editingItem}
        facilities={facilities}
        users={users}
      />

      {/* Equipment Direct Assignment Modal */}
      {assigningItem && (
        <EquipmentAssignModal
          item={assigningItem}
          users={users}
          onClose={() => setAssigningItem(null)}
          onSuccess={() => {
            setAssigningItem(null);
            setSuccess('Equipment assigned successfully! Both borrower and assigner have been notified.');
            fetchItems();
            fetchRequests();
          }}
        />
      )}

      {/* Issue Modal */}
      {issuingRequest && (
        <InventoryIssueModal
          request={issuingRequest}
          onClose={() => setIssuingRequest(null)}
          onSuccess={() => {
            setIssuingRequest(null);
            setSuccess('Item successfully issued and recorded in inventory history.');
            fetchItems();
            fetchRequests();
          }}
        />
      )}

      {/* Return Modal */}
      {returningRequest && (
        <InventoryReturnModal
          request={returningRequest}
          onClose={() => setReturningRequest(null)}
          onSuccess={() => {
            setReturningRequest(null);
            setSuccess('Equipment return processed and item returned to available stock.');
            fetchItems();
            fetchRequests();
          }}
        />
      )}
    </div>
  );
}
