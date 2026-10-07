import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { X, Calendar, Clock, AlertTriangle, CheckCircle, Users, MapPin, Info } from 'lucide-react';
import { Facility, FacilityBooking } from '../types/facility';
import { Button, Input, StatusBadge } from './ui';

interface FacilityBookingModalProps {
  facility: Facility;
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

export default function FacilityBookingModal({ facility, onClose, onSuccess }: FacilityBookingModalProps) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayStr);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  const [dayBookings, setDayBookings] = useState<FacilityBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch bookings for the selected date
  useEffect(() => {
    fetchDateBookings(date);
  }, [date, facility.id]);

  const fetchDateBookings = async (selectedDate: string) => {
    setLoadingBookings(true);
    setErrorMessage(null);
    try {
      const { data, error } = await api.get(`/api/facilities/${facility.id}/bookings`, {
        date: selectedDate,
      });
      if (error) {
        console.error('Error fetching bookings:', error);
      } else if (Array.isArray(data)) {
        setDayBookings(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBookings(false);
    }
  };

  // Check for conflicts whenever time or bookings change
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
        `Time conflict: Already booked from ${bStartFormatted} to ${bEndFormatted} ("${overlapping.title}" by ${overlapping.user_name || 'Member'}).`
      );
    } else {
      setConflict(null);
    }
  }, [date, startTime, endTime, dayBookings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('Please provide a booking purpose/title.');
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
      const { data, error } = await api.post(`/api/facilities/${facility.id}/bookings`, {
        start_time: startDateTime,
        end_time: endDateTime,
        title: title.trim(),
        description: description.trim() || undefined,
      });

      if (error) {
        setErrorMessage(typeof error === 'string' ? error : (error as any).message || 'Failed to book facility');
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
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Book Facility
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Reserves the complete space for your chosen date and time window
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Facility summary header */}
        <div className="p-6 pb-2">
          <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">{facility.name}</h3>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-slate-300 mt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  {facility.location}
                </span>
                {facility.capacity && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Capacity: {facility.capacity} seats
                  </span>
                )}
              </div>
            </div>
            <StatusBadge status={facility.status || 'operational'} size="sm" />
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
              <span>Selected time window is currently available!</span>
            </div>
          )}

          {/* Day's existing schedule */}
          <div className="border border-gray-200 dark:border-slate-800 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-800/30">
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Schedule for {new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </h4>
              <span className="text-[11px] text-gray-500 dark:text-slate-400">
                {dayBookings.length} {dayBookings.length === 1 ? 'booking' : 'bookings'}
              </span>
            </div>

            {loadingBookings ? (
              <p className="text-xs text-gray-500 py-2">Loading reservations...</p>
            ) : dayBookings.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-slate-400 py-2 italic">
                No existing bookings for this day. The whole space is open.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {dayBookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/40">
                        {formatSlotTime(b.start_time)} - {formatSlotTime(b.end_time)}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-slate-100 truncate max-w-xs">
                        {b.title}
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

          {/* Title & Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Purpose / Title *
            </label>
            <Input
              type="text"
              placeholder="e.g., Weekly Team Sync, PCB Soldering Session, Client Presentation"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Requirements / Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g., Need projector setup, 12 chairs arranged in circle..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              Confirm Facility Booking
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
