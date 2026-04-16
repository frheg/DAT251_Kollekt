import type { Player, PlayerStats } from './types';

// ─── Core RNG ─────────────────────────────────────────────────────────────────

/**
 * Pick a random item from `items` where each entry has a corresponding weight.
 * Higher weight = proportionally higher probability of selection.
 * All weights must be >= 0; at least one must be > 0.
 */
export function weightedRandom<T>(items: T[], weights: number[]): T {
  if (items.length === 0) throw new RangeError('weightedRandom: items must not be empty');
  if (items.length !== weights.length) throw new RangeError('weightedRandom: items and weights must have equal length');

  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  let cursor = Math.random() * total;

  for (let i = 0; i < items.length; i++) {
    cursor -= Math.max(0, weights[i]);
    if (cursor <= 0) return items[i];
  }

  // Floating-point safety fallback — return the last item
  return items[items.length - 1];
}

// ─── Round-type selection ─────────────────────────────────────────────────────

import type { RoundType, GameConfig } from './types';

/**
 * Pick the next round type according to the configured probability weights.
 */
export function pickRoundType(config: GameConfig): RoundType {
  const types = Object.keys(config.roundTypeWeights) as RoundType[];
  const weights = types.map((t) => config.roundTypeWeights[t]);
  return weightedRandom(types, weights);
}

// ─── Stat-weighted player selection ──────────────────────────────────────────

/**
 * Select one player from `players`, weighted by the given stat.
 *
 * - `preferHigh = true`  → players with higher stat values are more likely chosen.
 * - `preferHigh = false` → players with lower stat values are more likely chosen.
 * - `statInfluence` (0–1) blends stat-weighting with uniform random selection.
 *   0 = uniform, 1 = fully stat-driven.
 */
export function pickPlayerByStat(
  players: Player[],
  statKey: keyof Omit<PlayerStats, 'badges'>,
  preferHigh: boolean,
  statInfluence: number,
): Player {
  const values = players.map((p) => p.stats[statKey] as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const weights = values.map((v) => {
    // Normalise to 0–1 then flip if we prefer low values
    const normalised = (v - min) / range;
    const directional = preferHigh ? normalised : 1 - normalised;
    // Blend: always keep some uniform probability (epsilon avoids zero weight)
    return (1 - statInfluence) * 1.0 + statInfluence * (directional + 0.05);
  });

  return weightedRandom(players, weights);
}

// ─── Deterministic extreme selection ─────────────────────────────────────────

/**
 * Return the player with the highest or lowest value for `statKey`.
 * For ties, returns the first tied player in array order.
 */
export function getExtremeStat(
  players: Player[],
  statKey: keyof Omit<PlayerStats, 'badges'>,
  extreme: 'highest' | 'lowest',
): Player {
  return players.reduce((champion, challenger) => {
    const champVal = champion.stats[statKey] as number;
    const chalVal = challenger.stats[statKey] as number;
    return extreme === 'highest'
      ? chalVal > champVal ? challenger : champion
      : chalVal < champVal ? challenger : champion;
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle — returns a new array. */
export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Pick `count` distinct players chosen uniformly at random.
 * If count >= players.length, returns all players in shuffled order.
 */
export function pickRandomPlayers(players: Player[], count: number): Player[] {
  return shuffle(players).slice(0, Math.min(count, players.length));
}

/** Lightweight random ID (no crypto dependency). */
export function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}
