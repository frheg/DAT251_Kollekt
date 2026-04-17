import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Beer,
  CheckCircle2,
  Hash,
  ListChecks,
  Play,
  RotateCcw,
  Shuffle,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useUser } from '../context/UserContext';
import {
  getDrinkingGames,
  type DrinkingGameId,
  type DrinkingPromptKind,
} from '../lib/drinkingGames';

type GameSelection = DrinkingGameId | 'kollekt';

const promptStyles: Record<DrinkingPromptKind, string> = {
  vote: 'from-primary/35 to-primary/10 border-primary/30 text-primary',
  challenge: 'from-secondary/35 to-secondary/10 border-secondary/30 text-secondary',
  toast: 'from-accent/35 to-accent/10 border-accent/30 text-accent',
  never: 'from-destructive/25 to-secondary/10 border-secondary/30 text-secondary',
};

const promptIcons: Record<DrinkingPromptKind, typeof Users> = {
  vote: Users,
  challenge: Zap,
  toast: Beer,
  never: Beer,
};

function shuffled<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export default function GamesPage() {
  const { t, i18n } = useTranslation();
  const { currentUser } = useUser();
  const navigate = useNavigate();
  const [selectedGameKey, setSelectedGameKey] = useState<GameSelection>('hundred-questions');
  const [phase, setPhase] = useState<'rules' | 'playing'>('rules');
  const [members, setMembers] = useState<string[]>([]);
  const [deck, setDeck] = useState<number[]>([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [activePromptId, setActivePromptId] = useState<number | null>(null);
  const [usedPromptIds, setUsedPromptIds] = useState<number[]>([]);
  const [duplicateNumber, setDuplicateNumber] = useState<number | null>(null);
  const [randomOrder, setRandomOrder] = useState(false);

  const name = currentUser?.name ?? '';
  const localizedGames = useMemo(
    () => getDrinkingGames(i18n.resolvedLanguage ?? i18n.language),
    [i18n.language, i18n.resolvedLanguage],
  );
  const isKollektSelected = selectedGameKey === 'kollekt';
  const selectedGame = useMemo(
    () => (
      isKollektSelected
        ? null
        : localizedGames.find((game) => game.id === selectedGameKey) ?? localizedGames[0]
    ),
    [isKollektSelected, localizedGames, selectedGameKey],
  );
  const promptById = useMemo(
    () => new Map((selectedGame?.prompts ?? []).map((prompt) => [prompt.id, prompt])),
    [selectedGame],
  );
  const activePrompt = selectedGame && activePromptId ? promptById.get(activePromptId) ?? null : null;
  const selectedGameIndex = isKollektSelected
    ? localizedGames.length
    : localizedGames.findIndex((game) => game.id === selectedGame?.id);
  const totalGames = localizedGames.length + 1;

  useEffect(() => {
    if (!name) return;
    api.get<{ name: string }[]>(`/members/collective?memberName=${encodeURIComponent(name)}`)
      .then((res) => setMembers(res.map((m) => m.name)))
      .catch(() => {});
  }, [name]);

  const clearProgress = () => {
    setDeck([]);
    setDeckIndex(0);
    setActivePromptId(null);
    setUsedPromptIds([]);
    setDuplicateNumber(null);
  };

  const chooseGame = (gameId: GameSelection) => {
    setSelectedGameKey(gameId);
    setPhase('rules');
    setRandomOrder(false);
    clearProgress();
  };

  const startGame = () => {
    if (!selectedGame) return;

    const promptIds = selectedGame.prompts.map((prompt) => prompt.id);
    const nextDeck = selectedGame.allowRandomOrder && randomOrder
      ? shuffled(promptIds)
      : promptIds;

    clearProgress();
    setPhase('playing');

    if (selectedGame.mode === 'ordered-deck') {
      setDeck(nextDeck);
      setActivePromptId(nextDeck[0] ?? null);
    }
  };

  const advanceDeck = () => {
    const nextIndex = deckIndex + 1;

    if (nextIndex >= deck.length) {
      setDeckIndex(deck.length);
      setActivePromptId(null);
      return;
    }

    setDeckIndex(nextIndex);
    setActivePromptId(deck[nextIndex]);
  };

  const restartGame = () => {
    clearProgress();
    startGame();
  };

  const revealNumber = (promptId: number) => {
    const alreadyUsed = usedPromptIds.includes(promptId);

    if (alreadyUsed) {
      setDuplicateNumber(promptId);
      setActivePromptId(promptId);
      return;
    }

    setDuplicateNumber(null);
    setUsedPromptIds((prev) => [...prev, promptId]);
    setActivePromptId(promptId);
  };

  const renderPlayers = () => {
    if (members.length === 0) return null;

    return (
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">{t('games.players')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {members.map((member) => (
            <div
              key={member}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-xs font-medium ${member === name ? 'glow-primary border border-primary/30' : ''}`}
            >
              <div className="h-5 w-5 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center text-[9px] font-bold">
                {member[0]}
              </div>
              <span>{member}</span>
              {member === name && <span className="text-[9px] text-primary">{t('games.you')}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderGameSelector = () => (
    <div className="grid grid-cols-2 gap-3">
      {localizedGames.map((game, index) => {
        const isSelected = game.id === selectedGame?.id;
        const Icon = game.mode === 'ordered-deck' ? ListChecks : Hash;

        return (
          <button
            key={game.id}
            onClick={() => chooseGame(game.id)}
            className={`glass rounded-2xl p-4 text-left min-h-[132px] ${isSelected ? 'glow-primary border-primary/40' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isSelected ? 'gradient-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold text-muted-foreground">
                {String(index + 1).padStart(2, '0')}
              </span>
            </div>
            <p className="font-display font-bold mt-4 leading-tight">{game.title}</p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{game.description}</p>
          </button>
        );
      })}

      <button
        onClick={() => chooseGame('kollekt')}
        className={`glass rounded-2xl p-4 text-left min-h-[132px] border border-primary/20 ${
          isKollektSelected ? 'glow-primary border-primary/40' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
            isKollektSelected
              ? 'gradient-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}>
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-bold text-muted-foreground">
            {String(totalGames).padStart(2, '0')}
          </span>
        </div>
        <p className="font-display font-bold mt-4 leading-tight">{t('kollektGame.title')}</p>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {t('kollektGame.entryCard.description')}
        </p>
      </button>
    </div>
  );

  const renderKollektRules = () => (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 space-y-5">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-2xl gradient-primary text-primary-foreground flex items-center justify-center shrink-0">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
            {t('games.selectedGame', { current: selectedGameIndex + 1, total: totalGames })}
          </p>
          <h3 className="font-display text-2xl font-bold mt-1">{t('kollektGame.title')}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t('kollektGame.entryCard.description')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-background/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            {t('games.players')}
          </p>
          <p className="font-display text-xl font-bold mt-1">{t('kollektGame.entryRules.playersValue')}</p>
        </div>
        <div className="rounded-xl bg-background/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            {t('games.flow')}
          </p>
          <p className="font-display text-sm font-bold mt-2">{t('kollektGame.entryRules.flowValue')}</p>
        </div>
      </div>

      <div className="rounded-xl bg-background/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">{t('games.rules')}</p>
        </div>
        <ol className="space-y-2">
          {[
            t('kollektGame.entryRules.rule1'),
            t('kollektGame.entryRules.rule2'),
            t('kollektGame.entryRules.rule3'),
          ].map((rule, index) => (
            <li key={rule} className="flex gap-2 text-sm text-muted-foreground">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                {index + 1}
              </span>
              <span>{rule}</span>
            </li>
          ))}
        </ol>
      </div>

      <button
        onClick={() => navigate('/games/kollekt')}
        className="w-full gradient-primary rounded-2xl py-4 font-display font-bold text-primary-foreground flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
      >
        <Play className="h-5 w-5" />
        {t('games.startGame')}
      </button>
    </motion.div>
  );

  const renderRules = () => (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 space-y-5">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-2xl gradient-primary text-primary-foreground flex items-center justify-center shrink-0">
          {selectedGame?.mode === 'ordered-deck' ? <ListChecks className="h-6 w-6" /> : <Hash className="h-6 w-6" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
            {t('games.selectedGame', { current: selectedGameIndex + 1, total: totalGames })}
          </p>
          <h3 className="font-display text-2xl font-bold mt-1">{selectedGame?.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{selectedGame?.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-background/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{t('games.prompts')}</p>
          <p className="font-display text-xl font-bold mt-1">{selectedGame?.prompts.length}</p>
        </div>
        <div className="rounded-xl bg-background/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{t('games.flow')}</p>
          <p className="font-display text-sm font-bold mt-2">
            {selectedGame?.allowRandomOrder
              ? t('games.flexibleFlow')
              : selectedGame?.mode === 'ordered-deck'
                ? t('games.orderedFlow')
                : t('games.numberFlow')}
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-background/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">{t('games.rules')}</p>
        </div>
        <ol className="space-y-2">
          {selectedGame?.rules.map((rule, index) => (
            <li key={rule} className="flex gap-2 text-sm text-muted-foreground">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                {index + 1}
              </span>
              <span>{rule}</span>
            </li>
          ))}
        </ol>
      </div>

      {selectedGame?.allowRandomOrder && (
        <div className="rounded-xl bg-background/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">{t('games.playOrder')}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setRandomOrder(false)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold border ${!randomOrder ? 'bg-primary/15 text-primary border-primary/30' : 'bg-background/35 text-muted-foreground border-border'}`}
            >
              <ListChecks className="h-4 w-4 mx-auto mb-1" />
              {t('games.sequentialOrder')}
            </button>
            <button
              onClick={() => setRandomOrder(true)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold border ${randomOrder ? 'bg-primary/15 text-primary border-primary/30' : 'bg-background/35 text-muted-foreground border-border'}`}
            >
              <Shuffle className="h-4 w-4 mx-auto mb-1" />
              {t('games.randomOrder')}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={startGame}
        className="w-full gradient-primary rounded-2xl py-4 font-display font-bold text-primary-foreground flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
      >
        <Play className="h-5 w-5" />
        {t('games.startGame')}
      </button>
    </motion.div>
  );

  const renderPromptCard = () => {
    if (!activePrompt) {
      return (
        <motion.div
          key="finished"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="glass rounded-2xl p-8 text-center"
        >
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
          <h3 className="font-display text-xl font-bold">{t('games.finishedTitle')}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t('games.finishedText')}</p>
        </motion.div>
      );
    }

    const Icon = promptIcons[activePrompt.kind];
    const colors = promptStyles[activePrompt.kind];

    return (
      <motion.div
        key={`${activePrompt.id}-${duplicateNumber ?? 'prompt'}`}
        initial={{ opacity: 0, scale: 0.92, rotateY: -12 }}
        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
        exit={{ opacity: 0, scale: 0.92, rotateY: 12 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        className={`rounded-2xl p-6 bg-gradient-to-br ${duplicateNumber ? 'from-destructive/30 to-destructive/10 border-destructive/30 text-destructive' : colors} border glow-primary min-h-[210px] flex flex-col justify-between`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-background/35">
            {duplicateNumber ? <Beer className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
            {duplicateNumber ? t('games.duplicateTitle') : t(`games.promptKinds.${activePrompt.kind}`)}
          </span>
          <span className="font-display text-sm font-bold">#{activePrompt.id}</span>
        </div>
        {duplicateNumber ? (
          <div className="mt-6">
            <p className="font-display text-2xl font-bold leading-tight">
              {t('games.duplicateText', { number: duplicateNumber })}
            </p>
            <p className="text-sm mt-3 opacity-80">{t('games.duplicateHint')}</p>
          </div>
        ) : (
          <p className="font-display text-2xl font-bold leading-snug mt-6">{activePrompt.text}</p>
        )}
      </motion.div>
    );
  };

  const renderOrderedGame = () => {
    if (!selectedGame) return null;

    const total = selectedGame.prompts.length;
    const currentNumber = activePrompt ? deckIndex + 1 : total;
    const progress = total > 0 ? Math.min((currentNumber / total) * 100, 100) : 0;

    return (
      <div className="space-y-4">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>{t('games.progress', { current: currentNumber, total })}</span>
            <span>{selectedGame.allowRandomOrder && randomOrder ? t('games.randomOrder') : t('games.orderedFlow')}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full gradient-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <AnimatePresence mode="wait">{renderPromptCard()}</AnimatePresence>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button
            onClick={activePrompt ? advanceDeck : restartGame}
            className="gradient-primary rounded-2xl py-4 font-display font-bold text-primary-foreground flex items-center justify-center gap-2"
          >
            {activePrompt ? <ArrowRight className="h-5 w-5" /> : <RotateCcw className="h-5 w-5" />}
            {activePrompt ? t('games.nextQuestion') : t('games.playAgain')}
          </button>
          <button
            onClick={restartGame}
            className="h-full aspect-square glass rounded-2xl flex items-center justify-center text-muted-foreground"
            aria-label={t('games.restart')}
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>

      </div>
    );
  };

  const renderNumberBoardGame = () => {
    if (!selectedGame) return null;

    const usedCount = usedPromptIds.length;

    return (
      <div className="space-y-4">
        <div className="glass rounded-2xl p-4">
          <div>
            <p className="text-xs text-muted-foreground">{t('games.usedNumbers')}</p>
            <p className="font-display text-2xl font-bold">{usedCount}/{selectedGame.prompts.length}</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activePrompt ? renderPromptCard() : (
            <motion.div
              key="number-idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="glass rounded-2xl p-8 text-center"
            >
              <Hash className="h-12 w-12 text-primary mx-auto mb-3 opacity-70" />
              <p className="text-sm text-muted-foreground">{t('games.numberPrompt')}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="glass rounded-2xl p-3">
          <div className="grid grid-cols-7 gap-1.5">
            {selectedGame.prompts.map((prompt) => {
              const isUsed = usedPromptIds.includes(prompt.id);
              const isActive = activePromptId === prompt.id;
              return (
                <button
                  key={prompt.id}
                  onClick={() => revealNumber(prompt.id)}
                  className={`aspect-square rounded-lg border text-xs font-display font-bold transition-colors ${
                    isActive
                      ? 'border-secondary bg-secondary/20 text-secondary'
                      : isUsed
                        ? 'border-primary/30 bg-primary/15 text-primary'
                        : 'border-border bg-background/35 text-foreground'
                  }`}
                  aria-label={t('games.pickNumber', { number: prompt.id })}
                >
                  {prompt.id}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={restartGame}
          className="w-full glass rounded-2xl py-3 font-semibold text-muted-foreground flex items-center justify-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          {t('games.restart')}
        </button>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 pt-4">
      <div>
        <h2 className="font-display text-xl font-bold">{t('games.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('games.subtitle')}</p>
      </div>

      {renderGameSelector()}
      {renderPlayers()}

      {phase === 'playing' && (
        <button
          onClick={() => {
            setPhase('rules');
            clearProgress();
          }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('games.backToRules')}
        </button>
      )}

      {phase === 'rules'
        ? (isKollektSelected ? renderKollektRules() : renderRules())
        : selectedGame?.mode === 'ordered-deck'
          ? renderOrderedGame()
          : renderNumberBoardGame()}
    </motion.div>
  );
}
