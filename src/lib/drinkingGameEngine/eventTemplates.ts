import type { GameLang, Player } from './types';

export interface StatCompTemplate {
  id: string;
  title: Record<GameLang, string>;
  statKey: keyof Pick<
    Player['stats'],
    'streak' | 'tasksCompleted' | 'lateCompletions' | 'skippedTasks' | 'xp' | 'level' | 'rank'
  >;
  extreme: 'highest' | 'lowest';
  baseDrinks: number;
  distribute: boolean;
  describe: Record<GameLang, (target: Player, value: number, drinkCount: number) => string>;
}

export interface ChallengeTemplate {
  id: string;
  title: Record<GameLang, string>;
  baseDrinks: number;
  applicable(player: Player): boolean;
  describe: Record<GameLang, (player: Player) => string>;
}

export interface HotSeatTemplate {
  id: string;
  title: Record<GameLang, string>;
  baseDrinks: number;
  describe: Record<GameLang, (players: Player[]) => string>;
}

export interface TriviaTwistTemplate {
  id: string;
  title: Record<GameLang, string>;
  baseDrinks: number;
  applicable(players: Player[]): boolean;
  describe: Record<GameLang, (players: Player[]) => string>;
}

export interface RandomEventTemplate {
  id: string;
  title: Record<GameLang, string>;
  baseDrinks: number;
  distribute: boolean;
  describe: Record<GameLang, (players: Player[]) => string>;
}

function enCount(value: number, singular: string, plural = `${singular}s`): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function noCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function enSips(value: number): string {
  return enCount(value, 'sip');
}

function noSips(value: number): string {
  return noCount(value, 'slurk', 'slurker');
}

