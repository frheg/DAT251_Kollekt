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
import { logoutSession } from './lib/api';
import { APP_VIEWS, type AppView } from './lib/app';
import type { AppUser } from './lib/types';

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

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>(() => parseViewFromHash(window.location.hash) ?? 'dashboard');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('kollekt-user');
    if (!storedUser) return;

    try {
      setCurrentUser(JSON.parse(storedUser) as AppUser);
    } catch {
      localStorage.removeItem('kollekt-user');
    }
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
    return <StartPage onAuthenticated={handleAuthenticated} />;
  }

  return (
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
            <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right shadow-sm sm:block">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Profil</p>
              <p className="text-sm font-medium text-slate-900">{currentUser.name}</p>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Logg ut</span>
            </Button>
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
  );
}
