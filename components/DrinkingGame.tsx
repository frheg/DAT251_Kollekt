import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Beer, Shuffle, TrendingUp, Users, Zap, Trophy } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';

interface Player {
  name: string;
  level: number;
  xp: number;
  tasksCompleted: number;
}

interface Question {
  text: string;
  type: 'drink' | 'distribute' | 'everyone' | 'vote' | 'challenge';
  targetedPlayer?: string;
}

export function DrinkingGame() {
  const [gameStarted, setGameStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionCount, setQuestionCount] = useState(0);

  const players: Player[] = [
    { name: 'Emma', level: 15, xp: 3240, tasksCompleted: 45 },
    { name: 'Kasper', level: 12, xp: 2450, tasksCompleted: 38 },
    { name: 'Fredric', level: 11, xp: 2180, tasksCompleted: 32 },
    { name: 'Lars', level: 10, xp: 1950, tasksCompleted: 28 },
    { name: 'Sofia', level: 9, xp: 1720, tasksCompleted: 25 },
    { name: 'Marcus', level: 8, xp: 1480, tasksCompleted: 21 },
  ];

  // Questions tailored to player stats and apartment life
  const getRandomQuestion = (): Question => {
    const sortedByXP = [...players].sort((a, b) => b.xp - a.xp);
    const sortedByTasks = [...players].sort((a, b) => b.tasksCompleted - a.tasksCompleted);
    const topPlayer = sortedByXP[0];
    const bottomPlayer = sortedByXP[sortedByXP.length - 1];
    const laziestPlayer = sortedByTasks[sortedByTasks.length - 1];
    const hardestWorker = sortedByTasks[0];

    const questions: Question[] = [
      // Targeted based on stats
      { text: `${topPlayer.name}, som leaderboard-leder, del ut 3 slurker!`, type: 'distribute', targetedPlayer: topPlayer.name },
      { text: `${bottomPlayer.name}, du er sist på leaderboardet. Drikk 2!`, type: 'drink', targetedPlayer: bottomPlayer.name },
      { text: `${laziestPlayer.name}, du har færrest fullførte oppgaver. Drikk 1 slurk for hver dag siden sist vask!`, type: 'drink', targetedPlayer: laziestPlayer.name },
      { text: `${hardestWorker.name}, du jobber hardest! Velg noen til å drikke 3.`, type: 'distribute', targetedPlayer: hardestWorker.name },
      
      // General apartment life
      { text: 'Alle som har glemt å tømme søppel denne uken drikker 2!', type: 'everyone' },
      { text: 'Alle som har tørketrommel-klær liggende ennå drikker 1!', type: 'everyone' },
      { text: 'Personen som sist tok oppvasken deler ut 3 slurker!', type: 'distribute' },
      { text: 'Alle som skylder penger i felleskassa drikker!', type: 'everyone' },
      { text: 'Den som har lavest XP drikker, alle andre deler ut 1!', type: 'distribute' },
      { text: 'Alle med negativt saldo på økonomi drikker 2!', type: 'everyone' },
      
      // Voting/pointing
      { text: 'Pek på hvem som mest sannsynlig aldri rydder i fellesarealer. De drikker 2!', type: 'vote' },
      { text: 'Pek på hvem som mest sannsynlig glemmer å handle. De drikker 1!', type: 'vote' },
      { text: 'Pek på hvem som lager mest støy sent på kvelden. De deler ut 3!', type: 'vote' },
      { text: 'Pek på dagens MVP av kollektivet. De deler ut 4 slurker!', type: 'vote' },
      
      // Challenges
      { text: 'Alle med streak over 5 dager: waterfall! Resten drikker 1.', type: 'challenge' },
      { text: `Level battle! Level ${topPlayer.level} vs resten. Laveste nivå drikker.`, type: 'challenge' },
      { text: 'Alle som har fullført oppgaver i dag slipper. Resten drikker 2!', type: 'challenge' },
      { text: 'Rock, paper, scissors mellom topp 2 på leaderboard. Taper drikker 3!', type: 'challenge' },
      
      // Fun apartment-specific
      { text: 'Alle som har besøk over i kveld drikker!', type: 'everyone' },
      { text: 'Har du vært sist hjemme i natt? Drikk 2!', type: 'everyone' },
      { text: 'Har du spist på rommet i dag i stedet for kjøkkenet? Drikk 1!', type: 'everyone' },
      { text: 'Den som ordnet med WiFi sist deler ut 5 slurker for all-time MVP!', type: 'distribute' },
    ];

    return questions[Math.floor(Math.random() * questions.length)];
  };

  const startGame = () => {
    setGameStarted(true);
    nextQuestion();
  };

  const nextQuestion = () => {
    setCurrentQuestion(getRandomQuestion());
    setQuestionCount(prev => prev + 1);
  };

  const endGame = () => {
    setGameStarted(false);
    setCurrentQuestion(null);
    setQuestionCount(0);
  };

  const getQuestionColor = (type: string) => {
    switch (type) {
      case 'drink':
        return 'from-red-500 to-pink-500';
      case 'distribute':
        return 'from-blue-500 to-purple-500';
      case 'everyone':
        return 'from-orange-500 to-red-500';
      case 'vote':
        return 'from-purple-500 to-pink-500';
      case 'challenge':
        return 'from-green-500 to-emerald-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const getQuestionIcon = (type: string) => {
    switch (type) {
      case 'drink':
        return <Beer className="w-8 h-8" />;
      case 'distribute':
        return <Users className="w-8 h-8" />;
      case 'everyone':
        return <TrendingUp className="w-8 h-8" />;
      case 'vote':
        return <Trophy className="w-8 h-8" />;
      case 'challenge':
        return <Zap className="w-8 h-8" />;
      default:
        return <Beer className="w-8 h-8" />;
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-green-500',
      'bg-orange-500',
      'bg-red-500',
    ];
    const index = name.length % colors.length;
    return colors[index];
  };

  if (!gameStarted) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <Card className="p-6 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white border-0">
          <div className="flex items-center gap-3 mb-3">
            <Beer className="w-10 h-10" />
            <div>
              <h2 className="text-white mb-1">Drikkespill</h2>
              <p className="text-pink-100 text-sm">Tilpasset kollektivet ditt</p>
            </div>
          </div>
        </Card>

        {/* Info Card */}
        <Card className="p-6 bg-white/80 backdrop-blur">
          <h3 className="mb-4">Hvordan det fungerer</h3>
          <div className="space-y-3 text-sm text-gray-600 mb-6">
            <p>✨ Spørsmålene er tilpasset etter leaderboard-stats og kollektiv-aktivitet</p>
            <p>🎯 Topp-spillere får flere "del ut" kort</p>
            <p>😅 De som slacker på oppgaver må drikke litt mer</p>
            <p>🏆 Level og XP påvirker utfordringene</p>
            <p>🎲 Alt er randomisert for maksimalt kaos!</p>
          </div>

          <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-200 rounded-lg p-4 mb-6">
            <p className="text-sm">
              ⚠️ Husk å drikke ansvarlig! Dette er bare for moro skyld.
            </p>
          </div>

          <Button 
            onClick={startGame} 
            className="w-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-lg py-6"
          >
            <Beer className="w-5 h-5 mr-2" />
            Start spill
          </Button>
        </Card>

        {/* Active Players */}
        <Card className="p-6 bg-white/80 backdrop-blur">
          <h3 className="mb-4">Aktive spillere ({players.length})</h3>
          <div className="grid grid-cols-3 gap-3">
            {players.map((player) => (
              <div key={player.name} className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
                <Avatar className={`w-12 h-12 ${getAvatarColor(player.name)} mb-2`}>
                  <AvatarFallback className="text-white">
                    {getInitials(player.name)}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm text-center">{player.name}</p>
                <Badge variant="outline" className="text-xs mt-1">
                  Lvl {player.level}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Progress */}
      <Card className="p-6 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white border-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Beer className="w-8 h-8" />
            <div>
              <h2 className="text-white mb-1">Drikkespill</h2>
              <p className="text-pink-100 text-sm">Spørsmål #{questionCount}</p>
            </div>
          </div>
          <Button 
            onClick={endGame} 
            variant="outline" 
            className="bg-white/20 border-white/40 text-white hover:bg-white/30"
          >
            Avslutt
          </Button>
        </div>
      </Card>

      {/* Current Question */}
      {currentQuestion && (
        <Card className={`p-8 bg-gradient-to-br ${getQuestionColor(currentQuestion.type)} text-white border-0 shadow-xl`}>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-white/20 rounded-full">
              {getQuestionIcon(currentQuestion.type)}
            </div>
            
            <Badge className="bg-white/30 text-white border-white/40 px-4 py-1">
              {currentQuestion.type === 'drink' && '🍺 Drikk'}
              {currentQuestion.type === 'distribute' && '🎁 Del ut'}
              {currentQuestion.type === 'everyone' && '👥 Alle'}
              {currentQuestion.type === 'vote' && '👉 Pek'}
              {currentQuestion.type === 'challenge' && '⚔️ Utfordring'}
            </Badge>

            <p className="text-xl text-white max-w-md">
              {currentQuestion.text}
            </p>

            {currentQuestion.targetedPlayer && (
              <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2">
                <Avatar className={`w-8 h-8 ${getAvatarColor(currentQuestion.targetedPlayer)}`}>
                  <AvatarFallback className="text-white text-xs">
                    {getInitials(currentQuestion.targetedPlayer)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">Mål: {currentQuestion.targetedPlayer}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-1 gap-3">
        <Button 
          onClick={nextQuestion}
          className="bg-gradient-to-r from-green-500 to-emerald-500 py-6 text-lg"
        >
          <Shuffle className="w-5 h-5 mr-2" />
          Neste spørsmål
        </Button>
      </div>

      {/* Quick Stats */}
      <Card className="p-4 bg-white/80 backdrop-blur">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl">#{questionCount}</p>
            <p className="text-sm text-gray-600">Spørsmål</p>
          </div>
          <div>
            <p className="text-2xl">{players.length}</p>
            <p className="text-sm text-gray-600">Spillere</p>
          </div>
          <div>
            <p className="text-2xl">🔥</p>
            <p className="text-sm text-gray-600">Nivå</p>
          </div>
        </div>
      </Card>

      {/* Leaderboard Preview */}
      <Card className="p-4 bg-white/80 backdrop-blur">
        <h4 className="mb-3 text-sm text-gray-600">Dagens rangeringer:</h4>
        <div className="space-y-2">
          {players.slice(0, 3).map((player, index) => (
            <div key={player.name} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white text-xs">
                {index + 1}
              </div>
              <Avatar className={`w-6 h-6 ${getAvatarColor(player.name)}`}>
                <AvatarFallback className="text-white text-xs">
                  {getInitials(player.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm flex-1">{player.name}</span>
              <Badge variant="outline" className="text-xs">Lvl {player.level}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
