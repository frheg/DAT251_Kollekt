import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Receipt, 
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

interface Expense {
  id: number;
  description: string;
  amount: number;
  paidBy: string;
  category: string;
  date: string;
  splitBetween: number;
}

interface Balance {
  name: string;
  amount: number;
}

export function Economy() {
  const [expenses, setExpenses] = useState<Expense[]>([
    { id: 1, description: 'Dopapir & kluter', amount: 156, paidBy: 'Fredric', category: 'Husholdning', date: '2026-02-03', splitBetween: 8 },
    { id: 2, description: 'Pizza til filmkveld', amount: 320, paidBy: 'Kasper', category: 'Mat', date: '2026-02-02', splitBetween: 5 },
    { id: 3, description: 'Oppvaskmiddel & rengjøring', amount: 245, paidBy: 'Emma', category: 'Husholdning', date: '2026-02-01', splitBetween: 8 },
    { id: 4, description: 'Kaffe til fellesskap', amount: 189, paidBy: 'Lars', category: 'Mat', date: '2026-01-30', splitBetween: 8 },
  ]);

  const [balances] = useState<Balance[]>([
    { name: 'Kasper', amount: -85 },
    { name: 'Fredric', amount: 120 },
    { name: 'Emma', amount: 95 },
    { name: 'Lars', amount: 45 },
    { name: 'Sofia', amount: -40 },
    { name: 'Marcus', amount: -60 },
    { name: 'Lina', amount: -35 },
    { name: 'Erik', amount: -40 },
  ]);

  const [pantFund, setPantFund] = useState(450);
  const [pantGoal] = useState(1000);

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const myShare = expenses.reduce((sum, exp) => {
    if (exp.paidBy === 'Kasper') return sum;
    return sum + (exp.amount / exp.splitBetween);
  }, 0);
  const myContributions = expenses
    .filter(exp => exp.paidBy === 'Kasper')
    .reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white mb-1">Økonomi</h2>
            <p className="text-green-100 text-sm">Din saldo</p>
          </div>
          <div className="text-right">
            <p className="text-4xl">-85 kr</p>
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
          {/* Add Expense Button */}
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
                  <Input placeholder="F.eks. Dopapir" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Beløp (kr)</Label>
                    <Input type="number" placeholder="0" />
                  </div>
                  <div>
                    <Label>Kategori</Label>
                    <Input placeholder="Husholdning" />
                  </div>
                </div>
                <div>
                  <Label>Split mellom</Label>
                  <Input type="number" placeholder="8" defaultValue="8" />
                </div>
                <div>
                  <Label>Kvittering (valgfri)</Label>
                  <Button variant="outline" className="w-full">
                    <Receipt className="w-4 h-4 mr-2" />
                    Last opp bilde
                  </Button>
                </div>
                <Button className="w-full bg-gradient-to-r from-green-500 to-emerald-500">
                  Legg til utgift
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Summary Stats */}
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
                  <p className="text-xl">{expenses.length}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Expenses List */}
          <Card className="p-6 bg-white/80 backdrop-blur">
            <h3 className="mb-4">Siste utgifter</h3>
            <div className="space-y-3">
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200 hover:border-green-300 transition-all"
                >
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
                        Split mellom {expense.splitBetween} personer ({Math.round(expense.amount / expense.splitBetween)} kr/person)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl">{expense.amount} kr</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="balances" className="space-y-4 mt-4">
          <Card className="p-6 bg-white/80 backdrop-blur">
            <h3 className="mb-4">Saldooversikt</h3>
            <p className="text-sm text-gray-600 mb-4">
              Positive tall = får tilbake • Negative tall = skal betale
            </p>
            <div className="space-y-2">
              {balances
                .sort((a, b) => b.amount - a.amount)
                .map((balance, index) => {
                  const isMe = balance.name === 'Kasper';
                  const isPositive = balance.amount > 0;
                  
                  return (
                    <div
                      key={balance.name}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        isMe 
                          ? 'bg-blue-50 border-blue-300' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                            isPositive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                          }`}>
                            #{index + 1}
                          </div>
                          <div>
                            <p className={isMe ? '' : ''}>{balance.name}</p>
                            {isMe && <Badge variant="secondary" className="text-xs mt-1">Deg</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isPositive ? (
                            <ArrowUpRight className="w-5 h-5 text-green-600" />
                          ) : (
                            <ArrowDownRight className="w-5 h-5 text-red-600" />
                          )}
                          <span className={`text-xl ${
                            isPositive ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {isPositive ? '+' : ''}{balance.amount} kr
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>

          {/* Settlement Suggestions */}
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200">
            <h3 className="mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Forslag til oppgjør
            </h3>
            <div className="space-y-2 text-sm">
              <p>• Kasper sender 85 kr til Fredric</p>
              <p>• Sofia sender 40 kr til Emma</p>
              <p>• Marcus sender 55 kr til Emma</p>
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
                <span>Spart: {pantFund} kr</span>
                <span>Mål: {pantGoal} kr</span>
              </div>
              <div className="h-3 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full transition-all"
                  style={{ width: `${(pantFund / pantGoal) * 100}%` }}
                />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white/80 backdrop-blur">
            <h3 className="mb-4">Registrer pant</h3>
            <div className="space-y-3">
              <div>
                <Label>Antall flasker/bokser</Label>
                <Input type="number" placeholder="0" />
              </div>
              <div>
                <Label>Beløp (kr)</Label>
                <Input type="number" placeholder="0" />
              </div>
              <Button className="w-full bg-gradient-to-r from-orange-500 to-amber-500">
                <Plus className="w-4 h-4 mr-2" />
                Legg til i felleskatten
              </Button>
            </div>
          </Card>

          <Card className="p-6 bg-white/80 backdrop-blur">
            <h3 className="mb-4">Siste pant-registreringer</h3>
            <div className="space-y-2">
              <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                <div>
                  <p>15 flasker</p>
                  <p className="text-sm text-gray-600">Fredric • 3. feb</p>
                </div>
                <span className="text-green-600">+45 kr</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                <div>
                  <p>22 flasker</p>
                  <p className="text-sm text-gray-600">Emma • 1. feb</p>
                </div>
                <span className="text-green-600">+66 kr</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                <div>
                  <p>8 flasker</p>
                  <p className="text-sm text-gray-600">Kasper • 30. jan</p>
                </div>
                <span className="text-green-600">+24 kr</span>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
