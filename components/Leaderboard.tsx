import { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Trophy, TrendingUp, Flame, Target, Zap, Star, Award } from 'lucide-react';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { api } from '../lib/api';
import type { Achievement, LeaderboardResponse } from '../lib/types';

export function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse>({ players: [], weeklyStats: { totalTasks: 0, totalXp: 0, avgPerPerson: 0, topContributor: '' } });
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    const load = async () => {
      const [leaderboardData, achievementData] = await Promise.all([
        api.get<LeaderboardResponse>('/leaderboard'),
        api.get<Achievement[]>('/achievements'),
      ]);
      setLeaderboard(leaderboardData);
      setAchievements(achievementData);
    };
    load();
  }, []);

  const players = leaderboard.players;
  const weeklyStats = leaderboard.weeklyStats;

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'from-yellow-400 to-orange-500';
      case 2:
        return 'from-gray-300 to-gray-400';
      case 3:
        return 'from-orange-400 to-orange-600';
      default:
        return 'from-blue-500 to-purple-500';
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '1';
      case 2:
        return '2';
      case 3:
        return '3';
      default:
        return `#${rank}`;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 text-white border-0">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="w-8 h-8" />
          <div>
            <h2 className="text-white mb-1">Leaderboard</h2>
            <p className="text-orange-100 text-sm">Denne uken</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/20 rounded-lg p-3">
            <p className="text-sm text-orange-100">Total XP (uke)</p>
            <p className="text-xl text-white">{weeklyStats.totalXp} XP</p>
          </div>
          <div className="bg-white/20 rounded-lg p-3">
            <p className="text-sm text-orange-100">Oppgaver (uke)</p>
            <p className="text-xl text-white">{weeklyStats.totalTasks}</p>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="rankings" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-white/80 backdrop-blur">
          <TabsTrigger value="rankings">Rankings</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>

        <TabsContent value="rankings" className="space-y-4 mt-4">
          <Card className="p-6 bg-white/80 backdrop-blur">
            <h3 className="mb-4">Alle spillere</h3>
            <div className="space-y-2">
              {players.map(player => {
                const isMe = player.name === 'Kasper';
                const progressToNext = ((player.xp % 200) / 200) * 100;

                return (
                  <div key={player.rank} className={`p-4 rounded-lg border-2 transition-all ${isMe ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-purple-300' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getRankColor(player.rank)} flex items-center justify-center flex-shrink-0 shadow-md`}>
                        <span className="text-white">{getRankIcon(player.rank)}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4>{player.name}</h4>
                          {isMe && (
                            <Badge variant="secondary" className="text-xs">
                              Deg
                            </Badge>
                          )}
                          <div className="flex gap-1">
                            {player.badges.map((badge, i) => (
                              <span key={i} className="text-sm">
                                {badge}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-2">
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3" />
                            Level {player.level}
                          </span>
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {player.xp} XP
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {player.tasksCompleted} oppgaver
                          </span>
                          {player.streak > 0 && (
                            <span className="flex items-center gap-1 text-orange-600">
                              <Flame className="w-3 h-3" />
                              {player.streak} dager
                            </span>
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Til Level {player.level + 1}</span>
                            <span>{player.xp % 200}/200 XP</span>
                          </div>
                          <Progress value={progressToNext} className="h-1.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
            <h3 className="mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Ukens statistikk
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Snitt XP per person</p>
                <p className="text-2xl text-green-600">{weeklyStats.avgPerPerson}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Topp bidragsyter</p>
                <p className="text-2xl">{weeklyStats.topContributor}</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4 mt-4">
          <Card className="p-6 bg-white/80 backdrop-blur">
            <h3 className="mb-4">Dine achievements</h3>
            <div className="grid grid-cols-1 gap-3">
              {achievements.map(achievement => (
                <div
                  key={achievement.id}
                  className={`p-4 rounded-lg border-2 transition-all ${achievement.unlocked ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-300' : 'bg-gray-50 border-gray-200 opacity-60'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`text-4xl flex-shrink-0 ${achievement.unlocked ? '' : 'grayscale'}`}>{achievement.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4>{achievement.title}</h4>
                        {achievement.unlocked && <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">Låst opp</Badge>}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>

                      {!achievement.unlocked && achievement.progress !== undefined && achievement.total !== undefined && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Progresjon</span>
                            <span>
                              {achievement.progress}/{achievement.total}
                            </span>
                          </div>
                          <Progress value={(achievement.progress / achievement.total) * 100} className="h-2" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
              <div className="flex items-center gap-3">
                <Award className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-2xl">
                    {achievements.filter(a => a.unlocked).length}/{achievements.length}
                  </p>
                  <p className="text-sm text-gray-600">Låst opp</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200">
              <div className="flex items-center gap-3">
                <Target className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl">{achievements.length ? Math.round((achievements.filter(a => a.unlocked).length / achievements.length) * 100) : 0}%</p>
                  <p className="text-sm text-gray-600">Fullført</p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