export const STAT_COMP_TEMPLATES: StatCompTemplate[] = [
  // Improved existing prompts
  {
    id: 'streak-low',
    title: { en: 'Cold Streak', no: 'Kald streak' },
    statKey: 'streak',
    extreme: 'lowest',
    baseDrinks: 2,
    distribute: false,
    describe: {
      en: (t, v, d) =>
        `${t.name} has the shortest streak in the house at ${enCount(v, 'day')}. Take ${enSips(d)} and promise the table a comeback.`,
      no: (t, v, d) =>
        `${t.name} har den korteste streaken i kollektivet med ${noCount(v, 'dag', 'dager')}. Ta ${noSips(d)} og lov bordet et lite comeback.`,
    },
  },
  {
    id: 'streak-high',
    title: { en: 'Streak Royalty', no: 'Streak-konge' },
    statKey: 'streak',
    extreme: 'highest',
    baseDrinks: 3,
    distribute: true,
    describe: {
      en: (t, v, d) =>
        `${t.name} is on a ${enCount(v, 'day')} streak. Very impressive. Slightly annoying. Hand out ${enSips(d)} like the household legend you are.`,
      no: (t, v, d) =>
        `${t.name} er på en streak på ${noCount(v, 'dag', 'dager')}. Imponerende, og litt provoserende. Del ut ${noSips(d)} som den husholdningshelten du er.`,
    },
  },
  {
    id: 'tasks-low',
    title: { en: 'Slacker Tax', no: 'Sluntreskatt' },
    statKey: 'tasksCompleted',
    extreme: 'lowest',
    baseDrinks: 2,
    distribute: false,
    describe: {
      en: (t, v, d) =>
        `${t.name} has completed the fewest tasks so far: ${v}. Take ${enSips(d)} as a symbolic contribution to the household.`,
      no: (t, v, d) =>
        `${t.name} har fullført færrest oppgaver så langt: ${v}. Ta ${noSips(d)} som et symbolsk bidrag til fellesskapet.`,
    },
  },
  {
    id: 'tasks-high',
    title: { en: 'Task Leader', no: 'Oppgavelederen' },
    statKey: 'tasksCompleted',
    extreme: 'highest',
    baseDrinks: 3,
    distribute: true,
    describe: {
      en: (t, v, d) =>
        `${t.name} is leading the room with ${v} completed tasks. Hand out ${enSips(d)} however you like. That authority looks earned.`,
      no: (t, v, d) =>
        `${t.name} leder gjengen med ${v} fullførte oppgaver. Del ut ${noSips(d)} akkurat som du vil. Den autoriteten ser fortjent ut.`,
    },
  },
  {
    id: 'late-high',
    title: { en: 'Fashionably Late', no: 'Evig forsinket' },
    statKey: 'lateCompletions',
    extreme: 'highest',
    baseDrinks: 3,
    distribute: false,
    describe: {
      en: (t, v, d) =>
        `${t.name} has been late ${v} times. Take ${enSips(d)} for every time "I'll do it later" became "tomorrow, probably."`,
      no: (t, v, d) =>
        `${t.name} har vært forsinket ${v} ganger. Ta ${noSips(d)} for hver gang "jeg gjør det senere" ble til "i morgen da".`,
    },
  },
  {
    id: 'skip-high',
    title: { en: 'Skip Champion', no: 'Skip-kongen' },
    statKey: 'skippedTasks',
    extreme: 'highest',
    baseDrinks: 3,
    distribute: false,
    describe: {
      en: (t, v, d) =>
        `${t.name} has skipped ${v} tasks outright. The chores disappeared. These ${enSips(d)} will not.`,
      no: (t, v, d) =>
        `${t.name} har hoppet over ${v} oppgaver helt. Jobben forsvant visst, men det gjør ikke disse ${noSips(d)}.`,
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
        `${t.name} is bringing just ${v} XP to the table, the lowest in the room. Take ${enSips(d)} and start planning the comeback arc.`,
      no: (t, v, d) =>
        `${t.name} stiller med bare ${v} XP, lavest i gjengen. Ta ${noSips(d)} og begynn å planlegge comebacket.`,
    },
  },
  {
    id: 'xp-high',
    title: { en: 'XP Flex', no: 'XP-flex' },
    statKey: 'xp',
    extreme: 'highest',
    baseDrinks: 2,
    distribute: true,
    describe: {
      en: (t, v, d) =>
        `${t.name} has the highest XP total at ${v}. Use that main-character energy and hand out ${enSips(d)}.`,
      no: (t, v, d) =>
        `${t.name} har høyest XP med ${v}. Bruk hovedkarakter-energien med måte og del ut ${noSips(d)}.`,
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
        `${t.name} is level ${v}, officially the rookie of the room. Take ${enSips(d)} and own the humble beginning.`,
      no: (t, v, d) =>
        `${t.name} er nivå ${v}, og dermed ferskest i gjengen. Ta ${noSips(d)} og omfavn den ydmyke starten.`,
    },
  },
  {
    id: 'late-low',
    title: { en: 'Deadline Darling', no: 'Fristfavoritten' },
    statKey: 'lateCompletions',
    extreme: 'lowest',
    baseDrinks: 2,
    distribute: true,
    describe: {
      en: (t, v, d) =>
        `${t.name} has the fewest late completions with ${v}. Punctuality is hot tonight, so hand out ${enSips(d)}.`,
      no: (t, v, d) =>
        `${t.name} har færrest forsinkede fullføringer med ${v}. Punktlighet er plutselig veldig attraktivt, så del ut ${noSips(d)}.`,
    },
  },
  {
    id: 'skip-low',
    title: { en: 'Reliable Soul', no: 'Den pålitelige' },
    statKey: 'skippedTasks',
    extreme: 'lowest',
    baseDrinks: 2,
    distribute: true,
    describe: {
      en: (t, v, d) =>
        `${t.name} has skipped the fewest tasks: ${v}. Reliability looks good on you. Hand out ${enSips(d)}.`,
      no: (t, v, d) =>
        `${t.name} har hoppet over færrest oppgaver: ${v}. Pålitelighet kler deg. Del ut ${noSips(d)}.`,
    },
  },
  {
    id: 'rank-best',
    title: { en: 'Leaderboard Royalty', no: 'Toppliste-kongelighet' },
    statKey: 'rank',
    extreme: 'lowest',
    baseDrinks: 3,
    distribute: true,
    describe: {
      en: (t, v, d) =>
        `${t.name} has the best leaderboard rank at #${v}. Bow respectfully and let them hand out ${enSips(d)}.`,
      no: (t, v, d) =>
        `${t.name} har beste plassering på topplisten med #${v}. Bøy dere høflig og la dem dele ut ${noSips(d)}.`,
    },
  },
  {
    id: 'level-high',
    title: { en: 'House Veteran', no: 'Kollektiv-veteranen' },
    statKey: 'level',
    extreme: 'highest',
    baseDrinks: 2,
    distribute: true,
    describe: {
      en: (t, v, d) =>
        `${t.name} is the highest level here at ${v}. Veteran privileges unlocked: hand out ${enSips(d)}.`,
      no: (t, v, d) =>
        `${t.name} har høyest nivå her med ${v}. Veteranfordel låst opp: del ut ${noSips(d)}.`,
    },
  },
  // New prompts
  {
    id: 'rank-worst',
    title: { en: 'Back Of The Pack', no: 'Bakerst i feltet' },
    statKey: 'rank',
    extreme: 'highest',
    baseDrinks: 2,
    distribute: false,
    describe: {
      en: (t, v, d) =>
        `${t.name} is currently last out of this group on the leaderboard at #${v}. Take ${enSips(d)} and call it a warm-up round.`,
      no: (t, v, d) =>
        `${t.name} ligger sist i denne gjengen på topplisten med #${v}. Ta ${noSips(d)} og kall det en oppvarmingsrunde.`,
    },
  },
  {
    id: 'task-machine',
    title: { en: 'Task Machine', no: 'Oppgavemaskinen' },
    statKey: 'tasksCompleted',
    extreme: 'highest',
    baseDrinks: 2,
    distribute: true,
    describe: {
      en: (t, v, d) =>
        `${t.name} has powered through ${v} completed tasks. Hand out ${enSips(d)} to the people who need the motivation most.`,
      no: (t, v, d) =>
        `${t.name} har pløyd gjennom ${v} fullførte oppgaver. Del ut ${noSips(d)} til dem som trenger motivasjonen mest.`,
    },
  },
  {
    id: 'xp-underdog',
    title: { en: 'Underdog Energy', no: 'Underdog-energi' },
    statKey: 'xp',
    extreme: 'lowest',
    baseDrinks: 2,
    distribute: false,
    describe: {
      en: (t, v, d) =>
        `${t.name} is the underdog tonight with ${v} XP. Take ${enSips(d)} now, then start your redemption tour.`,
      no: (t, v, d) =>
        `${t.name} er kveldens underdog med ${v} XP. Ta ${noSips(d)} nå, og start innløsningsturneen etterpå.`,
    },
  },
  {
    id: 'punctuality-icon',
    title: { en: 'Punctuality Icon', no: 'Punktlighetsikon' },
    statKey: 'lateCompletions',
    extreme: 'lowest',
    baseDrinks: 2,
    distribute: true,
    describe: {
      en: (t, v, d) =>
        `${t.name} has kept delays down to ${v}. Clean work. Hand out ${enSips(d)} like the timing icon you are.`,
      no: (t, v, d) =>
        `${t.name} har holdt forsinkelsene nede på ${v}. Ryddig levert. Del ut ${noSips(d)} som det punktlighetsikonet du er.`,
    },
  },
  {
    id: 'clean-record',
    title: { en: 'Clean Record', no: 'Ren statistikk' },
    statKey: 'skippedTasks',
    extreme: 'lowest',
    baseDrinks: 2,
    distribute: true,
    describe: {
      en: (t, v, d) =>
        `${t.name} has the cleanest skip record with ${v} missed tasks. Hand out ${enSips(d)} and enjoy the good reputation.`,
      no: (t, v, d) =>
        `${t.name} har den reneste skip-statistikken med ${v} uteblitte oppgaver. Del ut ${noSips(d)} og nyt det gode ryktet.`,
    },
  },
];

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  // Improved existing prompts
  {
    id: 'streak-name',
    title: { en: 'Streak Check-In', no: 'Streak-sjekk' },
    baseDrinks: 2,
    applicable: (p) => !p.isGuest && p.stats.streak > 0,
    describe: {
      en: (p) =>
        `${p.name}, you're on a ${enCount(p.stats.streak, 'day')} streak. Name the last chore you finished without checking your phone. Hesitate or bluff, and take 2 sips.`,
      no: (p) =>
        `${p.name}, du er på en streak på ${noCount(p.stats.streak, 'dag', 'dager')}. Nevn den siste oppgaven du fullførte uten å sjekke telefonen. Nøler du eller bløffer, blir det 2 slurker.`,
    },
  },
  {
    id: 'late-excuse',
    title: { en: 'Excuse Time', no: 'Unnskyldning på tid' },
    baseDrinks: 3,
    applicable: (p) => !p.isGuest && p.stats.lateCompletions > 0,
    describe: {
      en: (p) =>
        `${p.name}, you've been late ${p.stats.lateCompletions} times. Give the table your smoothest excuse. If nobody buys it, take 3 sips.`,
      no: (p) =>
        `${p.name}, du har vært for sen ${p.stats.lateCompletions} ganger. Gi bordet din glatteste unnskyldning. Hvis ingen kjøper den, tar du 3 slurker.`,
    },
  },
  {
    id: 'task-category',
    title: { en: 'Chore Roll Call', no: 'Oppgaveopprop' },
    baseDrinks: 2,
    applicable: (p) => !p.isGuest && p.stats.tasksCompleted >= 3,
    describe: {
      en: (p) =>
        `${p.name}, you've logged ${p.stats.tasksCompleted} tasks. Name two different chores you've actually done lately. If the room calls bluff, drink 2 sips.`,
      no: (p) =>
        `${p.name}, du har logget ${p.stats.tasksCompleted} oppgaver. Nevn to ulike oppgaver du faktisk har gjort i det siste. Hvis rommet ikke tror deg, drikker du 2 slurker.`,
    },
  },
  {
    id: 'skip-defend',
    title: { en: 'Skipped Task Trial', no: 'Skip-saken' },
    baseDrinks: 4,
    applicable: (p) => !p.isGuest && p.stats.skippedTasks > 0,
    describe: {
      en: (p) =>
        `${p.name}, you've skipped ${p.stats.skippedTasks} tasks. You have 15 seconds to defend yourself. Guilty verdict means 4 sips.`,
      no: (p) =>
        `${p.name}, du har hoppet over ${p.stats.skippedTasks} oppgaver. Du får 15 sekunder til å forsvare deg. Skyldig dom betyr 4 slurker.`,
    },
  },
  {
    id: 'achievement-recall',
    title: { en: 'Achievement Recall', no: 'Prestasjonsquiz' },
    baseDrinks: 2,
    applicable: (p) => !p.isGuest && p.stats.achievementsUnlocked >= 1,
    describe: {
      en: (p) =>
        `${p.name}, you've unlocked ${p.stats.achievementsUnlocked} achievements. Name one from memory. Blank stare? Drink 2 sips.`,
      no: (p) =>
        `${p.name}, du har låst opp ${p.stats.achievementsUnlocked} prestasjoner. Nevn én fra hukommelsen. Står det stille? Drikk 2 slurker.`,
    },
  },
  {
    id: 'level-flex',
    title: { en: 'Level Flex', no: 'Nivå-flex' },
    baseDrinks: 2,
    applicable: (p) => !p.isGuest && p.stats.level >= 2,
    describe: {
      en: (p) =>
        `${p.name}, you're level ${p.stats.level}. Tell the room one thing you're genuinely proud of doing at home. No applause means 2 sips.`,
      no: (p) =>
        `${p.name}, du er nivå ${p.stats.level}. Fortell gruppa om én ting du faktisk er stolt av å ha gjort hjemme. Får du ikke applaus, blir det 2 slurker.`,
    },
  },
  {
    id: 'rookie-ordeal',
    title: { en: 'Rookie Moment', no: 'Rookie-øyeblikket' },
    baseDrinks: 1,
    applicable: (p) => !p.isGuest && p.stats.level === 1 && p.stats.tasksCompleted <= 2,
    describe: {
      en: (p) =>
        `${p.name}, you're level 1 with just ${p.stats.tasksCompleted} completed tasks. Everyone gives you one future chore suggestion. Reject one, and drink 1 sip per rejection.`,
      no: (p) =>
        `${p.name}, du er nivå 1 med bare ${p.stats.tasksCompleted} fullførte oppgaver. Alle gir deg ett forslag til en framtidig oppgave. Avviser du noe, blir det 1 slurk per avvisning.`,
    },
  },
  {
    id: 'top-performer-challenge',
    title: { en: 'Top Spot Tax', no: 'Topplass-skatt' },
    baseDrinks: 0,
    applicable: (p) => !p.isGuest && p.stats.badges.includes('TOP'),
    describe: {
      en: (p) =>
        `${p.name}, you're carrying the TOP badge. Pick someone and give them 3 sips. If the room hates your choice, you drink them instead.`,
      no: (p) =>
        `${p.name}, du bærer TOP-merket. Velg noen og gi dem 3 slurker. Hvis bordet misliker valget ditt, drikker du dem selv.`,
    },
  },
  {
    id: 'no-streak',
    title: { en: 'Streakless Wonder', no: 'Uten streak' },
    baseDrinks: 2,
    applicable: (p) => !p.isGuest && p.stats.streak === 0,
    describe: {
      en: (p) =>
        `${p.name}, your streak is currently zero. Stand up, promise the room you'll do better, and sit back down. Refuse the speech, and take 2 sips.`,
      no: (p) =>
        `${p.name}, streaken din står på null. Reis deg, lov at du skal skjerpe deg, og sett deg ned igjen. Nekter du talen, blir det 2 slurker.`,
    },
  },
  {
    id: 'rank-brag',
    title: { en: 'Winner Speech', no: 'Vinnertalen' },
    baseDrinks: 2,
    applicable: (p) => !p.isGuest && p.stats.rank <= 3,
    describe: {
      en: (p) =>
        `${p.name}, you're sitting at rank #${p.stats.rank}. Give the room a 10-second winner speech. If it's flat, take 2 sips.`,
      no: (p) =>
        `${p.name}, du ligger på plass #${p.stats.rank}. Hold en vinnertale på 10 sekunder. Er den kjedelig, blir det 2 slurker.`,
    },
  },
  {
    id: 'task-memory',
    title: { en: 'Receipt Check', no: 'Kvitteringssjekk' },
    baseDrinks: 2,
    applicable: (p) => !p.isGuest && p.stats.tasksCompleted >= 5,
    describe: {
      en: (p) =>
        `${p.name}, you've logged ${p.stats.tasksCompleted} tasks. Name the last three you remember doing. Miss one, and take 2 sips.`,
      no: (p) =>
        `${p.name}, du har logget ${p.stats.tasksCompleted} oppgaver. Nevn de tre siste du husker å ha gjort. Bommer du på én, tar du 2 slurker.`,
    },
  },
  {
    id: 'deadline-saint',
    title: { en: 'Deadline Saint', no: 'Fristhelgenen' },
    baseDrinks: 2,
    applicable: (p) => !p.isGuest && p.stats.lateCompletions === 0 && p.stats.tasksCompleted >= 3,
    describe: {
      en: (p) =>
        `${p.name}, you have zero late completions. The room gets one shot each at tempting you into procrastination. Crack, and drink 2 sips.`,
      no: (p) =>
        `${p.name}, du har null sene fullføringer. Rommet får ett forsøk hver på å friste deg til å utsette ting. Ryker du, blir det 2 slurker.`,
    },
  },
  {
    id: 'badge-explain',
    title: { en: 'Badge Defense', no: 'Merkeforsvar' },
    baseDrinks: 2,
    applicable: (p) => !p.isGuest && p.stats.badges.length > 0,
    describe: {
      en: (p) =>
        `${p.name}, pick one of your badges and explain why you deserve it. If the room isn't convinced, take 2 sips.`,
      no: (p) =>
        `${p.name}, velg ett av merkene dine og forklar hvorfor du fortjener det. Hvis ingen kjøper forklaringen, tar du 2 slurker.`,
    },
  },
  {
    id: 'xp-hustle',
    title: { en: 'XP Story', no: 'XP-historien' },
    baseDrinks: 2,
    applicable: (p) => !p.isGuest && p.stats.xp >= 50,
    describe: {
      en: (p) =>
        `${p.name}, you have ${p.stats.xp} XP. Give the room your most confident "how I got here" story. If it sounds fake, drink 2 sips.`,
      no: (p) =>
        `${p.name}, du har ${p.stats.xp} XP. Fortell din mest selvsikre "slik havnet jeg her"-historie. Høres den oppdiktet ut, drikker du 2 slurker.`,
    },
  },
  {
    id: 'streak-promise',
    title: { en: 'Streak Oath', no: 'Streak-løftet' },
    baseDrinks: 2,
    applicable: (p) => !p.isGuest && p.stats.streak >= 5,
    describe: {
      en: (p) =>
        `${p.name}, your streak is ${p.stats.streak}. Promise the room which chore standard you'll never drop below again. Weak promise means 2 sips.`,
      no: (p) =>
        `${p.name}, streaken din er ${p.stats.streak}. Lov gruppa hvilken standard du aldri skal falle under igjen. Svakt løfte gir 2 slurker.`,
    },
  },
  // New prompts
  {
    id: 'task-speed-round',
    title: { en: 'Speed Round', no: 'Hurtigrunden' },
    baseDrinks: 2,
    applicable: (p) => !p.isGuest && p.stats.tasksCompleted >= 2,
    describe: {
      en: (p) =>
        `${p.name}, name three chores you've done faster than the table can count to three. Miss one, and drink 2 sips.`,
      no: (p) =>
        `${p.name}, nevn tre oppgaver du har gjort før bordet rekker å telle til tre. Bommer du på én, drikker du 2 slurker.`,
    },
  },
  {
    id: 'late-redemption-plan',
    title: { en: 'Redemption Plan', no: 'Redningsplanen' },
    baseDrinks: 2,
    applicable: (p) => !p.isGuest && p.stats.lateCompletions > 0,
    describe: {
      en: (p) =>
        `${p.name}, give the room one realistic plan for being less late next week. If it sounds made up on the spot, drink 2 sips.`,
      no: (p) =>
        `${p.name}, gi rommet én realistisk plan for å bli mindre sen neste uke. Høres den improvisert ut, drikker du 2 slurker.`,
    },
  },
  {
    id: 'skip-apology',
    title: { en: 'Public Apology', no: 'Offentlig unnskyldning' },
    baseDrinks: 2,
    applicable: (p) => !p.isGuest && p.stats.skippedTasks > 0,
    describe: {
      en: (p) =>
        `${p.name}, give your skipped tasks a dramatic public apology. If the table gives you nothing back, drink 2 sips.`,
      no: (p) =>
        `${p.name}, gi de hoppede oppgavene dine en dramatisk offentlig unnskyldning. Får du null respons fra bordet, drikker du 2 slurker.`,
    },
  },
  {
    id: 'rank-heat-check',
    title: { en: 'Rank Heat Check', no: 'Rangeringstest' },
    baseDrinks: 2,
    applicable: (p) => !p.isGuest && p.stats.rank <= 5,
    describe: {
      en: (p) =>
        `${p.name}, you're near the top at rank #${p.stats.rank}. Give the room one smug but useful household tip. If it flops, drink 2 sips.`,
      no: (p) =>
        `${p.name}, du ligger høyt med plass #${p.stats.rank}. Gi rommet ett småfrekt, men nyttig husholdningstips. Hvis det flopper, drikker du 2 slurker.`,
    },
  },
  {
    id: 'badge-sales-pitch',
    title: { en: 'Badge Sales Pitch', no: 'Merke-pitchen' },
    baseDrinks: 2,
    applicable: (p) => !p.isGuest && p.stats.badges.length > 0,
    describe: {
      en: (p) =>
        `${p.name}, sell one of your badges like it's a terrible TV ad. If the room isn't sold, drink 2 sips.`,
      no: (p) =>
        `${p.name}, selg ett av merkene dine som om det var en dårlig TV-reklame. Hvis rommet ikke er overbevist, drikker du 2 slurker.`,
    },
  },
];

