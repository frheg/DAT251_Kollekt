import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Beer,
  Brain,
  CheckCircle2,
  ChevronRight,
  Crown,
  Flame,
  Plus,
  RotateCcw,
  Settings2,
  SkipForward,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useUser } from '../context/UserContext';
import {
  addPlayer,
  buildSessionSummaries,
  canStartGame,
  createGuestPlayer,
  fromLeaderboardPlayer,
  GAME_PRESETS,
  generateRound,
  getActivePlayers,
  performanceTier,
  removePlayer,
  resolveRound,
  skipRound,
  togglePlayerActive,
} from '../lib/drinkingGameEngine';
import type {
  GameConfig,
  GameLang,
  GamePreset,
  Player,
  Round,
  RoundType,
  SessionPlayerSummary,
} from '../lib/drinkingGameEngine';
import type { LeaderboardResponse, MemberStats } from '../lib/types';

// ─── Round type display meta ──────────────────────────────────────────────────

const ROUND_TYPE_ICONS: Record<RoundType, typeof Beer> = {
  STAT_COMPARISON: Zap,
  CHALLENGE: Flame,
  HOT_SEAT: Crown,
  TRIVIA_TWIST: Brain,
  RANDOM_EVENT: Sparkles,
};

const ROUND_TYPE_COLORS: Record<RoundType, string> = {
  STAT_COMPARISON: 'text-secondary',
  CHALLENGE: 'text-primary',
  HOT_SEAT: 'text-accent',
  TRIVIA_TWIST: 'text-purple-400',
  RANDOM_EVENT: 'text-yellow-400',
};

const ROUND_TYPE_BG: Record<RoundType, string> = {
  STAT_COMPARISON: 'from-secondary/30 to-secondary/5 border-secondary/25',
  CHALLENGE: 'from-primary/30 to-primary/5 border-primary/25',
  HOT_SEAT: 'from-accent/30 to-accent/5 border-accent/25',
  TRIVIA_TWIST: 'from-purple-500/20 to-purple-500/5 border-purple-500/20',
  RANDOM_EVENT: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/20',
};

// ─── Phase types ──────────────────────────────────────────────────────────────

type Phase = 'loading' | 'setup' | 'config' | 'playing' | 'summary';

// ─── Language helper ──────────────────────────────────────────────────────────

