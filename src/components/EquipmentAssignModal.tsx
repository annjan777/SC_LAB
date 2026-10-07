import React, { useState } from 'react';
import {
  X,
  UserCheck,
  Calendar,
  AlertCircle,
  RotateCcw,
  MinusCircle,
  CheckCircle2,
  Package,
  MapPin,
} from 'lucide-react';
import { api } from '../lib/api';
import { InventoryItem } from '../types/inventory';
import { Button } from './ui';

interface EquipmentAssignModalProps {
  item: InventoryItem;
  users: Array<{ id: string; full_name: string; email: string }>;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EquipmentAssignModal({
  item,
  users,
  onClose,
  onSuccess,
}: EquipmentAssignModalProps) {
  const isEquipment = item.classification === 'Equipment';
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [isReturnable, setIsReturnable] = useState(isEquipment);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!assignedToUserId) {
      setError('Please select a user to assign this item to');
      return;
    }

    if (isReturnable && !expectedReturnDate) {
      setError('Please specify when the item will be returned');
      return;
    }

    if (!isReturnable && quantity > (item.quantity ?? 1)) {
      setError(`Cannot assign ${quantity} units. Available stock is only ${item.quantity}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/api/inventory/requests/assign', {
        inventory_item_id: item.id,
        assigned_to_user_id: assignedToUserId,
        quantity: Number(quantity) || 1,
        is_returnable: isReturnable,
        expected_return_date: isReturnable ? expectedReturnDate : null,
        remarks: remarks.trim() || null,
      });

      if (res.error) {
        throw new Error(
          typeof res.error === 'string' ? res.error : (res.error as any).message || 'Failed to assign equipment'
        );
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred while assigning the equipment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-white dark:from-slate-900 dark:to-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Assign Equipment</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Assign this item directly to a lab member and configure loan returnability
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

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Item Summary Card */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200/70 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h4 className="text-sm font-bold text-gray-900 dark:text-slate-100">{item.item_name}</h4>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
                {item.classification}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/60 dark:border-slate-700/60 text-xs text-gray-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span>{item.location}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-400">Available Stock:</span> <strong>{item.quantity}</strong>
              </div>
            </div>
          </div>

          {/* Select User to Assign */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Assign To User <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={assignedToUserId}
              onChange={(e) => setAssignedToUserId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 transition"
            >
              <option value="">Select a user / recipient...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Quantity to Issue <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Returnability Button Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Returnability Option <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Returnable Loan */}
              <button
                type="button"
                onClick={() => setIsReturnable(true)}
                className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                  isReturnable
                    ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 text-blue-950 dark:text-blue-200 ring-1 ring-blue-500/50'
                    : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-gray-700 dark:text-slate-300 hover:border-gray-300'
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                    isReturnable ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Returnable</span>
                    {isReturnable && <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Equipment loan. Requester must return item by expected date.
                  </p>
                </div>
              </button>

              {/* Non-returnable */}
              <button
                type="button"
                onClick={() => setIsReturnable(false)}
                className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                  !isReturnable
                    ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200 ring-1 ring-amber-500/50'
                    : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-gray-700 dark:text-slate-300 hover:border-gray-300'
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                    !isReturnable ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'
                  }`}
                >
                  <MinusCircle className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Non-returnable</span>
                    {!isReturnable && <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Consumable or permanent issue. Deducts from available stock.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* When will the item be returned? (Only if Returnable is ticked) */}
          {isReturnable && (
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-2 animate-in fade-in duration-150">
              <label className="block text-xs font-semibold text-blue-900 dark:text-blue-200 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                When will the item be returned? (Expected Return Date) <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                min={todayStr}
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-800 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                🔔 Automated portal notifications and email reminders will be sent to <strong>both</strong> the
                person who took the item and you (the person who assigned it) on the return date.
              </p>
            </div>
          )}

          {/* Remarks / Handover Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Handover Remarks / Notes
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Assigned for Capstone Robotics Project in Lab 4"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
            <Button variant="secondary" size="md" onClick={onClose} type="button" disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" disabled={submitting}>
              {submitting ? 'Assigning...' : 'Confirm & Assign Equipment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
