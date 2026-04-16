import type { GameEvent, GameConfig, GameEventText, GameLang, Player, RoundType } from './types';
import {
  getExtremeStat,
  pickPlayerByStat,
  pickRandomPlayers,
  shuffle,
  weightedRandom,
  genId,
} from './weightedRng';

// ─── Drink helper ─────────────────────────────────────────────────────────────

function sips(base: number, config: GameConfig): number {
  return Math.max(1, Math.round(base * config.drinkMultiplier));
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

// ─── STAT_COMPARISON templates ────────────────────────────────────────────────

interface StatCompTemplate {
  id: string;
  title: Record<GameLang, string>;
  statKey: keyof Pick<
    Player['stats'],
    'streak' | 'tasksCompleted' | 'lateCompletions' | 'skippedTasks' | 'xp' | 'level'
  >;
  extreme: 'highest' | 'lowest';
  baseDrinks: number;
  distribute: boolean;
  describe: Record<GameLang, (target: Player, value: number, drinkCount: number) => string>;
}

const STAT_COMP_TEMPLATES: StatCompTemplate[] = [
  {
    id: 'streak-low',
    title: { en: 'Streak Shame', no: 'Streak-skam' },
    statKey: 'streak',
    extreme: 'lowest',
    baseDrinks: 2,
    distribute: false,
    describe: {
      en: (t, v, d) =>
        `${t.name} has the weakest streak — only ${v} day(s). Take ${d} sips and consider doing a chore tonight.`,
      no: (t, v, d) =>
        `${t.name} har den svakeste streaken — bare ${v} dag(er). Ta ${d} slurker og vurder å gjøre en oppgave i kveld.`,
    },
  },
  {
    id: 'streak-high',
    title: { en: 'Streak King', no: 'Streak-kongen' },
    statKey: 'streak',
    extreme: 'highest',
    baseDrinks: 3,
    distribute: true,
    describe: {
      en: (t, v, d) =>
        `${t.name} is riding a ${v}-day streak. The household hero distributes ${d} sips — spread the love (or the pain).`,
      no: (t, v, d) =>
        `${t.name} er på en ${v}-dagers streak. Helten i kollektivet deler ut ${d} slurker — spre kjærligheten (eller smerten).`,
    },
  },
  {
    id: 'tasks-low',
    title: { en: 'Slacker Tax', no: 'Dovenkapsskatt' },
    statKey: 'tasksCompleted',
    extreme: 'lowest',
    baseDrinks: 2,
    distribute: false,
    describe: {
      en: (t, v, d) =>
        `${t.name} has completed the fewest tasks — just ${v}. Drink ${d} sips as a contribution to the household.`,
      no: (t, v, d) =>
        `${t.name} har fullført færrest oppgaver — bare ${v}. Drikk ${d} slurker som et bidrag til husholdningen.`,
    },
  },
  {
    id: 'tasks-high',
    title: { en: 'Top Worker', no: 'Pliktoppfylleren' },
    statKey: 'tasksCompleted',
    extreme: 'highest',
    baseDrinks: 3,
    distribute: true,
    describe: {
      en: (t, v, d) =>
        `${t.name} leads the pack with ${v} tasks completed. Distribute ${d} sips however you see fit — you've earned the power.`,
      no: (t, v, d) =>
        `${t.name} leder an med ${v} oppgaver fullført. Del ut ${d} slurker slik du vil — du har fortjent makten.`,
    },
  },
  {
    id: 'late-high',
    title: { en: 'Fashionably Late', no: 'Kronisk For Sen' },
    statKey: 'lateCompletions',
    extreme: 'highest',
    baseDrinks: 3,
    distribute: false,
    describe: {
      en: (t, v, d) =>
        `${t.name} has submitted ${v} task(s) past the deadline. Drink ${d} sips for every "I'll do it later" that became "I did it way later."`,
      no: (t, v, d) =>
        `${t.name} har levert ${v} oppgave(r) etter fristen. Drikk ${d} slurker for hvert «jeg gjør det siden» som ble «jeg gjorde det mye siden».`,
    },
  },
  {
    id: 'skip-high',
    title: { en: 'Skip Champion', no: 'Hoppemester' },
    statKey: 'skippedTasks',
    extreme: 'highest',
    baseDrinks: 3,
    distribute: false,
    describe: {
      en: (t, v, d) =>
        `${t.name} has skipped ${v} task(s) entirely. That's ${v} sips saved on chores and spent here instead. Drink ${d}.`,
      no: (t, v, d) =>
        `${t.name} har hoppet over ${v} oppgave(r) totalt. Det er ${v} slurker spart på husarbeid og brukt her i stedet. Drikk ${d}.`,
    },
  },
  {
    id: 'xp-low',
    title: { en: 'XP Drought', no: 'XP-tørke' },
    statKey: 'xp',
    extreme: 'lowest',
    baseDrinks: 2,
    distribute: false,
    describe: {
      en: (t, v, d) =>
        `${t.name} is sitting on only ${v} XP — the lowest at the table. Drink ${d} sips and reflect on your choices.`,
      no: (t, v, d) =>
        `${t.name} sitter på bare ${v} XP — det laveste ved bordet. Drikk ${d} slurker og reflekter over valgene dine.`,
    },
  },
  {
    id: 'xp-high',
    title: { en: 'XP Flex', no: 'XP-viser' },
    statKey: 'xp',
    extreme: 'highest',
    baseDrinks: 2,
    distribute: true,
    describe: {
      en: (t, v, d) =>
        `${t.name} has the most XP (${v}). With great power comes great distribution rights — assign ${d} sips.`,
      no: (t, v, d) =>
        `${t.name} har mest XP (${v}). Med stor makt følger stor utdelingsrett — del ut ${d} slurker.`,
    },
  },
  {
    id: 'level-low',
    title: { en: 'Rookie Status', no: 'Nybegynnerstatus' },
    statKey: 'level',
    extreme: 'lowest',
    baseDrinks: 1,
    distribute: false,
    describe: {
      en: (t, v, d) =>
        `${t.name} is only level ${v}. Welcome to the rookies' table — drink ${d} sip(s) and level up your life.`,
      no: (t, v, d) =>
        `${t.name} er bare nivå ${v}. Velkommen til nybegynnerbordet — drikk ${d} slurk(er) og bli bedre i livet.`,
    },
  },
];

// ─── CHALLENGE templates ──────────────────────────────────────────────────────

interface ChallengeTemplate {
  id: string;
  title: Record<GameLang, string>;
  baseDrinks: number;
  applicable(player: Player): boolean;
  describe: Record<GameLang, (player: Player) => string>;
}

const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    id: 'streak-name',
    title: { en: 'Streak Checkpoint', no: 'Streak-sjekkpunkt' },
    baseDrinks: 2,
    applicable: (p) => p.stats.streak > 0,
    describe: {
      en: (p) =>
        `${p.name}, your streak is at ${p.stats.streak} day(s). Name the last chore you actually completed — without checking your phone. Fail or fib = 2 sips.`,
      no: (p) =>
        `${p.name}, streaken din er på ${p.stats.streak} dag(er). Navngi den siste oppgaven du faktisk fullførte — uten å sjekke telefonen. Fail eller lyv = 2 slurker.`,
    },
  },
  {
    id: 'late-excuse',
    title: { en: 'Excuse Time', no: 'Unnskyldningstid' },
    baseDrinks: 3,
    applicable: (p) => p.stats.lateCompletions > 0,
    describe: {
      en: (p) =>
        `${p.name}, you've been late ${p.stats.lateCompletions} time(s). Present your best excuse to the jury. Majority rules: not convincing = 3 sips.`,
      no: (p) =>
        `${p.name}, du har vært for sen ${p.stats.lateCompletions} gang(er). Gi din beste unnskyldning til juryen. Flertallet bestemmer: ikke overbevisende = 3 slurker.`,
    },
  },
  {
    id: 'task-category',
    title: { en: 'Category Check', no: 'Kategorikontroll' },
    baseDrinks: 2,
    applicable: (p) => p.stats.tasksCompleted >= 3,
    describe: {
      en: (p) =>
        `${p.name} has completed ${p.stats.tasksCompleted} tasks. Name two different chore categories you've done recently. Anyone can challenge you — majority decides. Fail = 2 sips.`,
      no: (p) =>
        `${p.name} har fullført ${p.stats.tasksCompleted} oppgaver. Nevn to forskjellige oppgavekategorier du har gjort nylig. Andre kan utfordre deg — flertallet bestemmer. Fail = 2 slurker.`,
    },
  },
  {
    id: 'skip-defend',
    title: { en: 'Skipped Tasks Trial', no: 'Hoppede-over-oppgaver-rettssak' },
    baseDrinks: 4,
    applicable: (p) => p.stats.skippedTasks > 0,
    describe: {
      en: (p) =>
        `${p.name} skipped ${p.stats.skippedTasks} task(s). You have 15 seconds to defend yourself. Guilty verdict from the group = 4 sips. The floor is yours.`,
      no: (p) =>
        `${p.name} hoppet over ${p.stats.skippedTasks} oppgave(r). Du har 15 sekunder til å forsvare deg. Skyldig kjennelse fra gruppen = 4 slurker. Ordet er ditt.`,
    },
  },
  {
    id: 'achievement-recall',
    title: { en: 'Achievement Hunter', no: 'Prestasjonssamleren' },
    baseDrinks: 2,
    applicable: (p) => p.stats.achievementsUnlocked >= 1,
    describe: {
      en: (p) =>
        `${p.name} has unlocked ${p.stats.achievementsUnlocked} achievement(s). Name one without looking — or drink 2 sips.`,
      no: (p) =>
        `${p.name} har låst opp ${p.stats.achievementsUnlocked} prestasjon(er). Navngi én uten å se — eller drikk 2 slurker.`,
    },
  },
  {
    id: 'level-flex',
    title: { en: 'Level Flex', no: 'Nivå-vis' },
    baseDrinks: 2,
    applicable: (p) => p.stats.level >= 2,
    describe: {
      en: (p) =>
        `${p.name} is level ${p.stats.level}. Tell the group one thing you're genuinely proud of doing around the house. The group claps or ${p.name} drinks 2 sips.`,
      no: (p) =>
        `${p.name} er nivå ${p.stats.level}. Fortell gruppen én ting du er genuint stolt av å ha gjort hjemme. Gruppen klapper — ellers drikker ${p.name} 2 slurker.`,
    },
  },
  {
    id: 'rookie-ordeal',
    title: { en: 'Rookie Ordeal', no: 'Nybegynnerprøven' },
    baseDrinks: 1,
    applicable: (p) => p.stats.level === 1 && p.stats.tasksCompleted <= 2,
    describe: {
      en: (p) =>
        `${p.name} is a Level 1 newcomer with ${p.stats.tasksCompleted} task(s). Each player assigns them one future chore. Refuse any? 1 sip per rejection.`,
      no: (p) =>
        `${p.name} er en Nivå 1 nybegynner med ${p.stats.tasksCompleted} oppgave(r). Hver spiller gir dem én fremtidig oppgave. Avvis noen? 1 slurk per avvisning.`,
    },
  },
  {
    id: 'top-performer-challenge',
    title: { en: 'Top Dog Tax', no: 'Topphunds-avgift' },
    baseDrinks: 0,
    applicable: (p) => p.stats.badges.includes('TOP'),
    describe: {
      en: (p) =>
        `${p.name} wears the TOP badge. With great rank comes great responsibility — name someone and assign them 3 sips. But if the group thinks you're being unfair, you drink 3 instead.`,
      no: (p) =>
        `${p.name} bærer TOP-merket. Med stor rangering følger stort ansvar — velg noen og gi dem 3 slurker. Men hvis gruppen synes du er urettferdig, drikker du 3 i stedet.`,
    },
  },
  {
    id: 'no-streak',
    title: { en: 'Streakless Wonder', no: 'Streakløst Under' },
    baseDrinks: 2,
    applicable: (p) => p.stats.streak === 0,
    describe: {
      en: (p) =>
        `${p.name}, your current streak is zero. Stand up, say "I will do better", sit down. Skip the speech = 2 sips.`,
      no: (p) =>
        `${p.name}, den nåværende streaken din er null. Stå opp, si «Jeg skal gjøre det bedre», sett deg ned. Hopper du over talen = 2 slurker.`,
    },
  },
];

