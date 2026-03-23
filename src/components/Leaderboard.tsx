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
import type { Achievement, LeaderboardResponse } from '../lib/types';

interface LeaderboardProps {
  currentUserName: string;
}

const rankStyles: Record<number, string> = {
  1: 'bg-amber-100 text-amber-700',
  2: 'bg-slate-200 text-slate-700',
  3: 'bg-orange-100 text-orange-700',
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

  const load = async () => {
    const [leaderboardData, achievementData] = await Promise.all([
      api.get<LeaderboardResponse>(`/leaderboard?memberName=${encodeURIComponent(currentUserName)}`),
      api.get<Achievement[]>('/achievements'),
    ]);

    setLeaderboard(leaderboardData);
    setAchievements(achievementData);
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
        description="Se hvordan innsatsen fordeler seg i kollektivet denne uken."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-900 px-4 py-4 text-white shadow-sm">
            <p className="text-sm text-slate-300">Poeng denne uken</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{weeklyStats.totalXp} XP</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-sm text-slate-500">Fullførte oppgaver</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {weeklyStats.totalTasks}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-sm text-slate-500">Mest aktiv denne uken</p>
            <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
              {weeklyStats.topContributor || 'Ingen enda'}
            </p>
          </div>
        </div>
      </PageHeader>

      <Tabs defaultValue="ranking" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ranking">Rangering</TabsTrigger>
          <TabsTrigger value="milestones">Milepæler</TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="mt-4 space-y-4">
          <SectionCard
            title="Alle i kollektivet"
            description="Poeng, nivå og antall fullførte oppgaver per person."
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
