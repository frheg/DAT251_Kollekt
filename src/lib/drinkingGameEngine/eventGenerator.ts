import type { GameEvent, GameConfig, GameEventText, GameLang, Player, RoundType } from './types';
import {
  CHALLENGE_TEMPLATES,
  GUEST_CHALLENGE_TEMPLATES,
  GUEST_HOT_SEAT_TEMPLATES,
  HOT_SEAT_TEMPLATES,
  RANDOM_EVENT_TEMPLATES,
  STAT_COMP_TEMPLATES,
  TRIVIA_TWIST_TEMPLATES,
  type ChallengeTemplate,
  type HotSeatTemplate,
  type RandomEventTemplate,
  type TriviaTwistTemplate,
} from './eventTemplates';
import {
  getExtremeStat,
  pickRandomPlayers,
  shuffle,
  weightedRandom,
  genId,
} from './weightedRng';

function sips(base: number, config: GameConfig): number {
  return Math.max(1, Math.round(base * config.drinkMultiplier));
}

function getMembers(players: Player[]): Player[] {
  return players.filter((player) => !player.isGuest);
}

function getGuests(players: Player[]): Player[] {
  return players.filter((player) => player.isGuest);
}

function pickRandomPlayer(players: Player[]): Player {
  return pickRandomPlayers(players, 1)[0];
}

function makeEventText(
  title: Record<GameLang, string>,
  description: Record<GameLang, string>,
): Record<GameLang, GameEventText> {
  return {
    en: { title: title.en, description: description.en },
    no: { title: title.no, description: description.no },
  };
}

function buildEvent(
  roundType: RoundType,
  lang: GameLang,
  textByLanguage: Record<GameLang, GameEventText>,
  extra: Omit<GameEvent, 'id' | 'roundType' | 'title' | 'description' | 'textByLanguage'>,
): GameEvent {
  return {
    id: genId(),
    roundType,
    title: textByLanguage[lang].title,
    description: textByLanguage[lang].description,
    textByLanguage,
    ...extra,
  };
}

function buildHotSeatText(
  template: HotSeatTemplate,
  players: Player[],
): Record<GameLang, GameEventText> {
  const members = getMembers(players);

  switch (template.id) {
    case 'who-slacks': {
      if (members.length > 0) {
        const worst = members.reduce((a, b) => (a.stats.tasksCompleted <= b.stats.tasksCompleted ? a : b));
        return makeEventText(template.title, {
          en: `Group vote: who looks most likely to dodge their share? Most votes drinks 2 sips. Data hint: ${worst.name} currently has the fewest completed tasks.`,
          no: `Gruppestemme: hvem ser mest sannsynlig ut til å snike seg unna? Flest stemmer drikker 2 slurker. Datatips: ${worst.name} har akkurat nå færrest fullførte oppgaver.`,
        });
      }

      return makeEventText(template.title, {
        en: `Pure vibe vote: who would disappear fastest when chores show up? Most votes drinks 2 sips.`,
        no: `Ren magefølelse: hvem ville forsvunnet raskest når oppgavene dukker opp? Flest stemmer drikker 2 slurker.`,
      });
    }
    case 'who-overachiever': {
      if (members.length > 0) {
        const best = members.reduce((a, b) => (a.stats.tasksCompleted >= b.stats.tasksCompleted ? a : b));
        return makeEventText(template.title, {
          en: `Vote for tonight's overachiever. Winner hands out 3 sips. Data hint: ${best.name} leads with ${best.stats.tasksCompleted} completed tasks.`,
          no: `Stem på kveldens overpresterer. Vinneren deler ut 3 slurker. Datatips: ${best.name} leder med ${best.stats.tasksCompleted} fullførte oppgaver.`,
        });
      }

      return makeEventText(template.title, {
        en: `Vote for who looks most likely to reorganize the spice rack for fun. Winner hands out 3 sips.`,
        no: `Stem på hvem som ser mest sannsynlig ut til å omorganisere krydderhylla for moro skyld. Vinneren deler ut 3 slurker.`,
      });
    }
    case 'guest-outsider-award': {
      const guest = pickRandomPlayer(getGuests(players));
      return makeEventText(template.title, {
        en: `${guest.name}, point to the person giving the strongest "I definitely own matching storage boxes" energy. The room votes on whether you nailed it. Lose the vote and drink 2 sips.`,
        no: `${guest.name}, pek på personen som gir mest "jeg eier definitivt matchende oppbevaringsbokser"-energi. Rommet stemmer på om du traff. Taper du avstemningen, drikker du 2 slurker.`,
      });
    }
    case 'guest-house-keys': {
      const guest = pickRandomPlayer(getGuests(players));
      return makeEventText(template.title, {
        en: `${guest.name}, who here would you trust most with your house keys after one night? Point now. That person gets one sentence to justify the trust or drinks 2 sips.`,
        no: `${guest.name}, hvem her ville du stolt mest på med husnøklene dine etter én kveld? Pek nå. Den personen får én setning på å forsvare tilliten, eller må drikke 2 slurker.`,
      });
    }
    default:
      return makeEventText(template.title, {
        en: template.describe.en(players),
        no: template.describe.no(players),
      });
  }
}