// ─── HOT_SEAT templates ───────────────────────────────────────────────────────

interface HotSeatTemplate {
  id: string;
  title: Record<GameLang, string>;
  baseDrinks: number;
  describe: Record<GameLang, (players: Player[]) => string>;
}

const HOT_SEAT_TEMPLATES: HotSeatTemplate[] = [
  {
    id: 'who-slacks',
    title: { en: 'Slacker Vote', no: 'Latastemme' },
    baseDrinks: 2,
    describe: {
      en: (ps) => {
        const worst = ps.reduce((a, b) => a.stats.tasksCompleted <= b.stats.tasksCompleted ? a : b);
        return `Group vote: who slacks the most? Most votes = 2 sips. Spoiler: ${worst.name} has the data working against them…`;
      },
      no: (ps) => {
        const worst = ps.reduce((a, b) => a.stats.tasksCompleted <= b.stats.tasksCompleted ? a : b);
        return `Gruppestemme: hvem er mest lat? Flest stemmer = 2 slurker. Tips: ${worst.name} har dataene imot seg…`;
      },
    },
  },
  {
    id: 'who-overachiever',
    title: { en: 'Overachiever Award', no: 'Overachiever-prisen' },
    baseDrinks: 3,
    describe: {
      en: (ps) => {
        const best = ps.reduce((a, b) => a.stats.tasksCompleted >= b.stats.tasksCompleted ? a : b);
        return `Vote for the biggest overachiever. Winner distributes 3 sips. (${best.name} is the likely suspect with ${best.stats.tasksCompleted} tasks.)`;
      },
      no: (ps) => {
        const best = ps.reduce((a, b) => a.stats.tasksCompleted >= b.stats.tasksCompleted ? a : b);
        return `Stem på den største overachiever. Vinneren deler ut 3 slurker. (${best.name} er den sannsynlige kandidaten med ${best.stats.tasksCompleted} oppgaver.)`;
      },
    },
  },
  {
    id: 'most-excuses',
    title: { en: 'Excuse Champion', no: 'Unnskyldningsmester' },
    baseDrinks: 3,
    describe: {
      en: () => `Who gives the most excuses for skipping or being late? Vote now. Most votes = 3 sips. Then they must give their excuse live.`,
      no: () => `Hvem gir flest unnskyldninger for å hoppe over eller være sen? Stem nå. Flest stemmer = 3 slurker. Deretter må de gi unnskyldningen sin live.`,
    },
  },
  {
    id: 'secret-hater',
    title: { en: 'Secret Chore Hater', no: 'Den Hemmelige Oppgavehateren' },
    baseDrinks: 2,
    describe: {
      en: () => `Who secretly despises a specific chore but never admits it? Vote! Most votes drinks 2 sips, then must confess which chore it is.`,
      no: () => `Hvem hater hemmelig en bestemt oppgave men innrømmer det aldri? Stem! Flest stemmer drikker 2 slurker, deretter må de bekjenne hvilken oppgave det er.`,
    },
  },
  {
    id: 'best-nagger',
    title: { en: 'Nag Champion', no: 'Masekong' },
    baseDrinks: 2,
    describe: {
      en: () => `Who nags others the most about doing their chores? Vote! Most votes distributes 2 sips — a true badge of honour.`,
      no: () => `Hvem maser mest på andre om å gjøre oppgavene sine? Stem! Flest stemmer deler ut 2 slurker — et ekte æresmerke.`,
    },
  },
  {
    id: 'most-improved',
    title: { en: 'Glow-Up Award', no: 'Forbedringsprisen' },
    baseDrinks: 3,
    describe: {
      en: () => `Who has improved the most lately in terms of household contributions? Vote! Most votes distributes 3 sips. Growth deserves power.`,
      no: () => `Hvem har forbedret seg mest den siste tiden i husarbeidsbidrag? Stem! Flest stemmer deler ut 3 slurker. Vekst fortjener makt.`,
    },
  },
  {
    id: 'least-hygienic',
    title: { en: 'Hygiene Audit', no: 'Hygieneinspeksjon' },
    baseDrinks: 2,
    describe: {
      en: () => `Who is least likely to clean the bathroom without being asked? Vote! Most votes takes 2 sips and must schedule that bathroom clean right now.`,
      no: () => `Hvem er minst sannsynlig til å pusse badet uten å bli bedt? Stem! Flest stemmer tar 2 slurker og må planlegge den baderomsrengjøringen akkurat nå.`,
    },
  },
  {
    id: 'would-rather',
    title: { en: 'Would You Rather', no: 'Hva Foretrekker Du' },
    baseDrinks: 1,
    describe: {
      en: () => `Would you rather do dishes every day for a week, or clean the bathroom once? Everyone votes simultaneously. Minority opinion drinks 1 sip.`,
      no: () => `Ville du heller gjøre oppvask hver dag i en uke, eller pusse badet én gang? Alle stemmer samtidig. Minoritetsopinionen drikker 1 slurk.`,
    },
  },
];

