import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, authApi, setToken, getStoredToken } from '../lib/api';

export type UserRole = 'admin' | 'super_admin' | 'user';

export type PermissionName =
  | 'view_users' | 'manage_users' | 'manage_roles'
  | 'view_facilities' | 'create_facilities' | 'edit_facilities' | 'delete_facilities'
  | 'view_procurement' | 'create_purchase_request' | 'approve_procurement' | 'manage_procurement'
  | 'view_leaves' | 'create_leave_request' | 'approve_leaves'
  | 'view_work' | 'create_work' | 'edit_work' | 'delete_work' | 'manage_work_cycles'
  | 'view_inventory' | 'create_inventory' | 'edit_inventory' | 'delete_inventory'
  | 'view_reports' | 'generate_reports'
  | 'view_settings' | 'manage_settings'
  | 'view_notifications'
  | 'view_repository' | 'edit_repository_all' | 'delete_repository_all' | 'share_repository_documents';

export interface UserProfile {
  id: string;
  full_name: string;
  roll_number: string | null;
  employee_id: string | null;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  department: string | null;
  program_designation: string | null;
  supervisor: string | null;
  joining_date: string | null;
  tenure_ending_date: string | null;
  user_role: UserRole;
  is_active: boolean;
  profile_picture_url: string | null;
  require_password_change: boolean;
  last_password_changed_at: string | null;
  created_at: string;
  updated_at: string;
  role_id: string | null;
}

interface AuthContextType {
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  session: any;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; profile?: UserProfile | null }>;
  signUp: (email: string, password: string, fullName: string, role?: 'admin' | 'user') => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  reloadProfile: () => Promise<void>;
  permissions: Set<string>;
  hasPermission: (permission: PermissionName) => boolean;
  hasAnyPermission: (permissions: PermissionName[]) => boolean;
  hasAllPermissions: (permissions: PermissionName[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());

  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.purpose === 'password_reset') {
          setLoading(false);
          return;
        }
      } catch (e) {
        // ignore decode errors
      }
      loadSession();
    } else {
      setLoading(false);
    }
  }, []);

  const loadSession = async () => {
    try {
      const { data, error } = await authApi.getMe();
      if (error || !data) {
        setToken(null);
        setUser(null);
        setProfile(null);
        setPermissions(new Set());
      } else {
        setUser(data.user);
        setProfile(data.profile);
        setPermissions(new Set(data.permissions || []));
      }
    } catch {
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await authApi.login(email, password);
      if (error || !data) return { error: error || new Error('Login failed'), profile: null };

      setToken(data.token);
      setUser(data.user);
      setProfile(data.profile);
      setPermissions(new Set(data.permissions || []));
      return { error: null, profile: data.profile };
    } catch (error) {
      return { error: error as Error, profile: null };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: 'admin' | 'user' = 'user') => {
    try {
      const { data, error } = await authApi.signup(email, password, fullName, role);
      if (error || !data) return { error: error || new Error('Signup failed') };

      setToken(data.token);
      setUser(data.user);
      setProfile(data.profile);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    setToken(null);
    setUser(null);
    setProfile(null);
    setPermissions(new Set());
  };

  const reloadProfile = async () => {
    if (getStoredToken()) {
      await loadSession();
    }
  };

  const hasPermission = (permission: string) => {
    return permissions.has(permission);
  };

  const hasAnyPermission = (requiredPermissions: string[]) => {
    return requiredPermissions.some(p => permissions.has(p));
  };

  const hasAllPermissions = (requiredPermissions: string[]) => {
    return requiredPermissions.every(p => permissions.has(p));
  };

  return (
    <AuthContext.Provider value={{
      user, profile, session: null, loading,
      signIn, signUp, signOut, reloadProfile,
      permissions, hasPermission, hasAnyPermission, hasAllPermissions,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export function usePermissions() {
  const { permissions, hasPermission, hasAnyPermission, hasAllPermissions } = useAuth();
  return { permissions, hasPermission, hasAnyPermission, hasAllPermissions };
}
