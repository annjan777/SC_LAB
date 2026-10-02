import React, { useState } from 'react';
import { X, Send, Mail, Bell, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface BroadcastModalProps {
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function BroadcastModal({ onClose, onSuccess }: BroadcastModalProps) {
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const adminSenderName = profile?.full_name || 'SC Lab Administrator';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setError('Title and message are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: apiError } = await api.post('/api/notifications/broadcast', {
        title: title.trim(),
        message: message.trim(),
        type: 'announcement',
      });

      if (apiError) {
        throw new Error(typeof apiError === 'string' ? apiError : (apiError as any).message || 'Failed to send broadcast');
      }

      const successMsg = data?.message || 'Announcement broadcasted and sent via email to all users successfully!';
      onSuccess(successMsg);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to send broadcast.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Broadcast Announcement</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Delivers in-app notifications and emails to all active members
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-xs">
              {error}
            </div>
          )}

          {/* Email & Notification Delivery Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 flex items-start gap-3">
            <div className="p-1.5 bg-blue-100 rounded-md text-blue-700 shrink-0 mt-0.5">
              <Mail className="w-4 h-4" />
            </div>
            <div className="text-xs text-blue-900">
              <p className="font-semibold flex items-center gap-1.5">
                <span>In-App Notification & Email Delivery</span>
                <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-medium bg-blue-200 text-blue-800 rounded">
                  All Users
                </span>
              </p>
              <p className="text-blue-700 mt-1 leading-relaxed">
                Every active user will receive this message directly in their email inbox and in-app notifications with your signature at the bottom.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Announcement Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border-gray-300 border px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
              placeholder="e.g. Lab Safety Review & Quarterly Audit"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Message Content <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg border-gray-300 border px-3.5 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow resize-none"
              placeholder="Write the announcement details to be delivered..."
            />
          </div>

          {/* Sender Signature Preview */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Broadcast signature: <strong className="text-gray-900">{adminSenderName}</strong>
              </span>
            </div>
            <span className="text-[11px] text-gray-400 font-mono">Appended at end</span>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-medium disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                  <span>Dispatching Emails...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Broadcast & Email</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