export const GUEST_CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  // Improved existing prompts
  {
    id: 'guest-first-impression',
    title: { en: 'First Impression', no: 'Førsteinntrykk' },
    baseDrinks: 2,
    applicable: (p) => p.isGuest,
    describe: {
      en: (p) =>
        `${p.name}, based on first impression only: point to the person who looks most likely to keep a shared place tidy. If the room strongly disagrees, take 2 sips.`,
      no: (p) =>
        `${p.name}, kun basert på førsteinntrykk: pek på den som virker mest ryddig i et kollektiv. Hvis resten er tydelig uenig, tar du 2 slurker.`,
    },
  },
  {
    id: 'guest-roomie-radar',
    title: { en: 'Roommate Radar', no: 'Romkamerat-radaren' },
    baseDrinks: 2,
    applicable: (p) => p.isGuest,
    describe: {
      en: (p) =>
        `${p.name}, pick the person most likely to leave one suspicious container in the fridge for three weeks. They get 10 seconds to defend themselves or drink 2 sips.`,
      no: (p) =>
        `${p.name}, velg den som virker mest sannsynlig til å la en mistenkelig boks stå i kjøleskapet i tre uker. Personen får 10 sekunder til å forsvare seg eller drikke 2 slurker.`,
    },
  },
  {
    id: 'guest-confessional',
    title: { en: 'Guest Confessional', no: 'Gjeste-skriftemål' },
    baseDrinks: 2,
    applicable: (p) => p.isGuest,
    describe: {
      en: (p) =>
        `${p.name}, confess your worst habit when you live with or visit other people. If the table thinks you're hiding the real answer, drink 2 sips.`,
      no: (p) =>
        `${p.name}, innrøm den verste vanen din når du bor med eller besøker andre. Hvis bordet tror du holder tilbake sannheten, drikk 2 slurker.`,
    },
  },
  {
    id: 'guest-jury-duty',
    title: { en: 'Outsider Verdict', no: 'Outsiderdommen' },
    baseDrinks: 3,
    applicable: (p) => p.isGuest,
    describe: {
      en: (p) =>
        `${p.name}, pick the person most likely to become a tiny household dictator if given too much responsibility. If the room agrees, they drink 3 sips. If not, you do.`,
      no: (p) =>
        `${p.name}, velg den som virker mest sannsynlig til å bli en liten husholdningsdiktator med litt for mye ansvar. Hvis resten er enig, drikker den personen 3 slurker. Hvis ikke, gjør du det.`,
    },
  },
  {
    id: 'guest-host-rating',
    title: { en: 'Host Rating', no: 'Vertsvurdering' },
    baseDrinks: 2,
    applicable: (p) => p.isGuest,
    describe: {
      en: (p) =>
        `${p.name}, choose who here you would trust most to host a chaotic pregame without losing control. They either accept the honor or take 2 sips.`,
      no: (p) =>
        `${p.name}, velg hvem her du ville stolt mest på til å holde et kaotisk vors i gang uten å miste kontrollen. Personen tar enten imot æren eller drikker 2 slurker.`,
    },
  },
  {
    id: 'guest-airbnb-review',
    title: { en: 'Airbnb Review', no: 'Airbnb-anmeldelsen' },
    baseDrinks: 2,
    applicable: (p) => p.isGuest,
    describe: {
      en: (p) =>
        `${p.name}, give one person at the table a brutal but fair one-line Airbnb review. If the room thinks it's too soft, drink 2 sips.`,
      no: (p) =>
        `${p.name}, gi én ved bordet en brutal, men rettferdig Airbnb-anmeldelse på én linje. Hvis resten synes du er for snill, drikk 2 slurker.`,
    },
  },
  {
    id: 'guest-trust-fund',
    title: { en: 'Borrow 500?', no: 'Låne 500?' },
    baseDrinks: 2,
    applicable: (p) => p.isGuest,
    describe: {
      en: (p) =>
        `${p.name}, pick who here you would trust enough to borrow 500 kroner from. That person must explain why they deserve the trust or drink 2 sips.`,
      no: (p) =>
        `${p.name}, velg hvem her du ville stolt nok på til å låne 500 kroner av. Den personen må forklare hvorfor de fortjener tilliten eller drikke 2 slurker.`,
    },
  },
  {
    id: 'guest-chaos-meter',
    title: { en: 'Chaos Meter', no: 'Kaosmåleren' },
    baseDrinks: 2,
    applicable: (p) => p.isGuest,
    describe: {
      en: (p) =>
        `${p.name}, point to the person most likely to say "relax, I have a system" while clearly having no system. They defend themselves or drink 2 sips.`,
      no: (p) =>
        `${p.name}, pek på den som mest sannsynlig ville sagt "slapp av, jeg har et system" uten å ha noe system. Personen forsvarer seg eller drikker 2 slurker.`,
    },
  },
  {
    id: 'guest-roommate-draft',
    title: { en: 'Roommate Draft', no: 'Romkamerat-valget' },
    baseDrinks: 2,
    applicable: (p) => p.isGuest,
    describe: {
      en: (p) =>
        `${p.name}, if you had to move in with one person at this table tomorrow, who would you draft first? Everyone else who gets offended drinks 1 sip.`,
      no: (p) =>
        `${p.name}, hvis du måtte flyttet inn med én ved dette bordet i morgen, hvem hadde du valgt først? Alle andre som blir fornærmet drikker 1 slurk.`,
    },
  },
  // New prompts
  {
    id: 'guest-fridge-radar',
    title: { en: 'Fridge Radar', no: 'Kjøleskap-radar' },
    baseDrinks: 2,
    applicable: (p) => p.isGuest,
    describe: {
      en: (p) =>
        `${p.name}, point to the person most likely to label leftovers like they run a tiny restaurant. If the room disagrees, drink 2 sips.`,
      no: (p) =>
        `${p.name}, pek på den som mest sannsynlig ville merket rester som om de drev en liten restaurant. Hvis rommet er uenig, drikker du 2 slurker.`,
    },
  },
  {
    id: 'guest-clean-exit',
    title: { en: 'Clean Exit', no: 'Ryddig exit' },
    baseDrinks: 2,
    applicable: (p) => p.isGuest,
    describe: {
      en: (p) =>
        `${p.name}, who here looks most likely to stay five extra minutes just to help clean up? That person accepts the compliment or drinks 2 sips.`,
      no: (p) =>
        `${p.name}, hvem her ser mest sannsynlig ut til å bli fem minutter ekstra bare for å hjelpe til med ryddingen? Den personen tar imot komplimentet eller drikker 2 slurker.`,
    },
  },
  {
    id: 'guest-emergency-text',
    title: { en: 'Emergency Text', no: 'Nød-SMS' },
    baseDrinks: 2,
    applicable: (p) => p.isGuest,
    describe: {
      en: (p) =>
        `${p.name}, if you were locked out at 2 a.m., who at this table would you text first? They explain why they're the right pick or drink 2 sips.`,
      no: (p) =>
        `${p.name}, hvis du låste deg ute klokken to om natta, hvem ved dette bordet ville du sendt melding til først? Personen forklarer hvorfor de er riktig valg, eller drikker 2 slurker.`,
    },
  },
  {
    id: 'guest-last-slice',
    title: { en: 'Last Slice Energy', no: 'Siste-stykke-energi' },
    baseDrinks: 2,
    applicable: (p) => p.isGuest,
    describe: {
      en: (p) =>
        `${p.name}, pick the person most likely to take the last slice and still say "is anyone having this?" They defend themselves or drink 2 sips.`,
      no: (p) =>
        `${p.name}, velg den som mest sannsynlig ville tatt det siste stykket og likevel sagt "skal noen ha dette?" Personen forsvarer seg eller drikker 2 slurker.`,
    },
  },
  {
    id: 'guest-vibe-review',
    title: { en: 'Vibe Review', no: 'Vibe-anmeldelsen' },
    baseDrinks: 2,
    applicable: (p) => p.isGuest,
    describe: {
      en: (p) =>
        `${p.name}, give the table a one-line review of tonight's roommate energy so far. Too vague means 2 sips.`,
      no: (p) =>
        `${p.name}, gi bordet en énlinjers anmeldelse av kollektivenergien i kveld så langt. Blir den for vag, blir det 2 slurker.`,
    },
  },
];

