import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  FlaskConical,
  Cpu,
  MapPin,
  Building,
  Hash,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  InventoryItem,
  InventoryClassification,
  InventoryCondition,
  getCategoriesForClassification,
} from '../types/inventory';
import { Button } from './ui';

interface InventoryItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedItem: InventoryItem) => void;
  editingItem?: InventoryItem | null;
  facilities: Array<{ id: string; name: string; location: string; [key: string]: any }>;
  users?: Array<{ id: string; full_name: string; email: string }>;
}

export default function InventoryItemModal({
  isOpen,
  onClose,
  onSuccess,
  editingItem,
  facilities,
  users = [],
}: InventoryItemModalProps) {
  const [itemName, setItemName] = useState('');
  const [classification, setClassification] = useState<InventoryClassification>('Consumables');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<InventoryCondition>('good');
  const [poNumber, setPoNumber] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [purchasedBy, setPurchasedBy] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [assetTag, setAssetTag] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [warrantyEndDate, setWarrantyEndDate] = useState('');
  const [lastMaintenanceDate, setLastMaintenanceDate] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Categories available for currently selected classification
  const availableCategories = getCategoriesForClassification(classification);

  // Sync state when editingItem changes or modal opens
  useEffect(() => {
    if (editingItem) {
      setItemName(editingItem.item_name || '');
      const cls =
        editingItem.classification ||
        (['chemicals', 'consumables', 'consumable'].includes((editingItem.category || '').toLowerCase())
          ? 'Consumables'
          : 'Equipment');
      setClassification(cls);

      const cats = getCategoriesForClassification(cls);
      setCategory(editingItem.category && cats.includes(editingItem.category) ? editingItem.category : cats[0]);
      setLocation(editingItem.location || '');
      setQuantity(editingItem.quantity ?? 1);
      setCondition(editingItem.condition || 'good');
      setPoNumber(editingItem.po_number || '');
      setVendorName(editingItem.vendor_name || '');
      setPurchasedBy(editingItem.purchased_by || '');
      setAssignedToUserId(editingItem.assigned_to_user_id || '');
      setExpiryDate(editingItem.expiry_date ? String(editingItem.expiry_date).split('T')[0] : '');
      setSerialNumber(editingItem.serial_number || '');
      setAssetTag(editingItem.asset_tag || '');
      setFacilityId(editingItem.facility_id || '');
      setWarrantyEndDate(editingItem.warranty_end_date ? String(editingItem.warranty_end_date).split('T')[0] : '');
      setLastMaintenanceDate(
        editingItem.last_maintenance_date ? String(editingItem.last_maintenance_date).split('T')[0] : ''
      );
    } else {
      setItemName('');
      setClassification('Consumables');
      const cats = getCategoriesForClassification('Consumables');
      setCategory(cats[0]);
      setLocation('');
      setQuantity(1);
      setCondition('new');
      setPoNumber('');
      setVendorName('');
      setPurchasedBy('');
      setAssignedToUserId('');
      setExpiryDate('');
      setSerialNumber('');
      setAssetTag('');
      setFacilityId('');
      setWarrantyEndDate('');
      setLastMaintenanceDate('');
    }
    setError('');
  }, [editingItem, isOpen]);

  // When classification changes, auto-select first valid category
  const handleClassificationChange = (newCls: InventoryClassification) => {
    setClassification(newCls);
    const newCategories = getCategoriesForClassification(newCls);
    if (!newCategories.includes(category)) {
      setCategory(newCategories[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!itemName.trim()) {
      setError('Item name is required');
      return;
    }

    if (!location.trim()) {
      setError('Location is mandatory for inventory items');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        item_name: itemName.trim(),
        classification,
        category,
        location: location.trim(),
        quantity: Number(quantity) || 1,
        condition,
        po_number: poNumber.trim() || null,
        vendor_name: vendorName.trim() || null,
        purchased_by: purchasedBy.trim() || null,
        assigned_to_user_id: assignedToUserId || null,
        expiry_date: expiryDate || null,
        serial_number: serialNumber.trim() || null,
        asset_tag: assetTag.trim() || null,
        facility_id: facilityId || null,
        warranty_end_date: warrantyEndDate || null,
        last_maintenance_date: lastMaintenanceDate || null,
      };

      let res;
      if (editingItem) {
        res = await api.put(`/api/inventory/${editingItem.id}`, payload);
      } else {
        res = await api.post('/api/inventory', payload);
      }

      if (res.error) {
        throw new Error(
          typeof res.error === 'string' ? res.error : (res.error as any).message || 'Failed to save inventory item'
        );
      }

      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving the inventory item');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-gray-50/50 to-white dark:from-slate-900 dark:to-slate-900/50">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                classification === 'Consumables'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
              }`}
            >
              {classification === 'Consumables' ? (
                <FlaskConical className="w-5 h-5" />
              ) : (
                <Cpu className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                {editingItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {editingItem
                  ? 'Update item specifications, classification, and facility space linkage'
                  : 'Register a new consumable or equipment into the SC Lab inventory catalog'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-3 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* 1. CLASSIFICATION SELECTOR */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Item Classification <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Consumables Card */}
              <button
                type="button"
                onClick={() => handleClassificationChange('Consumables')}
                className={`p-4 rounded-xl border text-left transition flex items-start gap-3.5 ${
                  classification === 'Consumables'
                    ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100 shadow-sm ring-1 ring-amber-500/50'
                    : 'border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-700'
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    classification === 'Consumables'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                  }`}
                >
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">Consumables</span>
                    {classification === 'Consumables' && (
                      <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Chemicals, reagents, components, materials consumed upon issue.
                  </p>
                </div>
              </button>

              {/* Equipment Card */}
              <button
                type="button"
                onClick={() => handleClassificationChange('Equipment')}
                className={`p-4 rounded-xl border text-left transition flex items-start gap-3.5 ${
                  classification === 'Equipment'
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-blue-950 dark:text-blue-100 shadow-sm ring-1 ring-blue-500/50'
                    : 'border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-700'
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    classification === 'Equipment'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
                  }`}
                >
                  <Cpu className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">Equipment</span>
                    {classification === 'Equipment' && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Electronics, instruments, tools, appliances, reusable lab assets.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* 2. CORE DETAILS SECTION */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gray-50/70 dark:bg-slate-800/30 border border-gray-200/80 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200/60 dark:border-slate-700/60 text-xs font-bold text-gray-800 dark:text-slate-200 uppercase tracking-wider">
              <Package className="w-4 h-4 text-primary-500" />
              Core Information
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Item Name */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rigol Digital Oscilloscope 100MHz or Hydrochloric Acid 37%"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Dynamic Category Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>
                    Category <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[11px] font-normal text-gray-500 dark:text-slate-400">
                    Filtered for {classification}
                  </span>
                </label>
                <select
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 transition font-medium"
                >
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location (Mandatory) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>
                    Location <span className="text-red-500">*</span>
                  </span>
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    Mandatory
                  </span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chemical Bay 2, Cabinet A or Shelf 4"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
              </div>

              {/* Quantity / Stock */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Available Quantity / Stock <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Condition */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Physical Condition <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as InventoryCondition)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 transition"
                >
                  <option value="new">New (Pristine / Unused)</option>
                  <option value="good">Good (Fully Functional)</option>
                  <option value="fair">Fair (Minor Wear)</option>
                  <option value="poor">Poor (Requires Service)</option>
                  <option value="damaged">Damaged / Non-functional</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. PROCUREMENT, VENDOR & FACILITY LINKAGE */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gray-50/70 dark:bg-slate-800/30 border border-gray-200/80 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-200/60 dark:border-slate-700/60 text-xs font-bold text-gray-800 dark:text-slate-200 uppercase tracking-wider">
              <Building className="w-4 h-4 text-primary-500" />
              Procurement & Facility Space
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Associated Facility Space */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Associated Facility Space (Optional)
                </label>
                <select
                  value={facilityId}
                  onChange={(e) => setFacilityId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 transition"
                >
                  <option value="">None (Standalone / Unlinked Item)</option>
                  {facilities.map((fac) => (
                    <option key={fac.id} value={fac.id}>
                      {fac.name} ({fac.location})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                  Equipment stays linked to this space without duplicating into facilities.
                </p>
              </div>

              {/* P.O. Number */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  P.O. Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Hash className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. PO-2026-0042"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
              </div>

              {/* Vendor */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Vendor / Supplier
                </label>
                <input
                  type="text"
                  placeholder="e.g. Thermo Fisher, Sigma-Aldrich, Farnell"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Purchased By */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Purchased By
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Jane Smith, SERB Grant"
                  value={purchasedBy}
                  onChange={(e) => setPurchasedBy(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Assigned To */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Assigned To</span>
                  <span className="text-[11px] font-normal text-gray-500 dark:text-slate-400">
                    Custodian / Borrower
                  </span>
                </label>
                <select
                  value={assignedToUserId}
                  onChange={(e) => setAssignedToUserId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 transition"
                >
                  <option value="">Unassigned (In Lab Stock)</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Expiry Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Expiry Date (Optional)
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Serial Number */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Serial Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. SN-883921-X"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Asset Tag */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Asset Tag / Barcode
                </label>
                <input
                  type="text"
                  placeholder="e.g. SCLAB-EQ-0091"
                  value={assetTag}
                  onChange={(e) => setAssetTag(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Warranty End Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Warranty End Date
                </label>
                <input
                  type="date"
                  value={warrantyEndDate}
                  onChange={(e) => setWarrantyEndDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              {/* Last Maintenance Date */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
                  Last Maintenance Date
                </label>
                <input
                  type="date"
                  value={lastMaintenanceDate}
                  onChange={(e) => setLastMaintenanceDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
            <Button variant="secondary" size="md" onClick={onClose} type="button" disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