// ─── TRIVIA_TWIST templates ───────────────────────────────────────────────────

interface TriviaTwistTemplate {
  id: string;
  title: Record<GameLang, string>;
  baseDrinks: number;
  applicable(players: Player[]): boolean;
  describe: Record<GameLang, (players: Player[]) => string>;
}

const TRIVIA_TWIST_TEMPLATES: TriviaTwistTemplate[] = [
  {
    id: 'streak-compare',
    title: { en: 'Streak Showdown', no: 'Streak-duell' },
    baseDrinks: 2,
    applicable: (ps) => ps.length >= 2,
    describe: {
      en: (ps) => {
        const [a, b] = shuffle(ps);
        return `True or False: ${a.name}'s streak (${a.stats.streak}) is higher than ${b.name}'s (${b.stats.streak}). Everyone guesses simultaneously — wrong answer = 2 sips.`;
      },
      no: (ps) => {
        const [a, b] = shuffle(ps);
        return `Sant eller usant: ${a.name}s streak (${a.stats.streak}) er høyere enn ${b.name}s (${b.stats.streak}). Alle gjetter samtidig — feil svar = 2 slurker.`;
      },
    },
  },
  {
    id: 'task-compare',
    title: { en: 'Task Trivia', no: 'Oppgavetrivia' },
    baseDrinks: 2,
    applicable: (ps) => ps.length >= 2,
    describe: {
      en: (ps) => {
        const [a, b] = shuffle(ps);
        return `True or False: ${a.name} has done more tasks than ${b.name}? (${a.name}: ${a.stats.tasksCompleted}, ${b.name}: ${b.stats.tasksCompleted}) Wrong guess = 2 sips.`;
      },
      no: (ps) => {
        const [a, b] = shuffle(ps);
        return `Sant eller usant: ${a.name} har gjort flere oppgaver enn ${b.name}? (${a.name}: ${a.stats.tasksCompleted}, ${b.name}: ${b.stats.tasksCompleted}) Feil gjett = 2 slurker.`;
      },
    },
  },
  {
    id: 'level-guess',
    title: { en: 'Level Up Guess', no: 'Nivågjett' },
    baseDrinks: 1,
    applicable: (ps) => ps.length >= 2,
    describe: {
      en: (ps) => {
        const target = shuffle(ps)[0];
        return `Guess ${target.name}'s current level! Shout it out — first correct answer distributes 2 sips. Everyone wrong drinks 1. (Answer: Level ${target.stats.level})`;
      },
      no: (ps) => {
        const target = shuffle(ps)[0];
        return `Gjett ${target.name}s nåværende nivå! Rop det ut — første korrekte svar deler ut 2 slurker. Alle som tar feil drikker 1. (Svar: Nivå ${target.stats.level})`;
      },
    },
  },
  {
    id: 'xp-guess',
    title: { en: 'XP Estimation', no: 'XP-estimat' },
    baseDrinks: 2,
    applicable: (ps) => ps.length >= 2,
    describe: {
      en: (ps) => {
        const target = shuffle(ps)[0];
        const low = Math.floor(target.stats.xp * 0.7);
        const high = Math.ceil(target.stats.xp * 1.3);
        return `Guess ${target.name}'s XP — it's somewhere between ${low} and ${high}. Closest guess distributes 2 sips. (Answer: ${target.stats.xp} XP)`;
      },
      no: (ps) => {
        const target = shuffle(ps)[0];
        const low = Math.floor(target.stats.xp * 0.7);
        const high = Math.ceil(target.stats.xp * 1.3);
        return `Gjett ${target.name}s XP — det er et sted mellom ${low} og ${high}. Nærmeste gjett deler ut 2 slurker. (Svar: ${target.stats.xp} XP)`;
      },
    },
  },
  {
    id: 'badge-bluff',
    title: { en: 'Badge Bluff', no: 'Merke-bløff' },
    baseDrinks: 2,
    applicable: (ps) => ps.length >= 2,
    describe: {
      en: (ps) => {
        const target = shuffle(ps)[0];
        const hasBadge = target.stats.badges.length > 0;
        const badge = hasBadge ? target.stats.badges[0] : 'TOP';
        return `True or False: ${target.name} currently holds the "${badge}" badge. Wrong guess = 2 sips. (Answer: ${hasBadge ? 'True' : 'False'})`;
      },
      no: (ps) => {
        const target = shuffle(ps)[0];
        const hasBadge = target.stats.badges.length > 0;
        const badge = hasBadge ? target.stats.badges[0] : 'TOP';
        return `Sant eller usant: ${target.name} har merket «${badge}» for øyeblikket. Feil gjett = 2 slurker. (Svar: ${hasBadge ? 'Sant' : 'Usant'})`;
      },
    },
  },
  {
    id: 'rank-order',
    title: { en: 'Rank Race', no: 'Rangerings-løp' },
    baseDrinks: 2,
    applicable: (ps) => ps.length >= 3,
    describe: {
      en: (ps) => {
        const sample = shuffle(ps).slice(0, 3);
        const sorted = [...sample].sort((a, b) => a.stats.rank - b.stats.rank);
        return `Put these three in leaderboard order (best to worst): ${sample.map((p) => p.name).join(', ')}. First wrong answer drinks 2 sips. (Answer: ${sorted.map((p) => p.name).join(' > ')})`;
      },
      no: (ps) => {
        const sample = shuffle(ps).slice(0, 3);
        const sorted = [...sample].sort((a, b) => a.stats.rank - b.stats.rank);
        return `Sett disse tre i toppliste-rekkefølge (best til verst): ${sample.map((p) => p.name).join(', ')}. Første feil svar drikker 2 slurker. (Svar: ${sorted.map((p) => p.name).join(' > ')})`;
      },
    },
  },
];