export const HOT_SEAT_TEMPLATES: HotSeatTemplate[] = [
  // Improved existing prompts
  {
    id: 'who-slacks',
    title: { en: 'Slacker Vote', no: 'Sluntrevotering' },
    baseDrinks: 2,
    describe: {
      en: () => '',
      no: () => '',
    },
  },
  {
    id: 'who-overachiever',
    title: { en: 'Overachiever Award', no: 'Overprestasjonsprisen' },
    baseDrinks: 3,
    describe: {
      en: () => '',
      no: () => '',
    },
  },
  {
    id: 'most-excuses',
    title: { en: 'Excuse Champion', no: 'Unnskyldningsmesteren' },
    baseDrinks: 3,
    describe: {
      en: () => `Who always has an excuse ready for being late, tired, busy, or mysteriously unavailable? Vote now. Most votes takes 3 sips.`,
      no: () => `Hvem har alltid en unnskyldning klar for å være sen, sliten, opptatt eller mystisk utilgjengelig? Stem nå. Flest stemmer tar 3 slurker.`,
    },
  },
  {
    id: 'secret-hater',
    title: { en: 'Secret Chore Hater', no: 'Den skjulte oppgavehateren' },
    baseDrinks: 2,
    describe: {
      en: () => `Who clearly hates one specific chore but pretends to be totally chill about it? Most votes drinks 2 sips, then names the chore.`,
      no: () => `Hvem hater helt tydelig én bestemt oppgave, men later som alt er helt greit? Flest stemmer drikker 2 slurker og må så nevne oppgaven.`,
    },
  },
  {
    id: 'best-nagger',
    title: { en: 'Reminder Royalty', no: 'Påminnelsesmesteren' },
    baseDrinks: 2,
    describe: {
      en: () => `Who is most likely to remind everyone else before doing the thing themselves? Most votes hands out 2 sips.`,
      no: () => `Hvem er mest sannsynlig til å minne alle andre på noe før de gjør det selv? Flest stemmer deler ut 2 slurker.`,
    },
  },
  {
    id: 'most-improved',
    title: { en: 'Glow-Up Award', no: 'Glow-up-prisen' },
    baseDrinks: 3,
    describe: {
      en: () => `Who has had the biggest roommate glow-up lately? Vote now. Most votes hands out 3 sips.`,
      no: () => `Hvem har hatt størst glow-up som kollektivboer i det siste? Stem nå. Flest stemmer deler ut 3 slurker.`,
    },
  },
  {
    id: 'least-hygienic',
    title: { en: 'Bathroom Audit', no: 'Badromskontroll' },
    baseDrinks: 2,
    describe: {
      en: () => `Who is least likely to clean the bathroom until the situation feels mildly urgent? Most votes takes 2 sips.`,
      no: () => `Hvem er minst sannsynlig til å vaske badet før situasjonen føles litt for akutt? Flest stemmer tar 2 slurker.`,
    },
  },
  {
    id: 'would-rather',
    title: { en: 'Would You Rather', no: 'Hva ville du heller valgt?' },
    baseDrinks: 1,
    describe: {
      en: () => `Would you rather do dishes every day for a week, or deep-clean the bathroom once? Vote together. The minority drinks 1 sip.`,
      no: () => `Ville du heller tatt oppvasken hver dag i en uke, eller dyprenset badet én gang? Stem samtidig. Minoriteten drikker 1 slurk.`,
    },
  },
  {
    id: 'kitchen-dictator',
    title: { en: 'Kitchen Dictator', no: 'Kjøkkendiktatoren' },
    baseDrinks: 2,
    describe: {
      en: () => `Who would become completely unbearable with full control of the kitchen? Most votes takes 2 sips.`,
      no: () => `Hvem ville blitt helt uutholdelig med full kontroll over kjøkkenet? Flest stemmer tar 2 slurker.`,
    },
  },
  {
    id: 'borrows-forever',
    title: { en: 'Borrowed Forever', no: 'Lånt for lenge siden' },
    baseDrinks: 2,
    describe: {
      en: () => `Who is most likely to borrow something small and somehow keep it for six months? Most votes drinks 2 sips.`,
      no: () => `Hvem er mest sannsynlig til å låne noe lite og på mystisk vis beholde det i seks måneder? Flest stemmer drikker 2 slurker.`,
    },
  },
  {
    id: 'last-beer-crime',
    title: { en: 'Last Beer Crime', no: 'Siste-øl-saken' },
    baseDrinks: 2,
    describe: {
      en: () => `Who would take the last beer from the fridge and still act shocked when confronted? Most votes drinks 2 sips.`,
      no: () => `Hvem ville tatt det siste ølet fra kjøleskapet og likevel spilt overrasket når de ble tatt? Flest stemmer drikker 2 slurker.`,
    },
  },
  {
    id: 'panic-manager',
    title: { en: 'Crisis Manager', no: 'Krisesjefen' },
    baseDrinks: 3,
    describe: {
      en: () => `If the landlord showed up in 10 minutes, who would save the apartment? Most votes hands out 3 sips.`,
      no: () => `Hvis utleier sto i døra om 10 minutter, hvem hadde reddet leiligheten? Flest stemmer deler ut 3 slurker.`,
    },
  },
  {
    id: 'vanish-into-room',
    title: { en: 'Disappear Act', no: 'Forsvinningsnummeret' },
    baseDrinks: 2,
    describe: {
      en: () => `Who is most likely to vanish into their room the second shared responsibilities appear? Most votes drinks 2 sips.`,
      no: () => `Hvem er mest sannsynlig til å forsvinne inn på rommet sitt idet felles ansvar dukker opp? Flest stemmer drikker 2 slurker.`,
    },
  },
  // New prompts
  {
    id: 'group-chat-ghost',
    title: { en: 'Group Chat Ghost', no: 'Gruppechat-spøkelset' },
    baseDrinks: 2,
    describe: {
      en: () => `Who is most likely to read the group chat, react in their head, and never reply? Most votes drinks 2 sips.`,
      no: () => `Hvem er mest sannsynlig til å lese gruppechatten, svare i hodet og aldri faktisk sende noe? Flest stemmer drikker 2 slurker.`,
    },
  },
  {
    id: 'fridge-detective',
    title: { en: 'Fridge Detective', no: 'Kjøleskapsdetektiven' },
    baseDrinks: 2,
    describe: {
      en: () => `Who notices missing food first and starts the investigation immediately? Most votes hands out 2 sips.`,
      no: () => `Hvem merker først at mat mangler og starter etterforskningen umiddelbart? Flest stemmer deler ut 2 slurker.`,
    },
  },
  {
    id: 'midnight-snacker',
    title: { en: 'Midnight Snacker', no: 'Nattmat-eksperten' },
    baseDrinks: 2,
    describe: {
      en: () => `Who is most likely to make a midnight snack and leave just enough evidence behind? Most votes drinks 2 sips.`,
      no: () => `Hvem er mest sannsynlig til å lage nattmat og la igjen akkurat nok spor til å bli tatt? Flest stemmer drikker 2 slurker.`,
    },
  },
  {
    id: 'calendar-captain',
    title: { en: 'Calendar Captain', no: 'Kalenderkapteinen' },
    baseDrinks: 2,
    describe: {
      en: () => `Who would turn even a fun plan into a shared calendar event? Most votes hands out 2 sips.`,
      no: () => `Hvem ville gjort selv en morsom plan om til en delt kalenderhendelse? Flest stemmer deler ut 2 slurker.`,
    },
  },
  {
    id: 'five-minute-fix',
    title: { en: 'Five Minute Fix', no: 'Fem-minutters-redningen' },
    baseDrinks: 3,
    describe: {
      en: () => `If surprise guests arrived in five minutes, who would get the place under control first? Most votes hands out 3 sips.`,
      no: () => `Hvis overraskelsesgjester kom om fem minutter, hvem ville fått kontroll på stedet først? Flest stemmer deler ut 3 slurker.`,
    },
  },
];

