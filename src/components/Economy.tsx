import { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  PiggyBank,
  Plus,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { api, getUserMessage } from '../lib/api';
import { formatAmount, formatDateTime, formatShortDate } from '../lib/ui';
import {
  EmptyState,
  PageHeader,
  PageStack,
  SectionCard,
  StatusMessage,
} from './shared/page';
import type { AppUser, EconomySummary, Expense, PantEntry, SettleUpResponse } from '../lib/types';

interface EconomyProps {
  currentUserName: string;
}

const emptySummary: EconomySummary = {
  expenses: [],
  balances: [],
  pantSummary: {
    currentAmount: 0,
    goalAmount: 1000,
    entries: [],
  },
};

export function Economy({ currentUserName }: EconomyProps) {
  const [summary, setSummary] = useState<EconomySummary>(emptySummary);
  const [collectiveMembers, setCollectiveMembers] = useState<AppUser[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    category: 'Husholdning',
  });
  const [pantForm, setPantForm] = useState({ amount: '' });
  const [expenseError, setExpenseError] = useState('');
  const [settleInfo, setSettleInfo] = useState('');
  const [pantError, setPantError] = useState('');
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);

  const load = async () => {
    const [summaryData, membersData] = await Promise.all([
      api.get<EconomySummary>(`/economy/summary?memberName=${encodeURIComponent(currentUserName)}`),
      api.get<AppUser[]>(`/members/collective?memberName=${encodeURIComponent(currentUserName)}`),
    ]);

    setSummary(summaryData);
    setCollectiveMembers(membersData);
    setSelectedParticipants(membersData.map((member) => member.name));
  };

  useEffect(() => {
    void load();
  }, [currentUserName]);

  const addExpense = async () => {
    const description = expenseForm.description.trim();
    const amount = Number(expenseForm.amount.replace(',', '.'));

    if (!description) {
      setExpenseError('Legg inn en kort beskrivelse av kjøpet.');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setExpenseError('Beløpet må være et gyldig tall større enn 0.');
      return;
    }

    if (selectedParticipants.length === 0) {
      setExpenseError('Velg minst én person som skal være med på delingen.');
      return;
    }

    try {
      await api.post<Expense>('/economy/expenses', {
        description,
        amount: Math.round(amount),
        paidBy: currentUserName,
        category: expenseForm.category,
        date: new Date().toISOString().split('T')[0],
        participantNames: selectedParticipants,
      });

      await load();
      setExpenseForm({ description: '', amount: '', category: 'Husholdning' });
      setExpenseError('');
      setSettleInfo('');
      setIsExpenseDialogOpen(false);
    } catch (error) {
      setExpenseError(getUserMessage(error, 'Kunne ikke lagre kjøpet akkurat nå.'));
    }
  };

  const toggleParticipant = (name: string, checked: boolean) => {
    setExpenseError('');

    if (checked) {
      setSelectedParticipants((previous) => [...new Set([...previous, name])]);
      return;
    }

    setSelectedParticipants((previous) =>
      previous.filter((participant) => participant !== name),
    );
  };

  const settleUp = async () => {
    try {
      const result = await api.post<SettleUpResponse>('/economy/settle-up', {
        memberName: currentUserName,
      });

      await load();
      setSettleInfo(`Oppgjøret ble lagret ${formatDateTime(result.settledAt)}.`);
    } catch (error) {
      setSettleInfo(getUserMessage(error, 'Kunne ikke gjøre opp akkurat nå.'));
    }
  };

  const addPant = async () => {
    const amount = Number(pantForm.amount.replace(',', '.'));

    if (!Number.isFinite(amount) || amount <= 0) {
      setPantError('Skriv inn hvor mye pantingen ga.');
      return;
    }

    try {
      await api.post<PantEntry>('/economy/pant', {
        bottles: 0,
        amount,
        addedBy: currentUserName,
        date: new Date().toISOString().split('T')[0],
      });

      await load();
      setPantForm({ amount: '' });
      setPantError('');
    } catch (error) {
      setPantError(getUserMessage(error, 'Kunne ikke registrere pant akkurat nå.'));
    }
  };

  const myBalance = summary.balances.find((balance) => balance.name === currentUserName)?.amount ?? 0;
  const totalExpenses = summary.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const myContributions = summary.expenses
    .filter((expense) => expense.paidBy === currentUserName)
    .reduce((sum, expense) => sum + expense.amount, 0);
  const myShare = summary.expenses.reduce((sum, expense) => {
    const participantCount = expense.participantNames.length;
    if (participantCount === 0 || expense.paidBy === currentUserName) return sum;
    if (!expense.participantNames.includes(currentUserName)) return sum;
    return sum + expense.amount / participantCount;
  }, 0);

  const pantProgress =
    summary.pantSummary.goalAmount > 0
      ? Math.min(
          100,
          (summary.pantSummary.currentAmount / summary.pantSummary.goalAmount) * 100,
        )
      : 0;

  return (
    <PageStack>
      <PageHeader
        icon={Wallet}
        eyebrow="Felleskasse"
        title="Økonomi"
        description="Følg med på kjøp, fordelinger og pant uten å regne alt ut manuelt."
        action={
          <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Legg til kjøp
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrer et kjøp</DialogTitle>
                <DialogDescription>
                  Skriv inn hva som ble kjøpt og hvem det skal deles mellom.
                </DialogDescription>
              </DialogHeader>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addExpense();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="expense-description">Beskrivelse</Label>
                  <Input
                    id="expense-description"
                    value={expenseForm.description}
                    onChange={(event) => {
                      setExpenseError('');
                      setExpenseForm({ ...expenseForm, description: event.target.value });
                    }}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="expense-amount">Beløp</Label>
                    <Input
                      id="expense-amount"
                      inputMode="decimal"
                      value={expenseForm.amount}
                      onChange={(event) => {
                        setExpenseError('');
                        setExpenseForm({ ...expenseForm, amount: event.target.value });
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expense-category">Kategori</Label>
                    <Input
                      id="expense-category"
                      value={expenseForm.category}
                      onChange={(event) => {
                        setExpenseError('');
                        setExpenseForm({ ...expenseForm, category: event.target.value });
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Deles mellom</Label>
                  <div className="max-h-44 space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    {collectiveMembers.map((member) => {
                      const checked = selectedParticipants.includes(member.name);

                      return (
                        <label
                          key={member.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm shadow-sm"
                        >
                          <span className="flex items-center gap-2">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(state) =>
                                toggleParticipant(member.name, state === true)
                              }
                            />
                            <span>{member.name}</span>
                          </span>
                          <span className={checked ? 'text-emerald-600' : 'text-slate-400'}>
                            {checked ? 'Med' : 'Utenfor'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {expenseError && <StatusMessage tone="rose">{expenseError}</StatusMessage>}

                <Button className="w-full" type="submit">
                  Lagre kjøp
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-900 px-4 py-4 text-white shadow-sm">
            <p className="text-sm text-slate-300">Din saldo</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{formatAmount(myBalance)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-sm text-slate-500">Du har lagt ut</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {formatAmount(myContributions)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
            <p className="text-sm text-slate-500">Din andel</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {formatAmount(myShare)}
            </p>
          </div>
        </div>
      </PageHeader>

      <Tabs defaultValue="expenses" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="expenses">Utgifter</TabsTrigger>
          <TabsTrigger value="balances">Saldoer</TabsTrigger>
          <TabsTrigger value="pant">Pant</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <TrendingUp className="size-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Totalt brukt</p>
                  <p className="text-xl font-semibold tracking-tight text-slate-950">
                    {formatAmount(totalExpenses)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                  <Receipt className="size-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Registrerte kjøp</p>
                  <p className="text-xl font-semibold tracking-tight text-slate-950">
                    {summary.expenses.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <SectionCard
            title="Siste kjøp"
            description="Nyeste registreringer i felleskassen."
          >
            {summary.expenses.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Ingen kjøp registrert"
                description="Når noen legger inn et kjøp, vises det her."
              />
            ) : (
              <div className="space-y-3">
                {summary.expenses.map((expense) => {
                  const participantCount = expense.participantNames.length;
                  const perPerson =
                    participantCount > 0
                      ? Math.round(expense.amount / participantCount)
                      : expense.amount;

                  return (
                    <div
                      key={expense.id}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-slate-950">{expense.description}</p>
                            <Badge variant="outline">{expense.category}</Badge>
                          </div>
                          <p className="text-sm text-slate-600">
                            Betalt av {expense.paidBy} · {formatShortDate(expense.date)}
                          </p>
                          <p className="text-sm text-slate-500">
                            Delt på {participantCount} personer · {formatAmount(perPerson)} per person
                          </p>
                        </div>
                        <p className="text-lg font-semibold tracking-tight text-slate-950">
                          {formatAmount(expense.amount)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="balances" className="mt-4">
          <SectionCard
            title="Saldooversikt"
            description="Positive tall betyr at du skal ha penger tilbake. Negative tall betyr at du skylder."
            action={
              <Button variant="outline" onClick={() => void settleUp()}>
                Gjør opp nå
              </Button>
            }
          >
            {settleInfo && <StatusMessage tone="blue">{settleInfo}</StatusMessage>}

            {summary.balances.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Ingen saldoer å vise"
                description="Når det registreres kjøp, regnes saldoene ut her."
              />
            ) : (
              <div className="space-y-3">
                {[...summary.balances]
                  .sort((left, right) => right.amount - left.amount)
                  .map((balance) => {
                    const isMe = balance.name === currentUserName;
                    const isPositive = balance.amount > 0;

                    return (
                      <div
                        key={balance.name}
                        className={`rounded-2xl border px-4 py-4 shadow-sm ${
                          isMe ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className={`font-medium ${isMe ? 'text-white' : 'text-slate-950'}`}>
                                {balance.name}
                              </p>
                              {isMe && <Badge className="bg-white text-slate-900">Deg</Badge>}
                            </div>
                            <p className={`text-sm ${isMe ? 'text-slate-300' : 'text-slate-500'}`}>
                              {isPositive ? 'Skal motta' : 'Skal betale'}
                            </p>
                          </div>

                          <div
                            className={`flex items-center gap-2 text-lg font-semibold tracking-tight ${
                              isMe ? 'text-white' : isPositive ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {isPositive ? (
                              <ArrowUpRight className="size-5" />
                            ) : (
                              <ArrowDownRight className="size-5" />
                            )}
                            <span>
                              {isPositive ? '+' : ''}
                              {formatAmount(balance.amount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="pant" className="mt-4 space-y-4">
          <SectionCard
            title="Pant til felleskassa"
            description="Hold oversikt over hvor mye dere har spart til noe hyggelig sammen."
          >
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <PiggyBank className="size-5 text-slate-700" />
                    <p className="font-medium text-slate-950">Felles pant</p>
                  </div>
                  <p className="text-sm text-slate-600">
                    {formatAmount(summary.pantSummary.currentAmount)} spart av{' '}
                    {formatAmount(summary.pantSummary.goalAmount)}
                  </p>
                </div>

                <div className="w-full max-w-sm">
                  <Progress value={pantProgress} />
                </div>
              </div>
            </div>

            <form
              className="grid gap-3 sm:grid-cols-[1fr_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                void addPant();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="pant-amount">Beløp</Label>
                <Input
                  id="pant-amount"
                  inputMode="decimal"
                  value={pantForm.amount}
                  onChange={(event) => {
                    setPantError('');
                    setPantForm({ ...pantForm, amount: event.target.value });
                  }}
                />
              </div>

              <div className="flex items-end">
                <Button className="w-full sm:w-auto" type="submit">
                  <Plus className="size-4" />
                  Registrer
                </Button>
              </div>
            </form>

            {pantError && <StatusMessage tone="rose">{pantError}</StatusMessage>}
          </SectionCard>

          <SectionCard
            title="Siste pantinger"
            description="De nyeste bidragene til felleskassa."
          >
            {summary.pantSummary.entries.length === 0 ? (
              <EmptyState
                icon={PiggyBank}
                title="Ingen pant registrert"
                description="Når noen registrerer pant, dukker det opp her."
              />
            ) : (
              <div className="space-y-3">
                {summary.pantSummary.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-slate-950">Pant registrert</p>
                      <p className="text-sm text-slate-600">
                        Registrert av {entry.addedBy} · {formatShortDate(entry.date)}
                      </p>
                    </div>
                    <p className="text-lg font-semibold tracking-tight text-emerald-700">
                      +{formatAmount(entry.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </PageStack>
  );
}
