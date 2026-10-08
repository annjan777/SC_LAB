import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  Package,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  RotateCcw,
  Clock,
  Send,
  Bell,
  Check,
  XCircle,
  FileText,
  UserCheck
} from 'lucide-react';
import {
  InventoryItem,
  InventoryRequest,
  CONSUMABLE_CATEGORIES,
  EQUIPMENT_CATEGORIES,
  getCategoriesForClassification,
} from '../types/inventory';
import ItemDetailModal from '../components/ItemDetailModal';
import InventoryRequestModal from '../components/InventoryRequestModal';
import InventoryIssueModal from '../components/InventoryIssueModal';
import InventoryReturnModal from '../components/InventoryReturnModal';
import InventoryItemModal from '../components/InventoryItemModal';
import EquipmentAssignModal from '../components/EquipmentAssignModal';
import {
  PageHeader,
  Button,
  FilterBar,
  Select,
  TableContainer,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  StatusBadge,
  EmptyState,
} from '../components/ui';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
}

export default function InventoryPage() {
  const { profile, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'catalog' | 'requests'>('catalog');

  // Inventory Catalog State
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [facilities, setFacilities] = useState<Array<{ id: string; name: string; location: string }>>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [classificationFilter, setClassificationFilter] = useState<'all' | 'Equipment' | 'Consumables'>('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Requests State
  const [requests, setRequests] = useState<InventoryRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<InventoryRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestStatusFilter, setRequestStatusFilter] = useState('all');

  // Modals
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [assigningItem, setAssigningItem] = useState<InventoryItem | null>(null);

  // Workflow Modals
  const [requestingItem, setRequestingItem] = useState<InventoryItem | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [issuingRequest, setIssuingRequest] = useState<InventoryRequest | null>(null);
  const [returningRequest, setReturningRequest] = useState<InventoryRequest | null>(null);
  const [triggeringReminders, setTriggeringReminders] = useState(false);

  const isManager =
    hasPermission('manage_inventory_requests') ||
    profile?.user_role === 'admin' ||
    profile?.user_role === 'super_admin' ||
    profile?.user_role === 'lab_manager';

  const canCreateInventory = hasPermission('create_inventory');
  const canEditInventory = hasPermission('edit_inventory');
  const canDeleteInventory = hasPermission('delete_inventory');

  useEffect(() => {
    fetchInventory();
    fetchUsers();
    fetchRequests();
  }, []);

  useEffect(() => {
    filterItems();
  }, [items, searchTerm, categoryFilter, classificationFilter]);

  useEffect(() => {
    filterRequests();
  }, [requests, requestStatusFilter, searchTerm]);

  const fetchInventory = async () => {
    setLoading(true);
    const [invRes, facRes] = await Promise.all([
      api.get('/api/inventory', { order: 'created_at', ascending: 'false' }),
      api.get('/api/facilities'),
    ]);

    if (invRes.data) {
      setItems(invRes.data);
    }
    if (invRes.error) {
      showMessage('error', 'Failed to load inventory');
    }
    if (facRes.data && Array.isArray(facRes.data)) {
      setFacilities(facRes.data);
    }
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data } = await api.get('/api/users', { order: 'full_name' });
    if (data) {
      setUsers(data);
    }
  };

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const { data, error } = await api.get('/api/inventory/requests');
      if (error) {
        console.error('Error fetching inventory requests:', error);
      } else if (Array.isArray(data)) {
        setRequests(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const filterItems = () => {
    let filtered = items;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.item_name.toLowerCase().includes(q) ||
          item.serial_number?.toLowerCase().includes(q) ||
          item.asset_tag?.toLowerCase().includes(q) ||
          item.location?.toLowerCase().includes(q) ||
          item.po_number?.toLowerCase().includes(q) ||
          item.vendor_name?.toLowerCase().includes(q) ||
          item.facility_name?.toLowerCase().includes(q)
      );
    }

    if (classificationFilter !== 'all') {
      filtered = filtered.filter((item) => item.classification === classificationFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter((item) => item.category === categoryFilter);
    }

    setFilteredItems(filtered);
  };

  const filterRequests = () => {
    let filtered = requests;

    if (requestStatusFilter !== 'all') {
      if (requestStatusFilter === 'overdue') {
        const todayStr = new Date().toISOString().split('T')[0];
        filtered = filtered.filter(
          (r) =>
            r.status === 'overdue' ||
            (r.status === 'issued' && r.expected_return_date && r.expected_return_date.split('T')[0] < todayStr)
        );
      } else {
        filtered = filtered.filter((r) => r.status === requestStatusFilter);
      }
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.item_name?.toLowerCase().includes(q) ||
          r.requester_name?.toLowerCase().includes(q) ||
          r.purpose?.toLowerCase().includes(q)
      );
    }

    setFilteredRequests(filtered);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setShowEditModal(true);
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setShowEditModal(true);
    setShowDetailModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const { error } = await api.delete('/api/inventory/' + id);
      if (error) throw error;
      showMessage('success', 'Item deleted successfully');
      setShowDetailModal(false);
      fetchInventory();
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to delete item');
    }
  };

  // Workflow Handlers
  const handleApproveRequest = async (requestId: string) => {
    try {
      const { error } = await api.put(`/api/inventory/requests/${requestId}/approve`, {});
      if (error) throw error;
      showMessage('success', 'Request approved. Ready for issue.');
      fetchRequests();
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to approve request');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    const reason = prompt('Please provide a reason for rejection:');
    if (reason === null) return;

    try {
      const { error } = await api.put(`/api/inventory/requests/${requestId}/reject`, {
        rejection_reason: reason,
      });
      if (error) throw error;
      showMessage('success', 'Request rejected.');
      fetchRequests();
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to reject request');
    }
  };

  const handleTriggerReturnReminders = async () => {
    setTriggeringReminders(true);
    try {
      const { data, error } = await api.post('/api/inventory/requests/trigger-reminders', {});
      if (error) throw error;
      showMessage(
        'success',
        `Return reminder check complete: ${data.dueTodayCount} due today, ${data.overdueCount} overdue.`
      );
      fetchRequests();
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to trigger reminders');
    } finally {
      setTriggeringReminders(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const pendingRequestsCount = requests.filter((r) => r.status === 'pending').length;
  const overdueRequestsCount = requests.filter(
    (r) =>
      r.status === 'overdue' ||
      (r.status === 'issued' && r.expected_return_date && r.expected_return_date.split('T')[0] < todayStr)
  ).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Lab Inventory & Resources"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRequestingItem(null);
                setShowRequestModal(true);
              }}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Request Item
            </Button>
            {isManager && (
              <Button
                variant="outline"
                onClick={handleTriggerReturnReminders}
                disabled={triggeringReminders}
                leftIcon={<Bell className="w-4 h-4 text-amber-500" />}
                title="Send return reminder notifications and emails for items due today or overdue"
              >
                {triggeringReminders ? 'Checking...' : 'Check Return Reminders'}
              </Button>
            )}
            {canCreateInventory && (
              <Button variant="primary" onClick={handleAddNew} leftIcon={<Plus className="w-4 h-4" />}>
                Add Item
              </Button>
            )}
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
          Inventory Catalog ({items.length})
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
          Requests & Loans History
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

      {message && (
        <div
          className={`p-4 rounded-xl border flex items-start text-sm ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-emerald-950/40 border-green-200 dark:border-emerald-800 text-green-800 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
          }`}
        >
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          {message.text}
        </div>
      )}

      {/* TAB 1: CATALOG */}
      {activeTab === 'catalog' && (
        <>
          <FilterBar
            searchValue={searchTerm}
            onSearchChange={(e) => setSearchTerm(e.target.value)}
            onSearchClear={() => setSearchTerm('')}
            searchPlaceholder="Search by name, PO number, vendor, location..."
          >
            {/* Classification Filter */}
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

            {/* Category Filter */}
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
              Showing <strong>{filteredItems.length}</strong> of <strong>{items.length}</strong> items
            </div>
          </FilterBar>

          <TableContainer>
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Item & Classification</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location & Facility</TableHead>
                  <TableHead>Stock / Qty</TableHead>
                  <TableHead>Status / Assignment</TableHead>
                  <TableHead>PO & Vendor</TableHead>
                  <TableHead>Actions</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <TableCell colSpan={7} className="py-12 text-center text-gray-500 dark:text-slate-400">
                      {searchTerm || categoryFilter !== 'all' || classificationFilter !== 'all'
                        ? 'No items match your filter criteria'
                        : 'No inventory items found'}
                    </TableCell>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id} className="cursor-pointer" onClick={() => setSelectedItem(item)}>
                      <TableCell>
                        <div className="flex items-center">
                          <Package className="w-5 h-5 text-gray-400 dark:text-slate-500 mr-3 shrink-0" />
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                              {item.item_name}
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                  item.classification === 'Consumables'
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                    : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                                }`}
                              >
                                {item.classification || 'Equipment'}
                              </span>
                            </div>
                            {item.asset_tag && (
                              <div className="text-xs text-gray-400 dark:text-slate-500 font-mono">
                                Tag: {item.asset_tag}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="capitalize text-gray-700 dark:text-slate-300 text-xs font-medium">
                          {item.category}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          <div className="font-medium text-gray-900 dark:text-slate-100 flex items-center gap-1">
                            {item.location || 'Main Lab'}
                          </div>
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
                              Assigned: {item.assigned_to_name || 'Lab Member'}
                            </span>
                          ) : (
                            <StatusBadge status={item.condition} size="sm" />
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

                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          {/* Direct Assignment / Issue for Managers */}
                          {isManager && item.quantity > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAssigningItem(item)}
                              leftIcon={<UserCheck className="w-3.5 h-3.5 text-blue-600" />}
                              title="Assign equipment or issue item directly to a user"
                            >
                              Assign
                            </Button>
                          )}

                          {/* Request Button */}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setRequestingItem(item);
                              setShowRequestModal(true);
                            }}
                            title="Submit request for this item"
                          >
                            Request
                          </Button>

                          {canEditInventory && (
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded transition"
                              title="Edit item"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {canDeleteInventory && (
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded transition"
                              title="Delete item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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

      {/* TAB 2: REQUESTS & LOAN HISTORY */}
      {activeTab === 'requests' && (
        <>
          <FilterBar
            searchValue={searchTerm}
            onSearchChange={(e) => setSearchTerm(e.target.value)}
            onSearchClear={() => setSearchTerm('')}
            searchPlaceholder="Search by item, requester name, purpose..."
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
              Showing <strong>{filteredRequests.length}</strong> of <strong>{requests.length}</strong> requests
            </div>
          </FilterBar>

          <TableContainer>
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>Request Date & User</TableHead>
                  <TableHead>Requested Item</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Returnability</TableHead>
                  <TableHead>Return Due / Actual</TableHead>
                  <TableHead>Actions</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <tr>
                    <TableCell colSpan={8} className="py-12 text-center text-gray-500 dark:text-slate-400">
                      No inventory requests found
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
                              {req.requester_name || 'Lab Member'}
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
                            {/* Manager Actions */}
                            {isManager && req.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApproveRequest(req.id)}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
                                  title="Approve Request"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleRejectRequest(req.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                                  title="Reject Request"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {isManager && (req.status === 'approved' || req.status === 'pending') && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setIssuingRequest(req)}
                                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                              >
                                Issue
                              </Button>
                            )}

                            {isManager && (req.status === 'issued' || req.status === 'overdue') && req.is_returnable && (
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

      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEdit={() => handleEdit(selectedItem)}
          onDelete={() => handleDelete(selectedItem.id)}
          canEdit={canEditInventory}
          canDelete={canDeleteInventory}
          onAssign={() => setAssigningItem(selectedItem)}
        />
      )}

      {/* Submit Request Modal */}
      {showRequestModal && (
        <InventoryRequestModal
          item={requestingItem}
          items={items}
          onClose={() => {
            setShowRequestModal(false);
            setRequestingItem(null);
          }}
          onSuccess={() => {
            setShowRequestModal(false);
            setRequestingItem(null);
            showMessage('success', 'Inventory request submitted successfully!');
            fetchRequests();
          }}
        />
      )}

      {/* Issue Processing Modal */}
      {issuingRequest && (
        <InventoryIssueModal
          request={issuingRequest}
          onClose={() => setIssuingRequest(null)}
          onSuccess={() => {
            setIssuingRequest(null);
            showMessage('success', 'Item successfully issued and recorded.');
            fetchInventory();
            fetchRequests();
          }}
        />
      )}

      {/* Return Processing Modal */}
      {returningRequest && (
        <InventoryReturnModal
          request={returningRequest}
          onClose={() => setReturningRequest(null)}
          onSuccess={() => {
            setReturningRequest(null);
            showMessage('success', 'Equipment return recorded and stock released.');
            fetchInventory();
            fetchRequests();
          }}
        />
      )}

      {/* Add / Edit Inventory Item Modal */}
      <InventoryItemModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingItem(null);
        }}
        onSuccess={() => {
          showMessage('success', editingItem ? 'Item updated successfully' : 'Item added successfully');
          fetchInventory();
          fetchRequests();
        }}
        editingItem={editingItem}
        facilities={facilities}
        users={users}
      />

      {/* Equipment Assignment Modal */}
      {assigningItem && (
        <EquipmentAssignModal
          item={assigningItem}
          users={users}
          onClose={() => setAssigningItem(null)}
          onSuccess={() => {
            setAssigningItem(null);
            showMessage('success', 'Equipment assigned successfully! Notifications sent to borrower and assigner.');
            fetchInventory();
            fetchRequests();
          }}
        />
      )}
    </div>
  );
}
