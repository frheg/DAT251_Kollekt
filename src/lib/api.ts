import i18n from '../i18n';

// Late approval (regret missed task)
export async function regretTask(taskId: string, memberName: string) {
  return api.post(`/tasks/${taskId}/regret?memberName=${encodeURIComponent(memberName)}`, {});
}
export async function markAllNotificationsAsRead(userName: string): Promise<void> {
  await api.post(`/notifications/${userName}/read`, {});
}
export const API_BASE = import.meta.env.VITE_API_URL || '/api';

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

function t(key: string, defaultValue?: string): string {
  return i18n.t(key, { defaultValue });
}

function sanitizeMessage(message: string, fallback: string): string {
  const normalized = message.trim();
  if (!normalized) return fallback;

  const lower = normalized.toLowerCase();

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed')
  ) {
    return t('errors.network', fallback);
  }

  if (
    lower.includes('401') ||
    lower.includes('unauthorized') ||
    lower.includes('token expired') ||
    lower.includes('jwt')
  ) {
    return t('errors.sessionExpired', fallback);
  }

  if (lower.includes('403') || lower.includes('forbidden')) {
    return t('errors.forbidden', fallback);
  }

  if (lower.includes('404') || lower.includes('not found')) {
    return t('errors.notFound', fallback);
  }

  if (lower.includes('invalid credentials')) {
    return t('errors.invalidCredentials', fallback);
  }

  if (lower.includes('already exists') || lower.includes('duplicate')) {
    return t('errors.alreadyExists', fallback);
  }

  if (lower.includes('already belongs')) {
    return t('errors.alreadyInCollective', fallback);
  }

  if (lower.includes('join code') || lower.includes('collective not found')) {
    return t('errors.invalidJoinCode', fallback);
  }

  if (
    lower.includes('backend') ||
    lower.includes('server') ||
    lower.includes('api') ||
    lower.includes('response') ||
    lower.includes('request') ||
    /^[45]\d{2}\b/.test(lower)
  ) {
    return fallback;
  }

  return normalized;
}

export function getUserMessage(error: unknown, fallback = t('errors.generic', 'Something went wrong. Please try again.')): string {
  if (error instanceof Error) {
    return sanitizeMessage(error.message, fallback);
  }

  if (typeof error === 'string') {
    return sanitizeMessage(error, fallback);
  }

  return fallback;
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
  let response: Response;

  try {
    const isFormDataBody = init?.body instanceof FormData;
    // Merge headers safely
    let mergedHeaders: Record<string, any> = {
      ...(isFormDataBody ? {} : { 'Content-Type': 'application/json' }),
      ...(authHeader || {}),
    };
    if (init && init.headers) {
      if (typeof init.headers === 'object' && !(init.headers instanceof Headers)) {
        mergedHeaders = { ...mergedHeaders, ...init.headers };
      } else if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          mergedHeaders[key] = value;
        });
      } // If it's a string, ignore (rare, not recommended)
    }
    response = await fetch(`${API_BASE}${path}` , {
      ...init,
      headers: mergedHeaders,
    });
  } catch (error) {
    throw new Error(getUserMessage(error, t('errors.network', 'Couldn\'t connect right now. Please try again in a moment.')));
  }

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
    throw new Error(getUserMessage(message, t('errors.generic', 'Something went wrong. Please try again.')));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();

  if (!text.trim()) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType.includes('application/json')) {
    return JSON.parse(text) as T;
  }

  return text as T;
}

export async function deleteNotification(userName: string, id: number): Promise<void> {
  await api.delete(`/notifications/${encodeURIComponent(userName)}/${id}`);
}

export async function deleteAllNotifications(userName: string): Promise<void> {
  await api.delete(`/notifications/${encodeURIComponent(userName)}`);
}

export async function getNotificationPreferences(memberName: string): Promise<Record<string, boolean>> {
  return api.get<Record<string, boolean>>(`/notifications/preferences?memberName=${encodeURIComponent(memberName)}`);
}

export async function updateNotificationPreference(memberName: string, prefs: Record<string, boolean>): Promise<void> {
  await api.patch(`/notifications/preferences?memberName=${encodeURIComponent(memberName)}`, prefs);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  postForm: <T>(path: string, body: FormData) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = void>(path: string, body?: unknown) =>
      request<T>(path, {
        method: 'DELETE',
        body: body ? JSON.stringify(body) : undefined,
      }),
};
