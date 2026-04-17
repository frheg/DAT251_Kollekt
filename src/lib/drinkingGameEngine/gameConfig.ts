import type { GameConfig } from './types';

// ─── Presets ──────────────────────────────────────────────────────────────────

export const DEFAULT_GAME_CONFIG: GameConfig = {
  maxRounds: 15,
  drinkMultiplier: 1.0,
  statInfluence: 0.65,
  roundTypeWeights: {
    STAT_COMPARISON: 30,
    CHALLENGE: 25,
    HOT_SEAT: 20,
    TRIVIA_TWIST: 15,
    RANDOM_EVENT: 10,
  },
  allowSkip: true,
  skipDrinkPenalty: 2,
};

export const QUICK_GAME_CONFIG: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  maxRounds: 8,
};

export const HARDCORE_GAME_CONFIG: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  maxRounds: 20,
  drinkMultiplier: 2.0,
  allowSkip: false,
  skipDrinkPenalty: 4,
  roundTypeWeights: {
    STAT_COMPARISON: 35,
    CHALLENGE: 30,
    HOT_SEAT: 15,
    TRIVIA_TWIST: 10,
    RANDOM_EVENT: 10,
  },
};

export const CASUAL_GAME_CONFIG: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  maxRounds: 12,
  drinkMultiplier: 0.5,
  statInfluence: 0.4,
  roundTypeWeights: {
    STAT_COMPARISON: 15,
    CHALLENGE: 20,
    HOT_SEAT: 30,
    TRIVIA_TWIST: 20,
    RANDOM_EVENT: 15,
  },
};

export type GamePreset = 'default' | 'quick' | 'hardcore' | 'casual';

export const GAME_PRESETS: Record<GamePreset, { label: string; description: string; config: GameConfig }> = {
  default: {
    label: 'Standard',
    description: '15 rounds, balanced mix of chaos and stats.',
    config: DEFAULT_GAME_CONFIG,
  },
  quick: {
    label: 'Quick',
    description: '8 rounds — get in, get merry, get out.',
    config: QUICK_GAME_CONFIG,
  },
  hardcore: {
    label: 'Hardcore',
    description: '20 rounds, double drinks, no mercy.',
    config: HARDCORE_GAME_CONFIG,
  },
  casual: {
    label: 'Casual',
    description: '12 rounds, light sips, stats barely matter.',
    config: CASUAL_GAME_CONFIG,
  },
};