// ─── RANDOM_EVENT templates ───────────────────────────────────────────────────

interface RandomEventTemplate {
  id: string;
  title: Record<GameLang, string>;
  baseDrinks: number;
  distribute: boolean;
  describe: Record<GameLang, (players: Player[]) => string>;
}

const RANDOM_EVENT_TEMPLATES: RandomEventTemplate[] = [
  {
    id: 'waterfall',
    title: { en: 'Waterfall', no: 'Foss' },
    baseDrinks: 1,
    distribute: false,
    describe: {
      en: () =>
        `WATERFALL! Starting from the youngest player, everyone starts drinking in order. You can only stop when the person before you stops. Good luck.`,
      no: () =>
        `FOSS! Starter fra den yngste spilleren, alle begynner å drikke i rekkefølge. Du kan bare slutte når personen foran deg slutter. Lykke til.`,
    },
  },
  {
    id: 'rule-maker',
    title: { en: 'Rule Maker', no: 'Regelskaper' },
    baseDrinks: 2,
    distribute: false,
    describe: {
      en: (ps) => {
        const chosen = pickRandomPlayers(ps, 1)[0];
        return `${chosen.name} gets to create a new rule that lasts until the next round. Breaking it = 2 sips. No take-backs. Make it interesting.`;
      },
      no: (ps) => {
        const chosen = pickRandomPlayers(ps, 1)[0];
        return `${chosen.name} får lage en ny regel som gjelder til neste runde. Å bryte den = 2 slurker. Ingen angre. Gjør det interessant.`;
      },
    },
  },
  {
    id: 'thumb-master',
    title: { en: 'Thumb Master', no: 'Tommelmester' },
    baseDrinks: 1,
    distribute: false,
    describe: {
      en: (ps) => {
        const chosen = pickRandomPlayers(ps, 1)[0];
        return `${chosen.name} is now Thumb Master for this round! Place your thumb on the table at any time — the last person to notice drinks 1 sip.`;
      },
      no: (ps) => {
        const chosen = pickRandomPlayers(ps, 1)[0];
        return `${chosen.name} er nå Tommelmester for denne runden! Plasser tommelen på bordet når som helst — den siste som legger merke til det drikker 1 slurk.`;
      },
    },
  },
  {
    id: 'group-chug',
    title: { en: 'Social', no: 'Skål' },
    baseDrinks: 2,
    distribute: false,
    describe: {
      en: () => `Everyone drinks 2 sips at the same time. No exceptions. Hold them up — on three. One. Two. Three.`,
      no: () => `Alle drikker 2 slurker samtidig. Ingen unntak. Hold dem opp — på tre. En. To. Tre.`,
    },
  },
  {
    id: 'stare-down',
    title: { en: 'Stare Down', no: 'Stirrekonkurranse' },
    baseDrinks: 2,
    distribute: false,
    describe: {
      en: (ps) => {
        const pair = pickRandomPlayers(ps, 2);
        if (pair.length < 2) return `${pair[0].name} stares at everyone in turn. First to look away drinks 2 sips.`;
        return `${pair[0].name} and ${pair[1].name}, stare into each other's eyes. First to blink or look away drinks 2 sips. GO.`;
      },
      no: (ps) => {
        const pair = pickRandomPlayers(ps, 2);
        if (pair.length < 2) return `${pair[0].name} ser alle i øynene, én etter én. Den første som ser bort drikker 2 slurker.`;
        return `${pair[0].name} og ${pair[1].name}, se hverandre i øynene. Den første som blinker eller ser bort drikker 2 slurker. GÅ.`;
      },
    },
  },
  {
    id: 'phone-tax',
    title: { en: 'Phone Tax', no: 'Telefonavgift' },
    baseDrinks: 2,
    distribute: false,
    describe: {
      en: () => `Phone check! If you've touched your phone in the last 5 minutes for anything other than this game — drink 2 sips. Honour system.`,
      no: () => `Telefonsjekk! Hvis du har rørt telefonen de siste 5 minuttene til noe annet enn dette spillet — drikk 2 slurker. Æressystem.`,
    },
  },
  {
    id: 'categories',
    title: { en: 'Category Sprint', no: 'Kategorisprint' },
    baseDrinks: 1,
    distribute: false,
    describe: {
      en: () => {
        const cats = ['cleaning products', 'IKEA items', 'things under the sink', 'pizza toppings', 'excuses to avoid chores'];
        const cat = cats[Math.floor(Math.random() * cats.length)];
        return `Category: "${cat}". Go around the table — name one item each. First to hesitate or repeat drinks 1 sip. Start now.`;
      },
      no: () => {
        const cats = ['rengjøringsprodukter', 'IKEA-artikler', 'ting under vasken', 'pizza-toppings', 'unnskyldninger for å unngå husarbeid'];
        const cat = cats[Math.floor(Math.random() * cats.length)];
        return `Kategori: «${cat}». Gå rundt bordet — nevn én ting hver. Den første som nøler eller gjentar drikker 1 slurk. Start nå.`;
      },
    },
  },
  {
    id: 'most-likely',
    title: { en: 'Most Likely To', no: 'Mest Sannsynlig Til Å' },
    baseDrinks: 1,
    distribute: false,
    describe: {
      en: () => {
        const prompts = [
          'forget it was their turn to clean',
          'order takeaway instead of cooking',
          'leave dishes in the sink overnight',
          'stay up past 2am on a weeknight',
          'make an elaborate excuse for not doing laundry',
        ];
        const p = prompts[Math.floor(Math.random() * prompts.length)];
        return `Most likely to: "${p}"? Point on three — most fingers = 1 sip per pointer.`;
      },
      no: () => {
        const prompts = [
          'glemme at det var deres tur til å vaske',
          'bestille takeaway i stedet for å lage mat',
          'la oppvasken stå over natten',
          'holde seg oppe forbi kl. 02 på en hverdag',
          'lage en avansert unnskyldning for ikke å gjøre klesvask',
        ];
        const p = prompts[Math.floor(Math.random() * prompts.length)];
        return `Mest sannsynlig til å: «${p}»? Pek på tre — flest fingre = 1 slurk per peker.`;
      },
    },
  },
];

