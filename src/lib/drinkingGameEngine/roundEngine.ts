import type { Player, Round, RoundType, GameConfig, GameLang } from './types';
import { generateEvent } from './eventGenerator';
import { pickRoundType, genId } from './weightedRng';

// ─── Single round ─────────────────────────────────────────────────────────────

/**
 * Generate a single Round.
 *
 * @param roundNumber  1-based round index
 * @param players      Full player list (inactive players are filtered inside)
 * @param config       Game configuration
 * @param usedIds      Mutable set of already-used template IDs (mutated here)
 * @param lang         Locale for all generated text
 * @param forcedType   Override the RNG type selection (used to prevent streaks)
 */
export function generateRound(
  roundNumber: number,
  players: Player[],
  config: GameConfig,
  usedIds: Set<string>,
  lang: GameLang,
  forcedType?: RoundType,
): Round | null {
  const active = players.filter((p) => p.active);
  if (active.length < 2) return null;

  const roundType = forcedType ?? pickRoundType(config);
  const event = generateEvent(roundType, active, config, usedIds, lang);
  if (!event) return null;

  return {
    id: genId(),
    roundNumber,
    event,
    resolved: false,
    skipped: false,
  };
}

// ─── Full game generation ─────────────────────────────────────────────────────

/**
 * Pre-generate all rounds for a game session.
 *
 * Variety rules enforced:
 * - No more than 2 consecutive rounds of the same type.
 * - Every 5 rounds the engine injects a RANDOM_EVENT to maintain energy.
 *
 * @param lang  Locale for all generated text ('en' | 'no')
 */
export function generateAllRounds(
  players: Player[],
  config: GameConfig,
  lang: GameLang = 'en',
): Round[] {
  const usedIds = new Set<string>();
  const rounds: Round[] = [];

  const ALL_TYPES: RoundType[] = [
    'STAT_COMPARISON',
    'CHALLENGE',
    'HOT_SEAT',
    'TRIVIA_TWIST',
    'RANDOM_EVENT',
  ];

  let lastType: RoundType | null = null;
  let consecutiveCount = 0;

  for (let i = 0; i < config.maxRounds; i++) {
    let forcedType: RoundType | undefined;

    // Break a streak of the same type after 2 consecutive occurrences
    if (consecutiveCount >= 2 && lastType !== null) {
      const others = ALL_TYPES.filter((t) => t !== lastType);
      forcedType = others[Math.floor(Math.random() * others.length)];
    }

    // Every 5th round, inject a RANDOM_EVENT to maintain energy
    if (i > 0 && i % 5 === 0 && lastType !== 'RANDOM_EVENT') {
      forcedType = 'RANDOM_EVENT';
    }

    const round = generateRound(i + 1, players, config, usedIds, lang, forcedType);
    if (!round) break;

    const type = round.event.roundType;
    consecutiveCount = type === lastType ? consecutiveCount + 1 : 1;
    lastType = type;

    rounds.push(round);
  }

  return rounds;
}

// ─── Resolution helpers ───────────────────────────────────────────────────────

/** Mark a round as resolved (player completed the event). */
export function resolveRound(rounds: Round[], roundId: string): Round[] {
  return rounds.map((r) => (r.id === roundId ? { ...r, resolved: true } : r));
}

/** Mark a round as skipped (player paid the skip penalty). */
export function skipRound(rounds: Round[], roundId: string): Round[] {
  return rounds.map((r) => (r.id === roundId ? { ...r, skipped: true, resolved: true } : r));
}
