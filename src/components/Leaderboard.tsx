import { useEffect, useState } from 'react';
import { Award, Flame, Star, Target, Trophy, Zap } from 'lucide-react';
import { Badge } from './ui/badge';
import { Confetti } from './ui/Confetti';
import { Sparkles } from './ui/Sparkles';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { api } from '../lib/api';
import { connectCollectiveRealtime } from '../lib/realtime';
import {
  EmptyState,
  PageHeader,
  PageStack,
  SectionCard,
} from './shared/page';
import type { Achievement, LeaderboardResponse, LeaderboardPeriod } from '../lib/types';

interface LeaderboardProps {
  currentUserName: string;
}

const rankStyles: Record<number, string> = {
  1: 'bg-amber-100 text-amber-700',
  2: 'bg-slate-200 text-slate-700',
  3: 'bg-orange-100 text-orange-700',
};

const getPeriodText = (period: LeaderboardPeriod) => {
  switch (period) {
    case 'OVERALL': return { short: 'totalt', long: 'hele perioden', points: 'Poeng totalt' };
    case 'YEAR': return { short: 'året', long: 'dette året', points: 'Poeng dette året' };
    case 'MONTH': return { short: 'måneden', long: 'denne måneden', points: 'Poeng denne måneden' };
  }
};

const getPeriodDescription = (period: LeaderboardPeriod) => {
  switch (period) {
    case 'OVERALL': return 'Se hvordan innsatsen fordeler seg i kollektivet totalt.';
    case 'YEAR': return 'Se hvordan innsatsen fordeler seg i kollektivet dette året.';
    case 'MONTH': return 'Se hvordan innsatsen fordeler seg i kollektivet denne måneden.';
  }
};

