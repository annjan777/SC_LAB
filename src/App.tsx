import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import InventoryPage from './pages/InventoryPage';
import FacilitiesPage from './pages/FacilitiesPage';
import WorkOverviewPage from './pages/WorkOverviewPage';
import NotificationsPage from './pages/NotificationsPage';
import RepositoryPage from './pages/RepositoryPage';
import UsersPage from './pages/UsersPage';

import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminProcurementPage from './pages/admin/AdminProcurementPage';
import AdminLeavesPage from './pages/admin/AdminLeavesPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import AdminWorkOverviewPage from './pages/admin/AdminWorkOverviewPage';
import AdminRepositoryPage from './pages/admin/AdminRepositoryPage';

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePasswordPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <DashboardPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Layout>
                  <ProfilePage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/purchases"
            element={
              <ProtectedRoute>
                <Layout>
                  <AdminProcurementPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/leaves"
            element={
              <ProtectedRoute>
                <Layout>
                  <AdminLeavesPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/inventory"
            element={
              <ProtectedRoute>
                <Layout>
                  <InventoryPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/facilities"
            element={
              <ProtectedRoute>
                <Layout>
                  <FacilitiesPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/work-overview"
            element={
              <ProtectedRoute>
                <Layout>
                  <WorkOverviewPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Layout>
                  <NotificationsPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/repository"
            element={
              <ProtectedRoute>
                <Layout>
                  <RepositoryPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <Layout>
                  <UsersPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredPermissions={['manage_users', 'manage_roles']}>
                <Layout>
                  <AdminUsersPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/procurement"
            element={
              <ProtectedRoute requiredPermissions={['view_procurement', 'manage_procurement', 'approve_procurement']}>
                <Layout>
                  <AdminProcurementPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/leaves"
            element={
              <ProtectedRoute requiredPermissions={['approve_leaves']}>
                <Layout>
                  <AdminLeavesPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute requiredPermissions={['view_reports', 'generate_reports']}>
                <Layout>
                  <AdminReportsPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute requiredPermissions={['manage_settings']}>
                <Layout>
                  <AdminSettingsPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/work-overview"
            element={
              <ProtectedRoute requiredPermissions={['manage_work_cycles']}>
                <Layout>
                  <AdminWorkOverviewPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/repository"
            element={
              <ProtectedRoute requiredPermissions={['edit_repository_all', 'delete_repository_all', 'share_repository_documents']}>
                <Layout>
                  <AdminRepositoryPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/inventory"
            element={<Navigate to="/inventory" replace />}
          />

          <Route path="/" element={<HomeRedirect />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
