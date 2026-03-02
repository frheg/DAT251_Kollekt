import { useState } from 'react';
import { Home, CheckSquare, Calendar, MessageSquare, Wallet, Trophy, Beer } from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { Tasks } from './components/Tasks';
import { CalendarView } from './components/CalendarView';
import { Chat } from './components/Chat';
import { Economy } from './components/Economy';
import { Leaderboard } from './components/Leaderboard';
import { DrinkingGame } from './components/DrinkingGame';

type View = 'dashboard' | 'tasks' | 'calendar' | 'chat' | 'economy' | 'leaderboard' | 'game';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');

  const navigation = [
    { id: 'dashboard' as View, label: 'Hjem', icon: Home },
    { id: 'tasks' as View, label: 'Oppgaver', icon: CheckSquare },
    { id: 'calendar' as View, label: 'Kalender', icon: Calendar },
    { id: 'chat' as View, label: 'Chat', icon: MessageSquare },
    { id: 'economy' as View, label: 'Økonomi', icon: Wallet },
    { id: 'leaderboard' as View, label: 'Leaderboard', icon: Trophy },
    { id: 'game' as View, label: 'Drikkespill', icon: Beer },
  ];

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 px-4 py-3 shadow-sm">
        <div className="max-w-6xl mx-auto">
          <h1 className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Kollektiv Hub
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-4">
          {currentView === 'dashboard' && <Dashboard onNavigate={setCurrentView} />}
          {currentView === 'tasks' && <Tasks />}
          {currentView === 'calendar' && <CalendarView />}
          {currentView === 'chat' && <Chat />}
          {currentView === 'economy' && <Economy />}
          {currentView === 'leaderboard' && <Leaderboard />}
          {currentView === 'game' && <DrinkingGame />}
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