function buildTriviaTwistText(
  template: TriviaTwistTemplate,
  players: Player[],
): Record<GameLang, GameEventText> {
  switch (template.id) {
    case 'streak-compare': {
      const [a, b] = shuffle(players).slice(0, 2);
      return makeEventText(template.title, {
        en: `True or False: ${a.name}'s streak (${a.stats.streak}) is higher than ${b.name}'s (${b.stats.streak}). Everyone guesses simultaneously — wrong answer = 2 sips.`,
        no: `Sant eller usant: ${a.name}s streak (${a.stats.streak}) er høyere enn ${b.name}s (${b.stats.streak}). Alle gjetter samtidig — feil svar = 2 slurker.`,
      });
    }
    case 'task-compare': {
      const [a, b] = shuffle(players).slice(0, 2);
      return makeEventText(template.title, {
        en: `True or False: ${a.name} has done more tasks than ${b.name}? (${a.name}: ${a.stats.tasksCompleted}, ${b.name}: ${b.stats.tasksCompleted}) Wrong guess = 2 sips.`,
        no: `Sant eller usant: ${a.name} har gjort flere oppgaver enn ${b.name}? (${a.name}: ${a.stats.tasksCompleted}, ${b.name}: ${b.stats.tasksCompleted}) Feil gjett = 2 slurker.`,
      });
    }
    case 'level-guess': {
      const target = shuffle(players)[0];
      return makeEventText(template.title, {
        en: `Guess ${target.name}'s current level! Shout it out — first correct answer distributes 2 sips. Everyone wrong drinks 1. (Answer: Level ${target.stats.level})`,
        no: `Gjett ${target.name}s nåværende nivå! Rop det ut — første korrekte svar deler ut 2 slurker. Alle som tar feil drikker 1. (Svar: Nivå ${target.stats.level})`,
      });
    }
    case 'xp-guess': {
      const target = shuffle(players)[0];
      const low = Math.floor(target.stats.xp * 0.7);
      const high = Math.ceil(target.stats.xp * 1.3);
      return makeEventText(template.title, {
        en: `Guess ${target.name}'s XP — it's somewhere between ${low} and ${high}. Closest guess distributes 2 sips. (Answer: ${target.stats.xp} XP)`,
        no: `Gjett ${target.name}s XP — det er et sted mellom ${low} og ${high}. Nærmeste gjett deler ut 2 slurker. (Svar: ${target.stats.xp} XP)`,
      });
    }
    case 'badge-bluff': {
      const target = shuffle(players)[0];
      const hasBadge = target.stats.badges.length > 0;
      const badge = hasBadge ? target.stats.badges[0] : 'TOP';
      return makeEventText(template.title, {
        en: `True or False: ${target.name} currently holds the "${badge}" badge. Wrong guess = 2 sips. (Answer: ${hasBadge ? 'True' : 'False'})`,
        no: `Sant eller usant: ${target.name} har merket «${badge}» for øyeblikket. Feil gjett = 2 slurker. (Svar: ${hasBadge ? 'Sant' : 'Usant'})`,
      });
    }
    case 'rank-order': {
      const sample = shuffle(players).slice(0, 3);
      const sorted = [...sample].sort((a, b) => a.stats.rank - b.stats.rank);
      return makeEventText(template.title, {
        en: `Put these three in leaderboard order (best to worst): ${sample.map((p) => p.name).join(', ')}. First wrong answer drinks 2 sips. (Answer: ${sorted.map((p) => p.name).join(' > ')})`,
        no: `Sett disse tre i toppliste-rekkefølge (best til verst): ${sample.map((p) => p.name).join(', ')}. Første feil svar drikker 2 slurker. (Svar: ${sorted.map((p) => p.name).join(' > ')})`,
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
        en: `${chosen.name} gets to create a new rule that lasts until the next round. Breaking it = 2 sips. No take-backs. Make it interesting.`,
        no: `${chosen.name} får lage en ny regel som gjelder til neste runde. Å bryte den = 2 slurker. Ingen angre. Gjør det interessant.`,
      });
    }
    case 'thumb-master': {
      const chosen = pickRandomPlayers(players, 1)[0];
      return makeEventText(template.title, {
        en: `${chosen.name} is now Thumb Master for this round! Place your thumb on the table at any time — the last person to notice drinks 1 sip.`,
        no: `${chosen.name} er nå Tommelmester for denne runden! Plasser tommelen på bordet når som helst — den siste som legger merke til det drikker 1 slurk.`,
      });
    }
    case 'stare-down': {
      const pair = pickRandomPlayers(players, 2);
      const en =
        pair.length < 2
          ? `${pair[0].name} stares at everyone in turn. First to look away drinks 2 sips.`
          : `${pair[0].name} and ${pair[1].name}, stare into each other's eyes. First to blink or look away drinks 2 sips. GO.`;
      const no =
        pair.length < 2
          ? `${pair[0].name} ser alle i øynene, én etter én. Den første som ser bort drikker 2 slurker.`
          : `${pair[0].name} og ${pair[1].name}, se hverandre i øynene. Den første som blinker eller ser bort drikker 2 slurker. GÅ.`;
      return makeEventText(template.title, { en, no });
    }
    case 'categories': {
      const categories = [
        {
          en: 'cleaning products',
          no: 'rengjøringsprodukter',
        },
        {
          en: 'IKEA items',
          no: 'IKEA-artikler',
        },
        {
          en: 'things under the sink',
          no: 'ting under vasken',
        },
        {
          en: 'pizza toppings',
          no: 'pizza-toppings',
        },
        {
          en: 'excuses to avoid chores',
          no: 'unnskyldninger for å unngå husarbeid',
        },
      ];
      const category = categories[Math.floor(Math.random() * categories.length)];
      return makeEventText(template.title, {
        en: `Category: "${category.en}". Go around the table — name one item each. First to hesitate or repeat drinks 1 sip. Start now.`,
        no: `Kategori: «${category.no}». Gå rundt bordet — nevn én ting hver. Den første som nøler eller gjentar drikker 1 slurk. Start nå.`,
      });
    }
    case 'most-likely': {
      const prompts = [
        {
          en: 'forget it was their turn to clean',
          no: 'glemme at det var deres tur til å vaske',
        },
        {
          en: 'order takeaway instead of cooking',
          no: 'bestille takeaway i stedet for å lage mat',
        },
        {
          en: 'leave dishes in the sink overnight',
          no: 'la oppvasken stå over natten',
        },
        {
          en: 'stay up past 2am on a weeknight',
          no: 'holde seg oppe forbi kl. 02 på en hverdag',
        },
        {
          en: 'make an elaborate excuse for not doing laundry',
          no: 'lage en avansert unnskyldning for ikke å gjøre klesvask',
        },
      ];
      const prompt = prompts[Math.floor(Math.random() * prompts.length)];
      return makeEventText(template.title, {
        en: `Most likely to: "${prompt.en}"? Point on three — most fingers = 1 sip per pointer.`,
        no: `Mest sannsynlig til å: «${prompt.no}»? Pek på tre — flest fingre = 1 slurk per peker.`,
      });
    }
    default:
      return makeEventText(template.title, {
        en: template.describe.en(players),
        no: template.describe.no(players),
      });
  }
}

