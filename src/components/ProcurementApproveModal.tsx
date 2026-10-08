import { useState, FormEvent } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

export interface ApprovablePurchaseRequest {
  id: string;
  item_name: string;
  category: string;
  quantity: number;
  purpose: string;
  estimated_cost: number | null;
  vendor_name?: string;
  link?: string;
  manufacturer_part_no?: string;
  volume?: string;
  duration_of_consumption?: string;
  project_code?: string;
  user_profiles?: { full_name?: string; email?: string };
}

interface Props {
  request: ApprovablePurchaseRequest;
  onClose: () => void;
  onApproved: (message: string) => void;
}

const CATEGORIES = ['Chemicals', 'Electronics', 'Appliances', 'Computer Peripherals', 'Equipments', 'Consumables', 'Others'];

const inputClass =
  'w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const labelClass = 'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1';

/**
 * Approval step for a purchase request: the admin reviews everything the requester entered,
 * can correct any field, and must name the Project Code the purchase is charged to.
 */
export default function ProcurementApproveModal({ request, onClose, onApproved }: Props) {
  const [form, setForm] = useState({
    item_name: request.item_name || '',
    category: request.category || 'Others',
    quantity: String(request.quantity ?? 1),
    estimated_cost: request.estimated_cost === null || request.estimated_cost === undefined ? '' : String(request.estimated_cost),
    vendor_name: request.vendor_name || '',
    link: request.link || '',
    manufacturer_part_no: request.manufacturer_part_no || '',
    volume: request.volume || '',
    duration_of_consumption: request.duration_of_consumption || '',
    project_code: request.project_code || '',
    purpose: request.purpose || '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const projectCodeMissing = !request.project_code?.trim();
  const categories = CATEGORIES.includes(form.category) ? CATEGORIES : [form.category, ...CATEGORIES];

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.project_code.trim()) {
      setError('Project Code is required to approve this request');
      return;
    }
    setSubmitting(true);
    setError('');
    const { error: approveError } = await api.put(`/api/admin/purchase-requests/${request.id}/approve`, {
      ...form,
      quantity: Number(form.quantity),
      estimated_cost: form.estimated_cost === '' ? null : Number(form.estimated_cost),
    });
    setSubmitting(false);
    if (approveError) {
      setError(typeof approveError === 'string' ? approveError : approveError.message);
      return;
    }
    onApproved('Request approved successfully');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg max-w-3xl w-full my-8 shadow-xl"
      >
        <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Review & Approve Request</h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              Requested by {request.user_profiles?.full_name || 'a lab member'}. You can correct any field before approving.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-slate-200 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div
            className={`p-4 rounded-lg border ${
              projectCodeMissing
                ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700'
                : 'bg-gray-50 border-gray-200 dark:bg-slate-800/60 dark:border-slate-700'
            }`}
          >
            <label htmlFor="approve-project-code" className={labelClass}>
              Project Code <span className="text-red-500">*</span>
            </label>
            <input id="approve-project-code" type="text" required value={form.project_code} onChange={set('project_code')} className={inputClass} placeholder="Project the purchase is charged to" />
            {projectCodeMissing && (
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">The requester didn't give a Project Code. Enter it to approve.</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="approve-item-name" className={labelClass}>Item Name <span className="text-red-500">*</span></label>
              <input id="approve-item-name" type="text" required value={form.item_name} onChange={set('item_name')} className={inputClass} />
            </div>
            <div>
              <label htmlFor="approve-category" className={labelClass}>Category <span className="text-red-500">*</span></label>
              <select id="approve-category" required value={form.category} onChange={set('category')} className={inputClass}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="approve-quantity" className={labelClass}>Quantity <span className="text-red-500">*</span></label>
              <input id="approve-quantity" type="number" required min="1" step="1" value={form.quantity} onChange={set('quantity')} className={inputClass} />
            </div>
            <div>
              <label htmlFor="approve-cost" className={labelClass}>Estimated Cost (₹)</label>
              <input id="approve-cost" type="number" min="0" step="0.01" value={form.estimated_cost} onChange={set('estimated_cost')} className={inputClass} />
            </div>
            <div>
              <label htmlFor="approve-vendor" className={labelClass}>Vendor Name</label>
              <input id="approve-vendor" type="text" value={form.vendor_name} onChange={set('vendor_name')} className={inputClass} />
            </div>
            <div>
              <label htmlFor="approve-link" className={labelClass}>Link</label>
              <input id="approve-link" type="url" value={form.link} onChange={set('link')} className={inputClass} placeholder="https://" />
            </div>
            <div>
              <label htmlFor="approve-part" className={labelClass}>Manufacturer Part No</label>
              <input id="approve-part" type="text" value={form.manufacturer_part_no} onChange={set('manufacturer_part_no')} className={inputClass} />
            </div>
            <div>
              <label htmlFor="approve-volume" className={labelClass}>Volume</label>
              <input id="approve-volume" type="text" value={form.volume} onChange={set('volume')} className={inputClass} />
            </div>
            <div>
              <label htmlFor="approve-duration" className={labelClass}>Duration of Consumption</label>
              <input id="approve-duration" type="text" value={form.duration_of_consumption} onChange={set('duration_of_consumption')} className={inputClass} />
            </div>
            <div className="md:col-span-3">
              <label htmlFor="approve-purpose" className={labelClass}>Purpose <span className="text-red-500">*</span></label>
              <textarea id="approve-purpose" required rows={3} value={form.purpose} onChange={set('purpose')} className={inputClass} />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 font-medium flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>{submitting ? 'Approving...' : 'Save & Approve'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
