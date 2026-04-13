import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { api, getAccessToken, logoutSession, deleteNotification, deleteAllNotifications } from '../lib/api';
import { connectCollectiveRealtime } from '../lib/realtime';
import type { AppUser, Notification } from '../lib/types';

interface UserContextValue {
  currentUser: AppUser | null;
  setCurrentUser: (user: AppUser | null) => void;
  handleLogout: () => Promise<void>;
  isLoading: boolean;
  notifications: Notification[];
  notificationsLoading: boolean;
  refreshNotifications: () => void;
  dismissNotification: (id: number) => void;
  clearAllNotifications: () => void;
  markAllNotificationsRead: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<AppUser | null>(() => {
    if (!getAccessToken()) return null;
    const stored = localStorage.getItem('kollekt-user');
    if (!stored) return null;
    try { return JSON.parse(stored) as AppUser; } catch { return null; }
  });
  const [isLoading, setIsLoading] = useState(!!getAccessToken());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    api.get<AppUser>('/onboarding/me')
      .then((user) => {
        if (cancelled) return;
        setCurrentUserState(user);
        localStorage.setItem('kollekt-user', JSON.stringify(user));
      })
      .catch(() => {
        if (cancelled) return;
        if (!getAccessToken()) {
          setCurrentUserState(null);
          localStorage.removeItem('kollekt-user');
        }
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const fetchNotifications = useCallback((name: string) => {
    setNotificationsLoading(true);
    api.get<Notification[]>(`/notifications/${encodeURIComponent(name)}`)
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setNotificationsLoading(false));
  }, []);

  useEffect(() => {
    if (!currentUser?.name) { setNotifications([]); return; }
    fetchNotifications(currentUser.name);
  }, [currentUser?.name, fetchNotifications]);

  useEffect(() => {
    if (!currentUser?.name) return;
    const name = currentUser.name;
    const disconnect = connectCollectiveRealtime(name, (event) => {
      if (event.type === 'NOTIFICATION_CREATED') {
        fetchNotifications(name);
      }
    });
    return disconnect;
  }, [currentUser?.name, fetchNotifications]);

  const setCurrentUser = (user: AppUser | null) => {
    setCurrentUserState(user);
    if (user) localStorage.setItem('kollekt-user', JSON.stringify(user));
    else localStorage.removeItem('kollekt-user');
  };

  const handleLogout = async () => {
    await logoutSession();
    setCurrentUserState(null);
    setNotifications([]);
    localStorage.removeItem('kollekt-user');
  };

  const refreshNotifications = useCallback(() => {
    if (currentUser?.name) fetchNotifications(currentUser.name);
  }, [currentUser?.name, fetchNotifications]);

  const dismissNotification = useCallback(async (id: number) => {
    if (!currentUser?.name) return;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(currentUser.name, id).catch(() => {});
  }, [currentUser?.name]);

  const clearAllNotifications = useCallback(async () => {
    if (!currentUser?.name) return;
    setNotifications([]);
    await deleteAllNotifications(currentUser.name).catch(() => {});
  }, [currentUser?.name]);

  const markAllNotificationsRead = useCallback(async () => {
    if (!currentUser?.name) return;
    await api.post(`/notifications/${encodeURIComponent(currentUser.name)}/read`, {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [currentUser?.name]);

  return (
    <UserContext.Provider value={{
      currentUser,
      setCurrentUser,
      handleLogout,
      isLoading,
      notifications,
      notificationsLoading,
      refreshNotifications,
      dismissNotification,
      clearAllNotifications,
      markAllNotificationsRead,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used inside UserProvider');
  return ctx;
}
