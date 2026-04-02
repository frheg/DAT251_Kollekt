import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getAccessToken, logoutSession } from '../lib/api';
import type { AppUser } from '../lib/types';

interface UserContextValue {
  currentUser: AppUser | null;
  setCurrentUser: (user: AppUser | null) => void;
  handleLogout: () => Promise<void>;
  isLoading: boolean;
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

  const setCurrentUser = (user: AppUser | null) => {
    setCurrentUserState(user);
    if (user) localStorage.setItem('kollekt-user', JSON.stringify(user));
    else localStorage.removeItem('kollekt-user');
  };

  const handleLogout = async () => {
    await logoutSession();
    setCurrentUserState(null);
    localStorage.removeItem('kollekt-user');
  };

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser, handleLogout, isLoading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used inside UserProvider');
  return ctx;
}