function buildTriviaTwistText(
  template: TriviaTwistTemplate,
  players: Player[],
): Record<GameLang, GameEventText> {
  switch (template.id) {
    case 'streak-compare': {
      const [a, b] = shuffle(players).slice(0, 2);
      return makeEventText(template.title, {
        en: `True or false: ${a.name}'s streak (${a.stats.streak}) is higher than ${b.name}'s (${b.stats.streak}). Guess together. Wrong answer means 2 sips.`,
        no: `Sant eller usant: Streaken til ${a.name} (${a.stats.streak}) er høyere enn streaken til ${b.name} (${b.stats.streak}). Gjett samtidig. Feil svar betyr 2 slurker.`,
      });
    }
    case 'task-compare': {
      const [a, b] = shuffle(players).slice(0, 2);
      return makeEventText(template.title, {
        en: `True or false: ${a.name} has completed more tasks than ${b.name}. (${a.name}: ${a.stats.tasksCompleted}, ${b.name}: ${b.stats.tasksCompleted}) Miss it and drink 2 sips.`,
        no: `Sant eller usant: ${a.name} har fullført flere oppgaver enn ${b.name}. (${a.name}: ${a.stats.tasksCompleted}, ${b.name}: ${b.stats.tasksCompleted}) Tar du feil, drikker du 2 slurker.`,
      });
    }
    case 'level-guess': {
      const target = shuffle(players)[0];
      return makeEventText(template.title, {
        en: `Guess ${target.name}'s current level. First correct answer hands out 2 sips. Everyone else who missed it drinks 1. (Answer: Level ${target.stats.level})`,
        no: `Gjett hvilket nivå ${target.name} er på akkurat nå. Første riktige svar deler ut 2 slurker. Alle andre som bommer drikker 1. (Svar: Nivå ${target.stats.level})`,
      });
    }
    case 'xp-guess': {
      const target = shuffle(players)[0];
      const low = Math.floor(target.stats.xp * 0.7);
      const high = Math.ceil(target.stats.xp * 1.3);
      return makeEventText(template.title, {
        en: `Guess ${target.name}'s XP. It's somewhere between ${low} and ${high}. Closest guess hands out 2 sips. (Answer: ${target.stats.xp} XP)`,
        no: `Gjett hvor mye XP ${target.name} har. Det ligger et sted mellom ${low} og ${high}. Nærmeste gjetning deler ut 2 slurker. (Svar: ${target.stats.xp} XP)`,
      });
    }
    case 'badge-bluff': {
      const target = shuffle(players)[0];
      const hasBadge = target.stats.badges.length > 0;
      const badge = hasBadge ? target.stats.badges[0] : 'TOP';
      return makeEventText(template.title, {
        en: `True or false: ${target.name} currently has the "${badge}" badge. Wrong answer means 2 sips. (Answer: ${hasBadge ? 'True' : 'False'})`,
        no: `Sant eller usant: ${target.name} har merket "${badge}" akkurat nå. Feil svar betyr 2 slurker. (Svar: ${hasBadge ? 'Sant' : 'Usant'})`,
      });
    }
    case 'rank-order': {
      const sample = shuffle(players).slice(0, 3);
      const sorted = [...sample].sort((a, b) => a.stats.rank - b.stats.rank);
      return makeEventText(template.title, {
        en: `Put these three in leaderboard order from best to worst: ${sample.map((p) => p.name).join(', ')}. First wrong answer drinks 2 sips. (Answer: ${sorted.map((p) => p.name).join(' > ')})`,
        no: `Sett disse tre i topplistens rekkefølge fra best til svakest: ${sample.map((p) => p.name).join(', ')}. Første feil svar drikker 2 slurker. (Svar: ${sorted.map((p) => p.name).join(' > ')})`,
      });
    }
    case 'rank-battle': {
      const [a, b] = shuffle(players).slice(0, 2);
      const winner = a.stats.rank < b.stats.rank ? a : b;
      return makeEventText(template.title, {
        en: `Who has the better leaderboard rank: ${a.name} or ${b.name}? Say it together. Wrong answer means 2 sips. (Answer: ${winner.name})`,
        no: `Hvem har best plassering på topplisten: ${a.name} eller ${b.name}? Si det samtidig. Feil svar betyr 2 slurker. (Svar: ${winner.name})`,
      });
    }
    case 'achievement-count': {
      const candidates = players.filter((player) => player.stats.achievementsUnlocked > 0);
      const target = shuffle(candidates)[0];
      return makeEventText(template.title, {
        en: `Does ${target.name} have more than 1 unlocked achievement? True or false. Wrong answer means 2 sips. (Answer: ${target.stats.achievementsUnlocked > 1 ? 'True' : 'False'})`,
        no: `Har ${target.name} mer enn 1 opplåst prestasjon? Sant eller usant. Feil svar betyr 2 slurker. (Svar: ${target.stats.achievementsUnlocked > 1 ? 'Sant' : 'Usant'})`,
      });
    }
    case 'xp-lead': {
      const [a, b] = shuffle(players).slice(0, 2);
      const leader = a.stats.xp >= b.stats.xp ? a : b;
      const trailer = leader === a ? b : a;
      return makeEventText(template.title, {
        en: `Who currently has more XP: ${a.name} or ${b.name}? Wrong answer means 2 sips. (Answer: ${leader.name}, with ${leader.stats.xp} vs ${trailer.stats.xp})`,
        no: `Hvem har mest XP akkurat nå: ${a.name} eller ${b.name}? Feil svar betyr 2 slurker. (Svar: ${leader.name}, med ${leader.stats.xp} mot ${trailer.stats.xp})`,
      });
    }
    case 'top-spotlight': {
      const sample = shuffle(players).slice(0, 3);
      const best = [...sample].sort((a, b) => a.stats.rank - b.stats.rank)[0];
      return makeEventText(template.title, {
        en: `Among ${sample.map((p) => p.name).join(', ')}, who has the best leaderboard rank? Wrong guess means 2 sips. (Answer: ${best.name})`,
        no: `Blant ${sample.map((p) => p.name).join(', ')}, hvem har best plassering på topplisten? Feil svar betyr 2 slurker. (Svar: ${best.name})`,
      });
    }
    case 'late-battle': {
      const [a, b] = shuffle(players).slice(0, 2);
      return makeEventText(template.title, {
        en: `True or false: ${a.name} has more late completions than ${b.name}. (${a.name}: ${a.stats.lateCompletions}, ${b.name}: ${b.stats.lateCompletions}) Wrong answer means 2 sips.`,
        no: `Sant eller usant: ${a.name} har flere forsinkede fullføringer enn ${b.name}. (${a.name}: ${a.stats.lateCompletions}, ${b.name}: ${b.stats.lateCompletions}) Feil svar betyr 2 slurker.`,
      });
    }
    case 'skip-battle': {
      const [a, b] = shuffle(players).slice(0, 2);
      return makeEventText(template.title, {
        en: `True or false: ${a.name} has skipped more tasks than ${b.name}. (${a.name}: ${a.stats.skippedTasks}, ${b.name}: ${b.stats.skippedTasks}) Wrong answer means 2 sips.`,
        no: `Sant eller usant: ${a.name} har hoppet over flere oppgaver enn ${b.name}. (${a.name}: ${a.stats.skippedTasks}, ${b.name}: ${b.stats.skippedTasks}) Feil svar betyr 2 slurker.`,
      });
    }
    case 'badge-count-battle': {
      const [a, b] = shuffle(players).slice(0, 2);
      return makeEventText(template.title, {
        en: `True or false: ${a.name} has at least as many badges as ${b.name}. (${a.name}: ${a.stats.badges.length}, ${b.name}: ${b.stats.badges.length}) Wrong answer means 2 sips.`,
        no: `Sant eller usant: ${a.name} har minst like mange merker som ${b.name}. (${a.name}: ${a.stats.badges.length}, ${b.name}: ${b.stats.badges.length}) Feil svar betyr 2 slurker.`,
      });
    }
    case 'achievement-battle': {
      const [a, b] = shuffle(players).slice(0, 2);
      return makeEventText(template.title, {
        en: `True or false: ${a.name} has at least as many unlocked achievements as ${b.name}. (${a.name}: ${a.stats.achievementsUnlocked}, ${b.name}: ${b.stats.achievementsUnlocked}) Wrong answer means 2 sips.`,
        no: `Sant eller usant: ${a.name} har minst like mange opplåste prestasjoner som ${b.name}. (${a.name}: ${a.stats.achievementsUnlocked}, ${b.name}: ${b.stats.achievementsUnlocked}) Feil svar betyr 2 slurker.`,
      });
    }
    case 'level-top-three': {
      const sample = shuffle(players).slice(0, 3);
      const topLevel = Math.max(...sample.map((player) => player.stats.level));
      const leaders = sample.filter((player) => player.stats.level === topLevel);
      const answerEn = leaders.map((player) => player.name).join(' and ');
      const answerNo = leaders.map((player) => player.name).join(' og ');
      return makeEventText(template.title, {
        en: `Among ${sample.map((p) => p.name).join(', ')}, who is at the highest level right now? Wrong guess means 2 sips. (Answer: ${answerEn}, level ${topLevel})`,
        no: `Blant ${sample.map((p) => p.name).join(', ')}, hvem er på høyest nivå akkurat nå? Feil gjetning betyr 2 slurker. (Svar: ${answerNo}, nivå ${topLevel})`,
      });
    }
    default:
      return makeEventText(template.title, {
        en: template.describe.en(players),
        no: template.describe.no(players),
      });
  }
}

