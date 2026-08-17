import { X, Edit2, Trash2, ExternalLink, User, MapPin, Package, Calendar, Phone, FileText, Wrench, Image as ImageIcon } from 'lucide-react';

interface FacilityDetailModalProps {
  facility: any;
  onClose: () => void;
  onEdit: (facility: any) => void;
  onDelete: (id: string) => void;
  showActions?: boolean;
}

export default function FacilityDetailModal({ facility, onClose, onEdit, onDelete, showActions = false }: FacilityDetailModalProps) {
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

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isWarrantyExpired = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Facility Details</h2>
          <div className="flex items-center space-x-2">
            {showActions && (
              <>
                <button
                  onClick={() => onEdit(facility)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="Edit"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onDelete(facility.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {facility.image_url && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <img
                src={facility.image_url}
                alt={facility.name}
                className="w-full max-h-96 object-contain rounded-lg"
              />
            </div>
          )}

          {!facility.image_url && (
            <div className="bg-gray-50 p-8 rounded-lg flex flex-col items-center justify-center">
              <ImageIcon className="w-16 h-16 text-gray-400 mb-2" />
              <p className="text-gray-500">No image available</p>
            </div>
          )}

          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{facility.name}</h3>
            <div className="flex items-center space-x-4">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                  facility.status
                )}`}
              >
                {getStatusLabel(facility.status)}
              </span>
              {facility.make_model && (
                <span className="text-gray-700 font-medium">{facility.make_model}</span>
              )}
            </div>
          </div>

          {facility.specifications && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-start mb-2">
                <FileText className="w-5 h-5 text-gray-600 mr-2 mt-0.5" />
                <h3 className="text-lg font-semibold text-gray-900">Specifications</h3>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap ml-7">{facility.specifications}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center mb-3">
                <Package className="w-5 h-5 text-gray-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Identification</h3>
              </div>
              <div className="space-y-2 ml-7">
                <div>
                  <p className="text-sm text-gray-600">Serial Number</p>
                  <p className="text-gray-900 font-medium">{facility.serial_number || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Asset Tag</p>
                  <p className="text-gray-900 font-medium">{facility.asset_tag || '-'}</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center mb-3">
                <MapPin className="w-5 h-5 text-gray-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Location</h3>
              </div>
              <div className="ml-7">
                <p className="text-gray-900 font-medium">{facility.location || '-'}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center mb-3">
              <User className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Managed By</h3>
            </div>
            <div className="ml-7">
              {facility.assigned_user ? (
                <div>
                  <p className="text-gray-900 font-medium">{facility.assigned_user.full_name}</p>
                  <p className="text-sm text-gray-600">{facility.assigned_user.email}</p>
                </div>
              ) : (
                <p className="text-gray-500">Unassigned</p>
              )}
            </div>
          </div>

          {(facility.vendor_name || facility.vendor_contact) && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center mb-3">
                <Phone className="w-5 h-5 text-gray-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Vendor Information</h3>
              </div>
              <div className="space-y-2 ml-7">
                {facility.vendor_name && (
                  <div>
                    <p className="text-sm text-gray-600">Vendor Name</p>
                    <p className="text-gray-900 font-medium">{facility.vendor_name}</p>
                  </div>
                )}
                {facility.vendor_contact && (
                  <div>
                    <p className="text-sm text-gray-600">Contact Number</p>
                    <p className="text-gray-900 font-medium">{facility.vendor_contact}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center mb-3">
              <Wrench className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Maintenance</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-7">
              <div>
                <p className="text-sm text-gray-600">Warranty Expiry Date</p>
                {facility.warranty_end_date ? (
                  <div>
                    <p className="text-gray-900 font-medium">{formatDate(facility.warranty_end_date)}</p>
                    {isWarrantyExpired(facility.warranty_end_date) && (
                      <p className="text-red-600 text-sm font-medium">Expired</p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500">-</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600">Last Maintenance</p>
                <p className="text-gray-900 font-medium">{formatDate(facility.last_maintenance_date)}</p>
              </div>
            </div>
          </div>

          {facility.user_manual_url && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center mb-3">
                <FileText className="w-5 h-5 text-gray-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Documentation</h3>
              </div>
              <div className="ml-7">
                <a
                  href={facility.user_manual_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View User Manual
                </a>
              </div>
            </div>
          )}

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center mb-3">
              <Calendar className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Timestamps</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-7">
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="text-gray-900 font-medium">{formatDate(facility.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="text-gray-900 font-medium">{formatDate(facility.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
