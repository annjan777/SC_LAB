import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { Package, ShoppingCart, Calendar, Users, AlertCircle, TrendingUp, FolderOpen, Warehouse, ClipboardList, Clock } from 'lucide-react';
import { PageHeader, StatusBadge } from '../components/ui';

interface DashboardStats {
  totalUsers?: number;
  pendingPurchases?: number;
  pendingLeaves?: number;
  lowStockItems?: number;
  myPurchaseRequests?: number;
  myLeaveRequests?: number;
  inventoryCount?: number;
  myWorkCount?: number;
  myWorkCompletion?: number;
  teamWorkCount?: number;
  delayedWorkCount?: number;
  repositoryDocuments?: number;
  facilitiesCount?: number;
  recentDocuments?: any[];
  cycleName?: string | null;
}

export default function DashboardPage() {
  const { profile, hasPermission, hasAnyPermission } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, [hasPermission, profile]);

  const fetchDashboardStats = async () => {
    try {
      const { data } = await api.get('/api/dashboard/stats');
      if (data) {
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const adminCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers || 0,
      icon: Users,
      color: 'bg-blue-600',
      link: '/admin/users',
      description: 'Lab members',
    },
    {
      title: 'Active Work Items',
      value: stats.teamWorkCount || 0,
      icon: ClipboardList,
      color: 'bg-cyan-600',
      link: '/admin/work-overview',
      description: stats.cycleName ? `Cycle: ${stats.cycleName}` : 'All active work items',
    },
    {
      title: 'Delayed Tasks',
      value: stats.delayedWorkCount || 0,
      icon: Clock,
      color: 'bg-orange-600',
      link: '/admin/work-overview',
      description: 'Needs attention',
    },
    {
      title: 'Repository Documents',
      value: stats.repositoryDocuments || 0,
      icon: FolderOpen,
      color: 'bg-teal-600',
      link: '/repository',
      description: 'Total documents',
    },
    {
      title: 'Facilities',
      value: stats.facilitiesCount || 0,
      icon: Warehouse,
      color: 'bg-violet-600',
      link: '/facilities',
      description: 'Managed spaces',
    },
    {
      title: 'Pending Purchases',
      value: stats.pendingPurchases || 0,
      icon: ShoppingCart,
      color: 'bg-emerald-600',
      link: '/admin/procurement',
      description: 'Awaiting approval',
    },
    {
      title: 'Pending Leaves',
      value: stats.pendingLeaves || 0,
      icon: Calendar,
      color: 'bg-amber-600',
      link: '/admin/leaves',
      description: 'Awaiting review',
    },
    {
      title: 'Low Stock Alert',
      value: stats.lowStockItems || 0,
      icon: AlertCircle,
      color: 'bg-red-600',
      link: '/inventory',
      description: 'Items below threshold',
    },
  ];

  const userCards = [
    {
      title: 'My Work Items',
      value: stats.myWorkCount || 0,
      icon: ClipboardList,
      color: 'bg-blue-600',
      link: '/work-overview',
      description: `${stats.myWorkCompletion || 0}% avg completion`,
    },
    {
      title: 'Repository Documents',
      value: stats.repositoryDocuments || 0,
      icon: FolderOpen,
      color: 'bg-teal-600',
      link: '/repository',
      description: 'Lab documents',
    },
    {
      title: 'Lab Inventory',
      value: stats.inventoryCount || 0,
      icon: Package,
      color: 'bg-violet-600',
      link: '/inventory',
      description: 'Available items',
    },
    {
      title: 'My Purchase Requests',
      value: stats.myPurchaseRequests || 0,
      icon: ShoppingCart,
      color: 'bg-emerald-600',
      link: '/purchases',
      description: 'Pending requests',
    },
    {
      title: 'My Leave Requests',
      value: stats.myLeaveRequests || 0,
      icon: Calendar,
      color: 'bg-amber-600',
      link: '/leaves',
      description: 'Pending approval',
    },
    {
      title: 'Profile Status',
      value: profile?.is_active ? 'Active' : 'Inactive',
      icon: TrendingUp,
      color: 'bg-cyan-600',
      link: '/profile',
      description: 'Account status',
    },
  ];

  const cards = hasAnyPermission(['view_reports', 'manage_users']) ? adminCards : userCards;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader title={`Welcome back, ${profile?.full_name?.split(' ')[0]}!`} />

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <button
              key={index}
              onClick={() => navigate(card.link)}
              className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-4 sm:p-5 hover:shadow-md hover:border-blue-500/50 transition-all duration-200 text-left group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`${card.color} p-2.5 rounded-lg group-hover:scale-105 transition-transform`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-1 truncate">{card.title}</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-0.5">{card.value}</p>
              {card.description && (
                <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{card.description}</p>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-5 sm:p-6 transition-colors">
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Quick Actions
          </h2>
          <div className="space-y-3">
            {hasAnyPermission(['view_reports', 'manage_users']) ? (
              <>
                <button
                  onClick={() => navigate('/admin/work-overview')}
                  className="w-full text-left px-4 py-3 bg-blue-50/70 hover:bg-blue-100/70 dark:bg-slate-800/80 dark:hover:bg-slate-750 rounded-xl border border-blue-100 dark:border-slate-700/80 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-blue-950 dark:text-blue-300 text-sm">Team Work Overview</p>
                      <p className="text-xs text-blue-700 dark:text-slate-400 mt-0.5">Monitor team progress</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-950 dark:text-blue-200">{stats.teamWorkCount || 0}</p>
                      <p className="text-[11px] text-blue-600 dark:text-blue-400">items</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => navigate('/admin/procurement')}
                  className="w-full text-left px-4 py-3 bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-slate-800/80 dark:hover:bg-slate-750 rounded-xl border border-emerald-100 dark:border-slate-700/80 transition-all duration-200"
                >
                  <p className="font-semibold text-emerald-950 dark:text-emerald-300 text-sm">Review Purchases</p>
                  <p className="text-xs text-emerald-700 dark:text-slate-400 mt-0.5">{stats.pendingPurchases || 0} pending requests</p>
                </button>
                <button
                  onClick={() => navigate('/admin/leaves')}
                  className="w-full text-left px-4 py-3 bg-amber-50/70 hover:bg-amber-100/70 dark:bg-slate-800/80 dark:hover:bg-slate-750 rounded-xl border border-amber-100 dark:border-slate-700/80 transition-all duration-200"
                >
                  <p className="font-semibold text-amber-950 dark:text-amber-300 text-sm">Review Leaves</p>
                  <p className="text-xs text-amber-700 dark:text-slate-400 mt-0.5">{stats.pendingLeaves || 0} pending requests</p>
                </button>
                <button
                  onClick={() => navigate('/repository')}
                  className="w-full text-left px-4 py-3 bg-teal-50/70 hover:bg-teal-100/70 dark:bg-slate-800/80 dark:hover:bg-slate-750 rounded-xl border border-teal-100 dark:border-slate-700/80 transition-all duration-200"
                >
                  <p className="font-semibold text-teal-950 dark:text-teal-300 text-sm">Repository</p>
                  <p className="text-xs text-teal-700 dark:text-slate-400 mt-0.5">Manage lab documents</p>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate('/work-overview')}
                  className="w-full text-left px-4 py-3 bg-blue-50/70 hover:bg-blue-100/70 dark:bg-slate-800/80 dark:hover:bg-slate-750 rounded-xl border border-blue-100 dark:border-slate-700/80 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-blue-950 dark:text-blue-300 text-sm">My Work & Planning</p>
                      <p className="text-xs text-blue-700 dark:text-slate-400 mt-0.5">Track your progress</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-950 dark:text-blue-200">{stats.myWorkCount || 0}</p>
                      <p className="text-[11px] text-blue-600 dark:text-blue-400">{stats.myWorkCompletion || 0}%</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => navigate('/repository')}
                  className="w-full text-left px-4 py-3 bg-teal-50/70 hover:bg-teal-100/70 dark:bg-slate-800/80 dark:hover:bg-slate-750 rounded-xl border border-teal-100 dark:border-slate-700/80 transition-all duration-200"
                >
                  <p className="font-semibold text-teal-950 dark:text-teal-300 text-sm">Repository</p>
                  <p className="text-xs text-teal-700 dark:text-slate-400 mt-0.5">{stats.repositoryDocuments || 0} documents available</p>
                </button>
                <button
                  onClick={() => navigate('/purchases')}
                  className="w-full text-left px-4 py-3 bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-slate-800/80 dark:hover:bg-slate-750 rounded-xl border border-emerald-100 dark:border-slate-700/80 transition-all duration-200"
                >
                  <p className="font-semibold text-emerald-950 dark:text-emerald-300 text-sm">Purchase Request</p>
                  <p className="text-xs text-emerald-700 dark:text-slate-400 mt-0.5">Request equipment & consumables</p>
                </button>
                <button
                  onClick={() => navigate('/leaves')}
                  className="w-full text-left px-4 py-3 bg-amber-50/70 hover:bg-amber-100/70 dark:bg-slate-800/80 dark:hover:bg-slate-750 rounded-xl border border-amber-100 dark:border-slate-700/80 transition-all duration-200"
                >
                  <p className="font-semibold text-amber-950 dark:text-amber-300 text-sm">Apply for Leave</p>
                  <p className="text-xs text-amber-700 dark:text-slate-400 mt-0.5">Submit leave request</p>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-5 sm:p-6 transition-colors">
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center">
            <FolderOpen className="w-5 h-5 mr-2 text-teal-600 dark:text-teal-400" />
            Recent Documents
          </h2>
          <div className="space-y-3">
            {stats.recentDocuments && stats.recentDocuments.length > 0 ? (
              stats.recentDocuments.map((doc, index) => (
                <button
                  key={index}
                  onClick={() => navigate('/repository')}
                  className="w-full text-left px-4 py-3 bg-gray-50 dark:bg-slate-800/70 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl border border-gray-200/60 dark:border-slate-700/70 transition-all duration-200"
                >
                  <p className="font-medium text-gray-900 dark:text-slate-100 text-sm truncate">{doc.title}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 capitalize">{doc.category?.replace(/_/g, ' ')}</p>
                  <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400 dark:text-slate-500">
                <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No documents yet</p>
              </div>
            )}
          </div>
          {stats.recentDocuments && stats.recentDocuments.length > 0 && (
            <button
              onClick={() => navigate('/repository')}
              className="w-full mt-4 px-4 py-2 text-sm text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg transition font-medium"
            >
              View All Documents →
            </button>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-5 sm:p-6 transition-colors">
          <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
            Profile Info
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-slate-800">
              <span className="text-gray-600 dark:text-slate-400 text-sm">Your Role</span>
              <span className="font-semibold text-gray-900 dark:text-slate-100 capitalize text-sm">{profile?.user_role}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-slate-800">
              <span className="text-gray-600 dark:text-slate-400 text-sm">Department</span>
              <span className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{profile?.department || 'Not set'}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-slate-800">
              <span className="text-gray-600 dark:text-slate-400 text-sm">Supervisor</span>
              <span className="font-semibold text-gray-900 dark:text-slate-100 text-sm">{profile?.supervisor || 'Not set'}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-gray-600 dark:text-slate-400 text-sm">Status</span>
              <StatusBadge
                status={profile?.is_active ? 'Active' : 'Inactive'}
                variant={profile?.is_active ? 'emerald' : 'red'}
              />
            </div>
          </div>
          <button
            onClick={() => navigate('/profile')}
            className="w-full mt-4 px-4 py-2 text-sm text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition font-medium"
          >
            View Full Profile →
          </button>
        </div>
      </div>
    </div>
  );
}
