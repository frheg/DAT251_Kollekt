import { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Beer, Shuffle, TrendingUp, Users, Zap, Trophy } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { api } from '../lib/api';
import type { DrinkingQuestion, LeaderboardResponse } from '../lib/types';

interface Player {
  name: string;
  level: number;
}

export function DrinkingGame() {
  const [gameStarted, setGameStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<DrinkingQuestion | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    const loadPlayers = async () => {
      const leaderboard = await api.get<LeaderboardResponse>('/leaderboard');
      setPlayers(leaderboard.players.map(p => ({ name: p.name, level: p.level })));
    };
    loadPlayers();
  }, []);

  const nextQuestion = async () => {
    const question = await api.get<DrinkingQuestion>('/drinking-game/question');
    setCurrentQuestion(question);
    setQuestionCount(prev => prev + 1);
  };

  const startGame = async () => {
    setGameStarted(true);
    await nextQuestion();
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

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase();

  const getAvatarColor = (name: string) => {
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-green-500', 'bg-orange-500', 'bg-red-500'];
    return colors[name.length % colors.length];
  };

  if (!gameStarted) {
    return (
      <div className="space-y-4">
        <Card className="p-6 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white border-0">
          <div className="flex items-center gap-3 mb-3">
            <Beer className="w-10 h-10" />
            <div>
              <h2 className="text-white mb-1">Drikkespill</h2>
              <p className="text-pink-100 text-sm">Tilpasset kollektivet ditt</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white/80 backdrop-blur">
          <h3 className="mb-4">Hvordan det fungerer</h3>
          <div className="space-y-3 text-sm text-gray-600 mb-6">
            <p>Spørsmålene hentes fra backend.</p>
            <p>Spørsmålene bygger på leaderboard-data.</p>
            <p>Neste spørsmål trekkes dynamisk.</p>
          </div>

          <Button onClick={() => void startGame()} className="w-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-lg py-6">
            <Beer className="w-5 h-5 mr-2" />
            Start spill
          </Button>
        </Card>

        <Card className="p-6 bg-white/80 backdrop-blur">
          <h3 className="mb-4">Aktive spillere ({players.length})</h3>
          <div className="grid grid-cols-3 gap-3">
            {players.map(player => (
              <div key={player.name} className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
                <Avatar className={`w-12 h-12 ${getAvatarColor(player.name)} mb-2`}>
                  <AvatarFallback className="text-white">{getInitials(player.name)}</AvatarFallback>
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
      <Card className="p-6 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white border-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Beer className="w-8 h-8" />
            <div>
              <h2 className="text-white mb-1">Drikkespill</h2>
              <p className="text-pink-100 text-sm">Spørsmål #{questionCount}</p>
            </div>
          </div>
          <Button onClick={endGame} variant="outline" className="bg-white/20 border-white/40 text-white hover:bg-white/30">
            Avslutt
          </Button>
        </div>
      </Card>

      {currentQuestion && (
        <Card className={`p-8 bg-gradient-to-br ${getQuestionColor(currentQuestion.type)} text-white border-0 shadow-xl`}>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-white/20 rounded-full">{getQuestionIcon(currentQuestion.type)}</div>

            <Badge className="bg-white/30 text-white border-white/40 px-4 py-1">{currentQuestion.type}</Badge>

            <p className="text-xl text-white max-w-md">{currentQuestion.text}</p>

            {currentQuestion.targetedPlayer && (
              <div className="flex items-center gap-2 bg-white/20 rounded-full px-4 py-2">
                <Avatar className={`w-8 h-8 ${getAvatarColor(currentQuestion.targetedPlayer)}`}>
                  <AvatarFallback className="text-white text-xs">{getInitials(currentQuestion.targetedPlayer)}</AvatarFallback>
                </Avatar>
                <span className="text-sm">Mål: {currentQuestion.targetedPlayer}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3">
        <Button onClick={() => void nextQuestion()} className="bg-gradient-to-r from-green-500 to-emerald-500 py-6 text-lg">
          <Shuffle className="w-5 h-5 mr-2" />
          Neste spørsmål
        </Button>
      </div>
    </div>
  );
}
