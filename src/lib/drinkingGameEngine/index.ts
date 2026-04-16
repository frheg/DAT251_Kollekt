// Public API of the Kollekt drinking game engine.
// Import from here — never import from sub-modules directly in UI code.

export type {
  Player,
  PlayerStats,
  GameEvent,
  GameEventText,
  Round,
  RoundType,
  GameLang,
  GameSession,
  GameConfig,
  SessionStatus,
  SessionPlayerSummary,
} from './types';

export { DEFAULT_GUEST_STATS } from './types';

export {
  DEFAULT_GAME_CONFIG,
  QUICK_GAME_CONFIG,
  HARDCORE_GAME_CONFIG,
  CASUAL_GAME_CONFIG,
  GAME_PRESETS,
} from './gameConfig';
export type { GamePreset } from './gameConfig';

export {
  weightedRandom,
  pickRoundType,
  pickPlayerByStat,
  getExtremeStat,
  shuffle,
  pickRandomPlayers,
  genId,
} from './weightedRng';

export {
  fromLeaderboardPlayer,
  createGuestPlayer,
  togglePlayerActive,
  addPlayer,
  removePlayer,
  getActivePlayers,
  canStartGame,
  MIN_PLAYERS,
} from './playerManager';

export {
  computePerformanceScore,
  buildSessionSummaries,
  statLabel,
  performanceTier,
} from './statProcessor';
export type { PerformanceTier } from './statProcessor';

export { generateEvent } from './eventGenerator';

export {
  generateRound,
  generateAllRounds,
  resolveRound,
  skipRound,
} from './roundEngine';