function buildRandomEventText(
  template: RandomEventTemplate,
  players: Player[],
): Record<GameLang, GameEventText> {
  switch (template.id) {
    case 'rule-maker': {
      const chosen = pickRandomPlayers(players, 1)[0];
      return makeEventText(template.title, {
        en: `${chosen.name} makes one rule that lasts until the next round. Break it and drink 2 sips. Keep it simple, memorable, and slightly annoying.`,
        no: `${chosen.name} lager én regel som varer til neste runde. Bryter du den, drikker du 2 slurker. Hold den enkel, tydelig og litt irriterende.`,
      });
    }
    case 'thumb-master': {
      const chosen = pickRandomPlayers(players, 1)[0];
      return makeEventText(template.title, {
        en: `${chosen.name} is Thumb Master for this round. Drop your thumb on the table whenever you want. Last person to notice drinks 1 sip.`,
        no: `${chosen.name} er tommelmester denne runden. Legg tommelen på bordet når du vil. Siste person som merker det drikker 1 slurk.`,
      });
    }
    case 'stare-down': {
      const pair = pickRandomPlayers(players, 2);
      const en =
        pair.length < 2
          ? `${pair[0].name} stares everyone down one by one. First person to crack or look away drinks 2 sips.`
          : `${pair[0].name} and ${pair[1].name}, stare each other down. First to blink or look away drinks 2 sips.`;
      const no =
        pair.length < 2
          ? `${pair[0].name} stirrer ned alle én etter én. Første person som sprekker eller ser bort drikker 2 slurker.`
          : `${pair[0].name} og ${pair[1].name}, stirr hverandre ned. Første som blunker eller ser bort drikker 2 slurker.`;
      return makeEventText(template.title, { en, no });
    }
    case 'categories': {
      const categories = [
        { en: 'cleaning products', no: 'rengjøringsprodukter' },
        { en: 'IKEA items', no: 'IKEA-ting' },
        { en: 'things under the sink', no: 'ting under vasken' },
        { en: 'pizza toppings', no: 'pizza-toppinger' },
        { en: 'excuses to avoid chores', no: 'unnskyldninger for å slippe oppgaver' },
        { en: 'things people forget to buy', no: 'ting folk glemmer å kjøpe' },
        { en: 'bad excuses for not vacuuming', no: 'dårlige unnskyldninger for å ikke støvsuge' },
        { en: 'things that always go missing', no: 'ting som alltid blir borte' },
        { en: 'late-night snacks', no: 'nattmat' },
        { en: 'party songs everyone knows', no: 'festlåter alle kan' },
        { en: 'things guests notice first', no: 'ting gjester legger merke til først' },
        { en: 'reasons to do just one more round', no: 'grunner til å ta én runde til' },
      ];
      const category = categories[Math.floor(Math.random() * categories.length)];
      return makeEventText(template.title, {
        en: `Category: "${category.en}". Go around the table and name one each. First person to freeze or repeat drinks 1 sip.`,
        no: `Kategori: "${category.no}". Gå rundt bordet og nevn én ting hver. Første person som stopper opp eller gjentar seg drikker 1 slurk.`,
      });
    }
    case 'most-likely': {
      const prompts = [
        { en: 'forget it was their turn to clean', no: 'glemme at det var deres tur til å vaske' },
        { en: 'order takeaway instead of cooking', no: 'bestille takeaway i stedet for å lage mat' },
        { en: 'leave dishes in the sink overnight', no: 'la oppvasken stå over natten' },
        { en: 'stay up past 2am on a weeknight', no: 'være våken etter klokken 02 på en hverdag' },
        { en: 'make an elaborate excuse for not doing laundry', no: 'lage en avansert unnskyldning for å slippe klesvask' },
        { en: 'say "I was about to do it" and hope that counts', no: 'si "jeg skulle akkurat til å gjøre det" og håpe at det teller' },
        { en: 'start cleaning only when guests are coming over', no: 'begynne å rydde først når gjester er på vei' },
        { en: 'turn a quick errand into a full side quest', no: 'gjøre et raskt ærend om til et helt sideoppdrag' },
        { en: 'claim they are resting their eyes and then nap for two hours', no: 'påstå at de bare hviler øynene og så sovne i to timer' },
        { en: 'eat someone else\'s snacks and replace them a week later', no: 'spise noen andres snacks og erstatte dem en uke senere' },
        { en: 'open the group chat, type a reply, and never send it', no: 'åpne gruppechatten, skrive et svar og aldri sende det' },
        { en: 'become weirdly competitive about a simple drinking game', no: 'bli merkelig konkurranseinstilt i et enkelt drikkespill' },
      ];
      const prompt = prompts[Math.floor(Math.random() * prompts.length)];
      return makeEventText(template.title, {
        en: `Most likely to "${prompt.en}"? Point on three. The person with the most fingers on them drinks 1 sip per finger.`,
        no: `Mest sannsynlig til å "${prompt.no}"? Pek på tre. Personen med flest fingre på seg drikker 1 slurk per finger.`,
      });
    }
    default:
      return makeEventText(template.title, {
        en: template.describe.en(players),
        no: template.describe.no(players),
      });
  }
}

