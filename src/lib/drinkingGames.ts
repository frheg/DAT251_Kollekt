import hundredQuestionsGame from '../../backend/src/main/resources/drinking-games/100_SPØRSMÅL.json';
import truthOrChugGame from '../../backend/src/main/resources/drinking-games/CHUG_OR_TRUTH.json';
import neverHaveIEverGame from '../../backend/src/main/resources/drinking-games/JEG_HAR_ALDRI.json';

export type DrinkingGameId = 'hundred-questions' | 'truth-or-chug' | 'never-have-i-ever';
export type DrinkingGameMode = 'ordered-deck' | 'number-board';
export type DrinkingPromptKind = 'vote' | 'challenge' | 'toast' | 'never';
export type DrinkingGameLanguage = 'en' | 'no';

export interface DrinkingGamePrompt {
  id: number;
  text: string;
  kind: DrinkingPromptKind;
}

export interface DrinkingPromptTranslation {
  id: number;
  text: string;
}

export interface DrinkingGameTranslation {
  title?: string;
  shortTitle?: string;
  description?: string;
  rules?: string[];
  prompts?: DrinkingPromptTranslation[];
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
  translations?: Partial<Record<DrinkingGameLanguage, DrinkingGameTranslation>>;
}

export const drinkingGames = [
  hundredQuestionsGame,
  truthOrChugGame,
  neverHaveIEverGame,
] as unknown as DrinkingGameDefinition[];

function normalizeGameLanguage(language?: string): DrinkingGameLanguage {
  return language?.toLowerCase().startsWith('no') ? 'no' : 'en';
}

export function localizeDrinkingGame(
  game: DrinkingGameDefinition,
  language?: string,
): DrinkingGameDefinition {
  const normalizedLanguage = normalizeGameLanguage(language);
  const translation = game.translations?.[normalizedLanguage];

  if (!translation) return game;

  const translatedPrompts = new Map(
    translation.prompts?.map((prompt) => [prompt.id, prompt.text]) ?? [],
  );

  return {
    ...game,
    title: translation.title ?? game.title,
    shortTitle: translation.shortTitle ?? game.shortTitle,
    description: translation.description ?? game.description,
    rules: translation.rules ?? game.rules,
    prompts: game.prompts.map((prompt) => ({
      ...prompt,
      text: translatedPrompts.get(prompt.id) ?? prompt.text,
    })),
  };
}

export function getDrinkingGames(language?: string): DrinkingGameDefinition[] {
  return drinkingGames.map((game) => localizeDrinkingGame(game, language));
}

export function getDrinkingGame(
  gameId: DrinkingGameId,
  language?: string,
): DrinkingGameDefinition {
  const localizedGames = getDrinkingGames(language);
  return localizedGames.find((game) => game.id === gameId) ?? localizedGames[0];
}
