import type { Player, PlayerStats, SessionPlayerSummary } from './types';

// ─── Performance Score ────────────────────────────────────────────────────────

/**
 * Compute a 0–100 composite "performance score" for a single player relative
 * to the session's best values.
 *
 * Weights:
 *   streak           30%
 *   tasksCompleted   35%
 *   level            20%
 *   achievements     15%
 *
 * Penalties (capped at –20 total):
 *   –1 per late completion
 *   –2 per skipped task
 */
export function computePerformanceScore(
  stats: PlayerStats,
  sessionMaxStats: Pick<PlayerStats, 'streak' | 'tasksCompleted' | 'level' | 'achievementsUnlocked'>,
): number {
  const safeRatio = (value: number, max: number) => (max > 0 ? value / max : 0);

  const raw =
    safeRatio(stats.streak, sessionMaxStats.streak) * 30 +
    safeRatio(stats.tasksCompleted, sessionMaxStats.tasksCompleted) * 35 +
    safeRatio(stats.level, sessionMaxStats.level) * 20 +
    safeRatio(stats.achievementsUnlocked, sessionMaxStats.achievementsUnlocked) * 15;

  const penalty = Math.min(stats.lateCompletions * 1 + stats.skippedTasks * 2, 20);

  return Math.round(Math.max(0, Math.min(100, raw - penalty)));
}

// ─── Session Summaries ────────────────────────────────────────────────────────

/**
 * Produce a sorted list of SessionPlayerSummary for every active player.
 * Players are ranked 1…N within the session (1 = highest performance score).
 *
 * Call this once at game start; the UI holds the `drinksReceived` counter
 * and updates it independently as rounds are resolved.
 */
export function buildSessionSummaries(players: Player[]): SessionPlayerSummary[] {
  const maxStats = {
    streak: Math.max(...players.map((p) => p.stats.streak), 1),
    tasksCompleted: Math.max(...players.map((p) => p.stats.tasksCompleted), 1),
    level: Math.max(...players.map((p) => p.stats.level), 1),
    achievementsUnlocked: Math.max(...players.map((p) => p.stats.achievementsUnlocked), 1),
  };

  const summaries: SessionPlayerSummary[] = players.map((p) => ({
    name: p.name,
    isGuest: p.isGuest,
    performanceScore: computePerformanceScore(p.stats, maxStats),
    sessionRank: 0, // filled in below
    drinksReceived: 0,
  }));

  // Rank by score descending; equal scores share the same rank
  summaries.sort((a, b) => b.performanceScore - a.performanceScore);
  summaries.forEach((s, i) => {
    s.sessionRank = i + 1;
  });

  return summaries;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Human-readable label for a stat key, used inside event descriptions.
 */
export function statLabel(statKey: keyof Omit<PlayerStats, 'badges'>): string {
  const labels: Record<keyof Omit<PlayerStats, 'badges'>, string> = {
    level: 'level',
    xp: 'XP',
    rank: 'leaderboard rank',
    streak: 'streak',
    tasksCompleted: 'tasks completed',
    lateCompletions: 'late completions',
    skippedTasks: 'skipped tasks',
    achievementsUnlocked: 'achievements',
  };
  return labels[statKey];
}

export type PerformanceTier = 'elite' | 'solid' | 'average' | 'struggling' | 'rookie';

/**
 * Return a stable performance tier key for a given score.
 * The UI translates this key so labels follow live language changes.
 */
export function performanceTier(score: number): PerformanceTier {
  if (score >= 80) return 'elite';
  if (score >= 60) return 'solid';
  if (score >= 40) return 'average';
  if (score >= 20) return 'struggling';
  return 'rookie';
}