export function Leaderboard({ currentUserName }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse>({
    players: [],
    weeklyStats: {
      totalTasks: 0,
      totalXp: 0,
      avgPerPerson: 0,
      topContributor: '',
    },
  });
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [lastLevel, setLastLevel] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [period, setPeriod] = useState<LeaderboardPeriod>('OVERALL');
  const [isEditingPrize, setIsEditingPrize] = useState(false);
  const [editedPrize, setEditedPrize] = useState('');
  const [isSavingPrize, setIsSavingPrize] = useState(false);
  const [prizeSaveError, setPrizeSaveError] = useState<string | null>(null);

  const load = async () => {
    const [leaderboardData, achievementData] = await Promise.all([
      api.get<LeaderboardResponse>(`/leaderboard?memberName=${encodeURIComponent(currentUserName)}&period=${period}`),
      api.get<Achievement[]>('/achievements'),
    ]);

    setLeaderboard(leaderboardData);
    setAchievements(achievementData);
  };

  const saveMonthlyPrize = async () => {
    setIsSavingPrize(true);
    setPrizeSaveError(null);
    try {
      await api.post(`/monthly-prize?memberName=${encodeURIComponent(currentUserName)}`, {
        prize: editedPrize.trim() === '' ? null : editedPrize.trim(),
      });
      setIsEditingPrize(false);
      await load();
    } catch (error) {
      setPrizeSaveError(error instanceof Error ? error.message : 'Noe gikk galt ved lagring');
    } finally {
      setIsSavingPrize(false);
    }
  };

  useEffect(() => {
    setLastLevel(null);
    if (period === 'MONTH') {
      setEditedPrize(leaderboard.monthlyPrize ?? '');
    } else {
      setIsEditingPrize(false);
      setPrizeSaveError(null);
    }
  }, [period, leaderboard.monthlyPrize]);

  useEffect(() => {
    void load();
    const disconnect = connectCollectiveRealtime(currentUserName, (event) => {
      if (event.type === 'TASK_UPDATED' || event.type === 'XP_UPDATED') {
        void load();
      }
    });
    return disconnect;
  }, [currentUserName, period]);

  // Confetti on level up
  useEffect(() => {
    const me = leaderboard.players.find((p) => p.name === currentUserName);
    if (!me) return;
    if (lastLevel !== null && me.level > lastLevel) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
    }
    setLastLevel(me.level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderboard.players, currentUserName]);

  const players = leaderboard.players;
  const weeklyStats = leaderboard.weeklyStats;
  const unlockedAchievements = achievements.filter((achievement) => achievement.unlocked);

  return (
    <PageStack>
      <div style={{ position: 'relative' }}>
        <Sparkles count={22} color="#a5b4fc" size={2.5} style={{ zIndex: 0 }} />
        <Confetti trigger={showConfetti} />
        <PageHeader
        icon={Trophy}
        eyebrow="Poeng"
        title="Poengtavle"
        description={getPeriodDescription(period)}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-900 px-4 py-4 text-white shadow-sm">
            <p className="text-sm text-slate-300">{getPeriodText(period).points}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{weeklyStats.totalXp} XP</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-sm text-slate-500">Fullførte oppgaver</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {weeklyStats.totalTasks}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-sm text-slate-500">Mest aktiv {getPeriodText(period).short}</p>
            <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
              {weeklyStats.topContributor || 'Ingen enda'}
            </p>
          </div>
        </div>
      </PageHeader>

      <Tabs defaultValue="ranking" className="w-full mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ranking">Rangering</TabsTrigger>
          <TabsTrigger value="milestones">Milepæler</TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="mt-4 space-y-4">
          <div className="w-full mb-6">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm w-full">
              {(['OVERALL', 'YEAR', 'MONTH'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    period === p
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p === 'OVERALL' ? 'Totalt' : p === 'YEAR' ? 'År' : 'Måned'}
                </button>
              ))}
            </div>
          </div>
          <SectionCard
            title="Alle i kollektivet"
            description={`Poeng, nivå og antall fullførte oppgaver per person ${getPeriodText(period).long}.`}
          >
            {players.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="Ingen poeng å vise enda"
                description="Når oppgaver fullføres, bygges tavlen opp her."
              />
            ) : (
              <div className="space-y-3">
                {players.map((player) => {
                  const isMe = player.name === currentUserName;
                  const progressToNextLevel = ((player.xp % 200) / 200) * 100;

                  return (
                    <div
                      key={player.rank}
                      className={`rounded-2xl border px-4 py-4 shadow-sm ${
                        isMe ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div
                          className={`flex size-12 shrink-0 items-center justify-center rounded-2xl font-semibold ${
                            rankStyles[player.rank] ?? 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {player.rank}
                        </div>

                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={`font-medium ${isMe ? 'text-white' : 'text-slate-950'}`}>
                              {player.name}
                            </p>
                            {isMe && <Badge className="bg-white text-slate-900">Deg</Badge>}
                            {player.badges.map((badge, index) => (
                              <Badge key={`${badge}-${index}`} variant="secondary">
                                {badge}
                              </Badge>
                            ))}
                          </div>

                          <div
                            className={`flex flex-wrap items-center gap-3 text-sm ${
                              isMe ? 'text-slate-300' : 'text-slate-600'
                            }`}
                          >
                            <span className="inline-flex items-center gap-1">
                              <Star className="size-4" />
                              Nivå {player.level}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Zap className="size-4" />
                              {player.xp} XP
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Target className="size-4" />
                              {player.tasksCompleted} oppgaver
                            </span>
                            {player.streak > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <Flame className="size-4" />
                                {player.streak} dager på rad
                              </span>
                            )}
                          </div>

                          <div className="space-y-1">
                            <div
                              className={`flex justify-between text-xs ${
                                isMe ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              <span>Til neste nivå</span>
                              <span>{player.xp % 200}/200 XP</span>
                            </div>
                            <Progress
                              className={isMe ? 'bg-white' : undefined}
                              value={progressToNextLevel}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {period === 'MONTH' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
                  🏆
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-amber-700">Månedens premie</p>

                  {!isEditingPrize ? (
                    <div>
                      {leaderboard.monthlyPrize ? (
                        <p className="mt-1 text-lg font-semibold text-amber-900">
                          {leaderboard.monthlyPrize}
                        </p>
                      ) : (
                        <p className="mt-1 text-lg text-slate-500">
                          Ingen premie er satt for denne måneden.
                        </p>
                      )}
                    </div>
                  ) : (
                    <textarea
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                      rows={3}
                      value={editedPrize}
                      onChange={(event) => setEditedPrize(event.target.value)}
                      placeholder="Skriv månedens premie, f.eks. gratis pizza"
                    />
                  )}

                  {prizeSaveError && <p className="mt-2 text-sm text-red-600">{prizeSaveError}</p>}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {!isEditingPrize ? (
                      <button
                        onClick={() => {
                          setIsEditingPrize(true);
                          setEditedPrize(leaderboard.monthlyPrize ?? '');
                        }}
                        className="rounded-md border border-amber-700 bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800"
                      >
                        {leaderboard.monthlyPrize ? 'Endre premie' : 'Legg til premie'}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => void saveMonthlyPrize()}
                          disabled={isSavingPrize}
                          className="rounded-md bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
                        >
                          {isSavingPrize ? 'Lagrer...' : 'Lagre'}
                        </button>
                        <button
                          onClick={() => {
                            setIsEditingPrize(false);
                            setEditedPrize(leaderboard.monthlyPrize ?? '');
                            setPrizeSaveError(null);
                          }}
                          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Avbryt
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <p className="text-sm text-slate-500">Snitt per person</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {weeklyStats.avgPerPerson} XP
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <p className="text-sm text-slate-500">Antall deltakere</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {players.length}
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="milestones" className="mt-4 space-y-4">
          <SectionCard
            title="Milepæler"
            description="Små og store mål som følger innsatsen over tid."
          >
            {achievements.length === 0 ? (
              <EmptyState
                icon={Award}
                title="Ingen milepæler enda"
                description="Milepælene dukker opp når de er tilgjengelige i appen."
              />
            ) : (
              <div className="space-y-3">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={`rounded-2xl border px-4 py-4 shadow-sm ${
                      achievement.unlocked
                        ? 'border-amber-200 bg-amber-50/70'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
                        {achievement.icon}
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-950">{achievement.title}</p>
                          {achievement.unlocked && <Badge className="bg-amber-500 text-white">Låst opp</Badge>}
                        </div>
                        <p className="text-sm leading-6 text-slate-600">{achievement.description}</p>

                        {!achievement.unlocked &&
                          achievement.progress !== undefined &&
                          achievement.total !== undefined && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs text-slate-500">
                                <span>Fremdrift</span>
                                <span>
                                  {achievement.progress}/{achievement.total}
                                </span>
                              </div>
                              <Progress
                                value={(achievement.progress / achievement.total) * 100}
                              />
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <p className="text-sm text-slate-500">Låst opp</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {unlockedAchievements.length}/{achievements.length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
              <p className="text-sm text-slate-500">Fullført andel</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {achievements.length > 0
                  ? Math.round((unlockedAchievements.length / achievements.length) * 100)
                  : 0}
                %
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </PageStack>
  );
}
