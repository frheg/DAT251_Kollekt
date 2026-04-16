import {
  useEffect,
  useState,
  useRef,
  Fragment,
  type ChangeEvent,
  type SetStateAction,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  Circle,
  Plus,
  Package,
  X,
  ShoppingCart,
  Edit3,
  Trash2,
  MessageSquare,
  Clock,
  RotateCcw,
  Zap,
  Image,
  EyeOff,
} from 'lucide-react';
import { api } from '../lib/api';
import { useUser } from '../context/UserContext';
import { connectCollectiveRealtime } from '../lib/realtime';
import { formatDate, formatDateTime, translateKey } from '../i18n/helpers';
import type { Task, ShoppingItem, TaskCategory } from '../lib/types';

const CATEGORIES: TaskCategory[] = ['CLEANING', 'VACUUMING', 'MOPPING', 'BATHROOM', 'KITCHEN', 'LAUNDRY', 'DISHES', 'TRASH', 'DUSTING', 'WINDOWS', 'OTHER'];
const RECURRENCE_OPTIONS = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;
const TASK_FILTERS = ['ALL', 'MINE', 'TODAY', 'DONE'] as const;

type TaskFilter = (typeof TASK_FILTERS)[number];

function TaskEditor({
  title,
  newTitle,
  setNewTitle,
  newAssignee,
  setNewAssignee,
  members,
  name,
  newDue,
  setNewDue,
  newCategory,
  setNewCategory,
  newRecurrence,
  setNewRecurrence,
  newXp,
  setNewXp,
  onClose,
  onSave,
  saveLabel,
}: {
  title: string;
  newTitle: string;
  setNewTitle: (value: string) => void;
  newAssignee: string;
  setNewAssignee: (value: string) => void;
  members: string[];
  name: string;
  newDue: string;
  setNewDue: (value: string) => void;
  newCategory: TaskCategory;
  setNewCategory: (value: TaskCategory) => void;
  newRecurrence: string;
  setNewRecurrence: (value: string) => void;
  newXp: string;
  setNewXp: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  saveLabel: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <button onClick={onClose} aria-label={t('common.back')}>
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      <input
        value={newTitle}
        onChange={(event) => setNewTitle(event.target.value)}
        placeholder={t('tasks.taskTitlePlaceholder')}
        className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        onKeyDown={(event) => event.key === 'Enter' && onSave()}
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          value={newAssignee}
          onChange={(event) => setNewAssignee(event.target.value)}
          className="bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
        >
          {(members.length > 0 ? members : [name]).map((member) => (
            <option key={member} value={member}>
              {member}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={newDue}
          onChange={(event) => setNewDue(event.target.value)}
          className="bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={newCategory}
          onChange={(event) => setNewCategory(event.target.value as TaskCategory)}
          className="bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
        >
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {translateKey('common.taskCategories', category)}
            </option>
          ))}
        </select>
        <select
          value={newRecurrence}
          onChange={(event) => setNewRecurrence(event.target.value)}
          className="bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
        >
          {RECURRENCE_OPTIONS.map((recurrence) => (
            <option key={recurrence} value={recurrence}>
              {translateKey('common.recurrence', recurrence)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <input
          type="number"
          value={newXp}
          onChange={(event) => setNewXp(event.target.value)}
          className="w-20 bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
        />
        <span className="text-xs text-muted-foreground">{t('tasks.xpReward')}</span>
      </div>
      <button
        onClick={onSave}
        className="w-full gradient-primary rounded-lg py-2 text-sm font-semibold text-primary-foreground"
      >
        {saveLabel}
      </button>
    </div>
  );
}

function TasksMain() {
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [filter, setFilter] = useState<TaskFilter>('ALL');
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'tasks' | 'shopping'>(
    searchParams.get('tab') === 'shopping' ? 'shopping' : 'tasks',
  );
  const [showAdd, setShowAdd] = useState(false);
  const [showShoppingAdd, setShowShoppingAdd] = useState(false);
  const [newShoppingName, setNewShoppingName] = useState('');
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
  const [feedbackImage, setFeedbackImage] = useState<{
    data: string;
    mimeType: string;
  } | null>(null);
  const feedbackImageRef = useRef<HTMLInputElement>(null);
  const [editingShopId, setEditingShopId] = useState<number | null>(null);
  const [editShopText, setEditShopText] = useState('');
  const [buyingShopId, setBuyingShopId] = useState<number | null>(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [buyPaidBy, setBuyPaidBy] = useState('');
  const [buyParticipants, setBuyParticipants] = useState<string[]>([]);
  const [buyDate, setBuyDate] = useState('');
  const [buyDeadline, setBuyDeadline] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<number>>(new Set());
  const pendingTaskIdsRef = useRef<Set<number>>(new Set());
  const tasksRef = useRef<Task[]>([]);
  const fetchRequestIdRef = useRef(0);
  const taskOverridesRef = useRef<Map<number, Task>>(new Map());

  const name = currentUser?.name ?? '';
  const memberOptions = members.length > 0 ? members : [name];

  const setTasksState = (updater: SetStateAction<Task[]>) => {
    setTasks((prev) => {
      const next =
        typeof updater === 'function'
          ? (updater as (previous: Task[]) => Task[])(prev)
          : updater;
      tasksRef.current = next;
      return next;
    });
  };

  const taskMatchesOverride = (serverTask: Task, localTask: Task) =>
    serverTask.completed === localTask.completed &&
    serverTask.penaltyXp === localTask.penaltyXp &&
    serverTask.xp === localTask.xp &&
    serverTask.title === localTask.title &&
    serverTask.assignee === localTask.assignee &&
    serverTask.dueDate === localTask.dueDate &&
    serverTask.category === localTask.category &&
    serverTask.recurrenceRule === localTask.recurrenceRule;

  const setTaskOverride = (task: Task) => {
    taskOverridesRef.current.set(task.id, task);
  };

  const clearTaskOverride = (taskId: number) => {
    taskOverridesRef.current.delete(taskId);
  };

  const mergeFetchedTasks = (nextTasks: Task[]) => {
    const localTasksById = new Map(tasksRef.current.map((task) => [task.id, task]));

    return nextTasks.map((task) => {
      if (pendingTaskIdsRef.current.has(task.id)) {
        return localTasksById.get(task.id) ?? task;
      }

      const overriddenTask = taskOverridesRef.current.get(task.id);
      if (!overriddenTask) return task;

      if (taskMatchesOverride(task, overriddenTask)) {
        clearTaskOverride(task.id);
        return task;
      }

      return overriddenTask;
    });
  };

  const sortTasks = (nextTasks: Task[]) =>
    [...nextTasks].sort((firstTask, secondTask) => {
      const dueDateOrder = firstTask.dueDate.localeCompare(secondTask.dueDate);
      if (dueDateOrder !== 0) return dueDateOrder;
      return firstTask.id - secondTask.id;
    });

  const upsertTask = (nextTask: Task) => {
    setTasksState((prev) => {
      const existingIndex = prev.findIndex((task) => task.id === nextTask.id);
      if (existingIndex === -1) return sortTasks([...prev, nextTask]);

      const next = [...prev];
      next[existingIndex] = nextTask;
      return sortTasks(next);
    });
  };

  const extractTaskFromRealtimeEvent = (event: { type: string; payload?: unknown }): Task | null => {
    if (event.type === 'TASK_UPDATED') {
      const payload = event.payload as
        | { task?: Task; updatedBy?: string }
        | Task
        | undefined;

      if (payload && typeof payload === 'object' && 'task' in payload && payload.task) {
        return payload.task;
      }

      return (payload as Task | undefined) ?? null;
    }

    return (event.payload as Task | undefined) ?? null;
  };

  const fetchAll = async () => {
    if (!name) return;
    const requestId = ++fetchRequestIdRef.current;
    const [taskRes, shopRes] = await Promise.all([
      api.get<Task[]>(`/tasks?memberName=${encodeURIComponent(name)}`),
      api.get<ShoppingItem[]>(`/tasks/shopping?memberName=${encodeURIComponent(name)}`),
    ]);
    if (requestId !== fetchRequestIdRef.current) return;
    setTasksState(mergeFetchedTasks(taskRes));
    setShopping(shopRes);
    setLoading(false);
  };

  useEffect(() => {
    if (!name) return;
    void fetchAll();
    api.get<{ name: string }[]>(`/members/collective?memberName=${encodeURIComponent(name)}`)
      .then((response) => setMembers(response.map((member) => member.name)))
      .catch(() => {});
  }, [name]);

  useEffect(() => {
    if (!name) return;
    const disconnect = connectCollectiveRealtime(name, (event) => {
      if (event.type === 'TASK_UPDATED') {
        const payload = event.payload as
          | { updatedBy?: string; task?: Task }
          | undefined;
        if (payload?.updatedBy === name) return;
      }

      if (event.type === 'TASK_UPDATED' || event.type === 'TASK_CREATED') {
        const nextTask = extractTaskFromRealtimeEvent(event);
        if (nextTask) upsertTask(nextTask);
        return;
      }

      if (event.type === 'TASK_DELETED') {
        const payload = event.payload as { id?: number } | undefined;
        if (payload?.id !== undefined) {
          setTasksState((prev) => prev.filter((task) => task.id !== payload.id));
        }
        return;
      }

      if (
        [
          'SHOPPING_UPDATED',
          'SHOPPING_ITEM_CREATED',
          'SHOPPING_ITEM_TOGGLED',
          'SHOPPING_ITEM_DELETED',
          'SHOPPING_ITEM_UPDATED',
          'SHOPPING_ITEM_BOUGHT',
        ].includes(event.type)
      ) {
        void fetchAll();
      }
    });
    return disconnect;
  }, [name]);

  const handleShoppingAdd = async () => {
    if (!newShoppingName.trim()) return;
    const created = await api.post<ShoppingItem>('/tasks/shopping', {
      item: newShoppingName,
      addedBy: name,
    });
    setShopping((prev) => [...prev, created]);
    setNewShoppingName('');
    setShowShoppingAdd(false);
  };

  const updateTaskInPlace = (taskId: number, nextTask: Task) => {
    setTasksState((prev) => prev.map((task) => (task.id === taskId ? nextTask : task)));
  };

  const patchTaskInPlace = (taskId: number, patch: Partial<Task>) => {
    setTasksState((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
    );
  };

  const runTaskMutation = async (
    task: Task,
    optimisticPatch: Partial<Task>,
    request: () => Promise<Task>,
  ) => {
    if (pendingTaskIdsRef.current.has(task.id)) return;

    pendingTaskIdsRef.current.add(task.id);
    setPendingTaskIds((prev) => new Set(prev).add(task.id));
    patchTaskInPlace(task.id, optimisticPatch);

    try {
      const updatedTask = await request();
      setTaskOverride(updatedTask);
      updateTaskInPlace(task.id, updatedTask);
    } catch (error) {
      clearTaskOverride(task.id);
      updateTaskInPlace(task.id, task);
      console.error(error);
    } finally {
      pendingTaskIdsRef.current.delete(task.id);
      setPendingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  const toggleTask = async (task: Task) => {
    await runTaskMutation(
      task,
      { completed: !task.completed },
      () => api.patch<Task>(`/tasks/${task.id}/toggle?memberName=${encodeURIComponent(name)}`),
    );
  };

  const isOverdueTask = (task: Task) => {
    const today = new Date().toISOString().split('T')[0];
    return !task.completed && task.dueDate < today;
  };

  const handlePrimaryToggle = async (task: Task) => {
    if (task.completed) {
      await toggleTask(task);
      return;
    }

    if (isOverdueTask(task)) {
      if ((task.penaltyXp ?? 0) < 0) {
        await completeMissedTask(task);
      } else {
        await markLate(task);
      }
      return;
    }

    await toggleTask(task);
  };

  const markLate = async (task: Task) => {
    await runTaskMutation(
      task,
      { completed: true },
      () => api.post<Task>(`/tasks/${task.id}/regret?memberName=${encodeURIComponent(name)}`, {}),
    );
  };

  const completeMissedTask = async (task: Task) => {
    await runTaskMutation(
      task,
      { completed: true },
      () =>
        api.post<Task>(
          `/tasks/${task.id}/regret-missed?memberName=${encodeURIComponent(name)}`,
          {},
        ),
    );
  };

  const deleteTask = async (taskId: number) => {
    await api.delete(`/tasks/${taskId}?memberName=${encodeURIComponent(name)}`);
    setTasksState((prev) => prev.filter((task) => task.id !== taskId));
  };

  const startEdit = (task: Task) => {
    setShowAdd(false);
    setEditingId(task.id);
    setNewTitle(task.title);
    setNewAssignee(task.assignee);
    setNewDue(task.dueDate);
    setNewCategory(task.category);
    setNewXp(task.xp.toString());
    setNewRecurrence(task.recurrenceRule ?? 'NONE');
  };

  const resetForm = () => {
    setNewTitle('');
    setNewAssignee(name);
    setNewDue('');
    setNewCategory('CLEANING');
    setNewXp('10');
    setNewRecurrence('NONE');
    setShowAdd(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!newTitle.trim()) return;
    const body = {
      title: newTitle,
      assignee: newAssignee || name,
      dueDate: newDue || new Date().toISOString().split('T')[0],
      category: newCategory,
      xp: parseInt(newXp, 10) || 10,
      recurrenceRule: newRecurrence === 'NONE' ? null : newRecurrence,
    };

    if (editingId) {
      await api.patch(`/tasks/${editingId}?memberName=${encodeURIComponent(name)}`, body);
      setTasksState((prev) =>
        prev.map((task) => (task.id === editingId ? { ...task, ...body } : task)),
      );
    } else {
      const created = await api.post<Task>('/tasks', body);
      setTasksState((prev) => [...prev, created]);
    }

    resetForm();
  };

  const handleFeedbackImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFeedbackImage({
        data: (reader.result as string).split(',')[1],
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  const resetFeedbackComposer = () => {
    setCommentText('');
    setFeedbackAnonymous(false);
    setFeedbackImage(null);
    if (feedbackImageRef.current) feedbackImageRef.current.value = '';
  };

  const removeFeedbackImage = () => {
    setFeedbackImage(null);
    if (feedbackImageRef.current) feedbackImageRef.current.value = '';
  };

  const addFeedback = async (taskId: number) => {
    if (!commentText.trim()) return;
    await api.patch(`/tasks/${taskId}/feedback?memberName=${encodeURIComponent(name)}`, {
      message: commentText,
      anonymous: feedbackAnonymous,
      imageData: feedbackImage?.data ?? null,
      imageMimeType: feedbackImage?.mimeType ?? null,
    });
    resetFeedbackComposer();
    setCommentingId(null);
    await fetchAll();
  };

  const deleteShopItem = async (itemId: number) => {
    await api.delete(`/tasks/shopping/${itemId}?memberName=${encodeURIComponent(name)}`);
    setShopping((prev) => prev.filter((item) => item.id !== itemId));
  };

  const toggleShopItem = async (itemId: number) => {
    await api.patch(`/tasks/shopping/${itemId}/toggle?memberName=${encodeURIComponent(name)}`);
    setShopping((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item,
      ),
    );
  };

  const openBuyForm = (item: ShoppingItem) => {
    setEditingShopId(null);
    setBuyingShopId(item.id);
    setBuyAmount('');
    setBuyPaidBy(name);
    setBuyParticipants(memberOptions);
    setBuyDate(new Date().toISOString().split('T')[0]);
    setBuyDeadline('');
  };

  const toggleBuyParticipant = (member: string) => {
    setBuyParticipants((prev) =>
      prev.includes(member)
        ? prev.filter((value) => value !== member)
        : [...prev, member],
    );
  };

  const submitBought = async (itemId: number) => {
    const amount = parseInt(buyAmount, 10);
    if (!Number.isFinite(amount) || amount <= 0 || buyParticipants.length === 0) return;
    await api.post(
      `/tasks/shopping/${itemId}/bought?memberName=${encodeURIComponent(name)}`,
      {
        amount,
        paidBy: buyPaidBy || name,
        participantNames: buyParticipants,
        date: buyDate,
        ...(buyDeadline ? { deadlineDate: buyDeadline } : {}),
      },
    );
    setBuyDeadline('');
    setBuyingShopId(null);
    await fetchAll();
  };

  const startEditShop = (item: ShoppingItem) => {
    setBuyingShopId(null);
    setEditingShopId(item.id);
    setEditShopText(item.item);
  };

  const saveEditShop = async (itemId: number) => {
    if (!editShopText.trim()) return;
    const updated = await api.patch<ShoppingItem>(
      `/tasks/shopping/${itemId}?memberName=${encodeURIComponent(name)}`,
      { item: editShopText },
    );
    setShopping((prev) => prev.map((item) => (item.id === itemId ? updated : item)));
    setEditingShopId(null);
    setEditShopText('');
  };

  const filteredTasks = tasks
    .filter((task) => {
      const today = new Date().toISOString().split('T')[0];
      if (filter === 'DONE') return task.completed;
      if (filter === 'MINE') return task.assignee === name && !task.completed;
      if (filter === 'TODAY') return task.dueDate === today && !task.completed;
      return !task.completed;
    })
    .sort((firstTask, secondTask) => {
      const dueDateOrder = firstTask.dueDate.localeCompare(secondTask.dueDate);
      if (dueDateOrder !== 0) return dueDateOrder;
      return firstTask.id - secondTask.id;
    });

  if (loading) {
    return (
      <div className="space-y-3 pt-4 animate-pulse">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="glass rounded-xl h-14" />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 pt-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">{t('tasks.title')}</h2>
        <button
          onClick={() => {
            if (tab === 'tasks') { resetForm(); setShowAdd(true); }
            else { setShowShoppingAdd(true); }
          }}
          className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center"
          aria-label={tab === 'tasks' ? t('tasks.addTask') : t('tasks.addSupply')}
        >
          <Plus className="h-5 w-5 text-primary-foreground" />
        </button>
      </div>

      <div className="flex gap-1 glass rounded-xl p-1">
        {(['tasks', 'shopping'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === value
                ? 'gradient-primary text-primary-foreground'
                : 'text-muted-foreground'
            }`}
          >
            {t(`tasks.tabs.${value}`)}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {showShoppingAdd && tab === 'shopping' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{t('tasks.addSupply')}</p>
                <button onClick={() => setShowShoppingAdd(false)} aria-label={t('common.back')}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <input
                value={newShoppingName}
                onChange={(e) => setNewShoppingName(e.target.value)}
                placeholder={t('tasks.supplyNamePlaceholder')}
                className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={(e) => e.key === 'Enter' && void handleShoppingAdd()}
                autoFocus
              />
              <button
                onClick={() => void handleShoppingAdd()}
                className="w-full gradient-primary rounded-lg py-2 text-sm font-semibold text-primary-foreground"
              >
                {t('tasks.addSupply')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {tab === 'tasks' ? (
        <>
          <div className="flex gap-2 flex-wrap">
            {TASK_FILTERS.map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  value === filter
                    ? 'gradient-primary text-primary-foreground'
                    : 'glass text-muted-foreground'
                }`}
              >
                {t(`tasks.filters.${value}`)}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {showAdd && !editingId && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <TaskEditor
                  title={t('tasks.newTask')}
                  newTitle={newTitle}
                  setNewTitle={setNewTitle}
                  newAssignee={newAssignee}
                  setNewAssignee={setNewAssignee}
                  members={members}
                  name={name}
                  newDue={newDue}
                  setNewDue={setNewDue}
                  newCategory={newCategory}
                  setNewCategory={setNewCategory}
                  newRecurrence={newRecurrence}
                  setNewRecurrence={setNewRecurrence}
                  newXp={newXp}
                  setNewXp={setNewXp}
                  onClose={resetForm}
                  onSave={handleSave}
                  saveLabel={t('tasks.addTask')}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            {filteredTasks.map((task, index) => {
              const isOverdue = isOverdueTask(task);
              const isPenalized = (task.penaltyXp ?? 0) < 0;
              const taskIsPending = pendingTaskIds.has(task.id);

              return (
                <Fragment key={task.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className={`glass rounded-xl p-3.5 ${task.completed ? 'opacity-50' : ''}`}
                  >
                    <div
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => {
                        if (taskIsPending) return;
                        void handlePrimaryToggle(task);
                      }}
                    >
                      {task.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm font-medium ${task.completed ? 'line-through' : ''}`}
                        >
                          {task.title}
                        </p>
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[10px] text-muted-foreground">
                            {task.assignee} • {formatDate(task.dueDate)}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {translateKey('common.taskCategories', task.category)}
                          </span>
                          {task.recurrenceRule && task.recurrenceRule !== 'NONE' && (
                            <span className="text-[10px] text-accent flex items-center gap-0.5">
                              <RotateCcw className="h-2.5 w-2.5" />
                              {translateKey('common.recurrence', task.recurrenceRule)}
                            </span>
                          )}
                          {!task.completed && !isOverdue && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                              {t('common.active')}
                            </span>
                          )}
                          {isOverdue && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive font-medium">
                              {t('tasks.overdue')}
                            </span>
                          )}
                          {isPenalized && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary font-medium">
                              {t('tasks.penaltyApplied')}
                            </span>
                          )}
                          {task.assignmentReason === 'LATE' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary font-medium">
                              {translateKey(
                                'common.taskAssignmentReasons',
                                task.assignmentReason,
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-medium text-primary shrink-0">
                        +{task.xp} XP
                      </span>
                    </div>

                    <div className="flex items-center gap-1 mt-2 ml-8">
                      {!task.completed && isOverdue && !isPenalized && (
                        <button
                          onClick={() => {
                            void markLate(task);
                          }}
                          disabled={taskIsPending}
                          className="h-7 px-2 rounded-lg glass text-[10px] font-medium text-secondary flex items-center gap-1 disabled:opacity-60"
                        >
                          <Clock className="h-3 w-3" />
                          {t('tasks.completeLate')}
                        </button>
                      )}
                      {!task.completed && isOverdue && isPenalized && (
                        <button
                          onClick={() => {
                            void completeMissedTask(task);
                          }}
                          disabled={taskIsPending}
                          className="h-7 px-2 rounded-lg glass text-[10px] font-medium text-secondary flex items-center gap-1 disabled:opacity-60"
                        >
                          <Clock className="h-3 w-3" />
                          {t('tasks.regretMissed')}
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(task)}
                        className="h-7 w-7 rounded-lg glass flex items-center justify-center"
                        aria-label={t('tasks.editTaskAria')}
                      >
                        <Edit3 className="h-3 w-3 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => {
                          void deleteTask(task.id);
                        }}
                        className="h-7 w-7 rounded-lg glass flex items-center justify-center"
                        aria-label={t('tasks.deleteTaskAria')}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                      <button
                        onClick={() =>
                          setCommentingId(commentingId === task.id ? null : task.id)
                        }
                        className="h-7 px-2 rounded-lg glass text-[10px] font-medium text-muted-foreground flex items-center gap-1"
                        aria-label={t('tasks.toggleComments')}
                      >
                        <MessageSquare className="h-3 w-3" />
                      </button>
                    </div>

                    <AnimatePresence>
                      {commentingId === task.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mt-2 ml-8 space-y-2"
                        >
                          {task.feedbacks.length > 0 && (
                            <div className="space-y-1.5">
                              {task.feedbacks.map((feedback) => (
                                <div
                                  key={feedback.id}
                                  className="bg-muted/30 rounded-lg px-2.5 py-2 space-y-1"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold text-primary">
                                      {feedback.anonymous
                                        ? t('tasks.feedbackAnonymousAuthor')
                                        : (feedback.author ??
                                          t('tasks.feedbackAnonymousAuthor'))}
                                    </span>
                                    {feedback.anonymous && (
                                      <EyeOff className="h-2.5 w-2.5 text-muted-foreground" />
                                    )}
                                    <span className="text-[9px] text-muted-foreground ml-auto">
                                      {formatDateTime(feedback.createdAt)}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-foreground">
                                    {feedback.message}
                                  </p>
                                  {feedback.imageData && feedback.imageMimeType && (
                                    <img
                                      src={`data:${feedback.imageMimeType};base64,${feedback.imageData}`}
                                      alt={t('tasks.feedbackImageAlt')}
                                      className="mt-1 rounded-lg max-h-40 object-contain"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <input
                              value={commentText}
                              onChange={(event) => setCommentText(event.target.value)}
                              placeholder={t('tasks.feedbackPlaceholder')}
                              className="flex-1 bg-muted/50 rounded-lg px-2 py-1.5 text-[11px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              onKeyDown={(event) =>
                                event.key === 'Enter' && void addFeedback(task.id)
                              }
                            />
                            <button
                              onClick={() => {
                                void addFeedback(task.id);
                              }}
                              className="px-2 rounded-lg gradient-primary text-[10px] font-medium text-primary-foreground"
                            >
                              {t('common.send')}
                            </button>
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setFeedbackAnonymous((value) => !value)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                                feedbackAnonymous
                                  ? 'bg-primary/20 text-primary'
                                  : 'glass text-muted-foreground'
                              }`}
                            >
                              <EyeOff className="h-3 w-3" />
                              {feedbackAnonymous
                                ? t('tasks.feedbackAnonymous')
                                : t('tasks.feedbackPublic')}
                            </button>
                            <button
                              onClick={() => feedbackImageRef.current?.click()}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                                feedbackImage
                                  ? 'bg-primary/20 text-primary'
                                  : 'glass text-muted-foreground'
                              }`}
                            >
                              <Image className="h-3 w-3" />
                              {feedbackImage
                                ? t('tasks.feedbackImageAttached')
                                : t('tasks.feedbackAddImage')}
                            </button>
                            {feedbackImage && (
                              <button
                                onClick={removeFeedbackImage}
                                className="text-[10px] text-destructive"
                              >
                                {t('tasks.feedbackRemoveImage')}
                              </button>
                            )}
                            <input
                              ref={feedbackImageRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleFeedbackImage}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  <AnimatePresence>
                    {editingId === task.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-2"
                      >
                        <TaskEditor
                          title={t('tasks.editTask')}
                          newTitle={newTitle}
                          setNewTitle={setNewTitle}
                          newAssignee={newAssignee}
                          setNewAssignee={setNewAssignee}
                          members={members}
                          name={name}
                          newDue={newDue}
                          setNewDue={setNewDue}
                          newCategory={newCategory}
                          setNewCategory={setNewCategory}
                          newRecurrence={newRecurrence}
                          setNewRecurrence={setNewRecurrence}
                          newXp={newXp}
                          setNewXp={setNewXp}
                          onClose={resetForm}
                          onSave={handleSave}
                          saveLabel={t('tasks.saveChanges')}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Fragment>
              );
            })}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-secondary/40 to-secondary/10 flex items-center justify-center shrink-0">
              <Package className="h-6 w-6 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{t('tasks.restockTitle')}</p>
              <p className="text-[10px] text-muted-foreground">{t('tasks.restockSubtitle')}</p>
            </div>
            {shopping.filter((i) => !i.completed).length > 0 && (
              <span className="shrink-0 px-2.5 py-1 rounded-full gradient-primary text-[11px] font-bold text-primary-foreground">
                {shopping.filter((i) => !i.completed).length}
              </span>
            )}
          </div>

          {shopping.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t('tasks.noItemsYet')}
            </p>
          )}

          <div className="space-y-2">
            {shopping.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`glass rounded-xl p-3.5 ${item.completed ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${item.completed ? 'line-through' : ''}`}>
                      {item.item}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {t('tasks.addedBy', { name: item.addedBy })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.completed ? (
                      <button
                        onClick={() => {
                          void toggleShopItem(item.id);
                        }}
                        className="h-8 px-3 rounded-lg glass text-xs font-medium flex items-center gap-1 text-primary"
                      >
                        <ShoppingCart className="h-3 w-3" />
                        {t('common.undo')}
                      </button>
                    ) : (
                      <button
                        onClick={() => openBuyForm(item)}
                        className="h-8 px-3 rounded-lg glass text-xs font-medium flex items-center gap-1 text-muted-foreground"
                      >
                        <ShoppingCart className="h-3 w-3" />
                        {t('common.bought')}
                      </button>
                    )}
                    <button
                      onClick={() => startEditShop(item)}
                      className="h-8 w-8 rounded-lg glass flex items-center justify-center shrink-0"
                      aria-label={t('tasks.editShoppingItemAria')}
                    >
                      <Edit3 className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => {
                        void deleteShopItem(item.id);
                      }}
                      className="h-8 w-8 rounded-lg glass flex items-center justify-center shrink-0"
                      aria-label={t('tasks.deleteShoppingItemAria')}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {buyingShopId === item.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-3 space-y-2"
                    >
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          value={buyAmount}
                          onChange={(event) => setBuyAmount(event.target.value)}
                          placeholder={t('tasks.shopping.amountPlaceholder')}
                          className="bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
                        />
                        <select
                          value={buyPaidBy}
                          onChange={(event) => setBuyPaidBy(event.target.value)}
                          className="bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
                        >
                          {memberOptions.map((member) => (
                            <option key={member} value={member}>
                              {member}
                            </option>
                          ))}
                        </select>
                      </div>

                      <p className="text-[10px] text-muted-foreground">
                        {t('tasks.shopping.splitWith')}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {memberOptions.map((member) => (
                          <button
                            key={member}
                            onClick={() => toggleBuyParticipant(member)}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                              buyParticipants.includes(member)
                                ? 'gradient-primary text-primary-foreground'
                                : 'glass text-muted-foreground'
                            }`}
                          >
                            {member}
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={buyDate}
                          onChange={(event) => setBuyDate(event.target.value)}
                          className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
                          aria-label={t('tasks.shopping.purchaseDate')}
                        />
                        <input
                          type="date"
                          value={buyDeadline}
                          onChange={(event) => setBuyDeadline(event.target.value)}
                          className="flex-1 bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
                          aria-label={t('economy.deadlineDateLabel')}
                        />
                        <button
                          onClick={() => {
                            void submitBought(item.id);
                          }}
                          className="px-4 rounded-lg gradient-primary text-xs font-semibold text-primary-foreground"
                        >
                          {t('tasks.shopping.logPurchase')}
                        </button>
                        <button
                          onClick={() => setBuyingShopId(null)}
                          className="h-9 w-9 rounded-lg glass flex items-center justify-center"
                          aria-label={t('tasks.shopping.closePurchaseForm')}
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {editingShopId === item.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-2"
                    >
                      <div className="flex gap-2">
                        <input
                          value={editShopText}
                          onChange={(event) => setEditShopText(event.target.value)}
                          className="flex-1 bg-muted/50 rounded-lg px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void saveEditShop(item.id);
                            if (event.key === 'Escape') setEditingShopId(null);
                          }}
                        />
                        <button
                          onClick={() => {
                            void saveEditShop(item.id);
                          }}
                          className="px-3 rounded-lg gradient-primary text-xs font-medium text-primary-foreground"
                        >
                          {t('tasks.saveChanges')}
                        </button>
                        <button
                          onClick={() => setEditingShopId(null)}
                          className="h-8 w-8 rounded-lg glass flex items-center justify-center"
                          aria-label={t('common.back')}
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
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

export default function TasksPage() {
  return <TasksMain />;
}
