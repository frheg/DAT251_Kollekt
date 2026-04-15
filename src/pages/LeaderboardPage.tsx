import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Flame, Star, Gift, X, Pencil, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { connectCollectiveRealtime } from '../lib/realtime';
import { useUser } from '../context/UserContext';
import { translateKey } from '../i18n/helpers';
import type {
  LeaderboardResponse,
  Achievement,
  AchievementCatalogItem,
  LeaderboardPeriod,
  MemberStats,
} from '../lib/types';

const rankIcons: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const rankColors: Record<number, string> = {
  1: 'from-secondary/40 to-secondary/10 border-secondary/30',
  2: 'from-primary/30 to-primary/5 border-primary/20',
  3: 'from-accent/30 to-accent/5 border-accent/20',
};
const PERIODS: LeaderboardPeriod[] = ['OVERALL', 'YEAR', 'MONTH'];

export default function LeaderboardPage() {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const [period, setPeriod] = useState<LeaderboardPeriod>('OVERALL');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [showPrize, setShowPrize] = useState(false);
  const [prize, setPrize] = useState('');
  const [loading, setLoading] = useState(true);

  // Member stats bottom sheet
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [memberStats, setMemberStats] = useState<MemberStats | null>(null);
  const [memberStatsLoading, setMemberStatsLoading] = useState(false);

  // Achievement catalog bottom sheet
  const [showAchievementConfig, setShowAchievementConfig] = useState(false);
  const [catalog, setCatalog] = useState<AchievementCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const name = currentUser?.name ?? '';

  const fetchData = async (p: LeaderboardPeriod) => {
    if (!name) return;
    setLoading(true);
    const [lb, ach] = await Promise.all([
      api.get<LeaderboardResponse>(`/leaderboard?memberName=${encodeURIComponent(name)}&period=${p}`),
      api.get<Achievement[]>(`/achievements?memberName=${encodeURIComponent(name)}`),
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

  const handleOpenMemberStats = async (memberName: string) => {
    setSelectedMember(memberName);
    setMemberStats(null);
    setMemberStatsLoading(true);
    try {
      const stats = await api.get<MemberStats>(
        `/members/stats?viewerName=${encodeURIComponent(name)}&targetName=${encodeURIComponent(memberName)}`,
      );
      setMemberStats(stats);
    } finally {
      setMemberStatsLoading(false);
    }
  };

  const handleOpenAchievementConfig = async () => {
    setShowAchievementConfig(true);
    if (catalog.length > 0) return;
    setCatalogLoading(true);
    try {
      const items = await api.get<AchievementCatalogItem[]>(
        `/achievements/catalog?memberName=${encodeURIComponent(name)}`,
      );
      setCatalog(items);
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleToggleAchievement = async (key: string, enabled: boolean) => {
    const updated = catalog.map((item) => (item.key === key ? { ...item, enabled } : item));
    setCatalog(updated);
    const enabledKeys = updated.filter((item) => item.enabled).map((item) => item.key);
    await api.patch(`/achievements/config?memberName=${encodeURIComponent(name)}`, { enabledKeys });
    fetchData(period);
  };

  if (loading || !data) {
    return <div className="space-y-3 pt-4 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="glass rounded-xl h-14" />)}</div>;
  }

  const top3 = data.players.slice(0, 3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;
  const podiumHeights = ['h-24', 'h-32', 'h-20'];
  const ps = data.periodStats;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">{t('leaderboard.title')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('leaderboard.subtitle')}</p>
        </div>
      </div>

      {/* Podium */}
      {podiumOrder.length >= 3 && (
        <div className="rounded-2xl glass p-4 glow-primary/30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">{t('leaderboard.topThree')}</h3>
              <p className="text-[10px] text-muted-foreground">{t('leaderboard.podiumView')}</p>
            </div>
          </div>
          <div className="flex items-end justify-center gap-3 pt-2">
            {podiumOrder.map((user, i) => {
              const isFirst = i === 1;
              return (
                <motion.div key={user.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className="flex flex-col items-center gap-2 cursor-pointer"
                  onClick={() => handleOpenMemberStats(user.name)}>
                  <div className={`h-12 w-12 rounded-full ${isFirst ? 'gradient-primary glow-primary' : 'bg-muted'} flex items-center justify-center text-sm font-bold ${isFirst ? 'text-primary-foreground' : ''}`}>
                    {user.name[0]}
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground">{t('leaderboard.levelShort', { level: user.level })}</p>
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
        {PERIODS.map((periodValue) => (
          <button key={periodValue} onClick={() => setPeriod(periodValue)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              periodValue === period ? 'gradient-primary text-primary-foreground' : 'glass text-muted-foreground'
            }`}>
            {translateKey('common.leaderboardPeriods', periodValue)}
          </button>
        ))}
      </div>

      {/* Monthly prize card */}
      <div className="glass rounded-xl p-3 flex items-center gap-3">
        <Gift className="h-4 w-4 text-secondary shrink-0" />
        <div className="flex-1 min-w-0">
          {showPrize ? (
            <div className="flex gap-2">
              <input value={prize} onChange={(e) => setPrize(e.target.value)}
                placeholder={t('leaderboard.monthlyPrizePlaceholder')}
                className="flex-1 bg-muted/50 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
              <button onClick={handleSetPrize} className="gradient-primary rounded-lg px-3 py-1 text-xs font-semibold text-primary-foreground shrink-0">
                {t('leaderboard.savePrize')}
              </button>
            </div>
          ) : (
            <>
              <p className="text-[10px] text-muted-foreground">{t('leaderboard.monthlyPrize')}</p>
              <p className="text-xs font-medium">{data.monthlyPrize || <span className="text-muted-foreground">{t('leaderboard.monthlyPrizePlaceholder')}</span>}</p>
            </>
          )}
        </div>
        <button onClick={() => setShowPrize((v) => !v)} className="h-7 w-7 rounded-lg glass flex items-center justify-center shrink-0">
          {showPrize ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </div>

      {/* Full rankings */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">{t('leaderboard.fullRankings')}</h3>
        {data.players.map((user, i) => (
          <motion.div key={user.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
            className={`glass rounded-xl p-3.5 flex items-center gap-3 cursor-pointer ${user.name === name ? 'glow-primary border-primary/20' : ''}`}
            onClick={() => handleOpenMemberStats(user.name)}>
            <div className="w-6 text-center font-display font-bold text-sm text-muted-foreground">
              {rankIcons[user.rank] ?? `#${user.rank}`}
            </div>
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
              {user.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium">{user.name}</p>
                <span className="text-[10px] text-muted-foreground">{t('leaderboard.levelShort', { level: user.level })}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{t('leaderboard.tasksCompleted', { count: user.tasksCompleted })}</span>
                <span className="flex items-center gap-0.5"><Flame className="h-2.5 w-2.5 text-secondary" />{t('leaderboard.streak', { count: user.streak })}</span>
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
      <div className="glass rounded-2xl p-4 glow-accent">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">{t('leaderboard.statsTitle', { period: translateKey('common.leaderboardPeriods', period) })}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: t('leaderboard.stats.totalTasks'), value: ps.totalTasks.toString() },
            { label: t('leaderboard.stats.totalXp'), value: ps.totalXp.toString() },
            { label: t('leaderboard.stats.avgXp'), value: Math.round(ps.avgPerPerson).toString() },
            { label: t('leaderboard.stats.topContributor'), value: ps.topContributor },
            { label: 'Best streak', value: `${ps.bestStreak}d — ${ps.bestStreakHolder}` },
            { label: 'Late completions', value: ps.lateCompletions > 0 ? `${ps.lateCompletions} (${ps.lateCompletionsHolder})` : '0' },
            { label: 'Skipped tasks', value: ps.skippedCount > 0 ? `${ps.skippedCount} (${ps.skippedHolder})` : '0' },
            { label: 'Penalty XP', value: ps.totalPenaltyXp.toString() },
          ].map((s) => (
            <div key={s.label} className="bg-background/30 rounded-lg p-2">
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <p className="text-xs font-medium truncate">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
              <Star className="h-3.5 w-3.5" /> {t('leaderboard.achievements')}
            </h3>
            <button onClick={handleOpenAchievementConfig} className="h-7 w-7 rounded-lg glass flex items-center justify-center">
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-2">
            {achievements.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`glass rounded-xl p-3 ${a.unlocked ? 'glow-primary' : 'opacity-60'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t(`leaderboard.achievementKeys.${a.key}.title`, { defaultValue: a.title })}</p>
                    <p className="text-[10px] text-muted-foreground">{t(`leaderboard.achievementKeys.${a.key}.description`, { defaultValue: a.description })}</p>
                  </div>
                  {a.progress !== undefined && a.total !== undefined && (
                    <span className="text-xs font-medium text-muted-foreground shrink-0">{a.progress}/{a.total}</span>
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

      {/* Member stats bottom sheet */}
      <AnimatePresence>
        {selectedMember && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setSelectedMember(null)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 glass rounded-2xl p-5 pb-6" style={{ width: 'calc(100% - 2rem)', maxWidth: '32rem' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                    {selectedMember[0]}
                  </div>
                  <div>
                    <p className="font-semibold">{selectedMember}</p>
                    {memberStats && (
                      <p className="text-[10px] text-muted-foreground">
                        {t('leaderboard.levelShort', { level: memberStats.level })} · Rank #{memberStats.rank}
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedMember(null)} className="h-8 w-8 rounded-xl glass flex items-center justify-center">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {memberStatsLoading && (
                <div className="grid grid-cols-3 gap-2 animate-pulse">
                  {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-muted/30 rounded-lg" />)}
                </div>
              )}
              {memberStats && !memberStatsLoading && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'XP', value: memberStats.xp.toString() },
                    { label: 'Streak', value: `${memberStats.streak}d` },
                    { label: 'Tasks done', value: memberStats.tasksCompleted.toString() },
                    { label: 'Late', value: memberStats.lateCompletions.toString() },
                    { label: 'Skipped', value: memberStats.skippedTasks.toString() },
                    { label: 'Achievements', value: `${memberStats.achievementsUnlocked}/${memberStats.achievementsTotal}` },
                  ].map((s) => (
                    <div key={s.label} className="bg-background/30 rounded-lg p-2.5 text-center">
                      <p className="font-display font-bold text-sm">{s.value}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Achievement config bottom sheet */}
      <AnimatePresence>
        {showAchievementConfig && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setShowAchievementConfig(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 glass rounded-2xl flex flex-col" style={{ maxHeight: 'calc(100vh - 6rem)', width: 'calc(100% - 2rem)', maxWidth: '32rem' }}>
              <div className="flex items-center justify-between p-5 pb-3 shrink-0">
                <div>
                  <p className="font-semibold">{t('leaderboard.manageAchievements')}</p>
                  <p className="text-[10px] text-muted-foreground">{t('leaderboard.manageAchievementsSubtitle')}</p>
                </div>
                <button onClick={() => setShowAchievementConfig(false)} className="h-8 w-8 rounded-xl glass flex items-center justify-center shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-y-auto px-5 pb-5">
                {catalogLoading && (
                  <div className="space-y-2 animate-pulse">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted/30 rounded-lg" />)}
                  </div>
                )}
                {!catalogLoading && catalog.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => handleToggleAchievement(item.key, !item.enabled)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                    <div className="text-left">
                      <p className="text-sm font-medium">{t(`leaderboard.achievementKeys.${item.key}.title`, { defaultValue: item.title })}</p>
                      <p className="text-[10px] text-muted-foreground">{t(`leaderboard.achievementKeys.${item.key}.description`, { defaultValue: item.description })}</p>
                    </div>
                    <div className={`h-5 w-9 rounded-full transition-colors flex items-center px-0.5 shrink-0 ml-3 ${item.enabled ? 'bg-primary' : 'bg-muted'}`}>
                      <div className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${item.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
