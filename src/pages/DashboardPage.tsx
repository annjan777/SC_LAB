import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { Package, ShoppingCart, Calendar, Users, AlertCircle, TrendingUp, FolderOpen, Warehouse, ClipboardList, Clock } from 'lucide-react';

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
      description: 'In current cycle',
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
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {profile?.full_name?.split(' ')[0]}!
        </h1>
        <p className="text-gray-600 mt-2">
          {hasAnyPermission(['view_reports', 'manage_users']) ? 'Lab management overview and system statistics' : 'Your personalized lab portal overview'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <button
              key={index}
              onClick={() => navigate(card.link)}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 text-left group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`${card.color} p-3 rounded-lg group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <h3 className="text-gray-600 text-xs font-medium mb-1 uppercase tracking-wide">{card.title}</h3>
              <p className="text-2xl font-bold text-gray-900 mb-1">{card.value}</p>
              {card.description && (
                <p className="text-xs text-gray-500">{card.description}</p>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
            Quick Actions
          </h2>
          <div className="space-y-3">
            {hasAnyPermission(['view_reports', 'manage_users']) ? (
              <>
                <button
                  onClick={() => navigate('/admin/work-overview')}
                  className="w-full text-left px-4 py-3 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 rounded-lg transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-blue-900">Team Work Overview</p>
                      <p className="text-sm text-blue-700">Monitor team progress</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-900">{stats.teamWorkCount || 0}</p>
                      <p className="text-xs text-blue-600">items</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => navigate('/admin/procurement')}
                  className="w-full text-left px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 rounded-lg transition-all duration-300"
                >
                  <p className="font-medium text-emerald-900">Review Purchases</p>
                  <p className="text-sm text-emerald-700">{stats.pendingPurchases || 0} pending requests</p>
                </button>
                <button
                  onClick={() => navigate('/admin/leaves')}
                  className="w-full text-left px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 rounded-lg transition-all duration-300"
                >
                  <p className="font-medium text-amber-900">Review Leaves</p>
                  <p className="text-sm text-amber-700">{stats.pendingLeaves || 0} pending requests</p>
                </button>
                <button
                  onClick={() => navigate('/repository')}
                  className="w-full text-left px-4 py-3 bg-gradient-to-r from-teal-50 to-cyan-50 hover:from-teal-100 hover:to-cyan-100 rounded-lg transition-all duration-300"
                >
                  <p className="font-medium text-teal-900">Repository</p>
                  <p className="text-sm text-teal-700">Manage documents</p>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate('/work-overview')}
                  className="w-full text-left px-4 py-3 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 rounded-lg transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-blue-900">My Work & Planning</p>
                      <p className="text-sm text-blue-700">Track your progress</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-900">{stats.myWorkCount || 0}</p>
                      <p className="text-xs text-blue-600">{stats.myWorkCompletion || 0}%</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => navigate('/repository')}
                  className="w-full text-left px-4 py-3 bg-gradient-to-r from-teal-50 to-cyan-50 hover:from-teal-100 hover:to-cyan-100 rounded-lg transition-all duration-300"
                >
                  <p className="font-medium text-teal-900">Repository</p>
                  <p className="text-sm text-teal-700">{stats.repositoryDocuments || 0} documents available</p>
                </button>
                <button
                  onClick={() => navigate('/purchases')}
                  className="w-full text-left px-4 py-3 bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 rounded-lg transition-all duration-300"
                >
                  <p className="font-medium text-emerald-900">Purchase Request</p>
                  <p className="text-sm text-emerald-700">Request equipment</p>
                </button>
                <button
                  onClick={() => navigate('/leaves')}
                  className="w-full text-left px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 rounded-lg transition-all duration-300"
                >
                  <p className="font-medium text-amber-900">Apply for Leave</p>
                  <p className="text-sm text-amber-700">Submit leave request</p>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <FolderOpen className="w-5 h-5 mr-2 text-teal-600" />
            Recent Documents
          </h2>
          <div className="space-y-3">
            {stats.recentDocuments && stats.recentDocuments.length > 0 ? (
              stats.recentDocuments.map((doc, index) => (
                <button
                  key={index}
                  onClick={() => navigate('/repository')}
                  className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-all duration-300"
                >
                  <p className="font-medium text-gray-900 text-sm truncate">{doc.title}</p>
                  <p className="text-xs text-gray-500 mt-1 capitalize">{doc.category?.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No documents yet</p>
              </div>
            )}
          </div>
          {stats.recentDocuments && stats.recentDocuments.length > 0 && (
            <button
              onClick={() => navigate('/repository')}
              className="w-full mt-4 px-4 py-2 text-sm text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded-lg transition font-medium"
            >
              View All Documents →
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-blue-600" />
            Profile Info
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-600 text-sm">Your Role</span>
              <span className="font-semibold text-gray-900 capitalize text-sm">{profile?.user_role}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-600 text-sm">Department</span>
              <span className="font-semibold text-gray-900 text-sm">{profile?.department || 'Not set'}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-gray-600 text-sm">Supervisor</span>
              <span className="font-semibold text-gray-900 text-sm">{profile?.supervisor || 'Not set'}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-gray-600 text-sm">Status</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  profile?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {profile?.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate('/profile')}
            className="w-full mt-4 px-4 py-2 text-sm text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition font-medium"
          >
            View Full Profile →
          </button>
        </div>
      </div>
    </div>
  );
}
