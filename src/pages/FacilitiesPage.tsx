import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Warehouse, Search, Filter, User, Image as ImageIcon, Plus, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import FacilityDetailModal from '../components/FacilityDetailModal';
import FacilityFormModal from '../components/FacilityFormModal';
import { useAuth } from '../contexts/AuthContext';

interface FacilityItem {
  id: string;
  name: string;
  make_model: string | null;
  specifications: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  location: string | null;
  status: string | null;
  assigned_to_user_id: string | null;
  warranty_end_date: string | null;
  last_maintenance_date: string | null;
  user_manual_url: string | null;
  vendor_name: string | null;
  vendor_contact: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  assigned_user?: {
    full_name: string;
    email: string;
  };
}

export default function FacilitiesPage() {
  const { hasPermission } = useAuth();
  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [filteredFacilities, setFilteredFacilities] = useState<FacilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedFacility, setSelectedFacility] = useState<FacilityItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingFacility, setEditingFacility] = useState<FacilityItem | null>(null);
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

  const handleCardClick = (facility: FacilityItem) => {
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

  const handleEdit = (facility: FacilityItem) => {
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
    <div className="max-w-7xl mx-auto">
      {message && (
        <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            {message.text}
          </div>
        </div>
      )}

      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lab Facilities</h1>
          <p className="text-gray-600 mt-2">Browse all available lab facilities and equipment</p>
        </div>
        {canCreateFacilities && (
          <button
            onClick={handleAddNew}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            <span>Add Facility</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, model, location, vendor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
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
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center space-x-4 text-sm text-gray-600">
          <span>
            Showing <strong>{filteredFacilities.length}</strong> of <strong>{facilities.length}</strong> facilities
          </span>
        </div>
      </div>

      {filteredFacilities.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Warehouse className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm || statusFilter !== 'all' ? 'No Facilities Found' : 'No Facilities Available'}
          </h3>
          <p className="text-gray-600">
            {searchTerm || statusFilter !== 'all'
              ? 'No facilities match your search criteria. Try adjusting your filters.'
              : 'There are currently no facilities available to view.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFacilities.map((facility) => (
            <div
              key={facility.id}
              className="group bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer"
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

              <div className="p-5">
                <h3 className="text-lg font-bold text-gray-900 mb-1 truncate">
                  {facility.name}
                </h3>
                {facility.make_model && (
                  <p className="text-sm text-gray-600 mb-3 truncate">
                    {facility.make_model}
                  </p>
                )}

                <div className="space-y-2">
                  {facility.location && (
                    <div className="flex items-center text-sm text-gray-700">
                      <Warehouse className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{facility.location}</span>
                    </div>
                  )}

                  <div className="flex items-center text-sm text-gray-700">
                    <User className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                    <span className="truncate">
                      {facility.assigned_user?.full_name || 'Unassigned'}
                    </span>
                  </div>
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
    </div>
  );
}
