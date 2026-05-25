const API_BASE = 'http://localhost:4000/api';

export async function api(endpoint, options = {}) {
  const token = localStorage.getItem('admin_token');
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && endpoint !== '/auth/login') {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/login.html';
    throw new Error('Unauthorized');
  }

  return res;
}

export async function apiJSON(endpoint, options = {}) {
  const res = await api(endpoint, options);
  return res.json();
}

export function isAuthenticated() {
  return !!localStorage.getItem('admin_token');
}

export function logout() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  window.location.href = '/login.html';
}
