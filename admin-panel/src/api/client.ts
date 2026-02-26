/**
 * Admin API client — base URL ve Bearer token ile fetch.
 * Token: localStorage.getItem('admin_token') (set after login)
 */

const getBaseUrl = (): string => {
  const url = import.meta.env.VITE_API_BASE_URL;
  if (!url) return '';
  return url.replace(/\/$/, '');
};

const getToken = (): string | null => {
  return localStorage.getItem('admin_token');
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  pagination?: { total: number; limit: number; offset: number };
  message?: string;
};

export async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const base = getBaseUrl();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 204) {
    return { success: true, data: undefined } as ApiResponse<T>;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Check for validation error with details
    if (json.error && json.error.details && Array.isArray(json.error.details)) {
      const details = json.error.details
        .map((d: { field: string; message: string }) => `${d.field}: ${d.message}`)
        .join(', ');
      throw new Error(`${json.error.message || 'Validation failed'}: ${details}`);
    }

    const raw = json.message ?? json.error;
    const msg =
      typeof raw === 'string'
        ? raw
        : raw && typeof raw === 'object' && 'message' in raw
          ? String((raw as { message?: unknown }).message)
          : raw != null
            ? JSON.stringify(raw)
            : `HTTP ${res.status}`;
    throw new Error(msg === '[object Object]' ? `HTTP ${res.status}` : msg);
  }
  return json as ApiResponse<T>;
}

export async function get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<ApiResponse<T>> {
  const search = query
    ? '?' +
      Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  return request<T>(path + search, { method: 'GET' });
}

export async function patch<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function put<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

export async function post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

export async function del<T>(path: string): Promise<ApiResponse<T>> {
  return request<T>(path, { method: 'DELETE' });
}

/** POST with FormData (Content-Type not set; boundary added by browser). */
export async function postFormData<T>(
  path: string,
  formData: FormData,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const base = getBaseUrl();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  const token = getToken();
  const headers: HeadersInit = { ...(options.headers as Record<string, string>) };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    ...options,
    method: 'POST',
    body: formData,
    headers,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json.message ?? json.error ?? `HTTP ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return json as ApiResponse<T>;
}
