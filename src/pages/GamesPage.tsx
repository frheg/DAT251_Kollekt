import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices, Users, RefreshCw, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useUser } from '../context/UserContext';
import { translateLowerKey } from '../i18n/helpers';
import type { DrinkingQuestion } from '../lib/types';

const typeColors: Record<string, string> = {
  drink:     'from-secondary/40 to-secondary/10 border-secondary/30 text-secondary',
  distribute:'from-primary/40 to-primary/10 border-primary/30 text-primary',
  vote:      'from-accent/40 to-accent/10 border-accent/30 text-accent',
  challenge: 'from-destructive/40 to-destructive/10 border-destructive/30 text-destructive',
};
const typeEmoji: Record<string, string> = {
  drink: '🍺', distribute: '🎯', vote: '🗳️', challenge: '⚡',
};

export default function GamesPage() {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const [question, setQuestion] = useState<DrinkingQuestion | null>(null);
  const [history, setHistory] = useState<DrinkingQuestion[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);

  const name = currentUser?.name ?? '';

  useEffect(() => {
    if (!name) return;
    api.get<{ name: string }[]>(`/members/collective?memberName=${encodeURIComponent(name)}`)
      .then((res) => setMembers(res.map((m) => m.name)))
      .catch(() => {});
  }, [name]);

  const drawQuestion = async () => {
    if (!name) return;
    setLoading(true);
    try {
      const q = await api.get<DrinkingQuestion>(`/drinking-game/question?memberName=${encodeURIComponent(name)}`);
      if (question) setHistory((prev) => [question, ...prev].slice(0, 10));
      setQuestion(q);
      setStarted(true);
    } catch {}
    setLoading(false);
  };

  const typeLower = question?.type?.toLowerCase() ?? '';
  const colors = typeColors[typeLower] ?? 'from-muted to-muted/50 border-border text-foreground';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 pt-4">
      <div>
        <h2 className="font-display text-xl font-bold">{t('games.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('games.subtitle')} 🍻</p>
      </div>

      {/* Players */}
      {members.length > 0 && (
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">{t('games.players')}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {members.map((m) => (
              <div key={m} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-xs font-medium ${m === name ? 'glow-primary border border-primary/30' : ''}`}>
                <div className="h-5 w-5 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center text-[9px] font-bold">
                  {m[0]}
                </div>
                {m}
                {m === name && <span className="text-[9px] text-primary">{t('games.you')}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Question card */}
      <div className="relative min-h-[200px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {!started ? (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="glass rounded-2xl p-8 text-center w-full">
              <Dices className="h-12 w-12 text-primary mx-auto mb-3 opacity-60" />
              <p className="text-muted-foreground text-sm">{t('games.idlePrompt')}</p>
            </motion.div>
          ) : question ? (
            <motion.div key={question.text} initial={{ opacity: 0, scale: 0.9, rotateY: -15 }} animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.9, rotateY: 15 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={`w-full rounded-2xl p-6 bg-gradient-to-br ${colors} border glow-primary`}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">{typeEmoji[typeLower] ?? '🎲'}</span>
                <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-background/30`}>
                  {translateLowerKey('common.drinkingTypes', question.type, question.type)}
                </span>
              </div>
              <p className="font-display text-xl font-bold leading-snug">{question.text}</p>
              {question.targetedPlayer && (
                <div className="mt-4 flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5" />
                  <p className="text-sm font-semibold">{t('games.targeting', { name: question.targetedPlayer })}</p>
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Draw button */}
      <button onClick={drawQuestion} disabled={loading}
        className="w-full gradient-primary rounded-2xl py-4 font-display font-bold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform">
        {loading
          ? <RefreshCw className="h-5 w-5 animate-spin" />
          : <Dices className="h-5 w-5" />}
        {started ? t('games.nextQuestion') : t('games.drawQuestion')}
      </button>

      {/* History */}
      {history.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('games.previousCards')}</h3>
          <div className="space-y-2">
            {history.map((q, i) => {
              const tl = q.type?.toLowerCase() ?? '';
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="glass rounded-xl p-3 flex items-start gap-3 opacity-60">
                  <span className="text-base shrink-0">{typeEmoji[tl] ?? '🎲'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                      {translateLowerKey('common.drinkingTypes', q.type, q.type)}
                    </p>
                    <p className="text-sm mt-0.5">{q.text}</p>
                    {q.targetedPlayer && <p className="text-[10px] text-muted-foreground mt-0.5">→ {q.targetedPlayer}</p>}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
