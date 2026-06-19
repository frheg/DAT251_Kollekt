// Thin client for the external Kollekt Games REST API.
//
// All drinking-game *logic* (RNG, round/event generation, scoring) and *content*
// (question bank, presets) live in the standalone Kollekt Games service and are
// fetched over HTTP with an API key. This module only:
//   1. calls that service, and
//   2. keeps the contract TS types + trivial player-list state helpers that the
//      UI needs locally (these are React state plumbing, not game logic).
//
// Configure via env:
//   VITE_GAMES_API_URL  absolute HTTPS URL for native builds
//   VITE_GAMES_API_KEY  development-only until public-client auth is implemented

import { Capacitor } from '@capacitor/core';
import type { LeaderboardPlayer, MemberStats } from './types';

const configuredGamesApiBase = import.meta.env.VITE_GAMES_API_URL?.trim();

if (Capacitor.isNativePlatform() && !configuredGamesApiBase?.startsWith('https://')) {
  throw new Error('VITE_GAMES_API_URL must be an absolute HTTPS URL in the native app');
}

const GAMES_API_BASE = configuredGamesApiBase?.replace(/\/$/, '');
const GAMES_API_KEY = import.meta.env.VITE_GAMES_API_KEY?.trim();

// ─── Contract types (mirror of the Kollekt Games service) ──────────────────────

export type DrinkingGameId = 'hundred-questions' | 'truth-or-chug' | 'never-have-i-ever';
export type DrinkingGameMode = 'ordered-deck' | 'number-board';
export type DrinkingPromptKind = 'vote' | 'challenge' | 'toast' | 'never';

export interface DrinkingGamePrompt {
  id: number;
  text: string;
  kind: DrinkingPromptKind;
}

export interface DrinkingGameDefinition {
  id: DrinkingGameId;
  title: string;
  shortTitle: string;
  description: string;
  mode: DrinkingGameMode;
  allowRandomOrder?: boolean;
  sourceFile: string;
  rules: string[];
  prompts: DrinkingGamePrompt[];
}

export interface PlayerStats {
  level: number;
  xp: number;
  rank: number;
  streak: number;
  tasksCompleted: number;
  lateCompletions: number;
  skippedTasks: number;
  achievementsUnlocked: number;
  badges: string[];
}

export interface Player {
  id: string;
  name: string;
  isGuest: boolean;
  active: boolean;
  stats: PlayerStats;
}

export type RoundType =
  | 'STAT_COMPARISON'
  | 'CHALLENGE'
  | 'HOT_SEAT'
  | 'TRIVIA_TWIST'
  | 'RANDOM_EVENT';

export type GameLang = 'en' | 'no';

export interface GameEventText {
  title: string;
  description: string;
}

export interface GameEvent {
  id: string;
  roundType: RoundType;
  title: string;
  description: string;
  textByLanguage?: Record<GameLang, GameEventText>;
  targetPlayers: string[];
  drinks: number;
  distributeTarget?: string;
  distributeCount?: number;
  context?: Record<string, string | number>;
}

export interface Round {
  id: string;
  roundNumber: number;
  event: GameEvent;
  resolved: boolean;
  skipped: boolean;
}

export interface GameConfig {
  maxRounds: number;
  drinkMultiplier: number;
  statInfluence: number;
  roundTypeWeights: Record<RoundType, number>;
  allowSkip: boolean;
  skipDrinkPenalty: number;
}

export type GamePreset = 'default' | 'quick' | 'hardcore' | 'casual';

export interface GamePresetEntry {
  label: string;
  description: string;
  config: GameConfig;
}

export type PerformanceTier = 'elite' | 'solid' | 'average' | 'struggling' | 'rookie';

export interface SessionPlayerSummary {
  name: string;
  isGuest: boolean;
  performanceScore: number;
  sessionRank: number;
  tier: PerformanceTier;
}

export interface KollektMeta {
  presets: Record<GamePreset, GamePresetEntry>;
  minPlayers: number;
  defaultGuestStats: PlayerStats;
}

// ─── Local constants (mirror of the service; trivial config, not logic) ────────

export const MIN_PLAYERS = 2;

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

// ─── HTTP helpers ──────────────────────────────────────────────────────────────

async function gamesFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!GAMES_API_BASE) {
    throw new Error('VITE_GAMES_API_URL is not configured');
  }
  if (!GAMES_API_KEY) {
    throw new Error('VITE_GAMES_API_KEY is not configured');
  }

  const response = await fetch(`${GAMES_API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': GAMES_API_KEY,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Games API error ${response.status}`);
  }
  return response.json() as Promise<T>;
}

const langQuery = (language?: string) =>
  language ? `?lang=${encodeURIComponent(language)}` : '';

// ─── Content (prompt/deck games) ───────────────────────────────────────────────

export function getDrinkingGames(language?: string): Promise<DrinkingGameDefinition[]> {
  return gamesFetch<DrinkingGameDefinition[]>(`/games${langQuery(language)}`);
}

export function getDrinkingGame(
  gameId: DrinkingGameId,
  language?: string,
): Promise<DrinkingGameDefinition> {
  return gamesFetch<DrinkingGameDefinition>(`/games/${gameId}${langQuery(language)}`);
}

// ─── Dynamic Kollekt game ──────────────────────────────────────────────────────

export function getKollektMeta(): Promise<KollektMeta> {
  return gamesFetch<KollektMeta>('/kollekt/meta');
}

/**
 * Generate the next round. `usedIds` is round-tripped so the caller can keep
 * tracking which event templates have already been used across the session.
 */
export async function generateRound(params: {
  roundNumber: number;
  players: Player[];
  preset: GamePreset;
  usedIds: string[];
  lang: GameLang;
}): Promise<{ round: Round | null; usedIds: string[] }> {
  return gamesFetch<{ round: Round | null; usedIds: string[] }>('/kollekt/round', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function buildSessionSummaries(players: Player[]): Promise<SessionPlayerSummary[]> {
  const { summaries } = await gamesFetch<{ summaries: SessionPlayerSummary[] }>(
    '/kollekt/summary',
    { method: 'POST', body: JSON.stringify({ players }) },
  );
  return summaries;
}

// ─── Local player-list helpers (UI state plumbing) ─────────────────────────────

function genId(): string {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

export function fromLeaderboardPlayer(lb: LeaderboardPlayer, detail?: MemberStats): Player {
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

export function togglePlayerActive(players: Player[], name: string): Player[] {
  return players.map((p) => (p.name === name ? { ...p, active: !p.active } : p));
}

export function addPlayer(players: Player[], newPlayer: Player): Player[] {
  if (players.some((p) => p.name.toLowerCase() === newPlayer.name.toLowerCase())) {
    throw new Error(`A player named "${newPlayer.name}" is already in the session`);
  }
  return [...players, newPlayer];
}

export function removePlayer(players: Player[], name: string): Player[] {
  return players.filter((p) => p.name !== name);
}

export function getActivePlayers(players: Player[]): Player[] {
  return players.filter((p) => p.active);
}

export function canStartGame(players: Player[]): boolean {
  return getActivePlayers(players).length >= MIN_PLAYERS;
}
