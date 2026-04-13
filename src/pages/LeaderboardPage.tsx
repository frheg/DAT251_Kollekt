import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Flame, Star, Gift } from 'lucide-react';
import { api } from '../lib/api';
import { connectCollectiveRealtime } from '../lib/realtime';
import { useUser } from '../context/UserContext';
import type { LeaderboardResponse, Achievement, LeaderboardPeriod } from '../lib/types';

const rankIcons: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const rankColors: Record<number, string> = {
  1: 'from-secondary/40 to-secondary/10 border-secondary/30',
  2: 'from-primary/30 to-primary/5 border-primary/20',
  3: 'from-accent/30 to-accent/5 border-accent/20',
};

const PERIODS: { label: string; value: LeaderboardPeriod }[] = [
  { label: 'Overall', value: 'OVERALL' },
  { label: 'Year',    value: 'YEAR' },
  { label: 'Month',   value: 'MONTH' },
];

export default function LeaderboardPage() {
  const { currentUser } = useUser();
  const [period, setPeriod] = useState<LeaderboardPeriod>('OVERALL');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [showPrize, setShowPrize] = useState(false);
  const [prize, setPrize] = useState('');
  const [loading, setLoading] = useState(true);

  const name = currentUser?.name ?? '';

  const fetchData = async (p: LeaderboardPeriod) => {
    if (!name) return;
    setLoading(true);
    const [lb, ach] = await Promise.all([
      api.get<LeaderboardResponse>(`/leaderboard?memberName=${encodeURIComponent(name)}&period=${p}`),
      api.get<Achievement[]>('/achievements'),
    ]);
    setData(lb);
    setAchievements(ach);
    setPrize(lb.monthlyPrize ?? '');
    setLoading(false);
  };

  useEffect(() => { fetchData(period); }, [name, period]);

  useEffect(() => {
    if (!name) return;
    const disconnect = connectCollectiveRealtime(name, (event) => {
      if (['TASK_UPDATED', 'TASK_CREATED', 'TASK_DELETED', 'EXPENSE_CREATED', 'BALANCES_SETTLED'].includes(event.type)) {
        fetchData(period);
      }
    });
    return disconnect;
  }, [name, period]);

  const handleSetPrize = async () => {
    if (!name) return;
    await api.post(`/monthly-prize?memberName=${encodeURIComponent(name)}`, { prize });
    setShowPrize(false);
  };

  if (loading || !data) {
    return <div className="space-y-3 pt-4 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="glass rounded-xl h-14" />)}</div>;
  }

  const top3 = data.players.slice(0, 3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const podiumHeights = ['h-24', 'h-32', 'h-20'];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">Leaderboard</h2>
          <p className="text-sm text-muted-foreground mt-1">Who's the best roommate?</p>
        </div>
        <button onClick={() => setShowPrize((v) => !v)} className="h-9 w-9 rounded-xl glass flex items-center justify-center">
          <Gift className="h-4 w-4 text-secondary" />
        </button>
      </div>

      {/* Monthly prize editor */}
      <AnimatePresence>
        {showPrize && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass rounded-xl p-4 space-y-2 glow-accent">
              <p className="text-xs font-semibold flex items-center gap-1">🏆 Monthly Prize</p>
              <input value={prize} onChange={(e) => setPrize(e.target.value)}
                placeholder="e.g. Pizza for the winner 🍕"
                className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              <button onClick={handleSetPrize} className="w-full gradient-primary rounded-lg py-1.5 text-xs font-semibold text-primary-foreground">
                Save Prize
              </button>
              <p className="text-[10px] text-muted-foreground">Top performer this month wins the prize!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Podium */}
      {podiumOrder.length >= 3 && (
        <div className="rounded-2xl glass p-4 glow-primary/30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">Top 3</h3>
              <p className="text-[10px] text-muted-foreground">Podium view</p>
            </div>
          </div>
          <div className="flex items-end justify-center gap-3 pt-2">
            {podiumOrder.map((user, i) => {
              const isFirst = i === 1;
              return (
                <motion.div key={user.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className="flex flex-col items-center gap-2">
                  <div className={`h-12 w-12 rounded-full ${isFirst ? 'gradient-primary glow-primary' : 'bg-muted'} flex items-center justify-center text-sm font-bold ${isFirst ? 'text-primary-foreground' : ''}`}>
                    {user.name[0]}
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground">Lv.{user.level}</p>
                  </div>
                  <div className={`${podiumHeights[i]} w-20 rounded-t-xl bg-gradient-to-t ${rankColors[user.rank] ?? 'from-muted to-muted border-border'} border border-b-0 flex flex-col items-center justify-center`}>
                    <span className="text-lg">{rankIcons[user.rank] ?? `#${user.rank}`}</span>
                    <p className="font-display font-bold text-sm">{user.xp}</p>
                    <p className="text-[9px] text-muted-foreground">XP</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Period filter */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              p.value === period ? 'gradient-primary text-primary-foreground' : 'glass text-muted-foreground'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Full rankings */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Full Rankings</h3>
        {data.players.map((user, i) => (
          <motion.div key={user.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
            className={`glass rounded-xl p-3.5 flex items-center gap-3 ${user.name === name ? 'glow-primary border-primary/20' : ''}`}>
            <div className="w-6 text-center font-display font-bold text-sm text-muted-foreground">
              {rankIcons[user.rank] ?? `#${user.rank}`}
            </div>
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
              {user.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium">{user.name}</p>
                <span className="text-[10px] text-muted-foreground">Lv.{user.level}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{user.tasksCompleted} tasks</span>
                <span className="flex items-center gap-0.5"><Flame className="h-2.5 w-2.5 text-secondary" />{user.streak}d streak</span>
                {user.badges.length > 0 && <span>{user.badges.join('')}</span>}
              </div>
            </div>
            <div className="text-right">
              <p className="font-display font-bold text-sm">{user.xp}</p>
              <p className="text-[9px] text-muted-foreground">XP</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Period stats */}
      {data.weeklyStats && (
        <div className="glass rounded-2xl p-4 glow-accent">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">{PERIODS.find(p => p.value === period)?.label} Stats</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Total tasks', value: data.weeklyStats.totalTasks.toString() },
              { label: 'Total XP',    value: data.weeklyStats.totalXp.toString() },
              { label: 'Avg XP',      value: Math.round(data.weeklyStats.avgPerPerson).toString() },
              { label: 'Top contributor', value: data.weeklyStats.topContributor },
            ].map((s) => (
              <div key={s.label} className="bg-background/30 rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
                <p className="text-xs font-medium">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly prize display */}
      {data.monthlyPrize && (
        <div className="glass rounded-xl p-3 text-center">
          <p className="text-xs text-muted-foreground">🏆 Monthly Prize</p>
          <p className="text-sm font-semibold mt-0.5">{data.monthlyPrize}</p>
        </div>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <Star className="h-3.5 w-3.5" /> Achievements
          </h3>
          <div className="space-y-2">
            {achievements.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`glass rounded-xl p-3 ${a.unlocked ? 'glow-primary' : 'opacity-60'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-lg">{a.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-[10px] text-muted-foreground">{a.description}</p>
                  </div>
                  {a.progress !== undefined && a.total !== undefined && (
                    <span className="text-xs font-medium text-muted-foreground">{a.progress}/{a.total}</span>
                  )}
                </div>
                {a.progress !== undefined && a.total !== undefined && (
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full gradient-primary rounded-full" style={{ width: `${(a.progress / a.total) * 100}%` }} />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