// ─── Main Generator ───────────────────────────────────────────────────────────

/**
 * Generate a single GameEvent for the given round type.
 *
 * @param lang           Locale to use for all generated text ('en' | 'no')
 * @param usedTemplateIds Mutable Set of already-used template IDs (mutated here)
 */
export function generateEvent(
  roundType: RoundType,
  players: Player[],
  config: GameConfig,
  usedTemplateIds: Set<string>,
  lang: GameLang = 'en',
): GameEvent | null {
  if (players.length < 2) return null;

  switch (roundType) {
    case 'STAT_COMPARISON': {
      const pool = STAT_COMP_TEMPLATES.filter((t) => !usedTemplateIds.has(t.id));
      const templates = pool.length > 0 ? pool : STAT_COMP_TEMPLATES;
      const template = weightedRandom(templates, templates.map(() => 1));

      const target = getExtremeStat(players, template.statKey, template.extreme === 'highest' ? 'highest' : 'lowest');
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
      const options: Array<{ template: ChallengeTemplate; player: Player }> = [];
      for (const player of players) {
        for (const template of CHALLENGE_TEMPLATES) {
          const key = `${template.id}::${player.name}`;
          if (!usedTemplateIds.has(key) && template.applicable(player)) {
            options.push({ template, player });
          }
        }
      }

      const pool = options.length > 0 ? options : (() => {
        const all: typeof options = [];
        for (const player of players) {
          for (const template of CHALLENGE_TEMPLATES) {
            if (template.applicable(player)) all.push({ template, player });
          }
        }
        return all;
      })();

      if (pool.length === 0) {
        const fallback = pickPlayerByStat(players, 'skippedTasks', true, config.statInfluence);
        const drinkCount = sips(3, config);
        const fallbackTitle: Record<GameLang, string> = {
          en: 'Open Challenge',
          no: 'Åpen utfordring',
        };
        const fallbackDescription: Record<GameLang, string> = {
          en: `${fallback.name}, the group names a household challenge for you. You have 10 seconds to accept or drink ${sips(3, config)} sips.`,
          no: `${fallback.name}, gruppen velger en hjemlig utfordring for deg. Du har 10 sekunder på å akseptere eller drikke ${sips(3, config)} slurker.`,
        };
        return buildEvent(roundType, lang, makeEventText(fallbackTitle, fallbackDescription), {
          targetPlayers: [fallback.name],
          drinks: drinkCount,
        });
      }

      const perfScores = players.reduce<Record<string, number>>((acc, p) => {
        acc[p.name] = p.stats.tasksCompleted * 0.5 + p.stats.streak * 0.3 + p.stats.level * 0.2;
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
      const pool = HOT_SEAT_TEMPLATES.filter((t) => !usedTemplateIds.has(t.id));
      const templates = pool.length > 0 ? pool : HOT_SEAT_TEMPLATES;
      const template = templates[Math.floor(Math.random() * templates.length)];
      const textByLanguage = makeEventText(template.title, {
        en: template.describe.en(players),
        no: template.describe.no(players),
      });

      usedTemplateIds.add(template.id);

      return buildEvent(roundType, lang, textByLanguage, {
        targetPlayers: [],
        drinks: sips(template.baseDrinks, config),
      });
    }

    case 'TRIVIA_TWIST': {
      const pool = TRIVIA_TWIST_TEMPLATES.filter(
        (t) => !usedTemplateIds.has(t.id) && t.applicable(players),
      );
      const templates =
        pool.length > 0
          ? pool
          : TRIVIA_TWIST_TEMPLATES.filter((t) => t.applicable(players));

      if (templates.length === 0) {
        return generateEvent('HOT_SEAT', players, config, usedTemplateIds, lang);
      }

      const template = templates[Math.floor(Math.random() * templates.length)];
      const textByLanguage = buildTriviaTwistText(template, players);
      usedTemplateIds.add(template.id);

      return buildEvent(roundType, lang, textByLanguage, {
        targetPlayers: [],
        drinks: sips(template.baseDrinks, config),
      });
    }

    case 'RANDOM_EVENT': {
      const pool = RANDOM_EVENT_TEMPLATES.filter((t) => !usedTemplateIds.has(t.id));
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
