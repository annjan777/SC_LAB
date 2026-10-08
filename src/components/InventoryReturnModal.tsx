import { useState } from 'react';
import { X, RotateCcw, AlertCircle, Calendar, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import { InventoryRequest, InventoryCondition } from '../types/inventory';
import { Button } from './ui';

interface InventoryReturnModalProps {
  request: InventoryRequest;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InventoryReturnModal({ request, onClose, onSuccess }: InventoryReturnModalProps) {
  const [condition, setCondition] = useState<InventoryCondition>('good');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];
  const isOverdue =
    request.expected_return_date && request.expected_return_date.split('T')[0] < todayStr;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    setSubmitting(true);
    try {
      const res = await api.put(`/api/inventory/requests/${request.id}/return`, {
        returned_condition: condition,
        return_remarks: returnRemarks.trim() || null,
      });

      if (res.error) {
        throw new Error(typeof res.error === 'string' ? res.error : (res.error as any).message || 'Failed to process return');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to record return');
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
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Process Equipment Return</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Record physical return date, inspected condition, and release item
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

          {/* Item & Assignment Details */}
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200/70 dark:border-slate-700/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900 dark:text-slate-100 text-sm">
                {request.item_name}
              </span>
              {isOverdue ? (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40">
                  Overdue
                </span>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/40">
                  Active Loan
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/60 dark:border-slate-700/60 text-xs">
              <div>
                <span className="text-gray-400 dark:text-slate-500">Assigned To:</span>{' '}
                <strong className="text-gray-900 dark:text-slate-200">{request.requester_name}</strong>
              </div>
              <div>
                <span className="text-gray-400 dark:text-slate-500">Expected Due:</span>{' '}
                <span
                  className={`font-semibold ${
                    isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-slate-200'
                  }`}
                >
                  {request.expected_return_date ? request.expected_return_date.split('T')[0] : 'N/A'}
                </span>
              </div>
              {request.issue_date && (
                <div>
                  <span className="text-gray-400 dark:text-slate-500">Issue Date:</span>{' '}
                  <span className="text-gray-900 dark:text-slate-200">{request.issue_date.split('T')[0]}</span>
                </div>
              )}
            </div>
          </div>

          {/* Returned Condition */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Returned Physical Condition <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-5 gap-2">
              {(['new', 'good', 'fair', 'poor', 'damaged'] as InventoryCondition[]).map((cond) => (
                <button
                  key={cond}
                  type="button"
                  onClick={() => setCondition(cond)}
                  className={`py-2 px-1 text-xs font-semibold rounded-xl capitalize border transition ${
                    condition === cond
                      ? cond === 'damaged' || cond === 'poor'
                        ? 'bg-red-500 text-white border-red-500 shadow-sm'
                        : 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                  }`}
                >
                  {cond}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1.5">
              The item condition will be updated to <strong>{condition}</strong> upon return.
            </p>
          </div>

          {/* Return Remarks */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Inspection / Return Notes
            </label>
            <textarea
              rows={3}
              value={returnRemarks}
              onChange={(e) => setReturnRemarks(e.target.value)}
              placeholder="e.g. Returned with all cables and accessories in good working order."
              className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Confirmation Notice */}
          <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/40 text-xs text-purple-900 dark:text-purple-200">
            <span className="font-semibold">Release Confirmation:</span> Confirming this return will clear the
            user assignment, mark this request as returned in history, and make the equipment available for new
            requests.
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-slate-800">
            <Button variant="secondary" size="md" onClick={onClose} type="button" disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" size="md" type="submit" disabled={submitting}>
              {submitting ? 'Recording Return...' : 'Confirm Return'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