export const GUEST_HOT_SEAT_TEMPLATES: HotSeatTemplate[] = [
  // Improved existing prompts
  {
    id: 'guest-best-host',
    title: { en: 'Best Host Energy', no: 'Beste vertsenergi' },
    baseDrinks: 2,
    describe: {
      en: () => `If a random guest had to stay over tonight, who would handle it best? Winner hands out 2 sips.`,
      no: () => `Hvis en tilfeldig gjest måtte sove over i natt, hvem hadde håndtert det best? Vinneren deler ut 2 slurker.`,
    },
  },
  {
    id: 'guest-trip-roomie',
    title: { en: 'Weekend Trip Liability', no: 'Helgetur-risiko' },
    baseDrinks: 2,
    describe: {
      en: () => `Who here would be the biggest liability on a weekend trip? Most votes drinks 2 sips and pleads their case.`,
      no: () => `Hvem her ville vært størst risiko på en helgetur? Flest stemmer drikker 2 slurker og må forsvare seg.`,
    },
  },
  {
    id: 'guest-outsider-award',
    title: { en: 'Outsider Award', no: 'Outsiderprisen' },
    baseDrinks: 2,
    describe: {
      en: () => '',
      no: () => '',
    },
  },
  {
    id: 'guest-house-keys',
    title: { en: 'House Keys Test', no: 'Nøkkeltesten' },
    baseDrinks: 2,
    describe: {
      en: () => '',
      no: () => '',
    },
  },
  {
    id: 'guest-vibe-check',
    title: { en: 'Vibe Check Jury', no: 'Vibe-check-juryen' },
    baseDrinks: 2,
    describe: {
      en: () => `Guests included: who gives the strongest "I know where everything is" energy? Most votes hands out 2 sips.`,
      no: () => `Med gjester i rommet: hvem gir mest "jeg vet hvor alt er"-energi? Flest stemmer deler ut 2 slurker.`,
    },
  },
  {
    id: 'guest-safe-choice',
    title: { en: 'Safe Choice', no: 'Det trygge valget' },
    baseDrinks: 2,
    describe: {
      en: () => `Who would a guest trust most to clean up after the party without turning it into a committee meeting? Most votes hands out 2 sips.`,
      no: () => `Hvem ville en gjest stolt mest på til å rydde opp etter festen uten å gjøre det til et komitémøte? Flest stemmer deler ut 2 slurker.`,
    },
  },
  {
    id: 'guest-bad-influence',
    title: { en: 'Bad Influence', no: 'Dårlig innflytelse' },
    baseDrinks: 2,
    describe: {
      en: () => `Who here would be the first to convince a guest that "one more round" is a great idea? Most votes drinks 2 sips.`,
      no: () => `Hvem her ville vært den første til å overbevise en gjest om at "én runde til" er en glimrende idé? Flest stemmer drikker 2 slurker.`,
    },
  },
  {
    id: 'guest-clean-cut',
    title: { en: 'Most Trustworthy Face', no: 'Mest tillitsvekkende ansikt' },
    baseDrinks: 1,
    describe: {
      en: () => `Guests decide by pure instinct: who has the most trustworthy face at the table? Winner gives out 1 sip each to up to 3 people.`,
      no: () => `Gjester avgjør på ren intuisjon: hvem har det mest tillitsvekkende ansiktet ved bordet? Vinneren deler ut 1 slurk hver til opptil 3 personer.`,
    },
  },
  // New prompts
  {
    id: 'guest-couch-choice',
    title: { en: 'Crash Couch Choice', no: 'Sovesofa-valget' },
    baseDrinks: 2,
    describe: {
      en: () => `If you had to crash on someone's couch tonight, who would you pick first? Winner hands out 2 sips.`,
      no: () => `Hvis du måtte sove på noens sofa i natt, hvem ville du valgt først? Vinneren deler ut 2 slurker.`,
    },
  },
  {
    id: 'guest-party-anchor',
    title: { en: 'Party Anchor', no: 'Festens anker' },
    baseDrinks: 2,
    describe: {
      en: () => `Who would keep the party fun without letting it get messy? Most votes hands out 2 sips.`,
      no: () => `Hvem ville holdt festen morsom uten at den sklir helt ut? Flest stemmer deler ut 2 slurker.`,
    },
  },
  {
    id: 'guest-safe-debrief',
    title: { en: 'Safe Debrief', no: 'Trygg debrief' },
    baseDrinks: 2,
    describe: {
      en: () => `Who feels like the safest person to debrief with after a chaotic night? Most votes hands out 2 sips.`,
      no: () => `Hvem føles som den tryggeste personen å debriefe med etter en kaotisk kveld? Flest stemmer deler ut 2 slurker.`,
    },
  },
  {
    id: 'guest-last-bus',
    title: { en: 'Missed The Last Bus', no: 'Misset siste buss' },
    baseDrinks: 2,
    describe: {
      en: () => `If you missed the last bus home, who here would you call first? Winner hands out 2 sips.`,
      no: () => `Hvis du misset siste buss hjem, hvem her ville du ringt først? Vinneren deler ut 2 slurker.`,
    },
  },
  {
    id: 'guest-main-character',
    title: { en: 'Host Of The Night', no: 'Kveldens vert' },
    baseDrinks: 2,
    describe: {
      en: () => `Who gives the strongest host-of-the-night energy right now? Most votes hands out 2 sips.`,
      no: () => `Hvem gir mest kveldens-vert-energi akkurat nå? Flest stemmer deler ut 2 slurker.`,
    },
  },
];

