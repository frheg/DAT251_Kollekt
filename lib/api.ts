export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const TOKEN_KEY = 'kollekt-access-token';
const REFRESH_TOKEN_KEY = 'kollekt-refresh-token';

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function clearRefreshToken(): void {
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function logoutSession(): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    clearAccessToken();
    clearRefreshToken();
    return;
  }
  const refreshToken = getRefreshToken();
  try {
    await fetch(`${API_BASE}/onboarding/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ refreshToken }),
    });
  } finally {
    clearAccessToken();
    clearRefreshToken();
  }
}

interface AuthRefreshResponse {
  accessToken: string;
  refreshToken: string;
}

async function tryRefreshTokens(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const response = await fetch(`${API_BASE}/onboarding/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearAccessToken();
    clearRefreshToken();
    return false;
  }

  const payload = (await response.json()) as AuthRefreshResponse;
  setAccessToken(payload.accessToken);
  setRefreshToken(payload.refreshToken);
  return true;
}

async function request<T>(path: string, init?: RequestInit, retryOnAuthFailure = true): Promise<T> {
  const token = getAccessToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeader, ...(init?.headers || {}) },
    ...init,
  });

  if (response.status === 401 && retryOnAuthFailure && path !== '/onboarding/refresh') {
    const refreshed = await tryRefreshTokens();
    if (refreshed) {
      return request<T>(path, init, false);
    }
  }

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    if (text) {
      try {
        const parsed = JSON.parse(text) as { error?: string };
        message = parsed.error ?? text;
      } catch {
        // Keep raw body when it is not JSON.
      }
    }
    throw new Error(message || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
};
