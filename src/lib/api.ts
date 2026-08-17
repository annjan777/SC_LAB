// API client - replaces Supabase client
const API_URL = import.meta.env.VITE_API_URL || '';

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export function getStoredToken(): string | null {
  return getToken();
}

async function request<T = any>(
  path: string,
  options: RequestInit & { params?: Record<string, any> } = {}
): Promise<{ data: T | null; error: Error | null; count?: number }> {
  try {
    const { params, ...fetchOptions } = options;
    let url = `${API_URL}${path}`;

    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, val] of Object.entries(params)) {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      }
      const qs = searchParams.toString();
      if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }

    const token = getToken();
    const headers: Record<string, string> = {
      ...(fetchOptions.headers as Record<string, string> || {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(fetchOptions.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, { ...fetchOptions, headers });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return { data: null, error: new Error(json?.error || `HTTP ${res.status}`) };
    }

    // Support count responses
    if (json && typeof json === 'object' && 'count' in json && Object.keys(json).length <= 2) {
      return { data: null, error: null, count: json.count };
    }

    return { data: json as T, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

export const api = {
  get: <T = any>(path: string, params?: Record<string, any>) =>
    request<T>(path, { method: 'GET', params }),

  post: <T = any>(path: string, body?: any) =>
    request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: <T = any>(path: string, body?: any) =>
    request<T>(path, {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  delete: <T = any>(path: string) =>
    request<T>(path, { method: 'DELETE' }),

  upload: <T = any>(path: string, formData: FormData, method: string = 'POST') =>
    request<T>(path, { method, body: formData }),
};

// --- Auth API ---
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: any; profile: any; permissions: string[]; restricted?: boolean }>(
      '/api/auth/login',
      { email, password }
    ),

  signup: (email: string, password: string, full_name: string, role?: string) =>
    api.post<{ token: string; user: any; profile: any }>(
      '/api/auth/signup',
      { email, password, full_name, role }
    ),

  getMe: () =>
    api.get<{ user: any; profile: any; permissions: string[] }>('/api/auth/me'),

  changePassword: (password: string, currentPassword?: string) =>
    api.post('/api/auth/change-password', { password, currentPassword }),

  adminResetPassword: (userId: string, newPassword?: string) =>
    api.post('/api/auth/admin-reset-password', { userId, newPassword }),

  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/api/auth/forgot-password', { email }),
  verifyResetToken: () =>
    api.get<{ valid: boolean; user: any }>('/api/auth/verify-reset-token'),
};