export const TRIVIA_TWIST_TEMPLATES: TriviaTwistTemplate[] = [
  // Improved existing prompts
  {
    id: 'streak-compare',
    title: { en: 'Streak Showdown', no: 'Streak-duellen' },
    baseDrinks: 2,
    applicable: (ps) => ps.length >= 2,
    describe: { en: () => '', no: () => '' },
  },
  {
    id: 'task-compare',
    title: { en: 'Task Trivia', no: 'Oppgave-trivia' },
    baseDrinks: 2,
    applicable: (ps) => ps.length >= 2,
    describe: { en: () => '', no: () => '' },
  },
  {
    id: 'level-guess',
    title: { en: 'Level Guess', no: 'Nivågjett' },
    baseDrinks: 1,
    applicable: (ps) => ps.length >= 2,
    describe: { en: () => '', no: () => '' },
  },
  {
    id: 'xp-guess',
    title: { en: 'XP Guess', no: 'XP-gjett' },
    baseDrinks: 2,
    applicable: (ps) => ps.length >= 2,
    describe: { en: () => '', no: () => '' },
  },
  {
    id: 'badge-bluff',
    title: { en: 'Badge Bluff', no: 'Merke-bløffen' },
    baseDrinks: 2,
    applicable: (ps) => ps.length >= 2,
    describe: { en: () => '', no: () => '' },
  },
  {
    id: 'rank-order',
    title: { en: 'Rank Race', no: 'Rangeringsløpet' },
    baseDrinks: 2,
    applicable: (ps) => ps.length >= 3,
    describe: { en: () => '', no: () => '' },
  },
  {
    id: 'rank-battle',
    title: { en: 'Rank Battle', no: 'Rangeringsduellen' },
    baseDrinks: 2,
    applicable: (ps) => ps.length >= 2,
    describe: { en: () => '', no: () => '' },
  },
  {
    id: 'achievement-count',
    title: { en: 'Achievement Count', no: 'Prestasjonstelling' },
    baseDrinks: 2,
    applicable: (ps) => ps.some((player) => player.stats.achievementsUnlocked > 0),
    describe: { en: () => '', no: () => '' },
  },
  {
    id: 'xp-lead',
    title: { en: 'XP Lead', no: 'XP-forspranget' },
    baseDrinks: 2,
    applicable: (ps) => ps.length >= 2,
    describe: { en: () => '', no: () => '' },
  },
  {
    id: 'top-spotlight',
    title: { en: 'Top Spot', no: 'Topplassen' },
    baseDrinks: 2,
    applicable: (ps) => ps.length >= 3,
    describe: { en: () => '', no: () => '' },
  },
  // New prompts
  {
    id: 'late-battle',
    title: { en: 'Late Battle', no: 'Forsinkelsesduell' },
    baseDrinks: 2,
    applicable: (ps) => ps.length >= 2,
    describe: { en: () => '', no: () => '' },
  },
  {
    id: 'skip-battle',
    title: { en: 'Skip Battle', no: 'Skip-duell' },
    baseDrinks: 2,
    applicable: (ps) => ps.length >= 2,
    describe: { en: () => '', no: () => '' },
  },
  {
    id: 'badge-count-battle',
    title: { en: 'Badge Count', no: 'Merketelling' },
    baseDrinks: 2,
    applicable: (ps) => ps.length >= 2,
    describe: { en: () => '', no: () => '' },
  },
  {
    id: 'achievement-battle',
    title: { en: 'Achievement Battle', no: 'Prestasjonsduell' },
    baseDrinks: 2,
    applicable: (ps) => ps.length >= 2,
    describe: { en: () => '', no: () => '' },
  },
  {
    id: 'level-top-three',
    title: { en: 'Level Spotlight', no: 'Nivå-spotlight' },
    baseDrinks: 2,
    applicable: (ps) => ps.length >= 3,
    describe: { en: () => '', no: () => '' },
  },
];

