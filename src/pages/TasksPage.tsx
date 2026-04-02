import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Circle, Plus, Package, ChevronRight, ArrowLeft, X,
  ShoppingCart, Edit3, Trash2, MessageSquare, Clock, RotateCcw, Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import { useUser } from '../context/UserContext';
import { connectCollectiveRealtime } from '../lib/realtime';
import type { Task, ShoppingItem, TaskCategory } from '../lib/types';

const CATEGORIES: TaskCategory[] = ['CLEANING', 'SHOPPING', 'OTHER'];
const RECURRENCE_OPTIONS = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'];

// ── Tasks main view ─────────────────────────────────────
function TasksMain({ onNavigateRestock }: { onNavigateRestock: () => void }) {
  const { currentUser } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [filter, setFilter] = useState('All');
  const [tab, setTab] = useState<'tasks' | 'shopping'>('tasks');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newDue, setNewDue] = useState('');
  const [newCategory, setNewCategory] = useState<TaskCategory>('CLEANING');
  const [newXp, setNewXp] = useState('10');
  const [newRecurrence, setNewRecurrence] = useState('NONE');
  const [newShopItem, setNewShopItem] = useState('');
  const [commentingId, setCommentingId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);

  const name = currentUser?.name ?? '';

  const fetchAll = async () => {
    if (!name) return;
    const [taskRes, shopRes] = await Promise.all([
      api.get<Task[]>(`/tasks?memberName=${encodeURIComponent(name)}`),
      api.get<ShoppingItem[]>(`/tasks/shopping?memberName=${encodeURIComponent(name)}`),
    ]);
    setTasks(taskRes);
    setShopping(shopRes);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
    if (!name) return;
    api.get<{ name: string }[]>(`/members/collective?memberName=${encodeURIComponent(name)}`)
      .then((res) => setMembers(res.map((m) => m.name)))
      .catch(() => {});
  }, [name]);

  useEffect(() => {
    if (!name) return;
    const disconnect = connectCollectiveRealtime(name, (event) => {
      if (['TASK_UPDATED', 'TASK_CREATED', 'TASK_DELETED', 'SHOPPING_UPDATED'].includes(event.type)) {
        fetchAll();
      }
    });
    return disconnect;
  }, [name]);

  const toggleTask = async (taskId: number) => {
    await api.patch(`/tasks/${taskId}/toggle?memberName=${encodeURIComponent(name)}`);
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, completed: !t.completed } : t));
  };

  const isOverdueTask = (task: Task) => {
    const today = new Date().toISOString().split('T')[0];
    return !task.completed && task.dueDate < today;
  };

  const handlePrimaryToggle = async (task: Task) => {
    if (task.completed) {
      await toggleTask(task.id);
      return;
    }

    if (isOverdueTask(task)) {
      if ((task.penaltyXp ?? 0) < 0) {
        await completeMissedTask(task.id);
      } else {
        await markLate(task.id);
      }
      return;
    }

    await toggleTask(task.id);
  };

  const markLate = async (taskId: number) => {
    await api.post(`/tasks/${taskId}/regret?memberName=${encodeURIComponent(name)}`, {});
    fetchAll();
  };

  const completeMissedTask = async (taskId: number) => {
    await api.post(`/tasks/${taskId}/regret-missed?memberName=${encodeURIComponent(name)}`, {});
    fetchAll();
  };

  const deleteTask = async (taskId: number) => {
    await api.delete(`/tasks/${taskId}?memberName=${encodeURIComponent(name)}`);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const startEdit = (task: Task) => {
    setEditingId(task.id);
    setNewTitle(task.title);
    setNewAssignee(task.assignee);
    setNewDue(task.dueDate);
    setNewCategory(task.category);
    setNewXp(task.xp.toString());
    setNewRecurrence(task.recurrenceRule ?? 'NONE');
    setShowAdd(true);
  };

  const resetForm = () => {
    setNewTitle(''); setNewAssignee(name); setNewDue('');
    setNewCategory('CLEANING'); setNewXp('10'); setNewRecurrence('NONE');
    setShowAdd(false); setEditingId(null);
  };

  const handleSave = async () => {
    if (!newTitle.trim()) return;
    const body = {
      title: newTitle,
      assignee: newAssignee || name,
      dueDate: newDue || new Date().toISOString().split('T')[0],
      category: newCategory,
      xp: parseInt(newXp) || 10,
      recurrenceRule: newRecurrence === 'NONE' ? null : newRecurrence,
    };
    if (editingId) {
      await api.patch(`/tasks/${editingId}?memberName=${encodeURIComponent(name)}`, body);
      setTasks((prev) => prev.map((t) => t.id === editingId ? { ...t, ...body } : t));
    } else {
      const created = await api.post<Task>('/tasks', body);
      setTasks((prev) => [...prev, created]);
    }
    resetForm();
  };

  const addFeedback = async (taskId: number) => {
    if (!commentText.trim()) return;
    await api.patch(`/tasks/${taskId}/feedback?memberName=${encodeURIComponent(name)}`, { feedback: commentText });
    setCommentText('');
    setCommentingId(null);
  };

  const toggleShopItem = async (itemId: number) => {
    await api.patch(`/tasks/shopping/${itemId}/toggle?memberName=${encodeURIComponent(name)}`);
    setShopping((prev) => prev.map((s) => s.id === itemId ? { ...s, completed: !s.completed } : s));
  };

  const deleteShopItem = async (itemId: number) => {
    await api.delete(`/tasks/shopping/${itemId}?memberName=${encodeURIComponent(name)}`);
    setShopping((prev) => prev.filter((s) => s.id !== itemId));
  };

  const addShopItem = async () => {
    if (!newShopItem.trim()) return;
    const created = await api.post<ShoppingItem>('/tasks/shopping', {
      item: newShopItem,
      addedBy: name,
    });
    setShopping((prev) => [...prev, created]);
    setNewShopItem('');
  };

  const filtered = tasks.filter((t) => {
    const today = new Date().toISOString().split('T')[0];
    if (filter === 'Mine') return t.assignee === name;
    if (filter === 'Today') return t.dueDate === today;
    if (filter === 'Done') return t.completed;
    if (filter === 'Incomplete') return !t.completed;
    return true;
  });

  if (loading) return <div className="space-y-3 pt-4 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="glass rounded-xl h-14" />)}</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Tasks</h2>
        <button onClick={() => { resetForm(); setShowAdd(true); }} className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center">
          <Plus className="h-5 w-5 text-primary-foreground" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass rounded-xl p-1">
        {(['tasks', 'shopping'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${tab === t ? 'gradient-primary text-primary-foreground' : 'text-muted-foreground'}`}>
            {t === 'tasks' ? 'Tasks' : 'Shopping List'}
          </button>
        ))}
      </div>

      {tab === 'tasks' ? (
        <>
          {/* Restock card */}
          <button onClick={onNavigateRestock}
            className="w-full glass rounded-2xl p-3.5 flex items-center gap-3 hover:scale-[1.01] active:scale-[0.99] transition-transform">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-secondary/30 to-secondary/5 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-foreground" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold">Restock Supplies</p>
              <p className="text-[10px] text-muted-foreground">Shopping items that need attention</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {['All', 'Mine', 'Today', 'Incomplete', 'Done'].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${f === filter ? 'gradient-primary text-primary-foreground' : 'glass text-muted-foreground'}`}>
                {f}
              </button>
            ))}
          </div>

          {/* Add/Edit form */}
          <AnimatePresence>
            {showAdd && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="glass rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{editingId ? 'Edit Task' : 'New Task'}</p>
                    <button onClick={resetForm}><X className="h-4 w-4 text-muted-foreground" /></button>
                  </div>
                  <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Task title..."
                    className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)}
                      className="bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]">
                      {(members.length > 0 ? members : [name]).map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)}
                      className="bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as TaskCategory)}
                      className="bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]">
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={newRecurrence} onChange={(e) => setNewRecurrence(e.target.value)}
                      className="bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]">
                      {RECURRENCE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <input type="number" value={newXp} onChange={(e) => setNewXp(e.target.value)}
                      className="w-20 bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]" />
                    <span className="text-xs text-muted-foreground">XP reward</span>
                  </div>
                  <button onClick={handleSave} className="w-full gradient-primary rounded-lg py-2 text-sm font-semibold text-primary-foreground">
                    {editingId ? 'Save Changes' : 'Add Task'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Task list */}
          <div className="space-y-2">
            {filtered.map((task, i) => (
              (() => {
                const isOverdue = isOverdueTask(task);
                const isPenalized = (task.penaltyXp ?? 0) < 0;
                return (
              <motion.div key={task.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={`glass rounded-xl p-3.5 ${task.completed ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3" onClick={() => handlePrimaryToggle(task)}>
                  {task.completed
                    ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${task.completed ? 'line-through' : ''}`}>{task.title}</p>
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">{task.assignee} • {task.dueDate}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{task.category}</span>
                      {task.recurrenceRule && task.recurrenceRule !== 'NONE' && (
                        <span className="text-[10px] text-accent flex items-center gap-0.5"><RotateCcw className="h-2.5 w-2.5" />{task.recurrenceRule}</span>
                      )}
                      {!task.completed && !isOverdue && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">Active</span>
                      )}
                      {isOverdue && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive font-medium">Overdue</span>
                      )}
                      {isPenalized && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary font-medium">Penalty Applied</span>
                      )}
                      {task.assignmentReason === 'LATE' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary font-medium">Seint Gjennomført</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-primary shrink-0">+{task.xp} XP</span>
                </div>

                <div className="flex items-center gap-1 mt-2 ml-8">
                  {!task.completed && isOverdue && !isPenalized && (
                    <button onClick={() => markLate(task.id)}
                      className="h-7 px-2 rounded-lg glass text-[10px] font-medium text-secondary flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Complete Late (50%)
                    </button>
                  )}
                  {!task.completed && isOverdue && isPenalized && (
                    <button onClick={() => completeMissedTask(task.id)}
                      className="h-7 px-2 rounded-lg glass text-[10px] font-medium text-secondary flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Regret Missed (50%)
                    </button>
                  )}
                  <button onClick={() => startEdit(task)} className="h-7 w-7 rounded-lg glass flex items-center justify-center">
                    <Edit3 className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button onClick={() => deleteTask(task.id)} className="h-7 w-7 rounded-lg glass flex items-center justify-center">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                  <button onClick={() => setCommentingId(commentingId === task.id ? null : task.id)}
                    className="h-7 px-2 rounded-lg glass text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                  </button>
                </div>

                <AnimatePresence>
                  {commentingId === task.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-2 ml-8">
                      <div className="flex gap-2">
                        <input value={commentText} onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Add feedback..."
                          className="flex-1 bg-muted/50 rounded-lg px-2 py-1.5 text-[11px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          onKeyDown={(e) => e.key === 'Enter' && addFeedback(task.id)} />
                        <button onClick={() => addFeedback(task.id)}
                          className="px-2 rounded-lg gradient-primary text-[10px] font-medium text-primary-foreground">
                          Send
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
                );
              })()
            ))}
          </div>
        </>
      ) : (
        /* Shopping List */
        <div className="space-y-3">
          <div className="flex gap-2">
            <input value={newShopItem} onChange={(e) => setNewShopItem(e.target.value)}
              placeholder="Add item..."
              className="flex-1 glass rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={(e) => e.key === 'Enter' && addShopItem()} />
            <button onClick={addShopItem} className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shrink-0">
              <Plus className="h-4 w-4 text-primary-foreground" />
            </button>
          </div>
          <div className="space-y-2">
            {shopping.map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={`glass rounded-xl p-3 flex items-center gap-3 ${item.completed ? 'opacity-50' : ''}`}>
                <button onClick={() => toggleShopItem(item.id)}>
                  {item.completed
                    ? <CheckCircle2 className="h-5 w-5 text-primary" />
                    : <Circle className="h-5 w-5 text-muted-foreground" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.completed ? 'line-through' : ''}`}>{item.item}</p>
                  <p className="text-[10px] text-muted-foreground">Added by {item.addedBy}</p>
                </div>
                <button onClick={() => deleteShopItem(item.id)} className="h-7 w-7 rounded-lg glass flex items-center justify-center">
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Restock sub-view (shopping items with urgent flagging) ──
function RestockPage({ onBack }: { onBack: () => void }) {
  const { currentUser } = useUser();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newName, setNewName] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const name = currentUser?.name ?? '';

  useEffect(() => {
    if (!name) return;
    api.get<ShoppingItem[]>(`/tasks/shopping?memberName=${encodeURIComponent(name)}`).then(setItems).catch(() => {});
  }, [name]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const created = await api.post<ShoppingItem>('/tasks/shopping', {
      item: newName,
      addedBy: name,
    });
    setItems((p) => [...p, created]);
    setNewName('');
    setShowAdd(false);
  };

  const handleBought = async (id: number) => {
    await api.delete(`/tasks/shopping/${id}?memberName=${encodeURIComponent(name)}`);
    setItems((p) => p.filter((i) => i.id !== id));
  };

  return (
    <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="space-y-4 pt-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="h-9 w-9 rounded-xl glass flex items-center justify-center">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h2 className="font-display text-xl font-bold">Restock</h2>
          <p className="text-xs text-muted-foreground">Shared supplies tracker</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center">
          <Plus className="h-5 w-5 text-primary-foreground" />
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Add Supply</p>
                <button onClick={() => setShowAdd(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Supply name..."
                className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
              <button onClick={handleAdd} className="w-full gradient-primary rounded-lg py-2 text-sm font-semibold text-primary-foreground">
                Add Supply
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {items.map((item, i) => (
          <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{item.item}</p>
              <p className="text-[10px] text-muted-foreground">Added by {item.addedBy}</p>
            </div>
            <button onClick={() => handleBought(item.id)}
              className="h-8 px-3 rounded-lg glass text-xs font-medium text-muted-foreground flex items-center gap-1">
              <ShoppingCart className="h-3 w-3" /> Bought
            </button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Main export ─────────────────────────────────────────
export default function TasksPage() {
  const [view, setView] = useState<'tasks' | 'restock'>('tasks');
  return (
    <AnimatePresence mode="wait">
      {view === 'tasks'
        ? <TasksMain key="tasks" onNavigateRestock={() => setView('restock')} />
        : <RestockPage key="restock" onBack={() => setView('tasks')} />}
    </AnimatePresence>
  );
}
