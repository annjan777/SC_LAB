import { useState } from 'react';
import { X, CheckCircle2, Calendar, AlertCircle, RefreshCw, MinusCircle } from 'lucide-react';
import { api } from '../lib/api';
import { InventoryRequest } from '../types/inventory';
import { Button } from './ui';

interface InventoryIssueModalProps {
  request: InventoryRequest;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InventoryIssueModal({ request, onClose, onSuccess }: InventoryIssueModalProps) {
  // Default is_returnable based on item classification
  const defaultReturnable = request.classification === 'Equipment';
  const [isReturnable, setIsReturnable] = useState<boolean>(defaultReturnable);
  const [expectedReturnDate, setExpectedReturnDate] = useState<string>(
    request.expected_return_date ? request.expected_return_date.split('T')[0] : ''
  );
  const [remarks, setRemarks] = useState<string>(request.remarks || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const currentStock = request.current_stock ?? 0;
  const isInsufficientStock = !isReturnable && currentStock < request.quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isReturnable && !expectedReturnDate) {
      setError('Please provide an expected return date for returnable items');
      return;
    }

    if (isInsufficientStock) {
      setError(`Cannot issue ${request.quantity} units. Available stock is only ${currentStock}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.put(`/api/inventory/requests/${request.id}/issue`, {
        is_returnable: isReturnable,
        expected_return_date: isReturnable ? expectedReturnDate : null,
        remarks: remarks.trim() || null,
      });

      if (res.error) {
        throw new Error(typeof res.error === 'string' ? res.error : (res.error as any).message || 'Failed to issue item');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to issue inventory item');
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
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Issue Inventory Item</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Process issuance, configure returnability, and track stock
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Request summary */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200/70 dark:border-slate-700/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                  Item to Issue
                </span>
                <h4 className="text-base font-bold text-gray-900 dark:text-slate-100">{request.item_name}</h4>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
                Qty: {request.quantity}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/60 dark:border-slate-700/60 text-xs">
              <div>
                <span className="text-gray-400 dark:text-slate-500">Requester:</span>{' '}
                <strong className="text-gray-900 dark:text-slate-200">{request.requester_name}</strong>
              </div>
              <div>
                <span className="text-gray-400 dark:text-slate-500">Current Stock:</span>{' '}
                <strong className="text-gray-900 dark:text-slate-200">{currentStock}</strong>
              </div>
              {request.purpose && (
                <div className="col-span-2 text-gray-600 dark:text-slate-300">
                  <span className="text-gray-400 dark:text-slate-500">Purpose:</span> {request.purpose}
                </div>
              )}
            </div>
          </div>

          {/* Returnability Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Returnability Option <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Non-returnable */}
              <label
                className={`flex flex-col p-3.5 rounded-xl border cursor-pointer transition ${
                  !isReturnable
                    ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 shadow-sm'
                    : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="returnability"
                    checked={!isReturnable}
                    onChange={() => setIsReturnable(false)}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <span className="font-semibold text-sm flex items-center gap-1.5">
                    <MinusCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    Non-returnable
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-slate-400 pl-6 leading-relaxed">
                  Consumables or permanent issue. Deducts <strong>{request.quantity}</strong> unit(s) from inventory stock.
                </span>
              </label>

              {/* Returnable */}
              <label
                className={`flex flex-col p-3.5 rounded-xl border cursor-pointer transition ${
                  isReturnable
                    ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 shadow-sm'
                    : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 text-gray-700 dark:text-slate-300 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="returnability"
                    checked={isReturnable}
                    onChange={() => setIsReturnable(true)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-sm flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Returnable
                  </span>
                </div>
                <span className="text-xs text-gray-500 dark:text-slate-400 pl-6 leading-relaxed">
                  Equipment loan. Item remains assigned to user until physically returned.
                </span>
              </label>
            </div>
          </div>

          {/* Expected Return Date if Returnable */}
          {isReturnable && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                Expected Return Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={expectedReturnDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                Portal and email reminders are automatically scheduled for the return date.
              </p>
            </div>
          )}

          {/* Stock Deduction Preview for Non-returnable */}
          {!isReturnable && (
            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 text-xs space-y-1">
              <div className="font-semibold text-amber-900 dark:text-amber-200">Stock Deduction Summary:</div>
              <div className="text-amber-800 dark:text-amber-300">
                Current Stock ({currentStock}) - Issued ({request.quantity}) = Available After Issue (
                <strong>{Math.max(0, currentStock - request.quantity)}</strong>)
              </div>
            </div>
          )}

          {/* Remarks */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Issue Remarks / Notes
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Handed over with power adapter and cable"
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
              disabled={submitting || isInsufficientStock}
            >
              {submitting ? 'Processing...' : 'Confirm & Issue'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
