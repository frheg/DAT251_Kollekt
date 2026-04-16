import type { Player, PlayerStats } from './types';
import { DEFAULT_GUEST_STATS } from './types';
import type { LeaderboardPlayer, MemberStats } from '../types';
import { genId } from './weightedRng';

// ─── Constructors ─────────────────────────────────────────────────────────────

/**
 * Build a game Player from a leaderboard entry, optionally enriched with
 * detailed stats (lateCompletions, skippedTasks, achievementsUnlocked).
 *
 * The detailed stats come from /api/members/stats and are optional — the game
 * works fine with only leaderboard data, but richer stats unlock more
 * personalised events.
 */
export function fromLeaderboardPlayer(
  lb: LeaderboardPlayer,
  detail?: MemberStats,
): Player {
  return {
    id: genId(),
    name: lb.name,
    isGuest: false,
    active: true,
    stats: {
      level: lb.level,
      xp: lb.xp,
      rank: lb.rank,
      streak: lb.streak,
      tasksCompleted: lb.tasksCompleted,
      lateCompletions: detail?.lateCompletions ?? 0,
      skippedTasks: detail?.skippedTasks ?? 0,
      achievementsUnlocked: detail?.achievementsUnlocked ?? 0,
      badges: lb.badges,
    },
  };
}

/**
 * Create a guest player with an optional partial stat override.
 * Useful when someone at the table is not a collective member.
 */
export function createGuestPlayer(name: string, statsOverride?: Partial<PlayerStats>): Player {
  if (!name.trim()) throw new Error('Guest player name must not be empty');
  return {
    id: genId(),
    name: name.trim(),
    isGuest: true,
    active: true,
    stats: { ...DEFAULT_GUEST_STATS, ...statsOverride },
  };
}

// ─── Mutations (return new arrays — keep state immutable) ─────────────────────

/** Toggle the `active` flag for a single player by name. */
export function togglePlayerActive(players: Player[], name: string): Player[] {
  return players.map((p) => (p.name === name ? { ...p, active: !p.active } : p));
}

/** Add a new player to the list (prevents duplicate names). */
export function addPlayer(players: Player[], newPlayer: Player): Player[] {
  if (players.some((p) => p.name.toLowerCase() === newPlayer.name.toLowerCase())) {
    throw new Error(`A player named "${newPlayer.name}" is already in the session`);
  }
  return [...players, newPlayer];
}

/** Remove a player by name. */
export function removePlayer(players: Player[], name: string): Player[] {
  return players.filter((p) => p.name !== name);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** All players currently marked as active. */
export function getActivePlayers(players: Player[]): Player[] {
  return players.filter((p) => p.active);
}

/** Minimum active player count required to play. */
export const MIN_PLAYERS = 2;

export function canStartGame(players: Player[]): boolean {
  return getActivePlayers(players).length >= MIN_PLAYERS;
}
