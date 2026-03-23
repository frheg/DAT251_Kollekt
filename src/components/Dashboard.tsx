import { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Coins,
  Home,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { AnimatedButton } from './ui/AnimatedButton';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { api } from '../lib/api';
import { connectCollectiveRealtime } from '../lib/realtime';
import { type AppView } from '../lib/app';
import { formatAmount, formatShortDate, formatTime } from '../lib/ui';
import { EmptyState, MetricCard, PageHeader, PageStack, SectionCard } from './shared/page';
import type { AppUser, DashboardResponse, EconomySummary, Task } from '../lib/types';

interface DashboardProps {
  onNavigate: (view: AppView) => void;
  currentUserName: string;
}

export function Dashboard({ onNavigate, currentUserName }: DashboardProps) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [members, setMembers] = useState<AppUser[]>([]);
  const [completedTasksCount, setCompletedTasksCount] = useState(0);
  const [myBalance, setMyBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [dashboardData, collectiveMembers, tasks, economySummary] = await Promise.all([
        api.get<DashboardResponse>(`/dashboard?memberName=${encodeURIComponent(currentUserName)}`),
        api.get<AppUser[]>(`/members/collective?memberName=${encodeURIComponent(currentUserName)}`),
        api.get<Task[]>(`/tasks?memberName=${encodeURIComponent(currentUserName)}`),
        api.get<EconomySummary>(`/economy/summary?memberName=${encodeURIComponent(currentUserName)}`),
      ]);

      setData(dashboardData);
      setMembers(collectiveMembers);
      setCompletedTasksCount(tasks.filter((task) => task.completed).length);
      setMyBalance(
        economySummary.balances.find((balance) => balance.name === currentUserName)?.amount ?? 0,
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const disconnect = connectCollectiveRealtime(currentUserName, (event) => {
      if (event.type === 'TASK_UPDATED' || event.type === 'XP_UPDATED') {
        void load();
      }
    });
    return disconnect;
  }, [currentUserName]);

  const currentUser = {
    name: data?.currentUserName ?? currentUserName,
    xp: data?.currentUserXp ?? 0,
    level: data?.currentUserLevel ?? 1,
    rank: data?.currentUserRank ?? 1,
  };

  const progressToNextLevel = ((currentUser.xp % 200) / 200) * 100;
  const upcomingTasks = data?.upcomingTasks ?? [];
  const upcomingEvents = data?.upcomingEvents ?? [];
  const recentExpenses = data?.recentExpenses ?? [];

  return (
    <PageStack>
      <PageHeader
        icon={Home}
        eyebrow="Hjem"
        title={`Hei, ${currentUser.name}`}
        description="Dette er det viktigste som skjer i kollektivet akkurat nå."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-900 px-4 py-4 text-white shadow-sm">
            <p className="text-sm text-slate-300">Poeng</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{currentUser.xp} XP</p>
            <p className="mt-1 text-sm text-slate-300">Nivå {currentUser.level}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
            <p className="text-sm text-slate-500">Plassering</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              #{currentUser.rank}
            </p>
            <p className="mt-1 text-sm text-slate-600">Blant alle i kollektivet</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Neste nivå</p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                  {currentUser.xp % 200}/200 XP
                </p>
              </div>
              <Trophy className="size-5 text-slate-400" />
            </div>
            <Progress className="mt-3" value={progressToNextLevel} />
          </div>
        </div>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          icon={CheckCircle2}
          label="Fullførte oppgaver"
          value={String(completedTasksCount)}
          hint="Se hva som gjenstår"
          tone="emerald"
          onClick={() => onNavigate('tasks')}
        />
        <MetricCard
          icon={Wallet}
          label="Din saldo"
          value={formatAmount(myBalance)}
          hint="Sjekk hvem som skylder hva"
          tone="blue"
          onClick={() => onNavigate('economy')}
        />
        <MetricCard
          icon={Users}
          label="Aktive medlemmer"
          value={String(members.length)}
          hint="Hold alle oppdatert"
          tone="amber"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Kommende oppgaver"
          description="Oppgaver som snart må gjøres."
          action={
            <AnimatedButton onClick={() => onNavigate('tasks')}>
              Se alle
            </AnimatedButton>
          }
        >
          {upcomingTasks.length === 0 && !loading ? (
            <EmptyState
              icon={CheckCircle2}
              title="Ingen oppgaver på vei inn"
              description="Når noen legger til en oppgave, vises den her."
            />
          ) : (
            <div className="space-y-3">
              {upcomingTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-slate-950">{task.title}</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      <Badge variant="secondary">{task.assignee}</Badge>
                      <span>{formatShortDate(task.dueDate)}</span>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-slate-500">+{task.xp} XP</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Nærmeste planer"
          description="Det som ligger først i kalenderen."
          action={
            <AnimatedButton onClick={() => onNavigate('calendar')}>
              Åpne kalender
            </AnimatedButton>
          }
        >
          {upcomingEvents.length === 0 && !loading ? (
            <EmptyState
              icon={Calendar}
              title="Ingen planer enda"
              description="Legg inn neste filmkveld, middag eller husmøte."
            />
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-950">{event.title}</p>
                      <p className="text-sm text-slate-600">
                        {formatShortDate(event.date)} kl. {formatTime(event.time)}
                      </p>
                    </div>
                    <Calendar className="size-5 text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Siste felleskjøp"
          description="Nylig registrerte utgifter."
          action={
            <AnimatedButton onClick={() => onNavigate('economy')}>
              Se økonomi
            </AnimatedButton>
          }
        >
          {recentExpenses.length === 0 && !loading ? (
            <EmptyState
              icon={Coins}
              title="Ingen utgifter registrert"
              description="Når noen legger inn et kjøp, vises det her."
            />
          ) : (
            <div className="space-y-3">
              {recentExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-slate-950">{expense.description}</p>
                    <p className="text-sm text-slate-600">Betalt av {expense.paidBy}</p>
                  </div>
                  <div className="text-base font-semibold text-slate-950">
                    {formatAmount(expense.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Hvem bor her?" description="Medlemmer i kollektivet akkurat nå.">
          {members.length === 0 && !loading ? (
            <EmptyState
              icon={Users}
              title="Ingen medlemmer enda"
              description="Inviter resten av kollektivet med koden deres."
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {members.map((member) => (
                <Badge key={member.id} variant="secondary" className="px-3 py-1.5">
                  {member.name}
                </Badge>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </PageStack>
  );
}
