const BASE = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api`;

function getToken(): string | null {
  return localStorage.getItem('admin_token');
}

export async function api(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);

  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${BASE}${endpoint}`, { ...options, headers });

  if (res.status === 401 && !endpoint.includes('/auth/login')) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/login';
  }

  return res;
}

export async function apiJSON<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await api(endpoint, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json() as Promise<T>;
}