export const RANDOM_EVENT_TEMPLATES: RandomEventTemplate[] = [
  // Improved existing prompts
  {
    id: 'waterfall',
    title: { en: 'Waterfall', no: 'Foss' },
    baseDrinks: 1,
    distribute: false,
    describe: {
      en: () => `Waterfall. Start with the youngest player and drink in sequence. You can stop only when the person before you stops.`,
      no: () => `Foss. Start med den yngste spilleren og drikk i rekkefølge. Du kan bare stoppe når personen før deg stopper.`,
    },
  },
  {
    id: 'rule-maker',
    title: { en: 'Rule Maker', no: 'Regelmakeren' },
    baseDrinks: 2,
    distribute: false,
    describe: { en: () => '', no: () => '' },
  },
  {
    id: 'thumb-master',
    title: { en: 'Thumb Master', no: 'Tommelmester' },
    baseDrinks: 1,
    distribute: false,
    describe: { en: () => '', no: () => '' },
  },
  {
    id: 'group-chug',
    title: { en: 'Cheers Together', no: 'Felles skål' },
    baseDrinks: 2,
    distribute: false,
    describe: {
      en: () => `Everyone drinks 2 sips at the same time. No negotiations. Glasses up.`,
      no: () => `Alle drikker 2 slurker samtidig. Ingen forhandlinger. Glassene opp.`,
    },
  },
  {
    id: 'stare-down',
    title: { en: 'Stare Down', no: 'Stirrekonkurranse' },
    baseDrinks: 2,
    distribute: false,
    describe: { en: () => '', no: () => '' },
  },
  {
    id: 'phone-tax',
    title: { en: 'Phone Tax', no: 'Telefonavgift' },
    baseDrinks: 2,
    distribute: false,
    describe: {
      en: () => `Phone check. If you touched your phone in the last five minutes for anything other than this game, drink 2 sips. Honour system.`,
      no: () => `Telefonsjekk. Hvis du har rørt telefonen de siste fem minuttene for noe annet enn dette spillet, drikk 2 slurker. Æresordning.`,
    },
  },
  {
    id: 'categories',
    title: { en: 'Category Sprint', no: 'Kategorisprint' },
    baseDrinks: 1,
    distribute: false,
    describe: { en: () => '', no: () => '' },
  },
  {
    id: 'most-likely',
    title: { en: 'Most Likely To', no: 'Mest sannsynlig til å' },
    baseDrinks: 1,
    distribute: false,
    describe: { en: () => '', no: () => '' },
  },
  {
    id: 'compliment-chain',
    title: { en: 'Compliment Chain', no: 'Komplimentkjeden' },
    baseDrinks: 1,
    distribute: false,
    describe: {
      en: () => `Go around the table. Each person gives the next person one specific compliment. Freeze, repeat yourself, or get mean and drink 1 sip.`,
      no: () => `Gå rundt bordet. Hver person gir den neste ett konkret kompliment. Fryser du, gjentar deg eller blir småslem, drikker du 1 slurk.`,
    },
  },
  {
    id: 'truth-burst',
    title: { en: 'Truth Burst', no: 'Sannhetsglimtet' },
    baseDrinks: 2,
    distribute: false,
    describe: {
      en: () => `Everyone shares one tiny but slightly embarrassing household truth. Refuse and drink 2 sips.`,
      no: () => `Alle deler én liten, men litt pinlig husholdningssannhet. Nekter du, drikker du 2 slurker.`,
    },
  },
  {
    id: 'no-first-names',
    title: { en: 'No First Names', no: 'Ingen fornavn' },
    baseDrinks: 1,
    distribute: false,
    describe: {
      en: () => `Until the next round, nobody is allowed to use first names. Slip up and drink 1 sip.`,
      no: () => `Fram til neste runde er det ikke lov å bruke fornavn. Glipper du, drikker du 1 slurk.`,
    },
  },
  {
    id: 'table-prediction',
    title: { en: 'Table Prediction', no: 'Bordspådommen' },
    baseDrinks: 2,
    distribute: false,
    describe: {
      en: () => `Everyone points to who they think will be the loudest in 20 minutes. The person with the most votes drinks 2 sips now.`,
      no: () => `Alle peker på den de tror kommer til å være høyest om 20 minutter. Personen med flest stemmer drikker 2 slurker nå.`,
    },
  },
  {
    id: 'social-reset',
    title: { en: 'Social Reset', no: 'Sosial reset' },
    baseDrinks: 1,
    distribute: false,
    describe: {
      en: () => `Everybody stand up, clink with two people you haven't talked to enough tonight, then sit back down. Last one done drinks 1 sip.`,
      no: () => `Alle reiser seg, skåler med to personer de ikke har snakket nok med i kveld, og setter seg igjen. Sistemann ferdig drikker 1 slurk.`,
    },
  },
  {
    id: 'mini-roast',
    title: { en: 'Mini Roast', no: 'Mini-roast' },
    baseDrinks: 2,
    distribute: false,
    describe: {
      en: () => `Pick one person for a loving one-line roast. If the room thinks you were too gentle, drink 2 sips.`,
      no: () => `Velg én person som skal få en kjærlig roast på én linje. Hvis resten synes du var for snill, drikker du 2 slurker.`,
    },
  },
  // New prompts
  {
    id: 'one-word-story',
    title: { en: 'One Word Story', no: 'Ettordsfortelling' },
    baseDrinks: 1,
    distribute: false,
    describe: {
      en: () => `Go around the table and build a one-word-at-a-time story about tonight. Break the flow and drink 1 sip.`,
      no: () => `Gå rundt bordet og bygg en ettordsfortelling om kvelden så langt. Ødelegger du flyten, drikker du 1 slurk.`,
    },
  },
  {
    id: 'two-word-toast',
    title: { en: 'Two Word Toast', no: 'To-ords-skål' },
    baseDrinks: 1,
    distribute: false,
    describe: {
      en: () => `Pick someone across the table and toast them with exactly two words. Miss the format and drink 1 sip.`,
      no: () => `Velg noen på andre siden av bordet og skål for dem med nøyaktig to ord. Bommer du på formatet, drikker du 1 slurk.`,
    },
  },
  {
    id: 'seat-swap',
    title: { en: 'Seat Swap', no: 'Bytt plass' },
    baseDrinks: 1,
    distribute: false,
    describe: {
      en: () => `Swap seats with someone you haven't spoken enough with tonight. Last pair to sit down drinks 1 sip each.`,
      no: () => `Bytt plass med noen du ikke har snakket nok med i kveld. Siste par som setter seg drikker 1 slurk hver.`,
    },
  },
  {
    id: 'shared-win',
    title: { en: 'Shared Win', no: 'Felles seier' },
    baseDrinks: 1,
    distribute: false,
    describe: {
      en: () => `Everyone name one small win from this week. Blank mind means 1 sip.`,
      no: () => `Alle nevner én liten seier fra denne uka. Står det stille, blir det 1 slurk.`,
    },
  },
  {
    id: 'hype-person',
    title: { en: 'Hype Person', no: 'Hypepersonen' },
    baseDrinks: 2,
    distribute: false,
    describe: {
      en: () => `Point to tonight's best mood booster. Most votes drinks 2 sips.`,
      no: () => `Pek på kveldens beste stemningsløfter. Flest stemmer drikker 2 slurker.`,
    },
  },
];
