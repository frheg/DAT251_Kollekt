import { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Trophy, CheckCircle2, Calendar, Wallet, TrendingUp, AlertCircle } from 'lucide-react';
import { Progress } from './ui/progress';
import { api } from '../lib/api';
import { connectCollectiveRealtime } from '../lib/realtime';
import type { AppUser, DashboardResponse, EconomySummary, Task } from '../lib/types';

interface DashboardProps {
  onNavigate: (view: string) => void;
  currentUserName: string;
}

export function Dashboard({ onNavigate, currentUserName }: DashboardProps) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [members, setMembers] = useState<AppUser[]>([]);
  const [completedTasksCount, setCompletedTasksCount] = useState(0);
  const [myBalance, setMyBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [response, collectiveMembers, tasks, economySummary] = await Promise.all([
        api.get<DashboardResponse>(`/dashboard?memberName=${encodeURIComponent(currentUserName)}`),
        api.get<AppUser[]>(`/members/collective?memberName=${encodeURIComponent(currentUserName)}`),
        api.get<Task[]>(`/tasks?memberName=${encodeURIComponent(currentUserName)}`),
        api.get<EconomySummary>(`/economy/summary?memberName=${encodeURIComponent(currentUserName)}`),
      ]);
      setData(response);
      setMembers(collectiveMembers);
      setCompletedTasksCount(tasks.filter((task) => task.completed).length);
      setMyBalance(economySummary.balances.find((balance) => balance.name === currentUserName)?.amount ?? 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const disconnect = connectCollectiveRealtime(currentUserName, (event) => {
      if (event.type === 'TASK_UPDATED' || event.type === 'XP_UPDATED') {
        void load();
      }
    });
    return disconnect;
  }, [currentUserName]);

  const currentUser = {
    name: data?.currentUserName ?? currentUserName,
    xp: data?.currentUserXp ?? 0,
    level: data?.currentUserLevel ?? 1,
    rank: data?.currentUserRank ?? 1,
  };

  const progressToNextLevel = ((currentUser.xp % 200) / 200) * 100;

  const upcomingTasks = data?.upcomingTasks ?? [];
  const upcomingEvents = data?.upcomingEvents ?? [];
  const recentExpenses = data?.recentExpenses ?? [];

  const alerts = [
    { id: 1, message: 'Tørketrommel må tømmes!', type: 'warning' },
    { id: 2, message: 'Handleliste: 3 nye varer', type: 'info' },
  ];

  return (
    <div className="space-y-4">
      {/* User Stats Card */}
      <Card className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 text-white p-6 border-0 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white mb-1">Hei, {currentUser.name}!</h2>
            <p className="text-blue-100 text-sm">Level {currentUser.level} • Rank #{currentUser.rank}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <Trophy className="w-6 h-6 text-yellow-300" />
              <span className="text-2xl">{currentUser.xp} XP</span>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-blue-100">
            <span>Progresjon til Level {currentUser.level + 1}</span>
            <span>{currentUser.xp % 200}/200 XP</span>
          </div>
          <Progress value={progressToNextLevel} className="h-2 bg-white/30" />
        </div>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              className={`p-4 flex items-center gap-3 ${
                alert.type === 'warning' ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'
              }`}
            >
              <AlertCircle
                className={`w-5 h-5 ${alert.type === 'warning' ? 'text-orange-600' : 'text-blue-600'}`}
              />
              <p className={alert.type === 'warning' ? 'text-orange-900' : 'text-blue-900'}>{alert.message}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 bg-white/80 backdrop-blur hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onNavigate('tasks')}>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl">{completedTasksCount}</p>
              <p className="text-sm text-gray-600">Oppgaver fullført</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white/80 backdrop-blur hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onNavigate('economy')}>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Wallet className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl">{myBalance} kr</p>
              <p className="text-sm text-gray-600">Din saldo</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Upcoming Tasks */}
      <Card className="p-6 bg-white/80 backdrop-blur">
        <div className="flex items-center justify-between mb-4">
          <h3>Kommende oppgaver</h3>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('tasks')}>
            Se alle
          </Button>
        </div>
        <div className="space-y-3">
          {upcomingTasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p>{task.title}</p>
                <p className="text-sm text-gray-600">{task.assignee}</p>
              </div>
              <span className="text-sm text-gray-500">{new Date(task.dueDate).toLocaleDateString('nb-NO')}</span>
            </div>
          ))}
          {!loading && upcomingTasks.length === 0 && <p className="text-sm text-gray-500">Ingen kommende oppgaver</p>}
        </div>
      </Card>

      {/* Upcoming Events */}
      <Card className="p-6 bg-white/80 backdrop-blur">
        <div className="flex items-center justify-between mb-4">
          <h3>Kommende events</h3>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('calendar')}>
            Se kalender
          </Button>
        </div>
        <div className="space-y-3">
          {upcomingEvents.map((event) => (
            <div key={event.id} className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
              <div className="flex-1">
                <p>{event.title}</p>
                <p className="text-sm text-gray-600">{new Date(event.date).toLocaleDateString('nb-NO')} • {event.time.slice(0, 5)}</p>
              </div>
            </div>
          ))}
          {!loading && upcomingEvents.length === 0 && <p className="text-sm text-gray-500">Ingen kommende events</p>}
        </div>
      </Card>

      {/* Recent Expenses */}
      <Card className="p-6 bg-white/80 backdrop-blur">
        <div className="flex items-center justify-between mb-4">
          <h3>Siste utgifter</h3>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('economy')}>
            Se alle
          </Button>
        </div>
        <div className="space-y-3">
          {recentExpenses.map((expense) => (
            <div key={expense.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p>{expense.description}</p>
                <p className="text-sm text-gray-600">Betalt av {expense.paidBy}</p>
              </div>
              <span className="font-medium">{expense.amount} kr</span>
            </div>
          ))}
          {!loading && recentExpenses.length === 0 && <p className="text-sm text-gray-500">Ingen registrerte utgifter</p>}
        </div>
      </Card>

      <Card className="p-6 bg-white/80 backdrop-blur">
        <h3 className="mb-4">Medlemmer i kollektivet</h3>
        <div className="flex flex-wrap gap-2">
          {members.map((member) => (
            <span key={member.id} className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm">
              {member.name}
            </span>
          ))}
          {!loading && members.length === 0 && <p className="text-sm text-gray-500">Ingen medlemmer funnet</p>}
        </div>
      </Card>
    </div>
  );
}
