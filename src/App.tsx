import { useEffect, useState } from 'react';
import {
  Beer,
  Calendar,
  CheckSquare,
  Home,
  LogOut,
  MessageSquare,
  Trophy,
  Wallet,
} from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { Tasks } from './components/Tasks';
import { CalendarView } from './components/CalendarView';
import { Chat } from './components/Chat';
import { Economy } from './components/Economy';
import { Leaderboard } from './components/Leaderboard';
import { DrinkingGame } from './components/DrinkingGame';
import { StartPage } from './components/StartPage';
import { Button } from './components/ui/button';
import { UserMenu } from './components/UserMenu';
import { NotificationDropdown } from "./components/NotificationDropdown" 
import { api, logoutSession, API_BASE, getAccessToken } from './lib/api';
import { APP_VIEWS, type AppView } from './lib/app';
import type { AppUser } from './lib/types';
import { ThemeProvider } from './components/ThemeProvider';
import { ThemeSelector } from './components/ThemeSelector';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './components/ui/dialog';
import { Profile } from './components/Profile';

const VIEW_HASH_PREFIX = '#';

const navigationItems: Array<{
  id: AppView;
  label: string;
  icon: typeof Home;
}> = [
  { id: 'dashboard', label: 'Hjem', icon: Home },
  { id: 'tasks', label: 'Oppgaver', icon: CheckSquare },
  { id: 'calendar', label: 'Kalender', icon: Calendar },
  { id: 'chat', label: 'Samtaler', icon: MessageSquare },
  { id: 'economy', label: 'Felleskasse', icon: Wallet },
  { id: 'leaderboard', label: 'Poeng', icon: Trophy },
  { id: 'game', label: 'Spill', icon: Beer },
];

function parseViewFromHash(hash: string): AppView | null {
  const normalized = hash.replace(VIEW_HASH_PREFIX, '').trim().toLowerCase();
  return APP_VIEWS.includes(normalized as AppView) ? (normalized as AppView) : null;
}

// ── Sub-components defined OUTSIDE App ────────────────────────────────────────

function ProfileForm({
  currentUser,
  onUpdate,
}: {
  currentUser: AppUser;
  onUpdate: (user: AppUser) => void;
}) {
  const [name, setName] = useState(currentUser.name);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setError('');
    try {
      const res = await fetch(
        `${API_BASE}/members/profile?memberName=${encodeURIComponent(currentUser.name)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({ name }),
        }
      );
      if (!res.ok) throw new Error((await res.json())?.message || 'Kunne ikke oppdatere profil');
      const updated = { ...currentUser, name };
      localStorage.setItem('kollekt-user', JSON.stringify(updated));
      setStatus('success');
      setTimeout(() => {
        setStatus('idle');
        onUpdate(updated);
      }, 1000);
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Noe gikk galt');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor="profileName">
        Navn
      </label>
      <input
        id="profileName"
        type="text"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-base"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        disabled={status === 'loading'}
      />
      <Button
        type="submit"
        className="w-full"
        variant="default"
        disabled={status === 'loading' || !name.trim()}
      >
        {status === 'loading' ? 'Lagrer...' : 'Lagre endringer'}
      </Button>
      {status === 'success' && <div className="text-green-600 text-sm">Profil oppdatert!</div>}
      {status === 'error' && <div className="text-rose-600 text-sm">{error}</div>}
    </form>
  );
}

function ChangeCollectiveForm({
  currentUser,
  onSuccess,
}: {
  currentUser: AppUser;
  onSuccess: () => void;
}) {
  const [collectiveCode, setCollectiveCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setStatus('loading');
      setError('');
      try {
        const res = await fetch(`${API_BASE}/onboarding/collectives/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({ userId: currentUser.id, joinCode: collectiveCode.trim().toUpperCase() }),
        });
        if (!res.ok) throw new Error((await res.json())?.message || 'Kunne ikke bytte kollektiv');
        setStatus('success');
        setCollectiveCode('');
        setTimeout(() => {
          setStatus('idle');
          onSuccess();
          window.location.reload();
        }, 1000);
      } catch (err: any) {
        setStatus('error');
        setError(err.message || 'Noe gikk galt');
      }
    };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor="collectiveCode">
        Kollektivkode
      </label>
      <input
        id="collectiveCode"
        type="text"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-base"
        value={collectiveCode}
        onChange={(e) => setCollectiveCode(e.target.value)}
        required
        disabled={status === 'loading'}
      />
      <button
        type="submit"
        className="w-full rounded-lg bg-indigo-600 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        disabled={status === 'loading' || !collectiveCode.trim()}
      >
        {status === 'loading' ? 'Bytter...' : 'Bytt kollektiv'}
      </button>
      {status === 'success' && <div className="text-green-600 text-sm">Kollektiv byttet!</div>}
      {status === 'error' && <div className="text-rose-600 text-sm">{error}</div>}
    </form>
  );
}

