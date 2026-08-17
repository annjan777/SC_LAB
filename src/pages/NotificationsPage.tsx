import { useEffect, useState } from 'react';
import { Bell, Check, Archive, Trash2, Filter, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  related_entity_type: string | null;
  related_entity_id: string | null;
  action_url: string | null;
  is_read: boolean;
  is_archived: boolean;
  created_at: string;
  read_at: string | null;
  archived_at: string | null;
}

type TabType = 'all' | 'unread' | 'read' | 'archived';

export default function NotificationsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 20;

  useEffect(() => {
    if (profile?.id) {
      fetchNotifications();
    }
  }, [profile?.id, activeTab, filterType, currentPage]);

  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId && notifications.length > 0) {
      const element = document.getElementById(`notification-${highlightId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-blue-500');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-blue-500');
        }, 2000);
      }
    }
  }, [searchParams, notifications]);

  const fetchNotifications = async () => {
    if (!profile?.id) return;

    setLoading(true);

    const params: Record<string, any> = {
      order: 'created_at',
      ascending: 'false',
      limit: itemsPerPage,
      offset: (currentPage - 1) * itemsPerPage,
      head: 'false',
    };

    if (activeTab === 'unread') {
      params.is_read = 'false';
      params.is_archived = 'false';
    } else if (activeTab === 'read') {
      params.is_read = 'true';
      params.is_archived = 'false';
    } else if (activeTab === 'archived') {
      params.is_archived = 'true';
    } else {
      params.is_archived = 'false';
    }

    if (filterType !== 'all') {
      params.type = filterType;
    }

    const { data, error } = await api.get('/api/notifications', params);
    // fetch total count separately
    const countParams = { ...params };
    delete countParams.limit;
    delete countParams.offset;
    countParams.head = 'true';
    const { count } = await api.get('/api/notifications', countParams);

    if (data && !error) {
      setNotifications(data);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await api.put('/api/notifications/' + notification.id, { is_read: true });
    }

    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notifications.map(n => n.id)));
    }
  };

  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const markSelectedAsRead = async () => {
    if (selectedIds.size === 0) return;

    await Promise.all(
      Array.from(selectedIds).map(id =>
        api.put('/api/notifications/' + id, { is_read: true })
      )
    );

    setSelectedIds(new Set());
    fetchNotifications();
  };

  const archiveSelected = async () => {
    if (selectedIds.size === 0) return;

    await Promise.all(
      Array.from(selectedIds).map(id =>
        api.put('/api/notifications/' + id, { is_archived: true })
      )
    );

    setSelectedIds(new Set());
    fetchNotifications();
  };

  const deleteArchived = async () => {
    if (!confirm('Are you sure you want to delete all archived notifications? This cannot be undone.')) {
      return;
    }

    await api.post('/api/notifications/archive-all');
    fetchNotifications();
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return past.toLocaleDateString();
  };

  const getNotificationIcon = (type: string) => {
    const iconClass = 'text-2xl';
    switch (type) {
      case 'purchase_request_new':
      case 'purchase_request_approved':
      case 'purchase_request_rejected':
      case 'purchase_request_ordered':
      case 'purchase_request_in_transit':
      case 'purchase_request_received':
      case 'purchase_request_inventory':
        return <span className={iconClass}>🛒</span>;
      case 'leave_request_new':
      case 'leave_request_approved':
      case 'leave_request_rejected':
        return <span className={iconClass}>📅</span>;
      case 'work_assigned':
      case 'work_comment':
      case 'work_needs_attention':
      case 'work_completed':
        return <span className={iconClass}>💼</span>;
      case 'problem_reported':
        return <span className={iconClass}>⚠️</span>;
      case 'support_requested':
        return <span className={iconClass}>🆘</span>;
      case 'progress_updated':
        return <span className={iconClass}>📊</span>;
      default:
        return <Bell className="w-6 h-6 text-gray-400" />;
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Notifications</h1>
        <p className="text-gray-600">Stay updated with all your activities</p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between p-4">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setActiveTab('all');
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'all'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                All
              </button>
              <button
                onClick={() => {
                  setActiveTab('unread');
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'unread'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Unread
              </button>
              <button
                onClick={() => {
                  setActiveTab('read');
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'read'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Read
              </button>
              <button
                onClick={() => {
                  setActiveTab('archived');
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'archived'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Archived
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="all">All Types</option>
                <option value="purchase_request_new">Purchase Requests</option>
                <option value="leave_request_new">Leave Requests</option>
                <option value="work_assigned">Work Assignments</option>
                <option value="problem_reported">Problem Reports</option>
                <option value="support_requested">Support Requests</option>
              </select>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="px-4 py-3 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
              <span className="text-sm text-blue-900">
                {selectedIds.size} notification{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={markSelectedAsRead}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Mark as Read
                </button>
                <button
                  onClick={archiveSelected}
                  className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </button>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No notifications</h3>
            <p className="text-gray-500">
              {activeTab === 'archived'
                ? "You haven't archived any notifications"
                : "You're all caught up!"}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  id={`notification-${notification.id}`}
                  className={`p-4 hover:bg-gray-50 transition-colors ${
                    !notification.is_read && !notification.is_archived ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(notification.id)}
                      onChange={() => handleSelect(notification.id)}
                      className="mt-1.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={`text-base font-semibold ${
                              !notification.is_read ? 'text-gray-900' : 'text-gray-700'
                            }`}>
                              {notification.title}
                            </h3>
                            {!notification.is_read && !notification.is_archived && (
                              <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full"></span>
                            )}
                          </div>
                          <p className="text-gray-600 mb-2">{notification.message}</p>
                          <span className="text-sm text-gray-500">
                            {getTimeAgo(notification.created_at)}
                          </span>
                        </div>
                        {notification.action_url && (
                          <button
                            onClick={() => handleNotificationClick(notification)}
                            className="flex-shrink-0 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                          >
                            View
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                  {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} notifications
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1.5 text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'archived' && notifications.length > 0 && (
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={deleteArchived}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete All Archived
            </button>
          </div>
        )}

        {notifications.length > 0 && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={selectedIds.size === notifications.length && notifications.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              Select all on this page
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
