import { useEffect, useState } from 'react';
import { Beer, Shuffle, TrendingUp, Trophy, Users, Zap } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { api } from '../lib/api';
import { getAvatarToneClass, getInitials } from '../lib/ui';
import {
  EmptyState,
  PageHeader,
  PageStack,
  SectionCard,
} from './shared/page';
import type { DrinkingQuestion, LeaderboardResponse } from '../lib/types';

interface Player {
  name: string;
  level: number;
}

interface DrinkingGameProps {
  currentUserName: string;
}

const questionAppearance: Record<
  string,
  {
    label: string;
    icon: typeof Beer;
    cardClassName: string;
    badgeClassName: string;
  }
> = {
  drink: {
    label: 'Ta en slurk',
    icon: Beer,
    cardClassName: 'border-rose-200 bg-rose-50/80',
    badgeClassName: 'bg-rose-100 text-rose-700',
  },
  distribute: {
    label: 'Del ut',
    icon: Users,
    cardClassName: 'border-blue-200 bg-blue-50/80',
    badgeClassName: 'bg-blue-100 text-blue-700',
  },
  everyone: {
    label: 'Alle er med',
    icon: TrendingUp,
    cardClassName: 'border-amber-200 bg-amber-50/80',
    badgeClassName: 'bg-amber-100 text-amber-700',
  },
  vote: {
    label: 'Stem frem',
    icon: Trophy,
    cardClassName: 'border-slate-200 bg-slate-50/80',
    badgeClassName: 'bg-slate-100 text-slate-700',
  },
  challenge: {
    label: 'Utfordring',
    icon: Zap,
    cardClassName: 'border-emerald-200 bg-emerald-50/80',
    badgeClassName: 'bg-emerald-100 text-emerald-700',
  },
};

export function DrinkingGame({ currentUserName }: DrinkingGameProps) {
  const [gameStarted, setGameStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<DrinkingQuestion | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    const loadPlayers = async () => {
      const leaderboard = await api.get<LeaderboardResponse>(
        `/leaderboard?memberName=${encodeURIComponent(currentUserName)}`,
      );
      setPlayers(leaderboard.players.map((player) => ({ name: player.name, level: player.level })));
    };

    void loadPlayers();
  }, [currentUserName]);

  const nextQuestion = async () => {
    const question = await api.get<DrinkingQuestion>(
      `/drinking-game/question?memberName=${encodeURIComponent(currentUserName)}`,
    );
    setCurrentQuestion(question);
    setQuestionCount((previous) => previous + 1);
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

  const appearance =
    (currentQuestion && questionAppearance[currentQuestion.type]) ?? questionAppearance.drink;
  const QuestionIcon = appearance.icon;

  return (
    <PageStack>
      <PageHeader
        icon={Beer}
        eyebrow="Spill"
        title="Drikkespill"
        description="En enkel spørsmålsrunde for kvelden når dere vil ha noe lett og sosialt å starte med."
        action={
          gameStarted ? (
            <Button variant="outline" onClick={endGame}>
              Avslutt runden
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void startGame()}>
              Start runde
            </Button>
          )
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-sm text-slate-500">Spillere</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {players.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
            <p className="text-sm text-slate-500">Status</p>
            <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
              {gameStarted ? 'Runden er i gang' : 'Klar når dere er'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-sm text-slate-500">Spørsmål vist</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {questionCount}
            </p>
          </div>
        </div>
      </PageHeader>

      {!gameStarted ? (
        <>
          <SectionCard
            title="Slik fungerer det"
            description="Start runden og trekk ett spørsmål av gangen. Bruk det som en lett icebreaker og juster tempoet selv."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <p className="font-medium text-slate-950">Trekk et spørsmål</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Hvert trekk gir en ny aktivitet eller utfordring.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
                <p className="font-medium text-slate-950">Ta det som det passer</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Bruk spørsmålene som start på praten, ikke som en fasit.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                <p className="font-medium text-slate-950">Trekk neste når dere vil</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Runden fortsetter så lenge dere har lyst.
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={`Spillere (${players.length})`}
            description="Alle som er med i kollektivet kan delta i runden."
          >
            {players.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Ingen spillere å vise"
                description="Legg til flere medlemmer i kollektivet for å få mer liv i runden."
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {players.map((player) => (
                  <div
                    key={player.name}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center shadow-sm"
                  >
                    <Avatar className={`mx-auto size-12 ${getAvatarToneClass(player.name)}`}>
                      <AvatarFallback>{getInitials(player.name)}</AvatarFallback>
                    </Avatar>
                    <p className="mt-3 font-medium text-slate-950">{player.name}</p>
                    <p className="mt-1 text-sm text-slate-500">Nivå {player.level}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      ) : (
        <>
          {currentQuestion && (
            <SectionCard
              className={appearance.cardClassName}
              title={`Spørsmål ${questionCount}`}
              description="Trekk neste når dere er klare."
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                    <QuestionIcon className="size-6" />
                  </div>
                  <Badge className={appearance.badgeClassName}>{appearance.label}</Badge>
                </div>

                <p className="max-w-2xl text-lg font-medium leading-8 text-slate-950">
                  {currentQuestion.text}
                </p>

                {currentQuestion.targetedPlayer && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                    <Avatar className={`size-8 ${getAvatarToneClass(currentQuestion.targetedPlayer)}`}>
                      <AvatarFallback>{getInitials(currentQuestion.targetedPlayer)}</AvatarFallback>
                    </Avatar>
                    <span>{currentQuestion.targetedPlayer}</span>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          <Button variant="outline" className="w-full sm:w-auto" onClick={() => void nextQuestion()}>
            <Shuffle className="size-4" />
            Neste spørsmål
          </Button>
        </>
      )}
    </PageStack>
  );
}
