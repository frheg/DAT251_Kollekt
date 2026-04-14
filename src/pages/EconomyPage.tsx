import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, Plus, Check, Recycle, ChevronRight, X, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useUser } from '../context/UserContext';
import { formatCurrency, formatDate, translateKey } from '../i18n/helpers';
import { connectCollectiveRealtime } from '../lib/realtime';
import type { EconomySummary, Expense } from '../lib/types';

const EXPENSE_CATEGORIES = ['Groceries', 'Bills', 'Cleaning', 'Entertainment', 'Food', 'Other'];

export default function EconomyPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const [summary, setSummary] = useState<EconomySummary | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('Other');
  const [newSplit, setNewSplit] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);

  const name = currentUser?.name ?? '';

  const fetchSummary = async () => {
    if (!name) return;
    const res = await api.get<EconomySummary>(`/economy/summary?memberName=${encodeURIComponent(name)}`);
    setSummary(res);
    setLoading(false);
  };

  useEffect(() => {
    fetchSummary();
    if (!name) return;
    api.get<{ name: string }[]>(`/members/collective?memberName=${encodeURIComponent(name)}`)
      .then((res) => {
        const names = res.map((m) => m.name);
        setMembers(names);
        setNewSplit(names);
      })
      .catch(() => {});
  }, [name]);

  useEffect(() => {
    if (!name) return;
    const disconnect = connectCollectiveRealtime(name, (event) => {
      if (['EXPENSE_CREATED', 'BALANCES_SETTLED', 'PANT_ADDED'].includes(event.type)) {
        fetchSummary();
      }
    });
    return disconnect;
  }, [name]);

  const toggleSplit = (member: string) =>
    setNewSplit((prev) => prev.includes(member) ? prev.filter((m) => m !== member) : [...prev, member]);

  const handleAddExpense = async () => {
    if (!newTitle.trim() || !newAmount) return;
    await api.post<Expense>('/economy/expenses', {
      description: newTitle,
      amount: Math.round(parseFloat(newAmount)),
      paidBy: name,
      category: newCategory,
      date: new Date().toISOString().split('T')[0],
      participantNames: newSplit.length > 0 ? newSplit : [name],
    });
    setNewTitle(''); setNewAmount(''); setNewCategory('Other'); setNewSplit(members);
    setShowAdd(false);
    fetchSummary();
  };

  const handleSettleAll = async () => {
    setSettling(true);
    try {
      await api.post('/economy/settle-up', { memberName: name });
      fetchSummary();
    } catch {}
    setSettling(false);
  };

  if (loading || !summary) {
    return <div className="space-y-3 pt-4 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="glass rounded-2xl h-20" />)}</div>;
  }

  const myBalance = summary.balances.find((b) => b.name === name);
  const oweAmount = myBalance && myBalance.amount < 0 ? Math.abs(myBalance.amount) : 0;
  const getAmount = myBalance && myBalance.amount > 0 ? myBalance.amount : 0;
  const creditor = summary.balances.find((b) => b.amount > 0 && b.name !== name);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 pt-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">{t('economy.title')}</h2>
        <button onClick={() => setShowAdd(true)} className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center">
          <Plus className="h-5 w-5 text-primary-foreground" />
        </button>
      </div>

      {/* Balance card */}
      <div className="glass rounded-2xl p-4 glow-primary">
        <p className="text-xs text-muted-foreground mb-1">{t('economy.yourBalance')}</p>
        <p className={`font-display text-3xl font-bold ${oweAmount > 0 ? 'text-destructive' : getAmount > 0 ? 'text-primary' : 'text-foreground'}`}>
          {oweAmount > 0 ? `- ${formatCurrency(oweAmount)}` : getAmount > 0 ? `+ ${formatCurrency(getAmount)}` : formatCurrency(0)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {oweAmount > 0 && creditor ? t('economy.owe', { name: creditor.name, amount: formatCurrency(oweAmount) })
          : getAmount > 0 ? t('economy.othersOweYou')
          : `${t('economy.allSettled')} ✅`}
        </p>
        <div className="flex gap-2 mt-3">
          {oweAmount > 0 && (
            <button onClick={handleSettleAll} disabled={settling}
              className="flex-1 gradient-primary rounded-xl py-2.5 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60">
              <Check className="h-4 w-4" /> {t('economy.payAmount', { amount: formatCurrency(oweAmount) })}
            </button>
          )}
          <button onClick={handleSettleAll} disabled={settling}
            className="flex-1 glass rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2">
            {t('economy.settleAll')}
          </button>
        </div>
      </div>

      {/* Add expense form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{t('economy.newExpense')}</p>
                <button onClick={() => setShowAdd(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t('economy.expenseTitlePlaceholder')}
                className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              <input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)}
                placeholder={t('economy.expenseAmountPlaceholder')}
                className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]" />
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]">
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{translateKey('common.expenseCategories', c)}</option>)}
              </select>
              {members.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1"><Users className="h-3 w-3" /> {t('economy.splitWith')}</p>
                  <div className="flex gap-2 flex-wrap">
                    {members.map((m) => (
                      <button key={m} onClick={() => toggleSplit(m)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          newSplit.includes(m) ? 'gradient-primary text-primary-foreground' : 'glass text-muted-foreground'
                        }`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={handleAddExpense} className="w-full gradient-primary rounded-lg py-2 text-sm font-semibold text-primary-foreground">
                {t('economy.addExpense')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pant card */}
      <button onClick={() => navigate('/economy/pant')}
        className="w-full glass rounded-2xl p-4 flex items-center gap-3 hover:scale-[1.01] active:scale-[0.99] transition-transform glow-accent">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent/30 to-accent/5 flex items-center justify-center shrink-0">
          <Recycle className="h-5 w-5 text-foreground" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold">{t('economy.pantTracker')}</p>
          <p className="text-[10px] text-muted-foreground">
            {summary.pantSummary
              ? t('economy.pantTrackerSummary', {
                bottles: summary.pantSummary.entries.reduce((s, e) => s + e.bottles, 0),
                current: formatCurrency(summary.pantSummary.currentAmount),
                goal: formatCurrency(summary.pantSummary.goalAmount),
              })
              : t('economy.pantTrackerEmpty')}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Balances */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('economy.balances')}</h3>
        <div className="grid grid-cols-2 gap-2">
          {summary.balances.map((b) => (
            <motion.div key={b.name} className="glass rounded-xl p-3 flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                {b.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{b.name}</p>
                <p className={`text-sm font-bold ${b.amount >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {b.amount === 0 ? `${t('economy.settled')} ✓` : `${b.amount > 0 ? '+' : '-'} ${formatCurrency(Math.abs(b.amount))}`}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Expense history */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('economy.expenseHistory')}</h3>
        <div className="space-y-2">
          {summary.expenses.map((e, i) => (
            <motion.div key={e.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="glass rounded-xl p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                {e.paidBy === name
                  ? <ArrowUpRight className="h-4 w-4 text-primary" />
                  : <ArrowDownLeft className="h-4 w-4 text-secondary" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{e.description}</p>
                <p className="text-[10px] text-muted-foreground">
                  {e.paidBy} • {formatDate(e.date)} • <span className="text-accent">{translateKey('common.expenseCategories', e.category, e.category)}</span> • {t('economy.splitCount', { count: e.participantNames.length })}
                </p>
              </div>
              <p className="text-sm font-bold">{formatCurrency(e.amount)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
