import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, PermissionName } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import SkillReminderModal from './SkillReminderModal';
import DailyTodoFloatingButton from './DailyTodo/DailyTodoFloatingButton';
import { BrandLogo } from './ui';
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
  FolderKanban,
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
    { icon: FolderKanban, label: 'Project Tracker', path: '/projects', permissions: ['view_projects', 'create_projects', 'edit_projects', 'add_project_achievement'] as const },
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

  const menuItems = allMenuItems.filter((item) => {
    const isAdmin = profile?.user_role === 'admin' || profile?.user_role === 'super_admin';

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

    if (isAdmin) return true;
    if (item.permissions.length === 0) return true;
    return hasAnyPermission(item.permissions as PermissionName[]);
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 transition-colors duration-200">
      {/* Mobile Top Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 z-30 transition-colors">
        <div className="h-full flex items-center justify-between px-4 sm:px-6">
          <button
            onClick={() => {
              navigate('/dashboard');
              setSidebarOpen(false);
            }}
            className="flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg py-1"
            aria-label="SC Lab Home"
          >
            <BrandLogo variant="mobile" />
          </button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 transition"
              aria-label="Toggle navigation menu"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Aside */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 z-40 transition-transform duration-300 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Dedicated Sidebar Branding Area */}
        <div className="h-[70px] min-h-[70px] max-h-[70px] box-border w-full px-4 flex items-center justify-center border-b border-gray-200 dark:border-slate-800 shrink-0">
          <button
            onClick={() => {
              navigate('/dashboard');
              setSidebarOpen(false);
            }}
            className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-1 transition flex items-center justify-center max-h-[52px]"
            aria-label="SC Lab Home"
          >
            <BrandLogo variant="sidebar" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto min-h-0">
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
                className={`w-full h-10 flex items-center space-x-3 px-3.5 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-semibold'
                    : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800/80 font-medium'
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Card & Sign Out at bottom */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center space-x-3 mb-3 px-1">
            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950/80 flex items-center justify-center shrink-0">
              <span className="text-blue-700 dark:text-blue-300 font-semibold text-sm">
                {profile?.full_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                {profile?.full_name}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 capitalize truncate">{profile?.user_role}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full h-9 flex items-center justify-center space-x-2 px-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Container */}
      <div className="lg:ml-64">
        <header className="hidden lg:flex items-center justify-end h-[70px] min-h-[70px] max-h-[70px] box-border bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 sm:px-8 sticky top-0 z-20 gap-3 transition-colors">
          <ThemeToggle />
          <NotificationBell />
        </header>
        <main className="pt-20 lg:pt-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-16">{children}</main>
      </div>

      <SkillReminderModal />
      <DailyTodoFloatingButton />
    </div>
  );
}
