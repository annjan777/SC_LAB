import { useState } from 'react';
import { X, Package, Calendar, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { InventoryItem } from '../types/inventory';
import { Button } from './ui';

interface InventoryRequestModalProps {
  item: InventoryItem | null;
  items?: InventoryItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function InventoryRequestModal({
  item: initialItem,
  items = [],
  onClose,
  onSuccess,
}: InventoryRequestModalProps) {
  const [selectedItemId, setSelectedItemId] = useState(initialItem?.id || (items[0]?.id || ''));
  const currentItem = initialItem || items.find((i) => i.id === selectedItemId) || null;

  const [quantity, setQuantity] = useState(1);
  const [purpose, setPurpose] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isConsumable = currentItem?.classification === 'Consumables';
  const isEquipment = currentItem?.classification === 'Equipment';
  const isOutOfStock = (currentItem?.quantity ?? 0) <= 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentItem) {
      setError('Please select an item');
      return;
    }

    if (quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    if (isOutOfStock) {
      setError('This item is currently out of stock and cannot be requested.');
      return;
    }

    if (currentItem.quantity < quantity) {
      setError(`Cannot request ${quantity} units. Only ${currentItem.quantity} are currently available in stock.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        inventory_item_id: currentItem.id,
        quantity,
        purpose: purpose.trim() || null,
        expected_return_date: isEquipment && expectedReturnDate ? expectedReturnDate : null,
        remarks: remarks.trim() || null,
      };

      const res = await api.post('/api/inventory/requests', payload);
      if (res.error) {
        throw new Error(typeof res.error === 'string' ? res.error : (res.error as any).message || 'Failed to submit request');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred while submitting your request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Request Inventory Item</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Submit an issuance request for consumables or equipment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Item Selector if not preselected */}
          {!initialItem && items.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Select Item <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500"
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.item_name} ({i.classification || 'Item'} — Available: {i.quantity})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Selected Item Overview Box */}
          {currentItem && (
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200/70 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900 dark:text-slate-100 text-sm">
                  {currentItem.item_name}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isConsumable
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                      : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                  }`}
                >
                  {currentItem.classification || 'Equipment'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-slate-400">
                <div>
                  <span className="text-gray-400 dark:text-slate-500">Available Stock:</span>{' '}
                  <strong className="text-gray-900 dark:text-slate-200">{currentItem.quantity}</strong>
                </div>
                <div>
                  <span className="text-gray-400 dark:text-slate-500">Location:</span>{' '}
                  <span className="text-gray-900 dark:text-slate-200">{currentItem.location || 'Main Lab'}</span>
                </div>
                {currentItem.facility_name && (
                  <div className="col-span-2">
                    <span className="text-gray-400 dark:text-slate-500">Facility:</span>{' '}
                    <span className="text-gray-900 dark:text-slate-200">{currentItem.facility_name}</span>
                  </div>
                )}
                {currentItem.assigned_to_name && (
                  <div className="col-span-2 text-xs text-gray-600 dark:text-slate-400">
                    <span className="text-gray-400 dark:text-slate-500">Assigned Lead / Custodian:</span>{' '}
                    <span className="font-medium text-gray-900 dark:text-slate-200">{currentItem.assigned_to_name}</span>
                  </div>
                )}
                {isOutOfStock && (
                  <div className="col-span-2 text-red-600 dark:text-red-400 font-medium">
                    ⚠️ Currently out of stock (0 available).
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Requested Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max={isConsumable ? currentItem?.quantity : 1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500"
            />
            {isConsumable && currentItem && (
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                Max consumable quantity available: {currentItem.quantity}
              </p>
            )}
          </div>

          {/* Expected Return Date for Equipment */}
          {isEquipment && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Expected Return Date
              </label>
              <input
                type="date"
                value={expectedReturnDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                Reminders will be sent to your portal and email on the return date.
              </p>
            </div>
          )}

          {/* Purpose */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Purpose / Experiment Details <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Explain the project or experiment requiring this item..."
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Additional Remarks (Optional)
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Need by Thursday morning"
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
            <Button variant="secondary" size="md" onClick={onClose} type="button" disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={submitting || isOutOfStock}
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