function AddFriendForm({
  currentUser,
  onSuccess,
}: {
  currentUser: AppUser;
  onSuccess: () => void;
}) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setError('');
    try {
      const res = await fetch(
        `${API_BASE}/members/invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({ email: inviteEmail, collectiveCode: currentUser.collectiveCode }),
        }
      );
      if (!res.ok) throw new Error((await res.json())?.message || 'Kunne ikke sende invitasjon');
      setStatus('success');
      setInviteEmail('');
      setTimeout(() => {
        setStatus('idle');
        onSuccess();
      }, 1000);
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Noe gikk galt');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor="inviteEmail">
        E-post til den du vil invitere
      </label>
      <input
        id="inviteEmail"
        type="email"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-base"
        value={inviteEmail}
        onChange={(e) => setInviteEmail(e.target.value)}
        required
        disabled={status === 'loading'}
      />
      <Button
        type="submit"
        className="w-full"
        variant="default"
        disabled={status === 'loading' || !inviteEmail.trim()}
      >
        {status === 'loading' ? 'Sender...' : 'Send invitasjon'}
      </Button>
      {status === 'success' && <div className="text-green-600 text-sm">Invitasjon sendt!</div>}
      {status === 'error' && <div className="text-rose-600 text-sm">{error}</div>}
    </form>
  );
}

function ResetPasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setError('');
    try {
      const res = await fetch(
        `${API_BASE}/members/reset-password?email=${encodeURIComponent(email)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ newPassword }),
        }
      );
      if (!res.ok) throw new Error((await res.json())?.message || 'Kunne ikke endre passord');
      setStatus('success');
      setNewPassword('');
      setTimeout(() => {
        setStatus('idle');
        onSuccess();
      }, 1000);
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Noe gikk galt');
    }
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor="resetEmail">
        E-post
      </label>
      <input
        id="resetEmail"
        type="email"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-base"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        disabled={status === 'loading'}
      />
      <label className="block text-sm font-medium text-slate-700" htmlFor="newPassword">
        Nytt passord
      </label>
      <input
        id="newPassword"
        type="password"
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-base"
        value={newPassword}
        onChange={e => setNewPassword(e.target.value)}
        required
        minLength={6}
        disabled={status === 'loading'}
      />
      <button
        type="submit"
        className="w-full rounded-lg bg-indigo-600 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        disabled={status === 'loading' || !email.trim() || !newPassword.trim()}
      >
        Endre passord
      </button>
      {status === 'success' && <div className="text-green-600 text-sm">Passord endret!</div>}
      {status === 'error' && <div className="text-rose-600 text-sm">{error}</div>}
    </form>
  );
}

