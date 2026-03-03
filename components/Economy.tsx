import { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Wallet, TrendingUp, Plus, Receipt, PiggyBank, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { api } from '../lib/api';
import type { AppUser, EconomySummary, Expense, PantEntry, SettleUpResponse } from '../lib/types';

interface EconomyProps {
  currentUserName: string;
}

export function Economy({ currentUserName }: EconomyProps) {
  const [summary, setSummary] = useState<EconomySummary>({ expenses: [], balances: [], pantSummary: { currentAmount: 0, goalAmount: 1000, entries: [] } });
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '', category: 'Husholdning' });
  const [pantForm, setPantForm] = useState({ bottles: '', amount: '' });
  const [expenseError, setExpenseError] = useState('');
  const [settleInfo, setSettleInfo] = useState('');
  const [collectiveMembers, setCollectiveMembers] = useState<AppUser[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      const [summaryData, membersData] = await Promise.all([
        api.get<EconomySummary>(`/economy/summary?memberName=${encodeURIComponent(currentUserName)}`),
        api.get<AppUser[]>(`/members/collective?memberName=${encodeURIComponent(currentUserName)}`),
      ]);
      setSummary(summaryData);
      setCollectiveMembers(membersData);
      setSelectedParticipants(membersData.map((member) => member.name));
    };
    load();
  }, [currentUserName]);

  const addExpense = async () => {
    const description = expenseForm.description.trim();
    const normalizedAmount = expenseForm.amount.replace(',', '.');
    const amount = Number(normalizedAmount);

    if (!description) {
      setExpenseError('Beskrivelse mangler.');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setExpenseError('Beløp må være et gyldig tall større enn 0.');
      return;
    }
    if (selectedParticipants.length === 0) {
      setExpenseError('Velg minst ett medlem å splitte utgiften mellom.');
      return;
    }

    try {
      setExpenseError('');
      setSettleInfo('');
      const created = await api.post<Expense>('/economy/expenses', {
        description,
        amount: Math.round(amount),
        paidBy: currentUserName,
        category: expenseForm.category,
        date: new Date().toISOString().split('T')[0],
        participantNames: selectedParticipants,
      });

      setSummary({ ...summary, expenses: [created, ...summary.expenses] });
      setExpenseForm({ description: '', amount: '', category: 'Husholdning' });
    } catch (error) {
      setExpenseError(error instanceof Error ? error.message : 'Kunne ikke lagre utgift.');
    }
  };

  const toggleParticipant = (name: string, checked: boolean) => {
    setExpenseError('');
    if (checked) {
      setSelectedParticipants(prev => [...new Set([...prev, name])]);
      return;
    }
    setSelectedParticipants(prev => prev.filter(participant => participant !== name));
  };

  const settleUp = async () => {
    try {
      const result = await api.post<SettleUpResponse>('/economy/settle-up', { memberName: currentUserName });
      const refreshed = await api.get<EconomySummary>(`/economy/summary?memberName=${encodeURIComponent(currentUserName)}`);
      setSummary(refreshed);
      setSettleInfo(`Gjort opp ${new Date(result.settledAt).toLocaleString('nb-NO')}. Historikken er beholdt.`);
    } catch (error) {
      setSettleInfo(error instanceof Error ? error.message : 'Kunne ikke gjøre opp nå.');
    }
  };

  const addPant = async () => {
    if (!pantForm.bottles || !pantForm.amount) return;

    const created = await api.post<PantEntry>('/economy/pant', {
      bottles: Number(pantForm.bottles),
      amount: Number(pantForm.amount),
      addedBy: currentUserName,
      date: new Date().toISOString().split('T')[0],
    });

    setSummary({
      ...summary,
      pantSummary: {
        ...summary.pantSummary,
        currentAmount: summary.pantSummary.currentAmount + created.amount,
        entries: [created, ...summary.pantSummary.entries],
      },
    });
    setPantForm({ bottles: '', amount: '' });
  };

  const myBalance = summary.balances.find(b => b.name === currentUserName)?.amount ?? 0;
  const totalExpenses = summary.expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const myContributions = summary.expenses.filter(exp => exp.paidBy === currentUserName).reduce((sum, exp) => sum + exp.amount, 0);
  const myShare = summary.expenses.reduce((sum, exp) => {
    const participantCount = exp.participantNames.length;
    if (participantCount === 0 || exp.paidBy === currentUserName) return sum;
    if (!exp.participantNames.includes(currentUserName)) return sum;
    return sum + exp.amount / participantCount;
  }, 0);

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white mb-1">Økonomi</h2>
            <p className="text-green-100 text-sm">Din saldo</p>
          </div>
          <div className="text-right">
            <p className="text-4xl">{myBalance} kr</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-white/20 rounded-lg p-3">
            <p className="text-sm text-green-100">Betalt</p>
            <p className="text-xl text-white">{myContributions} kr</p>
          </div>
          <div className="bg-white/20 rounded-lg p-3">
            <p className="text-sm text-green-100">Skyldig</p>
            <p className="text-xl text-white">{Math.round(myShare)} kr</p>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="expenses" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white/80 backdrop-blur">
          <TabsTrigger value="expenses">Utgifter</TabsTrigger>
          <TabsTrigger value="balances">Saldoer</TabsTrigger>
          <TabsTrigger value="pant">Pant</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-4 mt-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-500">
                <Plus className="w-4 h-4 mr-2" />
                Legg til utgift
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrer ny utgift</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Beskrivelse</Label>
                  <Input value={expenseForm.description} onChange={e => {
                    setExpenseError('');
                    setExpenseForm({ ...expenseForm, description: e.target.value });
                  }} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Beløp (kr)</Label>
                    <Input type="number" value={expenseForm.amount} onChange={e => {
                      setExpenseError('');
                      setExpenseForm({ ...expenseForm, amount: e.target.value });
                    }} />
                  </div>
                  <div>
                    <Label>Kategori</Label>
                    <Input value={expenseForm.category} onChange={e => {
                      setExpenseError('');
                      setExpenseForm({ ...expenseForm, category: e.target.value });
                    }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Deles mellom</Label>
                  <div className="max-h-40 overflow-auto rounded-md border p-3 space-y-2">
                    {collectiveMembers.map(member => {
                      const checked = selectedParticipants.includes(member.name);
                      return (
                        <label key={member.id} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={checked} onCheckedChange={(state) => toggleParticipant(member.name, state === true)} />
                          <span>{member.name}</span>
                          <span className={checked ? 'text-green-600' : 'text-gray-400'}>
                            {checked ? 'inkludert' : 'ekskludert'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                {expenseError && <p className="text-sm text-red-600">{expenseError}</p>}
                <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-500" onClick={() => void addExpense()}>
                  Legg til utgift
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 bg-white/80 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Totalt brukt</p>
                  <p className="text-xl">{totalExpenses} kr</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-white/80 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Receipt className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Antall utgifter</p>
                  <p className="text-xl">{summary.expenses.length}</p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-6 bg-white/80 backdrop-blur">
            <h3 className="mb-4">Siste utgifter</h3>
            <div className="space-y-3">
              {summary.expenses.map(expense => {
                const participantCount = expense.participantNames.length;
                const perPerson = participantCount > 0 ? Math.round(expense.amount / participantCount) : expense.amount;
                return (
                <div key={expense.id} className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200 hover:border-green-300 transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4>{expense.description}</h4>
                        <Badge variant="outline" className="text-xs">
                          {expense.category}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>Betalt av {expense.paidBy}</span>
                        <span>•</span>
                        <span>{new Date(expense.date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Split mellom {participantCount} personer ({perPerson} kr/person)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl">{expense.amount} kr</p>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="balances" className="space-y-4 mt-4">
          <Card className="p-6 bg-white/80 backdrop-blur">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3>Saldooversikt</h3>
              <Button variant="outline" onClick={() => void settleUp()}>
                Gjør opp
              </Button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Positive tall = får tilbake • Negative tall = skal betale</p>
            {settleInfo && <p className="text-sm text-gray-600 mb-4">{settleInfo}</p>}
            <div className="space-y-2">
              {[...summary.balances].sort((a, b) => b.amount - a.amount).map((balance, index) => {
                const isMe = balance.name === currentUserName;
                const isPositive = balance.amount > 0;

                return (
                  <div key={balance.name} className={`p-4 rounded-lg border-2 transition-all ${isMe ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${isPositive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          #{index + 1}
                        </div>
                        <div>
                          <p>{balance.name}</p>
                          {isMe && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              Deg
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPositive ? <ArrowUpRight className="w-5 h-5 text-green-600" /> : <ArrowDownRight className="w-5 h-5 text-red-600" />}
                        <span className={`text-xl ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {isPositive ? '+' : ''}
                          {balance.amount} kr
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="pant" className="space-y-4 mt-4">
          <Card className="p-6 bg-gradient-to-r from-orange-500 to-amber-500 text-white border-0">
            <div className="flex items-center gap-3 mb-4">
              <PiggyBank className="w-8 h-8" />
              <div>
                <h3 className="text-white">Felles pantepenger</h3>
                <p className="text-orange-100 text-sm">Sparer til fellesmiddag</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Spart: {summary.pantSummary.currentAmount} kr</span>
                <span>Mål: {summary.pantSummary.goalAmount} kr</span>
              </div>
              <div className="h-3 bg-white/30 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all" style={{ width: `${(summary.pantSummary.currentAmount / summary.pantSummary.goalAmount) * 100}%` }} />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white/80 backdrop-blur">
            <h3 className="mb-4">Registrer pant</h3>
            <div className="space-y-3">
              <div>
                <Label>Antall flasker/bokser</Label>
                <Input type="number" value={pantForm.bottles} onChange={e => setPantForm({ ...pantForm, bottles: e.target.value })} />
              </div>
              <div>
                <Label>Beløp (kr)</Label>
                <Input type="number" value={pantForm.amount} onChange={e => setPantForm({ ...pantForm, amount: e.target.value })} />
              </div>
              <Button className="w-full bg-gradient-to-r from-orange-500 to-amber-500" onClick={() => void addPant()}>
                <Plus className="w-4 h-4 mr-2" />
                Legg til i felleskatten
              </Button>
            </div>
          </Card>

          <Card className="p-6 bg-white/80 backdrop-blur">
            <h3 className="mb-4">Siste pant-registreringer</h3>
            <div className="space-y-2">
              {summary.pantSummary.entries.map(entry => (
                <div key={entry.id} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                  <div>
                    <p>{entry.bottles} flasker</p>
                    <p className="text-sm text-gray-600">
                      {entry.addedBy} • {new Date(entry.date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className="text-green-600">+{entry.amount} kr</span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
