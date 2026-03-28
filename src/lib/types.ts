export type TaskCategory = 'CLEANING' | 'SHOPPING' | 'OTHER';

export interface Task {
  id: number;
  title: string;
  assignee: string;
  dueDate: string;
  category: TaskCategory;
  completed: boolean;
  xp: number;
  /**
   * Recurrence rule for the task. Examples: 'NONE', 'DAILY', 'WEEKLY', 'MONTHLY', or RFC 5545 RRULE string.
   * If null or 'NONE', the task does not repeat.
   */
  recurrenceRule: string | null;
  assignmentReason?: string; // Optional: why this user was assigned
}

export interface ShoppingItem {
  id: number;
  item: string;
  addedBy: string;
  completed: boolean;
}

export type EventType = 'PARTY' | 'MOVIE' | 'DINNER' | 'OTHER';

export interface CalendarEvent {
  id: number;
  title: string;
  date: string;
  time: string;
  type: EventType;
  organizer: string;
  attendees: number;
  description?: string;
}

export interface Expense {
  id: number;
  description: string;
  amount: number;
  paidBy: string;
  category: string;
  date: string;
  participantNames: string[];
}

export interface Balance {
  name: string;
  amount: number;
}

export interface PantEntry {
  id: number;
  bottles: number;
  amount: number;
  addedBy: string;
  date: string;
}

export interface PantSummary {
  currentAmount: number;
  goalAmount: number;
  entries: PantEntry[];
}

export interface EconomySummary {
  expenses: Expense[];
  balances: Balance[];
  pantSummary: PantSummary;
}

export interface SettleUpResponse {
  collectiveCode: string;
  settledBy: string;
  lastExpenseId: number;
  settledAt: string;
}

export interface LeaderboardPlayer {
  rank: number;
  name: string;
  level: number;
  xp: number;
  tasksCompleted: number;
  streak: number;
  badges: string[];
}

export interface WeeklyStats {
  totalTasks: number;
  totalXp: number;
  avgPerPerson: number;
  topContributor: string;
}

export interface LeaderboardResponse {
  players: LeaderboardPlayer[];
  weeklyStats: WeeklyStats;
}

export interface Achievement {
  id: number;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: number;
  total?: number;
}

export interface DashboardResponse {
  currentUserName: string;
  currentUserXp: number;
  currentUserLevel: number;
  currentUserRank: number;
  upcomingTasks: Task[];
  upcomingEvents: CalendarEvent[];
  recentExpenses: Expense[];
}

export interface DrinkingQuestion {
  text: string;
  type: string;
  targetedPlayer?: string;
}

export type MemberStatus = 'ACTIVE' | 'AWAY' | 'LEFT';

export interface AppUser {
  id: number;
  name: string;
  email: string;
  collectiveCode: string;
  status: MemberStatus;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: AppUser;
}

export interface ChatReaction {
  emoji: string;
  users: string[];
}

export interface ChatPollOption {
  id: number;
  text: string;
  users: string[];
}

export interface ChatPoll {
  question: string;
  options: ChatPollOption[];
}

export interface ChatMessage {
  id: number;
  sender: string;
  text: string;
  imageData?: string | null;
  imageMimeType?: string | null;
  imageFileName?: string | null;
  timestamp: string;
  reactions: ChatReaction[];
  poll?: ChatPoll | null;
}