function resolveGameLang(language?: string): GameLang {
  return language?.toLowerCase().startsWith('no') ? 'no' : 'en';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CollektGamePage() {
  const { t, i18n } = useTranslation();
  const { currentUser } = useUser();
  const navigate = useNavigate();
  const name = currentUser?.name ?? '';

  const gameLang = useMemo(
    () => resolveGameLang(i18n.resolvedLanguage ?? i18n.language),
    [i18n.language, i18n.resolvedLanguage],
  );

  // ── Data / setup state ─────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('loading');
  // Store the i18n key, not the translated string — translating happens at render
  // time so switching language always shows the current translation.
  const [loadErrorKey, setLoadErrorKey] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<GamePreset>('default');
  const [guestName, setGuestName] = useState('');
  const [guestNameErrorKey, setGuestNameErrorKey] = useState<string | null>(null);

  // ── Active game state ──────────────────────────────────────────────────────
  // Rounds are generated ON DEMAND (one at a time) so that the current gameLang
  // is always used when generating new rounds.  This also means a language
  // switch during play takes effect on the very next round.
  const [sessionConfig, setSessionConfig] = useState<GameConfig | null>(null);
  const [sessionPlayers, setSessionPlayers] = useState<Player[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [roundIndex, setRoundIndex] = useState(0); // 0-based
  const [maxRounds, setMaxRounds] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  // Mutable ref — persists across renders, mutations don't cause re-renders.
  // Tracks which event templates have been used to avoid repetition.
  const usedIdsRef = useRef(new Set<string>());

  // ── Summary state ──────────────────────────────────────────────────────────
  const [summaries, setSummaries] = useState<SessionPlayerSummary[]>([]);

  // ─── Data loading ─────────────────────────────────────────────────────────
  // IMPORTANT: `t` is intentionally excluded from the dependency array.
  // `t` gets a new reference on every language change, which would cause this
  // effect to re-run mid-game and call setPhase('setup'), crashing the game.
  // The error key is stored and translated at render time instead.
  useEffect(() => {
    if (!name) return;

    const load = async () => {
      try {
        const [lbRes, members] = await Promise.all([
          api.get<LeaderboardResponse>(
            `/leaderboard?memberName=${encodeURIComponent(name)}&period=OVERALL`,
          ),
          api.get<{ name: string }[]>(
            `/members/collective?memberName=${encodeURIComponent(name)}`,
          ),
        ]);

        const detailResults = await Promise.allSettled(
          members.map((m) =>
            api.get<MemberStats>(
              `/members/stats?viewerName=${encodeURIComponent(name)}&targetName=${encodeURIComponent(m.name)}`,
            ),
          ),
        );

        const detailMap = new Map<string, MemberStats>();
        members.forEach((m, i) => {
          const r = detailResults[i];
          if (r.status === 'fulfilled') detailMap.set(m.name, r.value);
        });

        setPlayers(lbRes.players.map((lb) => fromLeaderboardPlayer(lb, detailMap.get(lb.name))));
        setPhase('setup');
      } catch {
        // Store the i18n key — translated at render time so language changes
        // immediately show the error in the new language without re-fetching.
        setLoadErrorKey('kollektGame.errors.loadFailed');
        setPhase('setup');
      }
    };

    load();
  }, [name]); // ← `t` deliberately omitted — see comment above

  // Active rounds keep stable copy for both languages, so switching language
  // only changes rendered text and never re-rolls the prompt.

  // ─── Player management ─────────────────────────────────────────────────────

  const handleTogglePlayer = useCallback((playerName: string) => {
    setPlayers((prev) => togglePlayerActive(prev, playerName));
  }, []);

  const handleAddGuest = useCallback(() => {
    const trimmed = guestName.trim();
    if (!trimmed) {
      setGuestNameErrorKey('kollektGame.errors.guestNameEmpty');
      return;
    }
    try {
      const guest = createGuestPlayer(trimmed);
      setPlayers((prev) => addPlayer(prev, guest));
      setGuestName('');
      setGuestNameErrorKey(null);
    } catch {
      setGuestNameErrorKey('kollektGame.errors.duplicateName');
    }
  }, [guestName]);

  const handleRemoveGuest = useCallback((playerName: string) => {
    setPlayers((prev) => removePlayer(prev, playerName));
  }, []);

  // ─── Game flow ─────────────────────────────────────────────────────────────

  const handleStartGame = useCallback(() => {
    const config = GAME_PRESETS[selectedPreset].config;
    const active = getActivePlayers(players);

    // Reset the used-template tracker for this new game
    usedIdsRef.current = new Set<string>();

    // Generate round 1 immediately using the current language
    const firstRound = generateRound(1, active, config, usedIdsRef.current, gameLang);
    if (!firstRound) return;

    setSessionConfig(config);
    setSessionPlayers(active);
    setMaxRounds(config.maxRounds);
    setCurrentRound(firstRound);
    setRoundIndex(0);
    setSkippedCount(0);
    setSummaries(buildSessionSummaries(active));
    setPhase('playing');
  }, [players, selectedPreset, gameLang]);

  const advanceGame = useCallback(
    (skipped: boolean) => {
      if (!currentRound || !sessionConfig) return;

      if (skipped) setSkippedCount((c) => c + 1);

      const nextIndex = roundIndex + 1;

      if (nextIndex >= maxRounds) {
        // Game over — update current round state so summary has the right count
        setRoundIndex(nextIndex);
        setCurrentRound(null);
        setPhase('summary');
        return;
      }

      // Generate next round on demand using the CURRENT gameLang
      const next = generateRound(
        nextIndex + 1,
        sessionPlayers,
        sessionConfig,
        usedIdsRef.current,
        gameLang,
      );
      setCurrentRound(next);
      setRoundIndex(nextIndex);
    },
    [currentRound, sessionConfig, sessionPlayers, roundIndex, maxRounds, gameLang],
  );

  const handleResolve = useCallback(() => advanceGame(false), [advanceGame]);
  const handleSkip = useCallback(() => advanceGame(true), [advanceGame]);

  const handleRestart = useCallback(() => {
    setCurrentRound(null);
    setRoundIndex(0);
    setMaxRounds(0);
    setSkippedCount(0);
    setSessionConfig(null);
    setSessionPlayers([]);
    setSummaries([]);
    usedIdsRef.current = new Set<string>();
    setPhase('setup');
  }, []);

  // ─── Render helpers ────────────────────────────────────────────────────────

  const renderLoadingScreen = () => (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <div className="h-10 w-10 rounded-full gradient-primary animate-pulse" />
      <p className="text-sm text-muted-foreground">{t('kollektGame.loading')}</p>
    </div>
  );

  const renderPlayerSetup = () => {
    const active = getActivePlayers(players);
    const canStart = canStartGame(players);
    const collectiveMembers = players.filter((p) => !p.isGuest);
    const guests = players.filter((p) => p.isGuest);

    return (
      <motion.div
        key="setup"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="space-y-5"
      >
        {loadErrorKey && (
          <div className="glass rounded-2xl p-4 border border-destructive/30 text-sm text-destructive">
            {t(loadErrorKey)}
          </div>
        )}

        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">{t('kollektGame.setup.selectPlayers')}</p>
            <span className="ml-auto text-xs text-muted-foreground">
              {t('kollektGame.setup.activePlayers', { count: active.length })}
            </span>
          </div>
          <div className="space-y-2">
            {collectiveMembers.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                isSelf={player.name === name}
                youLabel={t('kollektGame.setup.you')}
                levelLabel={t('kollektGame.setup.levelShort')}
                onToggle={handleTogglePlayer}
              />
            ))}
          </div>
          {collectiveMembers.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              {t('kollektGame.setup.noMembers')}
            </p>
          )}
        </div>

        <div className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-accent" />
            <p className="text-sm font-semibold">{t('kollektGame.setup.addGuests')}</p>
          </div>
          {guests.length > 0 && (
            <div className="space-y-2">
              {guests.map((guest) => (
                <div key={guest.id} className="flex items-center gap-3 rounded-xl bg-background/40 px-3 py-2.5">
                  <div className="h-7 w-7 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent shrink-0">
                    {guest.name[0].toUpperCase()}
                  </div>
                  <span className="text-sm flex-1">{guest.name}</span>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {t('kollektGame.setup.guest')}
                  </span>
                  <button
                    onClick={() => handleRemoveGuest(guest.name)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={t('kollektGame.setup.removeGuestAria', { name: guest.name })}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={guestName}
              onChange={(e) => { setGuestName(e.target.value); setGuestNameErrorKey(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddGuest(); }}
              placeholder={t('kollektGame.setup.guestPlaceholder')}
              className="flex-1 rounded-xl bg-background/40 border border-border px-3 py-2.5 text-sm outline-none focus:border-accent/50 transition-colors"
            />
            <button
              onClick={handleAddGuest}
              className="h-10 w-10 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center shrink-0"
              aria-label={t('kollektGame.setup.addGuestAria')}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {guestNameErrorKey && (
            <p className="text-xs text-destructive">{t(guestNameErrorKey)}</p>
          )}
        </div>

        <button
          onClick={() => setPhase('config')}
          disabled={!canStart}
          className={`w-full rounded-2xl py-4 font-display font-bold flex items-center justify-center gap-2 transition-opacity ${
            canStart
              ? 'gradient-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
          }`}
        >
          <Settings2 className="h-5 w-5" />
          {t('kollektGame.setup.configureGame')}
          <ChevronRight className="h-4 w-4" />
        </button>
        {!canStart && (
          <p className="text-xs text-center text-muted-foreground">
            {t('kollektGame.setup.minPlayersHint')}
          </p>
        )}
      </motion.div>
    );
  };

  const renderConfig = () => (
    <motion.div
      key="config"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-5"
    >
      <div className="glass rounded-2xl p-5 space-y-4">
        <p className="text-sm font-semibold">{t('kollektGame.config.gameMode')}</p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(GAME_PRESETS) as GamePreset[]).map((key) => {
            const config = GAME_PRESETS[key].config;
            const selected = selectedPreset === key;
            return (
              <button
                key={key}
                onClick={() => setSelectedPreset(key)}
                className={`rounded-xl p-3.5 text-left border transition-colors ${
                  selected
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-background/35 border-border text-foreground'
                }`}
              >
                <p className="font-display font-bold text-sm">{t(`kollektGame.presets.${key}.label`)}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-tight">
                  {t(`kollektGame.presets.${key}.description`)}
                </p>
                <p className="text-[10px] font-semibold mt-2 opacity-70">
                  {config.maxRounds}{t('kollektGame.config.rounds_suffix')}
                  {config.drinkMultiplier !== 1
                    ? t('kollektGame.config.drinks_multiplier', { m: config.drinkMultiplier })
                    : ''}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <p className="text-sm font-semibold">{t('kollektGame.config.playersInSession')}</p>
        <div className="flex gap-2 flex-wrap">
          {getActivePlayers(players).map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-xs font-medium ${
                p.name === name ? 'border border-primary/30 glow-primary' : ''
              }`}
            >
              <div className="h-5 w-5 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center text-[9px] font-bold">
                {p.name[0].toUpperCase()}
              </div>
              <span>{p.name}</span>
              {p.isGuest && (
                <span className="text-[9px] text-muted-foreground">{t('kollektGame.setup.guest')}</span>
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {[
            { labelKey: 'kollektGame.config.rounds', value: GAME_PRESETS[selectedPreset].config.maxRounds },
            { labelKey: 'kollektGame.config.players', value: getActivePlayers(players).length },
            { labelKey: 'kollektGame.config.statWeight', value: `${Math.round(GAME_PRESETS[selectedPreset].config.statInfluence * 100)}%` },
          ].map((stat) => (
            <div key={stat.labelKey} className="rounded-xl bg-background/40 p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{t(stat.labelKey)}</p>
              <p className="font-display font-bold text-base mt-0.5">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-2">
        <button
          onClick={() => setPhase('setup')}
          className="h-14 w-14 glass rounded-2xl flex items-center justify-center text-muted-foreground"
          aria-label={t('kollektGame.config.backAria')}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          onClick={handleStartGame}
          className="gradient-primary rounded-2xl py-4 font-display font-bold text-primary-foreground flex items-center justify-center gap-2"
        >
          <Beer className="h-5 w-5" />
          {t('kollektGame.config.startGame')}
        </button>
      </div>
    </motion.div>
  );

  const renderPlaying = () => {
    if (!currentRound || !sessionConfig) return null;
    const ev = currentRound.event;
    const eventText = ev.textByLanguage?.[gameLang] ?? {
      title: ev.title,
      description: ev.description,
    };
    const Icon = ROUND_TYPE_ICONS[ev.roundType];
    const colorClass = ROUND_TYPE_COLORS[ev.roundType];
    const bgClass = ROUND_TYPE_BG[ev.roundType];
    const roundLabel = t(`kollektGame.roundTypes.${ev.roundType}`);

    return (
      <motion.div
        key="playing"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="space-y-4"
      >
        {/* Progress bar */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>
              {t('kollektGame.playing.roundOf', { current: roundIndex + 1, total: maxRounds })}
            </span>
            <span className={`font-semibold ${colorClass}`}>{roundLabel}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full gradient-primary rounded-full"
              animate={{ width: `${(roundIndex / maxRounds) * 100}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Event card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={ev.id}
            initial={{ opacity: 0, scale: 0.92, rotateY: -8 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            exit={{ opacity: 0, scale: 0.92, rotateY: 8 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            className={`rounded-2xl p-6 bg-gradient-to-br ${bgClass} border min-h-[240px] flex flex-col gap-4`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className={`inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-background/30 ${colorClass}`}>
                <Icon className="h-3.5 w-3.5" />
                {roundLabel}
              </span>
              <span className="font-display font-bold text-xs text-muted-foreground">
                #{roundIndex + 1}
              </span>
            </div>
            <h3 className="font-display text-xl font-bold leading-tight">{eventText.title}</h3>
            <p className="text-sm leading-relaxed flex-1">{eventText.description}</p>
            {(ev.drinks > 0 || ev.distributeCount) && (
              <div className="flex items-center gap-2">
                <Beer className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {ev.distributeTarget
                    ? t('kollektGame.drinking.distributes', { name: ev.distributeTarget, count: ev.distributeCount })
                    : ev.targetPlayers.length > 0
                      ? t('kollektGame.drinking.drinksTarget', { names: ev.targetPlayers.join(', '), count: ev.drinks })
                      : t('kollektGame.drinking.sips', { count: ev.drinks })}
                </span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Action buttons */}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button
            onClick={handleResolve}
            className="gradient-primary rounded-2xl py-4 font-display font-bold text-primary-foreground flex items-center justify-center gap-2"
          >
            <ArrowRight className="h-5 w-5" />
            {t('kollektGame.playing.done')}
          </button>
          {sessionConfig.allowSkip && (
            <button
              onClick={handleSkip}
              className="h-full aspect-square glass rounded-2xl flex items-center justify-center text-muted-foreground"
              aria-label={t('kollektGame.playing.skipAria', { penalty: sessionConfig.skipDrinkPenalty })}
              title={t('kollektGame.playing.skipTitle', { penalty: sessionConfig.skipDrinkPenalty })}
            >
              <SkipForward className="h-5 w-5" />
            </button>
          )}
        </div>
        {sessionConfig.allowSkip && (
          <p className="text-[11px] text-center text-muted-foreground">
            {t('kollektGame.playing.skipCost', { count: sessionConfig.skipDrinkPenalty })}
          </p>
        )}
      </motion.div>
    );
  };

  const renderSummary = () => (
      <motion.div
        key="summary"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5"
      >
        <div className="glass rounded-2xl p-5 text-center">
          <Trophy className="h-12 w-12 text-secondary mx-auto mb-3" />
          <h3 className="font-display text-2xl font-bold">{t('kollektGame.summary.title')}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('kollektGame.summary.stats', { rounds: roundIndex, skipped: skippedCount })}
          </p>
        </div>

        <div className="glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-secondary" />
            <p className="text-sm font-semibold">{t('kollektGame.summary.performance')}</p>
            <span className="text-[10px] text-muted-foreground ml-1">
              {t('kollektGame.summary.performanceHint')}
            </span>
          </div>
          {[...summaries]
            .sort((a, b) => a.sessionRank - b.sessionRank)
            .map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-5 text-right">{s.sessionRank}</span>
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center text-[9px] font-bold shrink-0">
                  {s.name[0].toUpperCase()}
                </div>
                <span className="text-sm flex-1">{s.name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full gradient-primary rounded-full" style={{ width: `${s.performanceScore}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {t(`kollektGame.summary.tiers.${performanceTier(s.performanceScore)}`)}
                  </span>
                </div>
              </div>
            ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleRestart}
            className="glass rounded-2xl py-4 font-display font-bold flex items-center justify-center gap-2 text-sm"
          >
            <RotateCcw className="h-4 w-4" />
            {t('kollektGame.summary.newGame')}
          </button>
          <button
            onClick={() => navigate('/games')}
            className="gradient-primary rounded-2xl py-4 font-display font-bold text-primary-foreground flex items-center justify-center gap-2 text-sm"
          >
            <CheckCircle2 className="h-4 w-4" />
            {t('kollektGame.summary.backToGames')}
          </button>
        </div>
      </motion.div>
  );

  // ─── Root render ────────────────────────────────────────────────────────────

  const phaseSubtitle = (() => {
    if (phase === 'loading') return t('kollektGame.phases.loading');
    if (phase === 'setup') return t('kollektGame.phases.setup');
    if (phase === 'config') return t('kollektGame.phases.config');
    if (phase === 'playing') return t('kollektGame.phases.playing', { round: roundIndex + 1 });
    return t('kollektGame.phases.summary');
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 pt-4"
    >
      <div className="flex items-center gap-3">
        {phase !== 'playing' && phase !== 'summary' && (
          <button
            onClick={() => navigate('/games')}
            className="h-9 w-9 glass rounded-xl flex items-center justify-center text-muted-foreground shrink-0"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div>
          <h2 className="font-display text-xl font-bold">{t('kollektGame.title')}</h2>
          <p className="text-xs text-muted-foreground">{phaseSubtitle}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'loading' && renderLoadingScreen()}
        {phase === 'setup' && renderPlayerSetup()}
        {phase === 'config' && renderConfig()}
        {phase === 'playing' && renderPlaying()}
        {phase === 'summary' && renderSummary()}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlayerRow({
  player,
  isSelf,
  youLabel,
  levelLabel,
  onToggle,
}: {
  player: Player;
  isSelf: boolean;
  youLabel: string;
  levelLabel: string;
  onToggle: (name: string) => void;
}) {
  return (
    <button
      onClick={() => onToggle(player.name)}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors ${
        player.active ? 'bg-primary/10 border-primary/25' : 'bg-background/30 border-border opacity-50'
      }`}
    >
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          player.active ? 'bg-gradient-to-br from-primary/50 to-accent/50' : 'bg-muted'
        }`}
      >
        {player.name[0].toUpperCase()}
      </div>
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{player.name}</span>
          {isSelf && <span className="text-[9px] text-primary font-bold">{youLabel}</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground">
            {levelLabel} {player.stats.level}
          </span>
          <span className="text-[10px] text-muted-foreground">{player.stats.tasksCompleted}</span>
          {player.stats.streak > 0 && (
            <span className="text-[10px] text-orange-400 flex items-center gap-0.5">
              <Flame className="h-2.5 w-2.5" />
              {player.stats.streak}
            </span>
          )}
        </div>
      </div>
      <div
        className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
          player.active ? 'border-primary bg-primary' : 'border-muted-foreground bg-transparent'
        }`}
      >
        {player.active && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
      </div>
    </button>
  );
}
