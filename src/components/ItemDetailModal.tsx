import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  Edit2,
  Trash2,
  User,
  Calendar,
  Package,
  MapPin,
  AlertCircle,
  Building2,
  Clock,
  CheckCircle,
  Plus,
  UserCheck
} from 'lucide-react';
import { InventoryItem } from '../types/inventory';
import { Button, StatusBadge } from './ui';
import InventoryRequestModal from './InventoryRequestModal';

interface ItemDetailModalProps {
  item: InventoryItem;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit?: boolean;
  canDelete: boolean;
  onAssign?: () => void;
}

export default function ItemDetailModal({
  item,
  onClose,
  onEdit,
  onDelete,
  canEdit: canEditProp,
  canDelete,
  onAssign,
}: ItemDetailModalProps) {
  const { profile, hasPermission } = useAuth();
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [flashMessage, setFlashMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canEdit =
    canEditProp !== undefined
      ? canEditProp
      : hasPermission('edit_inventory') ||
        profile?.user_role === 'admin' ||
        profile?.user_role === 'super_admin';

  const isManager =
    hasPermission('manage_inventory_requests') ||
    profile?.user_role === 'admin' ||
    profile?.user_role === 'super_admin';

  const showFlash = (type: 'success' | 'error', text: string) => {
    setFlashMessage({ type, text });
    setTimeout(() => setFlashMessage(null), 3000);
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <Package className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                  {item.item_name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    item.classification === 'Consumables'
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                      : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                  }`}>
                    {item.classification || 'Equipment'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    Category: <strong className="text-gray-700 dark:text-slate-300">{item.category}</strong>
                  </span>
                  <StatusBadge status={item.condition} size="sm" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRequestModal(true)}
                leftIcon={<Package className="w-3.5 h-3.5" />}
              >
                Request Item
              </Button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Flash message */}
          {flashMessage && (
            <div
              className={`px-6 py-2.5 text-xs flex items-center gap-2 border-b ${
                flashMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
              }`}
            >
              {flashMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{flashMessage.text}</span>
            </div>
          )}

          {/* Body */}
          <div className="p-6 space-y-6 flex-1">
            {/* Associated Facility Banner if linked */}
            {item.facility_name ? (
              <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/40 rounded-xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div>
                    <p className="text-xs text-indigo-900 dark:text-indigo-300 font-semibold">
                      Associated Facility Space
                    </p>
                    <p className="text-xs text-indigo-700 dark:text-indigo-400">
                      Located in <strong>{item.facility_name}</strong>
                      {item.facility_location ? ` (${item.facility_location})` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] text-gray-500 dark:text-slate-400 bg-white/80 dark:bg-slate-900/80 px-2.5 py-1 rounded-md border border-indigo-200/60 dark:border-indigo-900/40">
                  Linked Space
                </span>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
                    Identification & Stock
                  </h3>
                  <div className="space-y-2 text-xs">
                    {item.serial_number && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-slate-400">Serial Number:</span>
                        <span className="font-medium text-gray-900 dark:text-slate-100">{item.serial_number}</span>
                      </div>
                    )}
                    {item.asset_tag && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-slate-400">Asset Tag:</span>
                        <span className="font-medium text-gray-900 dark:text-slate-100">{item.asset_tag}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-slate-400">Available Quantity:</span>
                      <span className="font-bold text-gray-900 dark:text-slate-100 text-sm">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-slate-400">Location (Mandatory):</span>
                      <span className="font-semibold text-gray-900 dark:text-slate-100">{item.location || 'Main Lab'}</span>
                    </div>
                    {item.po_number && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-slate-400">P.O. Number:</span>
                        <span className="font-mono font-medium text-gray-900 dark:text-slate-100">{item.po_number}</span>
                      </div>
                    )}
                    {item.vendor_name && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-slate-400">Vendor:</span>
                        <span className="font-medium text-gray-900 dark:text-slate-100">{item.vendor_name}</span>
                      </div>
                    )}
                    {item.purchased_by && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-slate-400">Purchased By:</span>
                        <span className="font-medium text-gray-900 dark:text-slate-100">{item.purchased_by}</span>
                      </div>
                    )}
                    {item.expiry_date && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-slate-400">Expiry Date:</span>
                        <span className="font-medium text-amber-600 dark:text-amber-400">{formatDate(item.expiry_date)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {(item.assigned_user || item.assigned_to_name) && (
                  <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
                      Currently Assigned To
                    </h3>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-900 dark:text-slate-100">
                          {item.assigned_user?.full_name || item.assigned_to_name}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">
                          {item.assigned_user?.email || item.assigned_to_email || ''}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
                    Dates & Warranty
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-slate-400">Warranty Expiry:</span>
                      <span className="font-medium text-gray-900 dark:text-slate-100">{formatDate(item.warranty_end_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-slate-400">Last Maintenance:</span>
                      <span className="font-medium text-gray-900 dark:text-slate-100">{formatDate(item.last_maintenance_date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-slate-400">Added to System:</span>
                      <span className="font-medium text-gray-900 dark:text-slate-100">{formatDate(item.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-slate-800 px-6 py-4 bg-gray-50 dark:bg-slate-900/90 flex items-center justify-between">
            <div>
              {canDelete && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={onDelete}
                  leftIcon={<Trash2 className="h-4 w-4" />}
                >
                  Delete Item
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {onAssign && item.quantity > 0 && isManager && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onAssign();
                  }}
                  leftIcon={<UserCheck className="h-4 w-4 text-blue-600" />}
                >
                  Assign Item
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={onClose}>
                Close
              </Button>
              {canEdit && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onEdit}
                  leftIcon={<Edit2 className="h-4 w-4" />}
                >
                  Edit Item
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showRequestModal && (
        <InventoryRequestModal
          item={item}
          onClose={() => setShowRequestModal(false)}
          onSuccess={() => {
            setShowRequestModal(false);
            showFlash('success', 'Inventory request submitted successfully!');
          }}
        />
      )}
    </>
  );
}
