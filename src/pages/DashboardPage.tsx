import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckSquare, Calendar, Wallet, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useUser } from '../context/UserContext';
import { formatCurrency, formatDate, formatTime, translateKey } from '../i18n/helpers';
import { connectCollectiveRealtime } from '../lib/realtime';
import type { DashboardResponse } from '../lib/types';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0, 0, 0.2, 1] as const } },
};

function XpProgress({ xp, label }: { xp: number; label: string }) {
  const xpPerLevel = 200;
  const progress = Math.min((xp % xpPerLevel) / xpPerLevel * 100, 100);
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full gradient-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0">{label}</span>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t: translate } = useTranslation();
  const { currentUser } = useUser();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = () => {
    if (!currentUser) return;
    api.get<DashboardResponse>(`/dashboard?memberName=${encodeURIComponent(currentUser.name)}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const disconnect = connectCollectiveRealtime(
      currentUser.name,
      (event) => {
        if (event.type === 'TASK_UPDATED' || event.type === 'EXPENSE_CREATED' || event.type === 'EVENT_CREATED') {
          fetchDashboard();
        }
        if (event.type === 'MEMBER_ONLINE') setOnlineCount((c) => c + 1);
        if (event.type === 'MEMBER_OFFLINE') setOnlineCount((c) => Math.max(0, c - 1));
      },
      { onConnected: () => setOnlineCount(1) },
    );
    return disconnect;
  }, [currentUser]);

  if (loading || !data) {
    return (
      <div className="space-y-4 pt-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass rounded-2xl h-24" />
        ))}
      </div>
    );
  }

  const xpLabel = `${data.currentUserXp % 200}/200 XP`;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5 pt-4">
      {/* Welcome */}
      <motion.div variants={item}>
        <p className="text-muted-foreground text-sm">{translate('dashboard.welcomeBack')} 👋</p>
        <h2 className="font-display text-2xl font-bold mt-1">{translate('dashboard.householdTitle')}</h2>
      </motion.div>

      {/* XP / Level card */}
      <motion.div variants={item} className="glass rounded-2xl p-4 glow-primary">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-12 w-12 rounded-full gradient-primary flex items-center justify-center shrink-0">
            <span className="font-display text-lg font-bold text-primary-foreground">
              {currentUser?.name[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">{translate('dashboard.level', { level: data.currentUserLevel })}</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                {translate('dashboard.rank', { rank: data.currentUserRank })}
              </span>
            </div>
            <XpProgress xp={data.currentUserXp} label={xpLabel} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: translate('dashboard.stats.tasksDone'), value: data.upcomingTasks.length.toString(), icon: CheckSquare },
            { label: translate('dashboard.stats.balance'), value: formatCurrency(0), icon: Wallet },
            { label: translate('dashboard.stats.xpEarned'), value: data.currentUserXp.toString(), icon: Zap },
          ].map((s) => (
            <div key={s.label} className="bg-background/40 rounded-xl p-2.5 text-center">
              <s.icon className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
              <p className="font-display font-bold text-base">{s.value}</p>
              <p className="text-muted-foreground text-[10px]">{s.label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Real-time indicator */}
      <motion.div variants={item} className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <p className="text-[10px] text-muted-foreground">
          {translate('common.live')} • {onlineCount > 0 ? translate('dashboard.onlineRoommates', { count: onlineCount }) : translate('common.connecting')}
        </p>
      </motion.div>

      {/* Upcoming tasks */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm text-muted-foreground">{translate('dashboard.upcomingTasks')}</h3>
          <button onClick={() => navigate('/tasks')} className="text-xs text-primary font-medium">{translate('common.seeAll')}</button>
        </div>
        <div className="space-y-2">
          {data.upcomingTasks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">{translate('dashboard.noUpcomingTasks')} 🎉</p>
          )}
          {data.upcomingTasks.slice(0, 5).map((task) => (
            <button key={task.id} onClick={() => navigate('/tasks')} className="glass rounded-xl p-3 flex items-center gap-3 w-full text-left">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <CheckSquare className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.title}</p>
                <p className="text-[10px] text-muted-foreground">{task.assignee} • {formatDate(task.dueDate)}</p>
              </div>
              <span className="text-[10px] font-medium text-primary">{translate('dashboard.xpValue', { xp: task.xp })}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Upcoming events */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm text-muted-foreground">{translate('dashboard.upcomingEvents')}</h3>
          <button onClick={() => navigate('/calendar')} className="text-xs text-primary font-medium">{translate('common.seeAll')}</button>
        </div>
        <div className="space-y-2">
          {data.upcomingEvents.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">{translate('dashboard.noUpcomingEvents')}</p>
          )}
          {data.upcomingEvents.slice(0, 3).map((e) => (
            <button key={e.id} onClick={() => navigate('/calendar')} className="glass rounded-xl p-3 flex items-center gap-3 w-full text-left">
              <div className="h-8 w-8 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                <Calendar className="h-4 w-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{e.title}</p>
                <p className="text-[10px] text-muted-foreground">{formatDate(e.date)} {formatTime(e.time)}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{translateKey('common.eventTypes', e.type)}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Recent expenses */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm text-muted-foreground">{translate('dashboard.recentExpenses')}</h3>
          <button onClick={() => navigate('/economy')} className="text-xs text-primary font-medium">{translate('common.seeAll')}</button>
        </div>
        <div className="space-y-2">
          {data.recentExpenses.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">{translate('dashboard.noRecentExpenses')}</p>
          )}
          {data.recentExpenses.slice(0, 3).map((e) => (
            <button key={e.id} onClick={() => navigate('/economy')} className="glass rounded-xl p-3 flex items-center gap-3 w-full text-left">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{e.description}</p>
                <p className="text-[10px] text-muted-foreground">{translate('dashboard.paidBy', { name: e.paidBy })} • {formatDate(e.date)}</p>
              </div>
              <p className="text-sm font-bold">{formatCurrency(e.amount)}</p>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
