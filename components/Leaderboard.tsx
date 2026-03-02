import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Trophy, TrendingUp, Flame, Target, Zap, Star, Award } from 'lucide-react';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface Player {
  rank: number;
  name: string;
  level: number;
  xp: number;
  tasksCompleted: number;
  streak: number;
  badges: string[];
}

interface Achievement {
  id: number;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number;
  total?: number;
}

export function Leaderboard() {
  const players: Player[] = [
    { rank: 1, name: 'Emma', level: 15, xp: 3240, tasksCompleted: 45, streak: 12, badges: ['🏆', '🔥', '⭐'] },
    { rank: 2, name: 'Kasper', level: 12, xp: 2450, tasksCompleted: 38, streak: 7, badges: ['🔥', '⭐'] },
    { rank: 3, name: 'Fredric', level: 11, xp: 2180, tasksCompleted: 32, streak: 5, badges: ['⭐'] },
    { rank: 4, name: 'Lars', level: 10, xp: 1950, tasksCompleted: 28, streak: 3, badges: ['⭐'] },
    { rank: 5, name: 'Sofia', level: 9, xp: 1720, tasksCompleted: 25, streak: 2, badges: [] },
    { rank: 6, name: 'Marcus', level: 8, xp: 1480, tasksCompleted: 21, streak: 1, badges: [] },
    { rank: 7, name: 'Lina', level: 7, xp: 1250, tasksCompleted: 18, streak: 0, badges: [] },
    { rank: 8, name: 'Erik', level: 6, xp: 980, tasksCompleted: 14, streak: 0, badges: [] },
  ];

  const achievements: Achievement[] = [
    { id: 1, title: 'Tidlig fugl', description: 'Fullfør 5 oppgaver før 10:00', icon: '🌅', unlocked: true },
    { id: 2, title: 'Ukestreak', description: 'Fullfør oppgaver 7 dager på rad', icon: '🔥', unlocked: true },
    { id: 3, title: 'Vaskekonge', description: 'Fullfør 20 vaskeoppgaver', icon: '🧼', unlocked: true, progress: 20, total: 20 },
    { id: 4, title: 'Handlehelt', description: 'Fullfør 15 handleturer', icon: '🛒', unlocked: false, progress: 8, total: 15 },
    { id: 5, title: 'Sosial sjef', description: 'Arranger 5 events', icon: '🎉', unlocked: false, progress: 3, total: 5 },
    { id: 6, title: 'Økonomiansvarlig', description: 'Betal for 10 felles utgifter', icon: '💰', unlocked: false, progress: 6, total: 10 },
  ];

  const weeklyStats = {
    totalTasks: 42,
    totalXP: 2100,
    avgPerPerson: 262,
    topContributor: 'Emma',
  };

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
        return '👑';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 text-white border-0">
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="w-8 h-8" />
          <div>
            <h2 className="text-white mb-1">Leaderboard</h2>
            <p className="text-orange-100 text-sm">Uke 6 • 2026</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/20 rounded-lg p-3">
            <p className="text-sm text-orange-100">Total XP (uke)</p>
            <p className="text-xl text-white">{weeklyStats.totalXP} XP</p>
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
          {/* Top 3 Podium */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {/* 2nd Place */}
            <div className="flex flex-col items-center pt-8">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-2xl mb-2">
                🥈
              </div>
              <p className="text-sm text-center">{players[1].name}</p>
              <Badge className="mt-1 bg-gray-400">Lvl {players[1].level}</Badge>
              <div className="w-full bg-gradient-to-br from-gray-300 to-gray-400 rounded-t-lg mt-2 h-20 flex items-center justify-center">
                <p className="text-white text-sm">{players[1].xp} XP</p>
              </div>
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-3xl mb-2 shadow-lg">
                👑
              </div>
              <p className="text-center">{players[0].name}</p>
              <Badge className="mt-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white">Lvl {players[0].level}</Badge>
              <div className="w-full bg-gradient-to-br from-yellow-400 to-orange-500 rounded-t-lg mt-2 h-32 flex items-center justify-center shadow-lg">
                <p className="text-white">{players[0].xp} XP</p>
              </div>
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center pt-12">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-xl mb-2">
                🥉
              </div>
              <p className="text-sm text-center">{players[2].name}</p>
              <Badge className="mt-1 bg-orange-500 text-white">Lvl {players[2].level}</Badge>
              <div className="w-full bg-gradient-to-br from-orange-400 to-orange-600 rounded-t-lg mt-2 h-16 flex items-center justify-center">
                <p className="text-white text-sm">{players[2].xp} XP</p>
              </div>
            </div>
          </div>

          {/* Full Rankings */}
          <Card className="p-6 bg-white/80 backdrop-blur">
            <h3 className="mb-4">Alle spillere</h3>
            <div className="space-y-2">
              {players.map((player) => {
                const isMe = player.name === 'Kasper';
                const progressToNext = ((player.xp % 200) / 200) * 100;

                return (
                  <div
                    key={player.rank}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isMe
                        ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-purple-300'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${getRankColor(player.rank)} flex items-center justify-center flex-shrink-0 shadow-md`}>
                        <span className="text-white">
                          {getRankIcon(player.rank)}
                        </span>
                      </div>

                      {/* Player Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4>{player.name}</h4>
                          {isMe && <Badge variant="secondary" className="text-xs">Deg</Badge>}
                          <div className="flex gap-1">
                            {player.badges.map((badge, i) => (
                              <span key={i} className="text-sm">{badge}</span>
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

          {/* Weekly Stats */}
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
                <p className="text-2xl">{weeklyStats.topContributor} 🌟</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4 mt-4">
          <Card className="p-6 bg-white/80 backdrop-blur">
            <h3 className="mb-4">Dine achievements</h3>
            <div className="grid grid-cols-1 gap-3">
              {achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    achievement.unlocked
                      ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-300'
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`text-4xl flex-shrink-0 ${achievement.unlocked ? '' : 'grayscale'}`}>
                      {achievement.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4>{achievement.title}</h4>
                        {achievement.unlocked && (
                          <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                            Låst opp!
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{achievement.description}</p>
                      
                      {!achievement.unlocked && achievement.progress !== undefined && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Progresjon</span>
                            <span>{achievement.progress}/{achievement.total}</span>
                          </div>
                          <Progress 
                            value={(achievement.progress / achievement.total!) * 100} 
                            className="h-2"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Achievement Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
              <div className="flex items-center gap-3">
                <Award className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-2xl">3/6</p>
                  <p className="text-sm text-gray-600">Låst opp</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200">
              <div className="flex items-center gap-3">
                <Target className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl">50%</p>
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
