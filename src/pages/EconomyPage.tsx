import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ArrowDownLeft, Plus, Check, Recycle, ChevronRight, X, Users, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useUser } from '../context/UserContext';
import { formatCurrency, formatDate, translateKey } from '../i18n/helpers';
import { connectCollectiveRealtime } from '../lib/realtime';
import type { EconomySummary, Expense, PayOption } from '../lib/types';

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
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [newDeadline, setNewDeadline] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('Other');
  const [deletingExpenseId, setDeletingExpenseId] = useState<number | null>(null);
  const [payOptions, setPayOptions] = useState<PayOption[]>([]);
  const [selectedCreditorName, setSelectedCreditorName] = useState('');

  const name = currentUser?.name ?? '';

  const fetchSummary = async () => {
    if (!name) return;
    const [res, payOptionsRes] = await Promise.all([
      api.get<EconomySummary>(`/economy/summary?memberName=${encodeURIComponent(name)}`),
      api.get<PayOption[]>(`/economy/pay-options?memberName=${encodeURIComponent(name)}`),
    ]);
    setSummary(res);
    setPayOptions(payOptionsRes);
    setSelectedCreditorName((prev) => {
      if (payOptionsRes.length === 0) return '';
      return payOptionsRes.some((option) => option.name === prev) ? prev : payOptionsRes[0].name;
    });
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
      if (['EXPENSE_CREATED', 'EXPENSE_UPDATED', 'EXPENSE_DELETED', 'BALANCES_SETTLED', 'PANT_ADDED'].includes(event.type)) {
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
      ...(newDeadline ? { deadlineDate: newDeadline } : {}),
    });
    setNewTitle(''); setNewAmount(''); setNewCategory('Other'); setNewSplit(members); setNewDeadline('');
    setShowAdd(false);
    fetchSummary();
  };

  const startEdit = (expense: Expense) => {
    setEditingExpenseId(expense.id);
    setEditTitle(expense.description);
    setEditAmount(String(expense.amount));
    setEditCategory(expense.category);
    setDeletingExpenseId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingExpenseId || !editTitle.trim() || !editAmount) return;
    await api.patch(`/economy/expenses/${editingExpenseId}`, {
      description: editTitle,
      amount: Math.round(parseFloat(editAmount)),
      category: editCategory,
    });
    setEditingExpenseId(null);
    fetchSummary();
  };

  const handleDeleteExpense = async (id: number) => {
    await api.delete(`/economy/expenses/${id}`);
    setDeletingExpenseId(null);
    fetchSummary();
  };

  const handleSettleAll = async () => {
    if (payOptions.length === 0) return;
    setSettling(true);
    try {
      for (const option of payOptions) {
        await api.post('/economy/settle-with', { creditorName: option.name });
      }
      fetchSummary();
    } catch {}
    setSettling(false);
  };

  const handlePayCreditor = async () => {
    if (!selectedPayOption) return;
    setSettling(true);
    try {
      await api.post('/economy/settle-with', { creditorName: selectedPayOption.name });
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
  const fallbackCreditor = summary.balances.find((b) => b.amount > 0 && b.name !== name);
  const selectedPayOption = payOptions.find((option) => option.name === selectedCreditorName) ?? payOptions[0];
  const hasPayOptions = payOptions.length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 pt-4">
      <div className="flex items-center justify-end">
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
          {hasPayOptions && selectedPayOption ? t('economy.owe', { name: selectedPayOption.name, amount: formatCurrency(selectedPayOption.amount) })
          : oweAmount > 0 && fallbackCreditor ? t('economy.owe', { name: fallbackCreditor.name, amount: formatCurrency(oweAmount) })
          : getAmount > 0 ? t('economy.othersOweYou')
          : `${t('economy.allSettled')} ✅`}
        </p>
        {hasPayOptions && selectedPayOption && (
          <div className="mt-4 space-y-2.5">
            {payOptions.length > 1 && (
              <select
                value={selectedPayOption.name}
                onChange={(e) => setSelectedCreditorName(e.target.value)}
                className="w-full glass rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
                aria-label={t('economy.payPersonLabel')}
              >
                {payOptions.map((option) => (
                  <option key={option.name} value={option.name}>
                    {option.name} ({formatCurrency(option.amount)})
                  </option>
                ))}
              </select>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button onClick={handlePayCreditor} disabled={settling || !selectedPayOption}
                className="w-full gradient-primary rounded-xl py-2.5 px-3 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60">
                <Check className="h-4 w-4" /> {t('economy.payAmountTo', { name: selectedPayOption.name, amount: formatCurrency(selectedPayOption.amount) })}
              </button>
              <button onClick={handleSettleAll} disabled={settling || payOptions.length === 0}
                className="w-full glass rounded-xl py-2.5 px-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
                {t('economy.settleAll')}
              </button>
            </div>
          </div>
        )}
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
              <input
                type="date"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
                aria-label={t('economy.deadlineDateLabel')}
                placeholder={t('economy.deadlineDateLabel')}
              />
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
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-muted-foreground">{t('economy.expenseHistory')}</h3>
          {summary.expenses.length > 2 && (
            <button onClick={() => setShowAllExpenses((v) => !v)} className="text-xs text-primary font-medium">
              {showAllExpenses ? t('common.showLess') : t('common.seeAll')}
            </button>
          )}
        </div>
        <div className="space-y-2">
          {(showAllExpenses ? summary.expenses : summary.expenses.slice(0, 2)).map((e, i) => (
            <div key={e.id}>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
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
                  {e.deadlineDate && (
                    <p className="text-[10px] text-destructive font-medium mt-0.5">
                      {t('economy.deadlineBadge', { date: formatDate(e.deadlineDate) })}
                    </p>
                  )}
                </div>
                {e.paidBy === name ? (
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-sm font-bold">{formatCurrency(e.amount)}</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEdit(e)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {deletingExpenseId === e.id ? (
                        <>
                          <button onClick={() => handleDeleteExpense(e.id)} className="text-destructive hover:text-destructive/80 transition-colors">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeletingExpenseId(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => { setDeletingExpenseId(e.id); setEditingExpenseId(null); }} className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm font-bold shrink-0">{formatCurrency(e.amount)}</p>
                )}
              </motion.div>
              <AnimatePresence>
                {editingExpenseId === e.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="glass rounded-xl p-3 mt-1 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">{t('economy.editExpense')}</p>
                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                        placeholder={t('economy.expenseTitlePlaceholder')}
                        className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      <input type="number" value={editAmount} onChange={(ev) => setEditAmount(ev.target.value)}
                        placeholder={t('economy.expenseAmountPlaceholder')}
                        className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]" />
                      <select value={editCategory} onChange={(ev) => setEditCategory(ev.target.value)}
                        className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]">
                        {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{translateKey('common.expenseCategories', c)}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button onClick={handleSaveEdit} className="flex-1 gradient-primary rounded-lg py-2 text-sm font-semibold text-primary-foreground">
                          {t('economy.saveChanges')}
                        </button>
                        <button onClick={() => setEditingExpenseId(null)} className="flex-1 glass rounded-lg py-2 text-sm font-medium">
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
