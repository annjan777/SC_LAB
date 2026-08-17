import { X, Edit2, Trash2, User, Calendar, Package, MapPin, AlertCircle } from 'lucide-react';

interface InventoryItem {
  id: string;
  item_name: string;
  category: string;
  serial_number: string | null;
  asset_tag: string | null;
  quantity: number;
  location: string | null;
  condition: 'new' | 'good' | 'fair' | 'poor' | 'damaged';
  warranty_end_date: string | null;
  last_maintenance_date: string | null;
  assigned_to_user_id: string | null;
  purchase_request_id: string | null;
  created_at: string;
  updated_at: string;
  assigned_user?: {
    full_name: string;
    email: string;
  };
}

interface ItemDetailModalProps {
  item: InventoryItem;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

export default function ItemDetailModal({ item, onClose, onEdit, onDelete, canDelete }: ItemDetailModalProps) {
  const getConditionColor = (condition: string) => {
    const colors: Record<string, string> = {
      new: 'bg-green-100 text-green-800',
      good: 'bg-blue-100 text-blue-800',
      fair: 'bg-yellow-100 text-yellow-800',
      poor: 'bg-orange-100 text-orange-800',
      damaged: 'bg-red-100 text-red-800',
    };
    return colors[condition] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">{item.item_name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            title="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Basic Information
                </h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-600">Category:</span>
                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                      {item.category}
                    </span>
                  </div>
                  {item.serial_number && (
                    <div>
                      <span className="text-sm text-gray-600">Serial Number:</span>
                      <span className="ml-2 text-sm font-medium text-gray-900">{item.serial_number}</span>
                    </div>
                  )}
                  {item.asset_tag && (
                    <div>
                      <span className="text-sm text-gray-600">Asset Tag:</span>
                      <span className="ml-2 text-sm font-medium text-gray-900">{item.asset_tag}</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Inventory Details
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Quantity:</span>
                    <span className={`ml-auto text-sm font-bold ${item.quantity < 10 ? 'text-red-600' : 'text-gray-900'}`}>
                      {item.quantity}
                      {item.quantity < 10 && item.category === 'consumable' && (
                        <span className="ml-2 text-xs text-red-600">(Low Stock)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Location:</span>
                    <span className="ml-auto text-sm text-gray-900">{item.location || 'Not specified'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Condition:</span>
                    <span className={`ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConditionColor(item.condition)}`}>
                      {item.condition}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {item.assigned_user && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Assignment
                  </h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <User className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.assigned_user.full_name}</p>
                        <p className="text-xs text-gray-600">{item.assigned_user.email}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Dates
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Warranty Ends:</span>
                    <span className="ml-auto text-sm text-gray-900">{formatDate(item.warranty_end_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Last Maintenance:</span>
                    <span className="ml-auto text-sm text-gray-900">{formatDate(item.last_maintenance_date)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Metadata
                </h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-600">Created:</span>
                    <span className="ml-2 text-sm text-gray-900">{formatDate(item.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Last Updated:</span>
                    <span className="ml-2 text-sm text-gray-900">{formatDate(item.updated_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
          <div>
            {canDelete && (
              <button
                onClick={onDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2 transition"
              >
                <Trash2 className="h-4 w-4" />
                Delete Item
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition"
            >
              Close
            </button>
            <button
              onClick={onEdit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 transition"
            >
              <Edit2 className="h-4 w-4" />
              Edit Item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