export function generateEvent(
  roundType: RoundType,
  players: Player[],
  config: GameConfig,
  usedTemplateIds: Set<string>,
  lang: GameLang = 'en',
): GameEvent | null {
  if (players.length < 2) return null;

  const members = getMembers(players);
  const guests = getGuests(players);

  switch (roundType) {
    case 'STAT_COMPARISON': {
      if (members.length < 2) {
        return generateEvent('HOT_SEAT', players, config, usedTemplateIds, lang);
      }

      const pool = STAT_COMP_TEMPLATES.filter((t) => !usedTemplateIds.has(t.id));
      const templates = pool.length > 0 ? pool : STAT_COMP_TEMPLATES;
      const template = weightedRandom(templates, templates.map(() => 1));

      const target = getExtremeStat(
        members,
        template.statKey,
        template.extreme === 'highest' ? 'highest' : 'lowest',
      );
      const value = target.stats[template.statKey] as number;
      const drinkCount = sips(template.baseDrinks, config);
      const textByLanguage = makeEventText(template.title, {
        en: template.describe.en(target, value, drinkCount),
        no: template.describe.no(target, value, drinkCount),
      });

      usedTemplateIds.add(template.id);

      return buildEvent(roundType, lang, textByLanguage, {
        targetPlayers: [target.name],
        drinks: template.distribute ? 0 : drinkCount,
        distributeTarget: template.distribute ? target.name : undefined,
        distributeCount: template.distribute ? drinkCount : undefined,
        context: { statKey: template.statKey, value },
      });
    }

    case 'CHALLENGE': {
      const templates = [...CHALLENGE_TEMPLATES, ...GUEST_CHALLENGE_TEMPLATES];
      const options: Array<{ template: ChallengeTemplate; player: Player }> = [];

      for (const player of players) {
        for (const template of templates) {
          const key = `${template.id}::${player.name}`;
          if (!usedTemplateIds.has(key) && template.applicable(player)) {
            options.push({ template, player });
          }
        }
      }

      const pool = options.length > 0
        ? options
        : players.flatMap((player) =>
            templates
              .filter((template) => template.applicable(player))
              .map((template) => ({ template, player })),
          );

      if (pool.length === 0) {
        const fallbackPool = guests.length > 0 ? players : members.length > 0 ? members : players;
        const fallback = pickRandomPlayer(fallbackPool);
        const drinkCount = sips(3, config);
        const fallbackTitle: Record<GameLang, string> = {
          en: 'Open Challenge',
          no: 'Åpen utfordring',
        };
        const fallbackDescription: Record<GameLang, string> = {
          en: `${fallback.name}, the group gives you a spontaneous challenge. You have 10 seconds to accept it or drink ${drinkCount} sips.`,
          no: `${fallback.name}, gruppen gir deg en spontan utfordring. Du har 10 sekunder på å akseptere den eller drikke ${drinkCount} slurker.`,
        };

        return buildEvent(roundType, lang, makeEventText(fallbackTitle, fallbackDescription), {
          targetPlayers: [fallback.name],
          drinks: drinkCount,
        });
      }

      const perfScores = players.reduce<Record<string, number>>((acc, player) => {
        acc[player.name] = player.stats.tasksCompleted * 0.5 + player.stats.streak * 0.3 + player.stats.level * 0.2;
        return acc;
      }, {});
      const maxPerf = Math.max(...Object.values(perfScores), 1);
      const weights = pool.map(({ player }) => {
        const norm = perfScores[player.name] / maxPerf;
        return (1 - config.statInfluence) + config.statInfluence * (1 - norm + 0.1);
      });

      const { template, player } = weightedRandom(pool, weights);
      usedTemplateIds.add(`${template.id}::${player.name}`);

      return buildEvent(
        roundType,
        lang,
        makeEventText(template.title, {
          en: template.describe.en(player),
          no: template.describe.no(player),
        }),
        {
          targetPlayers: [player.name],
          drinks: sips(template.baseDrinks, config),
        },
      );
    }

    case 'HOT_SEAT': {
      const allTemplates = guests.length > 0
        ? [...HOT_SEAT_TEMPLATES, ...GUEST_HOT_SEAT_TEMPLATES]
        : HOT_SEAT_TEMPLATES;
      const pool = allTemplates.filter((template) => !usedTemplateIds.has(template.id));
      const templates = pool.length > 0 ? pool : allTemplates;
      const template = templates[Math.floor(Math.random() * templates.length)];
      const textByLanguage = buildHotSeatText(template, players);

      usedTemplateIds.add(template.id);

      return buildEvent(roundType, lang, textByLanguage, {
        targetPlayers: [],
        drinks: sips(template.baseDrinks, config),
      });
    }

    case 'TRIVIA_TWIST': {
      if (members.length < 2) {
        return generateEvent('HOT_SEAT', players, config, usedTemplateIds, lang);
      }

      const pool = TRIVIA_TWIST_TEMPLATES.filter(
        (template) => !usedTemplateIds.has(template.id) && template.applicable(members),
      );
      const templates = pool.length > 0
        ? pool
        : TRIVIA_TWIST_TEMPLATES.filter((template) => template.applicable(members));

      if (templates.length === 0) {
        return generateEvent('HOT_SEAT', players, config, usedTemplateIds, lang);
      }

      const template = templates[Math.floor(Math.random() * templates.length)];
      const textByLanguage = buildTriviaTwistText(template, members);
      usedTemplateIds.add(template.id);

      return buildEvent(roundType, lang, textByLanguage, {
        targetPlayers: [],
        drinks: sips(template.baseDrinks, config),
      });
    }

    case 'RANDOM_EVENT': {
      const pool = RANDOM_EVENT_TEMPLATES.filter((template) => !usedTemplateIds.has(template.id));
      const templates = pool.length > 0 ? pool : RANDOM_EVENT_TEMPLATES;
      const template = templates[Math.floor(Math.random() * templates.length)];
      const textByLanguage = buildRandomEventText(template, players);

      usedTemplateIds.add(template.id);

      return buildEvent(roundType, lang, textByLanguage, {
        targetPlayers: [],
        drinks: template.distribute ? 0 : sips(template.baseDrinks, config),
      });
    }
  }
}
