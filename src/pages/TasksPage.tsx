import { useEffect, useState, useRef, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Circle, Plus, Package, ChevronRight, ArrowLeft, X,
  ShoppingCart, Edit3, Trash2, MessageSquare, Clock, RotateCcw, Zap, Image, EyeOff,
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
  const [commentingId, setCommentingId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [feedbackAnonymous, setFeedbackAnonymous] = useState(false);
  const [feedbackImage, setFeedbackImage] = useState<{ data: string; mimeType: string } | null>(null);
  const feedbackImageRef = useRef<HTMLInputElement>(null);
  const [editingShopId, setEditingShopId] = useState<number | null>(null);
  const [editShopText, setEditShopText] = useState('');
  const [buyingShopId, setBuyingShopId] = useState<number | null>(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [buyPaidBy, setBuyPaidBy] = useState('');
  const [buyParticipants, setBuyParticipants] = useState<string[]>([]);
  const [buyDate, setBuyDate] = useState('');
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
      if (['TASK_UPDATED', 'TASK_CREATED', 'TASK_DELETED', 'SHOPPING_UPDATED', 'SHOPPING_ITEM_CREATED', 'SHOPPING_ITEM_TOGGLED', 'SHOPPING_ITEM_DELETED', 'SHOPPING_ITEM_UPDATED', 'SHOPPING_ITEM_BOUGHT'].includes(event.type)) {
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

  const handleFeedbackImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFeedbackImage({ data: (reader.result as string).split(',')[1], mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const addFeedback = async (taskId: number) => {
    if (!commentText.trim()) return;
    await api.patch(`/tasks/${taskId}/feedback?memberName=${encodeURIComponent(name)}`, {
      message: commentText,
      anonymous: feedbackAnonymous,
      imageData: feedbackImage?.data ?? null,
      imageMimeType: feedbackImage?.mimeType ?? null,
    });
    setCommentText('');
    setFeedbackAnonymous(false);
    setFeedbackImage(null);
    if (feedbackImageRef.current) feedbackImageRef.current.value = '';
    setCommentingId(null);
    fetchAll();
  };

  const deleteShopItem = async (itemId: number) => {
    await api.delete(`/tasks/shopping/${itemId}?memberName=${encodeURIComponent(name)}`);
    setShopping((prev) => prev.filter((s) => s.id !== itemId));
  };

  const toggleShopItem = async (itemId: number) => {
    await api.patch(`/tasks/shopping/${itemId}/toggle?memberName=${encodeURIComponent(name)}`);
    setShopping((prev) => prev.map((s) => s.id === itemId ? { ...s, completed: !s.completed } : s));
  };

  const openBuyForm = (item: ShoppingItem) => {
    setBuyingShopId(item.id);
    setBuyAmount('');
    setBuyPaidBy(name);
    setBuyParticipants(members.length > 0 ? members : [name]);
    setBuyDate(new Date().toISOString().split('T')[0]);
  };

  const toggleBuyParticipant = (member: string) => {
    setBuyParticipants((prev) =>
      prev.includes(member) ? prev.filter((m) => m !== member) : [...prev, member],
    );
  };

  const submitBought = async (itemId: number) => {
    if (!buyAmount.trim()) return;
    await api.post(`/tasks/shopping/${itemId}/bought?memberName=${encodeURIComponent(name)}`, {
      amount: parseInt(buyAmount),
      paidBy: buyPaidBy,
      participantNames: buyParticipants,
      date: buyDate,
    });
    setBuyingShopId(null);
    fetchAll();
  };

  const startEditShop = (item: ShoppingItem) => {
    setEditingShopId(item.id);
    setEditShopText(item.item);
  };

  const saveEditShop = async (itemId: number) => {
    if (!editShopText.trim()) return;
    const updated = await api.patch<ShoppingItem>(`/tasks/shopping/${itemId}?memberName=${encodeURIComponent(name)}`, { item: editShopText });
    setShopping((prev) => prev.map((s) => s.id === itemId ? updated : s));
    setEditingShopId(null);
    setEditShopText('');
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
        {tab === 'tasks' && (
          <button onClick={() => { resetForm(); setShowAdd(true); }} className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center">
            <Plus className="h-5 w-5 text-primary-foreground" />
          </button>
        )}
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
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            {['All', 'Mine', 'Today', 'Incomplete', 'Done'].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${f === filter ? 'gradient-primary text-primary-foreground' : 'glass text-muted-foreground'}`}>
                {f}
              </button>
            ))}
          </div>

          {/* Add form (new task only) */}
          <AnimatePresence>
            {showAdd && !editingId && (
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
              <Fragment key={task.id}>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
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
                      className="overflow-hidden mt-2 ml-8 space-y-2">
                      {/* Existing feedbacks */}
                      {task.feedbacks && task.feedbacks.length > 0 && (
                        <div className="space-y-1.5">
                          {task.feedbacks.map((fb) => (
                            <div key={fb.id} className="bg-muted/30 rounded-lg px-2.5 py-2 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-primary">
                                  {fb.author ?? 'Anonymous'}
                                </span>
                                {fb.anonymous && (
                                  <EyeOff className="h-2.5 w-2.5 text-muted-foreground" />
                                )}
                                <span className="text-[9px] text-muted-foreground ml-auto">
                                  {new Date(fb.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-[11px] text-foreground">{fb.message}</p>
                              {fb.imageData && fb.imageMimeType && (
                                <img
                                  src={`data:${fb.imageMimeType};base64,${fb.imageData}`}
                                  alt="feedback"
                                  className="mt-1 rounded-lg max-h-40 object-contain"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* New feedback input */}
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
                      {/* Anonymous toggle + image upload */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setFeedbackAnonymous((v) => !v)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${feedbackAnonymous ? 'bg-primary/20 text-primary' : 'glass text-muted-foreground'}`}>
                          <EyeOff className="h-3 w-3" />
                          {feedbackAnonymous ? 'Anonymous' : 'Public'}
                        </button>
                        <button
                          onClick={() => feedbackImageRef.current?.click()}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${feedbackImage ? 'bg-primary/20 text-primary' : 'glass text-muted-foreground'}`}>
                          <Image className="h-3 w-3" />
                          {feedbackImage ? 'Image attached' : 'Add image'}
                        </button>
                        {feedbackImage && (
                          <button onClick={() => { setFeedbackImage(null); if (feedbackImageRef.current) feedbackImageRef.current.value = ''; }}
                            className="text-[10px] text-destructive">
                            Remove
                          </button>
                        )}
                        <input ref={feedbackImageRef} type="file" accept="image/*" className="hidden" onChange={handleFeedbackImage} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              <AnimatePresence>
                {editingId === task.id && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-2">
                    <div className="glass rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Edit Task</p>
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
                        Save Changes
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              </Fragment>
                );
              })()
            ))}
          </div>
        </>
      ) : (
        /* Shopping List */
        <div className="space-y-3">
          {/* Restock card */}
          <button onClick={onNavigateRestock}
            className="w-full glass rounded-2xl p-3.5 flex items-center gap-3 hover:scale-[1.01] active:scale-[0.99] transition-transform">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-secondary/30 to-secondary/5 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-foreground" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold">Restock Supplies</p>
              <p className="text-[10px] text-muted-foreground">Add items that need to be bought</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>

          {shopping.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No items yet — add supplies in Restock.</p>
          )}
          <div className="space-y-2">
            {shopping.map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={`glass rounded-xl p-3.5 ${item.completed ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${item.completed ? 'line-through' : ''}`}>{item.item}</p>
                    <p className="text-[10px] text-muted-foreground">Added by {item.addedBy}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.completed
                      ? (
                        <button onClick={() => toggleShopItem(item.id)}
                          className="h-8 px-3 rounded-lg glass text-xs font-medium flex items-center gap-1 text-primary">
                          <ShoppingCart className="h-3 w-3" /> Undo
                        </button>
                      ) : (
                        <button onClick={() => { setEditingShopId(null); openBuyForm(item); }}
                          className="h-8 px-3 rounded-lg glass text-xs font-medium flex items-center gap-1 text-muted-foreground">
                          <ShoppingCart className="h-3 w-3" /> Bought
                        </button>
                      )}
                    <button onClick={() => { setBuyingShopId(null); startEditShop(item); }} className="h-8 w-8 rounded-lg glass flex items-center justify-center shrink-0">
                      <Edit3 className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button onClick={() => deleteShopItem(item.id)} className="h-8 w-8 rounded-lg glass flex items-center justify-center shrink-0">
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {buyingShopId === item.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)}
                          placeholder="Amount (kr)"
                          className="bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]" />
                        <select value={buyPaidBy} onChange={(e) => setBuyPaidBy(e.target.value)}
                          className="bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]">
                          {(members.length > 0 ? members : [name]).map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(members.length > 0 ? members : [name]).map((m) => (
                          <button key={m} onClick={() => toggleBuyParticipant(m)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${buyParticipants.includes(m) ? 'gradient-primary text-primary-foreground' : 'glass text-muted-foreground'}`}>
                            {m}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)}
                          className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]" />
                        <button onClick={() => submitBought(item.id)} className="px-4 rounded-lg gradient-primary text-xs font-semibold text-primary-foreground">Log</button>
                        <button onClick={() => setBuyingShopId(null)} className="h-9 w-9 rounded-lg glass flex items-center justify-center"><X className="h-3 w-3 text-muted-foreground" /></button>
                      </div>
                    </motion.div>
                  )}
                  {editingShopId === item.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-2">
                      <div className="flex gap-2">
                        <input value={editShopText} onChange={(e) => setEditShopText(e.target.value)}
                          className="flex-1 bg-muted/50 rounded-lg px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEditShop(item.id); if (e.key === 'Escape') setEditingShopId(null); }} />
                        <button onClick={() => saveEditShop(item.id)} className="px-3 rounded-lg gradient-primary text-xs font-medium text-primary-foreground">Save</button>
                        <button onClick={() => setEditingShopId(null)} className="h-8 w-8 rounded-lg glass flex items-center justify-center"><X className="h-3 w-3 text-muted-foreground" /></button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const name = currentUser?.name ?? '';

  const fetchItems = () => {
    if (!name) return;
    api.get<ShoppingItem[]>(`/tasks/shopping?memberName=${encodeURIComponent(name)}`).then(setItems).catch(() => {});
  };

  useEffect(() => {
    fetchItems();
  }, [name]);

  useEffect(() => {
    if (!name) return;
    const disconnect = connectCollectiveRealtime(name, (event) => {
      if (['SHOPPING_ITEM_CREATED', 'SHOPPING_ITEM_TOGGLED', 'SHOPPING_ITEM_DELETED', 'SHOPPING_UPDATED', 'SHOPPING_ITEM_UPDATED', 'SHOPPING_ITEM_BOUGHT'].includes(event.type)) {
        fetchItems();
      }
    });
    return disconnect;
  }, [name]);

  const handleDelete = async (id: number) => {
    await api.delete(`/tasks/shopping/${id}?memberName=${encodeURIComponent(name)}`);
    setItems((p) => p.filter((i) => i.id !== id));
  };

  const handleEdit = async (id: number) => {
    if (!editText.trim()) return;
    const updated = await api.patch<ShoppingItem>(`/tasks/shopping/${id}?memberName=${encodeURIComponent(name)}`, { item: editText });
    setItems((p) => p.map((i) => i.id === id ? updated : i));
    setEditingId(null);
    setEditText('');
  };

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
            className="glass rounded-xl p-3.5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.item}</p>
                <p className="text-[10px] text-muted-foreground">Added by {item.addedBy}</p>
              </div>
              <button onClick={() => { setEditingId(item.id); setEditText(item.item); }} className="h-8 w-8 rounded-lg glass flex items-center justify-center shrink-0">
                <Edit3 className="h-3 w-3 text-muted-foreground" />
              </button>
              <button onClick={() => handleDelete(item.id)} className="h-8 w-8 rounded-lg glass flex items-center justify-center shrink-0">
                <Trash2 className="h-3 w-3 text-destructive" />
              </button>
            </div>
            <AnimatePresence>
              {editingId === item.id && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-2">
                  <div className="flex gap-2">
                    <input value={editText} onChange={(e) => setEditText(e.target.value)}
                      className="flex-1 bg-muted/50 rounded-lg px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(item.id); if (e.key === 'Escape') setEditingId(null); }} />
                    <button onClick={() => handleEdit(item.id)} className="px-3 rounded-lg gradient-primary text-xs font-medium text-primary-foreground">Save</button>
                    <button onClick={() => setEditingId(null)} className="h-8 w-8 rounded-lg glass flex items-center justify-center"><X className="h-3 w-3 text-muted-foreground" /></button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
