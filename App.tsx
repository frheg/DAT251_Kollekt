import { useEffect, useState } from 'react';
import { Home, CheckSquare, Calendar, MessageSquare, Wallet, Trophy, Beer, LogOut } from 'lucide-react';
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
import type { AppUser } from './lib/types';

type View = 'dashboard' | 'tasks' | 'calendar' | 'chat' | 'economy' | 'leaderboard' | 'game';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('kollekt-user');
    if (!stored) return;
    try {
      setCurrentUser(JSON.parse(stored) as AppUser);
    } catch {
      localStorage.removeItem('kollekt-user');
    }
  }, []);

  const handleAuthenticated = (user: AppUser) => {
    setCurrentUser(user);
    localStorage.setItem('kollekt-user', JSON.stringify(user));
  };

  const logout = () => {
    void logoutSession();
    setCurrentUser(null);
    localStorage.removeItem('kollekt-user');
    setCurrentView('dashboard');
  };

  const navigation = [
    { id: 'dashboard' as View, label: 'Hjem', icon: Home },
    { id: 'tasks' as View, label: 'Oppgaver', icon: CheckSquare },
    { id: 'calendar' as View, label: 'Kalender', icon: Calendar },
    { id: 'chat' as View, label: 'Chat', icon: MessageSquare },
    { id: 'economy' as View, label: 'Økonomi', icon: Wallet },
    { id: 'leaderboard' as View, label: 'Leaderboard', icon: Trophy },
    { id: 'game' as View, label: 'Drikkespill', icon: Beer },
  ];

  if (!currentUser) {
    return <StartPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 px-4 py-3 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <h1 className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Kollektiv Hub
          </h1>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-sm text-gray-900">{currentUser.name}</p>
              <p className="text-xs text-gray-500">Kode: {currentUser.collectiveCode ?? 'Ingen'}</p>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4 mr-1" />
              Logg ut
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-4">
          {currentView === 'dashboard' && <Dashboard onNavigate={setCurrentView} currentUserName={currentUser.name} />}
          {currentView === 'tasks' && <Tasks currentUserName={currentUser.name} />}
          {currentView === 'calendar' && <CalendarView currentUserName={currentUser.name} />}
          {currentView === 'chat' && <Chat currentUserName={currentUser.name} />}
          {currentView === 'economy' && <Economy currentUserName={currentUser.name} />}
          {currentView === 'leaderboard' && <Leaderboard currentUserName={currentUser.name} />}
          {currentView === 'game' && <DrinkingGame currentUserName={currentUser.name} />}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white/80 backdrop-blur-lg border-t border-gray-200/50 shadow-lg">
        <div className="max-w-6xl mx-auto px-2 py-2">
          <div className="flex justify-around items-center">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white shadow-md'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
