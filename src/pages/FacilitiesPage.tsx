import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Warehouse, Search, Filter, User, Image as ImageIcon, Plus, AlertCircle, Edit2, Trash2, Users, Package, Calendar } from 'lucide-react';
import FacilityDetailModal from '../components/FacilityDetailModal';
import FacilityFormModal from '../components/FacilityFormModal';
import FacilityBookingModal from '../components/FacilityBookingModal';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, Button, FilterBar, Select, EmptyState, StatusBadge } from '../components/ui';
import { Facility } from '../types/facility';

export default function FacilitiesPage() {
  const { hasPermission } = useAuth();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [filteredFacilities, setFilteredFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [bookingFacility, setBookingFacility] = useState<Facility | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canCreateFacilities = hasPermission('create_facilities');
  const canEditFacilities = hasPermission('edit_facilities');
  const canDeleteFacilities = hasPermission('delete_facilities');

  useEffect(() => {
    fetchFacilities();
  }, []);

  useEffect(() => {
    filterFacilities();
  }, [facilities, searchTerm, statusFilter]);

  const fetchFacilities = async () => {
    setLoading(true);
    const { data, error } = await api.get('/api/facilities', { order: 'created_at', ascending: 'false' });

    if (error) {
      console.error('Error fetching facilities:', error);
      showMessage('error', `Failed to load facilities: ${error.message || error}`);
      setFacilities([]);
    } else if (data) {
      setFacilities(data);
    }
    setLoading(false);
  };

  const filterFacilities = () => {
    let filtered = facilities;

    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.make_model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.asset_tag?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((item) => item.status === statusFilter);
    }

    setFilteredFacilities(filtered);
  };

  const getStatusColor = (status: string | null) => {
    const colors: Record<string, string> = {
      working: 'bg-green-100 text-green-800',
      partially_working: 'bg-yellow-100 text-yellow-800',
      not_working: 'bg-red-100 text-red-800',
      new: 'bg-green-100 text-green-800',
      good: 'bg-blue-100 text-blue-800',
      fair: 'bg-yellow-100 text-yellow-800',
      poor: 'bg-orange-100 text-orange-800',
      damaged: 'bg-red-100 text-red-800',
    };
    return status ? colors[status] || 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string | null) => {
    const labels: Record<string, string> = {
      working: 'Working',
      partially_working: 'Partially Working',
      not_working: 'Not Working',
      new: 'New',
      good: 'Good',
      fair: 'Fair',
      poor: 'Poor',
      damaged: 'Damaged',
    };
    return status ? labels[status] || status : 'N/A';
  };

  const handleCardClick = (facility: Facility) => {
    setSelectedFacility(facility);
    setShowDetailModal(true);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddNew = () => {
    setEditingFacility(null);
    setShowFormModal(true);
  };

  const handleEdit = (facility: Facility) => {
    setEditingFacility(facility);
    setShowFormModal(true);
    setShowDetailModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!canDeleteFacilities) {
      showMessage('error', 'You do not have permission to delete facilities');
      return;
    }

    if (!confirm('Are you sure you want to delete this facility?')) return;

    try {
      const { error } = await api.delete('/api/facilities/' + id);

      if (error) throw error;
      showMessage('success', 'Facility deleted successfully');
      setShowDetailModal(false);
      fetchFacilities();
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to delete facility');
    }
  };

  const handleFormSuccess = () => {
    showMessage('success', editingFacility ? 'Facility updated successfully' : 'Facility added successfully');
    setShowFormModal(false);
    setEditingFacility(null);
    fetchFacilities();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {message && (
        <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-green-50 dark:bg-emerald-950/40 border-green-200 dark:border-emerald-800 text-green-800 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'}`}>
          <div className="flex items-center text-sm">
            <AlertCircle className="w-5 h-5 mr-2" />
            {message.text}
          </div>
        </div>
      )}

      <PageHeader
        title="Lab Facilities"
        action={
          canCreateFacilities ? (
            <Button
              variant="primary"
              onClick={handleAddNew}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Facility
            </Button>
          ) : undefined
        }
      />

      <FilterBar
        searchValue={searchTerm}
        onSearchChange={(e) => setSearchTerm(e.target.value)}
        onSearchClear={() => setSearchTerm('')}
        searchPlaceholder="Search by name, model, location, vendor..."
      >
        <div className="w-full sm:w-56">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="working">Working</option>
            <option value="partially_working">Partially Working</option>
            <option value="not_working">Not Working</option>
            <option value="new">New</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
            <option value="damaged">Damaged</option>
          </Select>
        </div>
        <div className="text-xs text-gray-500 dark:text-slate-400 sm:ml-auto">
          Showing <strong>{filteredFacilities.length}</strong> of <strong>{facilities.length}</strong> facilities
        </div>
      </FilterBar>

      {filteredFacilities.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title={searchTerm || statusFilter !== 'all' ? 'No Facilities Found' : 'No Facilities Available'}
          description={
            searchTerm || statusFilter !== 'all'
              ? 'No facilities match your search criteria. Try adjusting your filters.'
              : 'There are currently no facilities available to view.'
          }
          actionText={canCreateFacilities && !searchTerm && statusFilter === 'all' ? 'Add Facility' : undefined}
          onAction={canCreateFacilities && !searchTerm && statusFilter === 'all' ? handleAddNew : undefined}
          actionIcon={<Plus className="w-4 h-4" />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFacilities.map((facility) => (
            <div
              key={facility.id}
              className="group bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden hover:shadow-lg hover:border-blue-500/50 transition-all duration-200 cursor-pointer"
              onClick={() => handleCardClick(facility)}
            >
              <div className="relative h-60 bg-gray-100 overflow-hidden">
                {facility.image_url ? (
                  <img
                    src={facility.image_url}
                    alt={facility.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-gray-400" />
                  </div>
                )}

                <div className="absolute top-3 right-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${getStatusColor(
                      facility.status
                    )}`}
                  >
                    {getStatusLabel(facility.status)}
                  </span>
                </div>

                {(canEditFacilities || canDeleteFacilities) && (
                  <div
                    className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canEditFacilities && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(facility);
                        }}
                        className="p-3 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition shadow-lg transform translate-y-2 group-hover:translate-y-0"
                        title="Edit Facility"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                    )}
                    {canDeleteFacilities && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(facility.id);
                        }}
                        className="p-3 bg-white text-red-600 rounded-lg hover:bg-red-50 transition shadow-lg transform translate-y-2 group-hover:translate-y-0"
                        title="Delete Facility"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-1 truncate">
                    {facility.name}
                  </h3>
                  {facility.make_model && (
                    <p className="text-sm text-gray-600 dark:text-slate-400 mb-3 truncate">
                      {facility.make_model}
                    </p>
                  )}

                  <div className="space-y-2 text-sm text-gray-700 dark:text-slate-300">
                    {facility.location && (
                      <div className="flex items-center">
                        <Warehouse className="w-4 h-4 mr-2 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                        <span className="truncate">{facility.location}</span>
                      </div>
                    )}

                    {facility.capacity && (
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-2 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                        <span>Capacity: {facility.capacity} seats</span>
                      </div>
                    )}

                    {facility.linked_equipment_count !== undefined && facility.linked_equipment_count > 0 && (
                      <div className="flex items-center">
                        <Package className="w-4 h-4 mr-2 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                        <span>{facility.linked_equipment_count} equipment linked</span>
                      </div>
                    )}

                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-2 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                      <span className="truncate">
                        {facility.assigned_user?.full_name || 'Unassigned'}
                      </span>
                    </div>
                  </div>

                  {facility.features && facility.features.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-3">
                      {facility.features.slice(0, 3).map((feat, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700"
                        >
                          {feat}
                        </span>
                      ))}
                      {facility.features.length > 3 && (
                        <span className="text-[11px] text-gray-500 dark:text-slate-400 self-center">
                          +{facility.features.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div
                  className="pt-4 mt-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                    View Details →
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBookingFacility(facility);
                    }}
                    leftIcon={<Calendar className="w-3.5 h-3.5" />}
                  >
                    Book Space
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDetailModal && selectedFacility && (
        <FacilityDetailModal
          facility={selectedFacility}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedFacility(null);
          }}
          onEdit={handleEdit}
          onDelete={handleDelete}
          showActions={canEditFacilities || canDeleteFacilities}
        />
      )}

      {showFormModal && (
        <FacilityFormModal
          facility={editingFacility}
          onClose={() => {
            setShowFormModal(false);
            setEditingFacility(null);
          }}
          onSuccess={handleFormSuccess}
        />
      )}

      {bookingFacility && (
        <FacilityBookingModal
          facility={bookingFacility}
          onClose={() => setBookingFacility(null)}
          onSuccess={() => {
            setBookingFacility(null);
            showMessage('success', 'Facility booked successfully!');
            fetchFacilities();
          }}
        />
      )}
    </div>
  );
}