function DeleteUserForm({
  currentUser,
  onSuccess,
}: {
  currentUser: AppUser;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setError('');
    try {
      const res = await fetch(
        `${API_BASE}/members/delete?memberName=${encodeURIComponent(currentUser.name)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
        }
      );
      if (!res.ok) throw new Error((await res.json())?.message || 'Kunne ikke slette bruker');
      setStatus('success');
      setTimeout(() => {
        setStatus('idle');
        onSuccess();
      }, 1000);
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Noe gikk galt');
    }
  };

  return (
    <form onSubmit={handleDelete} className="space-y-4 pt-2">
      <Button
        type="submit"
        className="w-full"
        variant="destructive"
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Sletter...' : 'Slett bruker'}
      </Button>
      {status === 'success' && <div className="text-green-600 text-sm">Bruker slettet!</div>}
      {status === 'error' && <div className="text-rose-600 text-sm">{error}</div>}
    </form>
  );
}

// ── Main App component ─────────────────────────────────────────────────────────

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>(
    () => parseViewFromHash(window.location.hash) ?? 'dashboard'
  );
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [showTheme, setShowTheme] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showChangeHome, setShowChangeHome] = useState(false);
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showDeleteUser, setShowDeleteUser] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      localStorage.removeItem('kollekt-user');
      return;
    }

    const storedUser = localStorage.getItem('kollekt-user');
    if (!storedUser) return;
    try {
      setCurrentUser(JSON.parse(storedUser) as AppUser);
    } catch {
      localStorage.removeItem('kollekt-user');
    }
  }, []);

  useEffect(() => {
    if (!getAccessToken()) return;

    let cancelled = false;

    void api.get<AppUser>('/onboarding/me')
      .then((user) => {
        if (cancelled) return;
        setCurrentUser(user);
        localStorage.setItem('kollekt-user', JSON.stringify(user));
      })
      .catch(() => {
        if (cancelled) return;
        if (!getAccessToken()) {
          setCurrentUser(null);
          localStorage.removeItem('kollekt-user');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const view = parseViewFromHash(window.location.hash);
      if (view) setCurrentView(view);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const expectedHash = `${VIEW_HASH_PREFIX}${currentView}`;
    if (window.location.hash !== expectedHash) {
      window.history.replaceState(null, '', expectedHash);
    }
  }, [currentView]);

  const handleAuthenticated = (user: AppUser) => {
    setCurrentUser(user);
    localStorage.setItem('kollekt-user', JSON.stringify(user));
  };

  const handleLogout = () => {
    void logoutSession();
    setCurrentUser(null);
    localStorage.removeItem('kollekt-user');
    setCurrentView('dashboard');
    window.history.replaceState(null, '', '#dashboard');
  };

  const renderView = () => {
    if (!currentUser) return null;
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentView} currentUserName={currentUser.name} />;
      case 'tasks':
        return <Tasks currentUserName={currentUser.name} />;
      case 'calendar':
        return <CalendarView currentUserName={currentUser.name} />;
      case 'chat':
        return <Chat currentUserName={currentUser.name} />;
      case 'economy':
        return <Economy currentUserName={currentUser.name} />;
      case 'leaderboard':
        return <Leaderboard currentUserName={currentUser.name} />;
      case 'game':
        return <DrinkingGame currentUserName={currentUser.name} />;
      default:
        return null;
    }
  };

  if (!currentUser) {
    return (
      <ThemeProvider>
        <StartPage onAuthenticated={handleAuthenticated} />
      </ThemeProvider>
    );
  }

  // Show onboarding if user is logged in but not in a collective
  if (!currentUser.collectiveCode) {
    return (
      <ThemeProvider>
        <StartPage onAuthenticated={handleAuthenticated} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ThemeSelector open={showTheme} onClose={() => setShowTheme(false)} />

      {/* Profile Modal */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Min profil</DialogTitle>
            <DialogDescription>Se og rediger din profilinformasjon.</DialogDescription>
          </DialogHeader>
          <Profile
            user={currentUser}
            onStatusChange={(status) => {
              const updatedUser = { ...currentUser, status };
              setCurrentUser(updatedUser);
              localStorage.setItem('kollekt-user', JSON.stringify(updatedUser));
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Change Home Modal */}
      <Dialog open={showChangeHome} onOpenChange={setShowChangeHome}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bytt kollektiv</DialogTitle>
            <DialogDescription>
              Bli med i et nytt kollektiv ved å skrive inn kollektivkode.
            </DialogDescription>
          </DialogHeader>
          <ChangeCollectiveForm
            currentUser={currentUser}
            onSuccess={() => setShowChangeHome(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Add Friends Modal */}
      <Dialog open={showAddFriends} onOpenChange={setShowAddFriends}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Legg til venner</DialogTitle>
            <DialogDescription>Inviter en venn til kollektivet ditt.</DialogDescription>
          </DialogHeader>
          <AddFriendForm currentUser={currentUser} onSuccess={() => setShowAddFriends(false)} />
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={showResetPassword} onOpenChange={setShowResetPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bytt passord</DialogTitle>
            <DialogDescription>Her kan du endre passordet ditt.</DialogDescription>
          </DialogHeader>
          <ResetPasswordForm
            onSuccess={() => setShowResetPassword(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete User Modal */}
      <Dialog open={showDeleteUser} onOpenChange={setShowDeleteUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Slett bruker</DialogTitle>
            <DialogDescription>
              Er du sikker på at du vil slette brukeren din? Dette kan ikke angres.
            </DialogDescription>
          </DialogHeader>
          <DeleteUserForm
            currentUser={currentUser}
            onSuccess={() => {
              setShowDeleteUser(false);
              handleLogout();
            }}
          />
        </DialogContent>
      </Dialog>

      <div className="min-h-dvh">
        <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4 md:px-6">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Kollektiv Hub
              </p>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">
                  Hei, {currentUser.name}
                </h1>
                <p className="truncate text-sm text-slate-600">
                  {currentUser.collectiveCode
                    ? `Kollektivkode ${currentUser.collectiveCode}`
                    : 'Fullfør oppsettet for å invitere resten av kollektivet.'}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {/* Notification Dropdown next to UserMenu */}
              <NotificationDropdown userName={currentUser.name} />
              <UserMenu
                user={{ name: currentUser.name, avatarUrl: undefined }}
                onAction={(action) => {
                  if (action === 'logout') handleLogout();
                  else if (action === 'theme') setShowTheme(true);
                  else if (action === 'profile') setShowProfile(true);
                  else if (action === 'changeHome') setShowChangeHome(true);
                  else if (action === 'addFriends') setShowAddFriends(true);
                  else if (action === 'resetPassword') setShowResetPassword(true);
                  else if (action === 'deleteUser') setShowDeleteUser(true);
                  else if (action === 'leaveCollective') handleLeaveCollective();
                  function handleLeaveCollective() {
                    if (!currentUser) return;
                    (async () => {
                      try {
                        await api.patch<void>(`/members/leave-collective?memberName=${encodeURIComponent(currentUser.name)}`);
                        const updatedUser: AppUser = { ...currentUser, collectiveCode: '' };
                        setCurrentUser(updatedUser);
                        localStorage.setItem('kollekt-user', JSON.stringify(updatedUser));
                      } catch (err) {
                        alert('Kunne ikke forlate kollektivet. Prøv igjen.');
                      }
                    })();
                  }
                }}
              />
            </div>
          </div>
        </header>

        <main className="mx-auto min-h-dvh max-w-7xl px-3 pb-36 pt-24 sm:px-4 sm:pb-32 sm:pt-28 md:px-6">
          {renderView()}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40" aria-label="Hovedmeny">
          <div className="mx-auto max-w-7xl px-3 pb-3 sm:px-4 sm:pb-4 md:px-6">
            <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/94 p-2 shadow-lg backdrop-blur">
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => setCurrentView(item.id)}
                      className={`flex min-h-16 items-center justify-center gap-2 rounded-2xl px-2 py-3 text-center text-xs font-medium transition sm:min-h-14 sm:flex-col sm:gap-1 ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="leading-tight">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </nav>
      </div>
    </ThemeProvider>
  );
}
