import hundredQuestionsGame from '../../backend/src/main/resources/drinking-games/100_SPØRSMÅL.json';
import truthOrChugGame from '../../backend/src/main/resources/drinking-games/CHUG_OR_TRUTH.json';
import neverHaveIEverGame from '../../backend/src/main/resources/drinking-games/JEG_HAR_ALDRI.json';

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

export const drinkingGames = [
  hundredQuestionsGame,
  truthOrChugGame,
  neverHaveIEverGame,
] as unknown as DrinkingGameDefinition[];

export function getDrinkingGame(gameId: DrinkingGameId): DrinkingGameDefinition {
  return drinkingGames.find((game) => game.id === gameId) ?? drinkingGames[0];
}
