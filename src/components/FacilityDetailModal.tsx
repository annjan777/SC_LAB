import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  Edit2,
  Trash2,
  ExternalLink,
  User,
  MapPin,
  Package,
  Calendar,
  Phone,
  FileText,
  Wrench,
  Image as ImageIcon,
  Users,
  Clock,
  Plus,
  Unlink,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Facility, FacilityLinkedEquipment, FacilityBooking } from '../types/facility';
import { Button, StatusBadge } from './ui';
import FacilityBookingModal from './FacilityBookingModal';

interface FacilityDetailModalProps {
  facility: Facility;
  onClose: () => void;
  onEdit: (facility: Facility) => void;
  onDelete: (id: string) => void;
  showActions?: boolean;
}

export default function FacilityDetailModal({
  facility,
  onClose,
  onEdit,
  onDelete,
  showActions = false,
}: FacilityDetailModalProps) {
  const { profile, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'equipment' | 'bookings'>('overview');
  
  // Linked equipment state
  const [linkedEquipment, setLinkedEquipment] = useState<FacilityLinkedEquipment[]>(facility.linked_equipment || []);
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  
  // Available equipment for linking (managers only)
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [availableInventory, setAvailableInventory] = useState<any[]>([]);
  const [selectedItemIdToLink, setSelectedItemIdToLink] = useState('');
  const [linking, setLinking] = useState(false);

  // Upcoming bookings state
  const [upcomingBookings, setUpcomingBookings] = useState<FacilityBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Modals for booking
  const [showFacilityBookingModal, setShowFacilityBookingModal] = useState(false);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isManager =
    hasPermission('manage_facility_bookings') ||
    profile?.user_role === 'admin' ||
    profile?.user_role === 'super_admin';

  useEffect(() => {
    fetchLinkedEquipment();
    fetchUpcomingBookings();
  }, [facility.id]);

  const showFlashMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3500);
  };

  const fetchLinkedEquipment = async () => {
    setLoadingEquipment(true);
    try {
      const { data, error } = await api.get(`/api/facilities/${facility.id}/equipment`);
      if (error) {
        console.error('Error fetching linked equipment:', error);
      } else if (Array.isArray(data)) {
        setLinkedEquipment(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEquipment(false);
    }
  };

  const fetchUpcomingBookings = async () => {
    setLoadingBookings(true);
    try {
      const { data, error } = await api.get(`/api/facilities/${facility.id}/bookings`, { upcoming: 'true' });
      if (error) {
        console.error('Error fetching upcoming bookings:', error);
      } else if (Array.isArray(data)) {
        setUpcomingBookings(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleOpenLinkModal = async () => {
    setShowLinkModal(true);
    try {
      const { data } = await api.get('/api/inventory');
      if (Array.isArray(data)) {
        // Filter items that are not already linked to this facility
        const alreadyLinkedIds = new Set(linkedEquipment.map((e) => e.id));
        setAvailableInventory(data.filter((item: any) => !alreadyLinkedIds.has(item.id)));
      }
    } catch (err) {
      console.error('Error fetching inventory for linking:', err);
    }
  };

  const handleLinkEquipment = async () => {
    if (!selectedItemIdToLink) return;
    setLinking(true);
    try {
      const { error } = await api.post(`/api/facilities/${facility.id}/equipment`, {
        inventory_item_ids: [selectedItemIdToLink],
      });
      if (error) {
        showFlashMessage('error', typeof error === 'string' ? error : 'Failed to link equipment');
      } else {
        showFlashMessage('success', 'Equipment linked to facility successfully');
        setShowLinkModal(false);
        setSelectedItemIdToLink('');
        fetchLinkedEquipment();
      }
    } catch (err: any) {
      showFlashMessage('error', err.message || 'Failed to link equipment');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkEquipment = async (itemId: string, itemName: string) => {
    if (!confirm(`Unlink "${itemName}" from this facility? The item will still remain in Inventory.`)) {
      return;
    }
    try {
      const { error } = await api.delete(`/api/facilities/${facility.id}/equipment/${itemId}`);
      if (error) {
        showFlashMessage('error', typeof error === 'string' ? error : 'Failed to unlink equipment');
      } else {
        showFlashMessage('success', 'Equipment unlinked from facility');
        fetchLinkedEquipment();
      }
    } catch (err: any) {
      showFlashMessage('error', err.message || 'Failed to unlink equipment');
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      const { error } = await api.put(`/api/facilities/bookings/${bookingId}/cancel`, {});
      if (error) {
        showFlashMessage('error', typeof error === 'string' ? error : 'Failed to cancel booking');
      } else {
        showFlashMessage('success', 'Booking cancelled successfully');
        fetchUpcomingBookings();
      }
    } catch (err: any) {
      showFlashMessage('error', err.message || 'Failed to cancel booking');
    }
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTimeRange = (startIso: string, endIso: string) => {
    const s = new Date(startIso);
    const e = new Date(endIso);
    const dateStr = s.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const startTime = s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} • ${startTime} - ${endTime}`;
  };

  const isWarrantyExpired = (date: string | null | undefined) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center z-10 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                Facility Details
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              {showActions && (
                <>
                  <button
                    onClick={() => onEdit(facility)}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition"
                    title="Edit Facility"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onDelete(facility.id)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition"
                    title="Delete Facility"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Flash message */}
          {message && (
            <div
              className={`px-6 py-3 border-b text-sm flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Top Banner / Hero */}
          <div className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-slate-800/80 bg-gray-50/50 dark:bg-slate-900/50 shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {facility.name}
                  </h3>
                  <StatusBadge status={facility.status || 'operational'} size="sm" />
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-slate-300">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <strong>Location:</strong> {facility.location}
                  </span>
                  {facility.capacity && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <strong>Capacity:</strong> {facility.capacity} persons
                    </span>
                  )}
                  {facility.project_code && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 font-mono text-[11px] border border-gray-200 dark:border-slate-700">
                      <strong>Project:</strong> {facility.project_code}
                    </span>
                  )}
                  {facility.funded_by && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] border border-emerald-200/60 dark:border-emerald-900/40 font-medium">
                      <strong>Funded By:</strong> {facility.funded_by}
                    </span>
                  )}
                  {facility.make_model && (
                    <span className="text-gray-500 dark:text-slate-400">
                      Model: {facility.make_model}
                    </span>
                  )}
                </div>

                {/* Features / Amenities Pills */}
                {facility.features && facility.features.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                    {facility.features.map((feat, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/50"
                      >
                        {feat}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Primary Action: Book Facility */}
              <div className="flex items-center gap-2 self-start md:self-center">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setShowFacilityBookingModal(true)}
                  leftIcon={<Calendar className="w-4 h-4" />}
                >
                  Book This Facility
                </Button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex space-x-6 mt-4 border-b border-gray-200 dark:border-slate-800 -mb-3">
              <button
                onClick={() => setActiveTab('overview')}
                className={`pb-3 text-xs font-semibold uppercase tracking-wider transition border-b-2 ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Overview & Specs
              </button>
              <button
                onClick={() => setActiveTab('equipment')}
                className={`pb-3 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'equipment'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                Linked Equipment ({linkedEquipment.length})
              </button>
              <button
                onClick={() => setActiveTab('bookings')}
                className={`pb-3 text-xs font-semibold uppercase tracking-wider transition border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'bookings'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Upcoming Bookings ({upcomingBookings.length})
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {facility.image_url ? (
                  <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
                    <img
                      src={facility.image_url}
                      alt={facility.name}
                      className="w-full max-h-72 object-contain rounded-lg"
                    />
                  </div>
                ) : null}

                {facility.specifications && (
                  <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
                    <div className="flex items-start mb-2">
                      <FileText className="w-5 h-5 text-gray-500 dark:text-slate-400 mr-2 mt-0.5" />
                      <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                        Specifications & Details
                      </h3>
                    </div>
                    <p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap ml-7 text-sm">
                      {typeof facility.specifications === 'object'
                        ? JSON.stringify(facility.specifications, null, 2)
                        : facility.specifications}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
                    <div className="flex items-center mb-3">
                      <Package className="w-5 h-5 text-gray-500 dark:text-slate-400 mr-2" />
                      <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                        Identification
                      </h3>
                    </div>
                    <div className="space-y-2 ml-7">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Serial Number</p>
                        <p className="text-gray-900 dark:text-slate-100 font-medium text-sm">
                          {facility.serial_number || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-slate-400">Asset Tag</p>
                        <p className="text-gray-900 dark:text-slate-100 font-medium text-sm">
                          {facility.asset_tag || '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
                    <div className="flex items-center mb-3">
                      <User className="w-5 h-5 text-gray-500 dark:text-slate-400 mr-2" />
                      <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                        Managed By
                      </h3>
                    </div>
                    <div className="ml-7">
                      {facility.assigned_user ? (
                        <div>
                          <p className="text-gray-900 dark:text-slate-100 font-medium text-sm">
                            {facility.assigned_user.full_name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            {facility.assigned_user.email}
                          </p>
                        </div>
                      ) : (
                        <p className="text-gray-500 dark:text-slate-400 text-sm">Unassigned</p>
                      )}
                    </div>
                  </div>
                </div>

                {(facility.vendor_name || facility.vendor_contact) && (
                  <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
                    <div className="flex items-center mb-3">
                      <Phone className="w-5 h-5 text-gray-500 dark:text-slate-400 mr-2" />
                      <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                        Vendor Information
                      </h3>
                    </div>
                    <div className="space-y-2 ml-7">
                      {facility.vendor_name && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-slate-400">Vendor / Manufacturer</p>
                          <p className="text-gray-900 dark:text-slate-100 font-medium text-sm">
                            {facility.vendor_name}
                          </p>
                        </div>
                      )}
                      {facility.vendor_contact && (
                        <div>
                          <p className="text-xs text-gray-500 dark:text-slate-400">Contact</p>
                          <p className="text-gray-900 dark:text-slate-100 font-medium text-sm">
                            {facility.vendor_contact}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
                  <div className="flex items-center mb-3">
                    <Wrench className="w-5 h-5 text-gray-500 dark:text-slate-400 mr-2" />
                    <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                      Maintenance & Warranty
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-7">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Warranty Expiry Date</p>
                      {facility.warranty_end_date ? (
                        <div>
                          <p className="text-gray-900 dark:text-slate-100 font-medium text-sm">
                            {formatDate(facility.warranty_end_date)}
                          </p>
                          {isWarrantyExpired(facility.warranty_end_date) && (
                            <p className="text-red-500 dark:text-red-400 text-xs font-medium">Expired</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-500 dark:text-slate-400 text-sm">-</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Last Maintenance</p>
                      <p className="text-gray-900 dark:text-slate-100 font-medium text-sm">
                        {formatDate(facility.last_maintenance_date)}
                      </p>
                    </div>
                  </div>
                </div>

                {facility.user_manual_url && (
                  <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
                    <div className="flex items-center mb-3">
                      <FileText className="w-5 h-5 text-gray-500 dark:text-slate-400 mr-2" />
                      <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                        Documentation
                      </h3>
                    </div>
                    <div className="ml-7">
                      <a
                        href={facility.user_manual_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium shadow-sm"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View User Manual
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Linked Equipment */}
            {activeTab === 'equipment' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 p-4 rounded-xl">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-slate-100">
                      Equipment Belonging to This Facility
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
                      Items can be booked individually from Inventory without booking the entire facility.
                    </p>
                  </div>
                  {isManager && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenLinkModal}
                      leftIcon={<Plus className="w-4 h-4" />}
                    >
                      Link Equipment
                    </Button>
                  )}
                </div>

                {loadingEquipment ? (
                  <div className="py-8 text-center text-sm text-gray-500">Loading equipment...</div>
                ) : linkedEquipment.length === 0 ? (
                  <div className="py-12 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl text-center p-6">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <h5 className="font-semibold text-gray-800 dark:text-slate-200 text-sm">
                      No Equipment Linked Yet
                    </h5>
                    <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                      Link items managed in Inventory (like 3D Printers, Soldering Irons, Scopes) to show them here.
                    </p>
                    {isManager && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={handleOpenLinkModal}
                        leftIcon={<Plus className="w-4 h-4" />}
                      >
                        Link First Equipment
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {linkedEquipment.map((eq) => (
                      <div
                        key={eq.id}
                        className="p-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-indigo-500/40 transition flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h5 className="font-bold text-gray-900 dark:text-slate-100 text-sm">
                              {eq.item_name}
                            </h5>
                            <StatusBadge status={eq.condition || 'good'} size="sm" />
                          </div>

                          <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-slate-400">
                            <div>
                              Category: <span className="font-medium text-gray-700 dark:text-slate-300">{eq.category}</span>
                            </div>
                            {eq.asset_tag && (
                              <div>
                                Asset Tag: <span className="font-medium text-gray-700 dark:text-slate-300">{eq.asset_tag}</span>
                              </div>
                            )}
                            <div>
                              Available Quantity: <span className="font-medium text-gray-700 dark:text-slate-300">{eq.quantity}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100 dark:border-slate-800/80">
                          {isManager && (
                            <button
                              onClick={() => handleUnlinkEquipment(eq.id, eq.item_name)}
                              className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 flex items-center gap-1"
                              title="Unlink from this facility"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                              Unlink
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Upcoming Bookings */}
            {activeTab === 'bookings' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 p-4 rounded-xl">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-slate-100">
                      Confirmed Upcoming Space Reservations
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">
                      Double-booking is strictly prohibited. The space is reserved exclusively during these hours.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowFacilityBookingModal(true)}
                    leftIcon={<Plus className="w-4 h-4" />}
                  >
                    Reserve Slot
                  </Button>
                </div>

                {loadingBookings ? (
                  <div className="py-8 text-center text-sm text-gray-500">Loading bookings...</div>
                ) : upcomingBookings.length === 0 ? (
                  <div className="py-12 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl text-center p-6">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <h5 className="font-semibold text-gray-800 dark:text-slate-200 text-sm">
                      No Upcoming Bookings
                    </h5>
                    <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                      This space is completely open for upcoming dates.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      className="mt-3"
                      onClick={() => setShowFacilityBookingModal(true)}
                      leftIcon={<Calendar className="w-4 h-4" />}
                    >
                      Book First Slot
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {upcomingBookings.map((b) => {
                      const canCancel = isManager || b.user_id === profile?.id;
                      return (
                        <div
                          key={b.id}
                          className="p-4 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-blue-600 dark:text-blue-400 text-xs bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-900/40">
                                {formatDateTimeRange(b.start_time, b.end_time)}
                              </span>
                              <StatusBadge status="confirmed" size="sm" />
                            </div>
                            <h5 className="font-bold text-gray-900 dark:text-slate-100 text-sm pt-0.5">
                              {b.title}
                            </h5>
                            {b.description && (
                              <p className="text-xs text-gray-600 dark:text-slate-400 line-clamp-1">
                                {b.description}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 dark:text-slate-400">
                              Booked by: <span className="font-medium text-gray-700 dark:text-slate-300">{b.user_name || 'Member'}</span>{' '}
                              ({b.user_email})
                            </p>
                          </div>

                          {canCancel && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 self-end sm:self-center"
                              onClick={() => handleCancelBooking(b.id)}
                            >
                              Cancel Booking
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Facility Booking Modal */}
      {showFacilityBookingModal && (
        <FacilityBookingModal
          facility={facility}
          onClose={() => setShowFacilityBookingModal(false)}
          onSuccess={() => {
            setShowFacilityBookingModal(false);
            showFlashMessage('success', 'Facility booked successfully!');
            fetchUpcomingBookings();
            setActiveTab('bookings');
          }}
        />
      )}

      {/* Link Equipment Modal (Manager only) */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Link Equipment to Facility
              </h3>
              <button
                onClick={() => setShowLinkModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-slate-400">
              Select an item from Inventory to associate with <strong>{facility.name}</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Select Inventory Item
              </label>
              <select
                value={selectedItemIdToLink}
                onChange={(e) => setSelectedItemIdToLink(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Choose an item --</option>
                {availableInventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_name} ({item.category}) - Qty: {item.quantity}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-slate-800">
              <Button variant="secondary" size="sm" onClick={() => setShowLinkModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!selectedItemIdToLink || linking}
                isLoading={linking}
                onClick={handleLinkEquipment}
              >
                Link Equipment
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
