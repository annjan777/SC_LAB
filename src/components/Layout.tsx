import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, PermissionName } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import {
  FlaskConical,
  LayoutDashboard,
  User,
  Package,
  ShoppingCart,
  Calendar,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  FileText,
  Warehouse,
  ClipboardList,
  FolderOpen,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { profile, signOut, hasPermission, hasAnyPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const allMenuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', permissions: [] },
    { icon: User, label: 'My Profile', path: '/profile', permissions: [] },
    { icon: Users, label: 'Labmates', path: '/users', permissions: [], hideIfAdmin: true },
    { icon: Users, label: 'Manage Users', path: '/admin/users', permissions: ['manage_users', 'manage_roles'] as const },
    { icon: ClipboardList, label: 'Work Overview', path: '/admin/work-overview', permissions: ['manage_work_cycles'] as const, adminOnly: true },
    { icon: ClipboardList, label: 'Work Overview', path: '/work-overview', permissions: ['view_work', 'create_work', 'edit_work'] as const, hideIfAdmin: true },
    { icon: Warehouse, label: 'Facilities', path: '/facilities', permissions: ['view_facilities', 'create_facilities', 'edit_facilities', 'delete_facilities'] as const },
    { icon: Package, label: 'Inventory', path: '/inventory', permissions: ['view_inventory', 'create_inventory', 'edit_inventory', 'delete_inventory'] as const },
    { icon: ShoppingCart, label: 'Procurement', path: '/admin/procurement', permissions: ['view_procurement', 'manage_procurement', 'approve_procurement'] as const },
    { icon: ShoppingCart, label: 'Purchase Requests', path: '/purchases', permissions: ['create_purchase_request'] as const, hideIfAdmin: true },
    { icon: Calendar, label: 'Leave Approvals', path: '/admin/leaves', permissions: ['approve_leaves'] as const },
    { icon: Calendar, label: 'Leave Requests', path: '/leaves', permissions: ['view_leaves', 'create_leave_request'] as const, hideIfAdmin: true },
    { icon: FolderOpen, label: 'Repository', path: '/admin/repository', permissions: ['edit_repository_all', 'delete_repository_all', 'share_repository_documents'] as const },
    { icon: FolderOpen, label: 'My Repository', path: '/repository', permissions: ['view_repository'] as const, hideIfAdmin: true },
    { icon: FileText, label: 'Reports', path: '/admin/reports', permissions: ['view_reports', 'generate_reports'] as const },
    { icon: Settings, label: 'Settings', path: '/admin/settings', permissions: ['manage_settings'] as const },
  ];

  const menuItems = allMenuItems.filter(item => {
    const isAdmin = profile?.user_role === 'admin';

    // Admin-only routes: only show to admin-role users
    if ((item as any).adminOnly && !isAdmin) return false;

    // User routes with admin equivalents: hide if user is admin
    if (item.hideIfAdmin && isAdmin) return false;

    // Legacy hideIfAdmin permission checks for non-role-gated items
    if (item.hideIfAdmin && !isAdmin) {
      if (item.path === '/users' && hasAnyPermission(['manage_users', 'view_users'])) return false;
      if (item.path === '/leaves' && hasAnyPermission(['approve_leaves'])) return false;
      if (item.path === '/purchases' && hasAnyPermission(['view_procurement', 'manage_procurement', 'approve_procurement'])) return false;
      if (item.path === '/repository' && hasAnyPermission(['edit_repository_all'])) return false;
    }

    if (item.permissions.length === 0) return true;
    return hasAnyPermission(item.permissions as PermissionName[]);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-30">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <img src="/logo.png" alt="SC Lab Logo" className="h-24" />
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-40 transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <img src="/logo.png" alt="SC Lab Logo" className="h-24" />
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center space-x-3 mb-3 px-2">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-700 font-medium">
                {profile?.full_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profile?.full_name}</p>
              <p className="text-xs text-gray-500 capitalize">{profile?.user_role}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:ml-64">
        <header className="hidden lg:flex items-center justify-end bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
          <NotificationBell />
        </header>
        <main className="pt-20 lg:pt-0 p-6">{children}</main>
      </div>
    </div>
  );
}
