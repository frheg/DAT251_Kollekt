// ─── Player ──────────────────────────────────────────────────────────────────

/**
 * All stat fields pulled from the collective backend.
 * Guests who lack real data receive DEFAULT_GUEST_STATS.
 */
export interface PlayerStats {
  level: number;
  xp: number;
  /** Leaderboard rank within the collective (1 = best). Lower is better. */
  rank: number;
  streak: number;
  tasksCompleted: number;
  lateCompletions: number;
  skippedTasks: number;
  achievementsUnlocked: number;
  /** Badge keys: 'TOP' | 'STREAK' | 'PRO' | 'HERO' */
  badges: string[];
}

export const DEFAULT_GUEST_STATS: PlayerStats = {
  level: 1,
  xp: 0,
  rank: 99,
  streak: 0,
  tasksCompleted: 0,
  lateCompletions: 0,
  skippedTasks: 0,
  achievementsUnlocked: 0,
  badges: [],
};

export interface Player {
  /** Stable local ID — not the backend member ID */
  id: string;
  name: string;
  isGuest: boolean;
  /** Whether this player participates in the current session */
  active: boolean;
  stats: PlayerStats;
}

// ─── Game Session ─────────────────────────────────────────────────────────────

export type RoundType =
  | 'STAT_COMPARISON' // lowest/highest stat holder drinks or distributes
  | 'CHALLENGE'       // personal dare derived from a player's own stats
  | 'HOT_SEAT'        // group votes on a stat-based question about each other
  | 'TRIVIA_TWIST'    // true/false about player stats; wrong guessers drink
  | 'RANDOM_EVENT';   // fun wildcard (waterfall, rule-maker, etc.)

export type GameLang = 'en' | 'no';

export interface GameEventText {
  title: string;
  description: string;
}

export interface GameEvent {
  id: string;
  roundType: RoundType;
  title: string;
  /** The main prompt text shown to players */
  description: string;
  /** Stable per-language copy so the same event can be shown after a language switch */
  textByLanguage?: Record<GameLang, GameEventText>;
  /** Player names that are specifically called out (may be empty) */
  targetPlayers: string[];
  /** Sips the "loser" / targeted player must drink (0 if they distribute instead) */
  drinks: number;
  /** If set, this player distributes sips instead of drinking them */
  distributeTarget?: string;
  distributeCount?: number;
  /** Extra metadata for display (e.g. the stat that triggered this event) */
  context?: Record<string, string | number>;
}

export interface Round {
  id: string;
  roundNumber: number;
  event: GameEvent;
  resolved: boolean;
  skipped: boolean;
}

export type SessionStatus = 'SETUP' | 'IN_PROGRESS' | 'PAUSED' | 'FINISHED';

export interface GameSession {
  id: string;
  players: Player[];
  rounds: Round[];
  currentRoundIndex: number;
  status: SessionStatus;
  config: GameConfig;
  createdAt: Date;
  startedAt?: Date;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface GameConfig {
  maxRounds: number;
  /** Multiply all drink counts by this value (0.5 = light, 2.0 = hardcore) */
  drinkMultiplier: number;
  /**
   * How much player stats influence who gets targeted.
   * 0 = fully random targeting, 1 = fully stat-weighted targeting.
   */
  statInfluence: number;
  /** Probability weights for each round type (unnormalised — ratios matter) */
  roundTypeWeights: Record<RoundType, number>;
  allowSkip: boolean;
  /** Extra drinks for using a skip */
  skipDrinkPenalty: number;
}

// ─── Summary (for UI scoreboard) ─────────────────────────────────────────────

export interface SessionPlayerSummary {
  name: string;
  isGuest: boolean;
  /** Composite performance score 0–100 (higher = stronger player) */
  performanceScore: number;
  /** Rank within this session (1 = strongest player) */
  sessionRank: number;
  /** Running sip tally updated by the UI as rounds are resolved */
  drinksReceived: number;
}
