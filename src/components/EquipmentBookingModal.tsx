import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { X, Calendar, Clock, AlertTriangle, CheckCircle, Package, MapPin, Tag } from 'lucide-react';
import { EquipmentBooking } from '../types/facility';
import { Button, Input, StatusBadge } from './ui';

interface EquipmentBookingModalProps {
  item: {
    id: string;
    item_name: string;
    category?: string;
    serial_number?: string | null;
    asset_tag?: string | null;
    location?: string | null;
    quantity?: number;
    facility_name?: string | null;
  };
  onClose: () => void;
  onSuccess: () => void;
}

// Generate 30-min time slots from 07:00 to 22:00
const TIME_SLOTS: string[] = [];
for (let hour = 7; hour <= 21; hour++) {
  const h = hour.toString().padStart(2, '0');
  TIME_SLOTS.push(`${h}:00`);
  TIME_SLOTS.push(`${h}:30`);
}
TIME_SLOTS.push('22:00');

export default function EquipmentBookingModal({ item, onClose, onSuccess }: EquipmentBookingModalProps) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [purpose, setPurpose] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  const [dayBookings, setDayBookings] = useState<EquipmentBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchDateBookings(date);
  }, [date, item.id]);

  const fetchDateBookings = async (selectedDate: string) => {
    setLoadingBookings(true);
    setErrorMessage(null);
    try {
      const { data, error } = await api.get(`/api/inventory/${item.id}/bookings`, {
        date: selectedDate,
      });
      if (error) {
        console.error('Error fetching equipment bookings:', error);
      } else if (Array.isArray(data)) {
        setDayBookings(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBookings(false);
    }
  };

  // Conflict detection
  useEffect(() => {
    if (!startTime || !endTime || !date) {
      setConflict(null);
      return;
    }

    if (startTime >= endTime) {
      setConflict('End time must be later than start time.');
      return;
    }

    const proposedStart = new Date(`${date}T${startTime}:00`).getTime();
    const proposedEnd = new Date(`${date}T${endTime}:00`).getTime();

    const overlapping = dayBookings.find((b) => {
      if (b.status === 'cancelled') return false;
      const bStart = new Date(b.start_time).getTime();
      const bEnd = new Date(b.end_time).getTime();
      return proposedStart < bEnd && proposedEnd > bStart;
    });

    if (overlapping) {
      const bStartFormatted = new Date(overlapping.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const bEndFormatted = new Date(overlapping.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setConflict(
        `Time conflict: Equipment already reserved from ${bStartFormatted} to ${bEndFormatted} ("${overlapping.purpose}" by ${overlapping.user_name || 'Member'}).`
      );
    } else {
      setConflict(null);
    }
  }, [date, startTime, endTime, dayBookings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purpose.trim()) {
      setErrorMessage('Please state the purpose of equipment usage.');
      return;
    }
    if (startTime >= endTime) {
      setErrorMessage('End time must be after start time.');
      return;
    }
    if (conflict) {
      setErrorMessage(conflict);
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const startDateTime = new Date(`${date}T${startTime}:00`).toISOString();
    const endDateTime = new Date(`${date}T${endTime}:00`).toISOString();

    try {
      const { error } = await api.post(`/api/inventory/${item.id}/bookings`, {
        start_time: startDateTime,
        end_time: endDateTime,
        quantity,
        purpose: purpose.trim(),
        notes: notes.trim() || undefined,
      });

      if (error) {
        setErrorMessage(typeof error === 'string' ? error : (error as any).message || 'Failed to book equipment');
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatSlotTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Book Equipment Independently
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Reserves this individual piece of equipment without locking the entire facility
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Equipment summary card */}
        <div className="p-6 pb-2">
          <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">{item.item_name}</h3>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-slate-300 mt-1">
                {item.category && (
                  <span className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    {item.category}
                  </span>
                )}
                {item.facility_name ? (
                  <span className="flex items-center gap-1 font-medium text-indigo-700 dark:text-indigo-300">
                    <MapPin className="w-3.5 h-3.5" />
                    Located in: {item.facility_name}
                  </span>
                ) : item.location ? (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-500" />
                    {item.location}
                  </span>
                ) : null}
                {item.asset_tag && (
                  <span className="text-gray-500 dark:text-slate-400">
                    Tag: {item.asset_tag}
                  </span>
                )}
              </div>
            </div>
            <StatusBadge status="available" variant="indigo" size="sm" label="Equipment Item" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 pt-3 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Date & Time Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Date *
              </label>
              <Input
                type="date"
                min={todayStr}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Start Time *
              </label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIME_SLOTS.slice(0, -1).map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                End Time *
              </label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIME_SLOTS.map((time) => (
                  <option key={time} value={time} disabled={time <= startTime}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conflict Warning */}
          {conflict ? (
            <div className="p-3.5 rounded-lg border border-amber-300 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold">Double Booking Conflict</p>
                <p className="mt-0.5">{conflict}</p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>This equipment is available for the selected slot!</span>
            </div>
          )}

          {/* Existing reservations for this date */}
          <div className="border border-gray-200 dark:border-slate-800 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-800/30">
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Equipment Reservations on {new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </h4>
              <span className="text-[11px] text-gray-500 dark:text-slate-400">
                {dayBookings.length} {dayBookings.length === 1 ? 'reservation' : 'reservations'}
              </span>
            </div>

            {loadingBookings ? (
              <p className="text-xs text-gray-500 py-2">Checking reservations...</p>
            ) : dayBookings.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-slate-400 py-2 italic">
                No existing bookings for this equipment today. Ready for reservation.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {dayBookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-900/40">
                        {formatSlotTime(b.start_time)} - {formatSlotTime(b.end_time)}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-slate-100 truncate max-w-xs">
                        {b.purpose}
                      </span>
                    </div>
                    <span className="text-gray-500 dark:text-slate-400 text-[11px]">
                      {b.user_name || 'Member'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Purpose & Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Purpose / Project *
              </label>
              <Input
                type="text"
                placeholder="e.g., 3D prototype printing, thermal stress test"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Quantity
              </label>
              <Input
                type="number"
                min={1}
                max={item.quantity && item.quantity > 0 ? item.quantity : 1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Additional Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g., Special nozzles required, testing samples prepared..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-slate-800">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!!conflict || submitting}
              isLoading={submitting}
              leftIcon={<CheckCircle className="w-4 h-4" />}
            >
              Confirm Equipment Booking
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
