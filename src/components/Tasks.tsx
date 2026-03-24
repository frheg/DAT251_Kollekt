import { motion } from "framer-motion";

// Animated Task Card with rewarding design
type TaskCardProps = {
  task: { id: number; title: string };
  onComplete: (id: number) => void;
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, onComplete }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -30 }}
    whileHover={{ scale: 1.03, boxShadow: "0 6px 32px #f472b655" }}
    className="bg-white rounded-2xl p-4 mb-4 shadow transition-all flex items-center justify-between"
  >
    <span>{task.title}</span>
    <motion.button
      whileTap={{ scale: 0.8, rotate: 20 }}
      onClick={() => onComplete(task.id)}
      className="ml-2 text-green-500 text-xl font-bold"
      aria-label="Complete task"
    >
      ✓
    </motion.button>
  </motion.div>
);
import { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  CheckSquare,
  Circle,
  Plus,
  ShoppingCart,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import { Button } from './ui/button';
import { useRef } from 'react';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Checkbox } from './ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Label } from './ui/label';
import { api, getUserMessage } from '../lib/api';
import { connectCollectiveRealtime } from '../lib/realtime';
import {
  formatShortDate,
  getRelativeDayLabel,
  isOverdueDate,
} from '../lib/ui';
import {
  EmptyState,
  PageHeader,
  PageStack,
  SectionCard,
  SelectField,
  StatusMessage,
} from './shared/page';
import type { AppUser, ShoppingItem, Task, TaskCategory } from '../lib/types';

interface TasksProps {
  currentUserName: string;
}

const categoryConfig: Record<
  TaskCategory,
  {
    label: string;
    icon: typeof Circle;
  }
> = {
  CLEANING: { label: 'Vasking', icon: Sparkles },
  SHOPPING: { label: 'Handling', icon: ShoppingCart },
  OTHER: { label: 'Annet', icon: Circle },
};

interface TaskRowProps {
  task: Task;
  onToggle: (id: number) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function TaskRow({ task, onToggle, onEdit, onDelete }: TaskRowProps) {
  const category = categoryConfig[task.category] ?? categoryConfig.OTHER;
  const CategoryIcon = category.icon;
  const overdue = !task.completed && isOverdueDate(task.dueDate);

  return (
    <div
      className={`rounded-2xl border px-4 py-4 shadow-sm transition ${
        task.completed
          ? 'border-[var(--border)] bg-[var(--muted)]'
          : overdue
            ? 'border-rose-200 bg-rose-50/70'
            : 'border-[var(--border)] bg-[var(--card)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onToggle(task.id)}
          className="mt-0.5 rounded-full text-slate-400 transition hover:text-slate-900"
          aria-label={task.completed ? 'Marker som ikke fullført' : 'Marker som fullført'}
        >
          {task.completed ? (
            <CheckCircle2 className="size-6 text-emerald-600" />
          ) : (
            <Circle className="size-6" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p
                className={`text-base font-medium ${
                  task.completed ? 'text-[var(--muted-foreground)] line-through' : 'text-[var(--foreground)]'
                }`}
              >
                {task.title}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <Badge variant="secondary">
                  <User className="size-3" />
                  {task.assignee}
                </Badge>
                <Badge variant={overdue ? 'destructive' : 'outline'}>
                  <Calendar className="size-3" />
                  {getRelativeDayLabel(task.dueDate)}
                </Badge>
                <Badge variant="outline">
                  <CategoryIcon className="size-3" />
                  {category.label}
                </Badge>
                {task.recurring && <Badge variant="outline">Gjentakende</Badge>}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <span>{formatShortDate(task.dueDate)}</span>
              <Badge className="bg-slate-900 text-white">+{task.xp} XP</Badge>
                <Button size="icon" variant="ghost" aria-label="Rediger oppgave" onClick={() => onEdit(task)}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-1.414.828l-4.243 1.414 1.414-4.243a4 4 0 01.828-1.414z"></path></svg>
                </Button>
                <Button size="icon" variant="ghost" aria-label="Slett oppgave" onClick={() => onDelete(task)}>
                  <Trash2 className="size-4 text-rose-600" />
                </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Tasks({ currentUserName }: TasksProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [members, setMembers] = useState<AppUser[]>([]);
  const [taskError, setTaskError] = useState('');
  const [newItem, setNewItem] = useState('');
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    assignee: currentUserName,
    dueDate: '',
    category: 'OTHER' as TaskCategory,
    xp: 10,
    recurring: false,
  });
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteTask, setDeleteTask] = useState<Task | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const handleEditTask = (task: Task) => {
    setEditTask(task);
    setIsEditDialogOpen(true);
  };

  const handleDeleteTask = (task: Task) => {
    setDeleteTask(task);
    setIsDeleteDialogOpen(true);
  };

  const submitEditTask = async (updated: Partial<Task>) => {
    if (!editTask) return;
    try {
      const patch: any = {};
      if (updated.title !== undefined) patch.title = updated.title;
      if (updated.assignee !== undefined) patch.assignee = updated.assignee;
      if (updated.dueDate !== undefined) patch.dueDate = updated.dueDate;
      if (updated.category !== undefined) patch.category = updated.category;
      if (updated.xp !== undefined) patch.xp = updated.xp;
      if (updated.recurring !== undefined) patch.recurring = updated.recurring;
      const result = await api.patch<Task>(`/tasks/${editTask.id}?memberName=${encodeURIComponent(currentUserName)}`, patch);
      setTasks((prev) => prev.map((t) => (t.id === result.id ? result : t)));
      setIsEditDialogOpen(false);
      setEditTask(null);
    } catch (error) {
      setTaskError(getUserMessage(error, 'Kunne ikke oppdatere oppgaven.'));
    }
  };

  const confirmDeleteTask = async () => {
    if (!deleteTask) return;
    try {
      await api.delete(`/tasks/${deleteTask.id}?memberName=${encodeURIComponent(currentUserName)}`);
      setTasks((prev) => prev.filter((t) => t.id !== deleteTask.id));
      setIsDeleteDialogOpen(false);
      setDeleteTask(null);
    } catch (error) {
      setTaskError(getUserMessage(error, 'Kunne ikke slette oppgaven.'));
    }
  };

  const load = async () => {
    const [taskData, shoppingData, collectiveMembers] = await Promise.all([
      api.get<Task[]>(`/tasks?memberName=${encodeURIComponent(currentUserName)}`),
      api.get<ShoppingItem[]>(`/tasks/shopping?memberName=${encodeURIComponent(currentUserName)}`),
      api.get<AppUser[]>(`/members/collective?memberName=${encodeURIComponent(currentUserName)}`),
    ]);

    setTasks(taskData);
    setShoppingList(shoppingData);
    setMembers(collectiveMembers);
  };

  useEffect(() => {
    void load();
    const disconnect = connectCollectiveRealtime(currentUserName, (event) => {
      if (event.type === 'TASK_UPDATED' || event.type === 'TASK_CREATED') {
        void load();
      }
    });
    return disconnect;
  }, [currentUserName]);

  useEffect(() => {
    setTaskForm((previous) => ({ ...previous, assignee: currentUserName }));
  }, [currentUserName]);

  const toggleTask = async (id: number) => {
    const currentTask = tasks.find((candidate) => candidate.id === id);
    if (!currentTask) return;

    const updatedTask = await api.patch<Task>(
      `/tasks/${id}/toggle?memberName=${encodeURIComponent(currentUserName)}&completed=${!currentTask.completed}`,
    );

    setTasks((previous) =>
      previous.map((task) => (task.id === id ? updatedTask : task)),
    );
  };

  const toggleShoppingItem = async (id: number) => {
    const updatedItem = await api.patch<ShoppingItem>(
      `/tasks/shopping/${id}/toggle?memberName=${encodeURIComponent(currentUserName)}`,
    );

    setShoppingList((previous) =>
      previous.map((item) => (item.id === id ? updatedItem : item)),
    );
  };

  const addShoppingItem = async () => {
    const value = newItem.trim();
    if (!value) return;

    const createdItem = await api.post<ShoppingItem>('/tasks/shopping', {
      item: value,
      addedBy: currentUserName,
    });

    setShoppingList((previous) => [...previous, createdItem]);
    setNewItem('');
  };

  const addTask = async () => {
    const title = taskForm.title.trim();
    if (!title || !taskForm.dueDate || !taskForm.assignee) {
      setTaskError('Fyll inn tittel, ansvarlig og dato før du lagrer.');
      return;
    }

    try {
      const createdTask = await api.post<Task>('/tasks', {
        title,
        assignee: taskForm.assignee,
        dueDate: taskForm.dueDate,
        category: taskForm.category,
        xp: taskForm.xp,
        recurring: taskForm.recurring,
      });

      setTasks((previous) => [...previous, createdTask]);
      setTaskForm({
        title: '',
        assignee: currentUserName,
        dueDate: '',
        category: 'OTHER',
        xp: 10,
        recurring: false,
      });
      setTaskError('');
      setIsTaskDialogOpen(false);
    } catch (error) {
      setTaskError(getUserMessage(error, 'Kunne ikke lagre oppgaven akkurat nå.'));
    }
  };

  const removeShoppingItem = async (id: number) => {
    await api.delete(`/tasks/shopping/${id}?memberName=${encodeURIComponent(currentUserName)}`);
    setShoppingList((previous) => previous.filter((item) => item.id !== id));
  };

  const activeTasks = tasks
    .filter((task) => !task.completed)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  const completedTasks = tasks
    .filter((task) => task.completed)
    .sort((left, right) => right.dueDate.localeCompare(left.dueDate));
  const myTasks = activeTasks.filter((task) => task.assignee === currentUserName);
  const pendingShoppingItems = shoppingList.filter((item) => !item.completed);
  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  return (
    <PageStack>
      <PageHeader
        icon={CheckSquare}
        eyebrow="Oppgaver"
        title="Oppgaver og handleliste"
        description="Fordel ansvar, følg med på frister og hold handlelisten oppdatert."
        action={
          <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Ny oppgave
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle>Legg til oppgave</DialogTitle>
                <DialogDescription>
                  Velg hva som skal gjøres, hvem som tar den og når den skal være ferdig.
                </DialogDescription>
              </DialogHeader>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addTask();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="task-title">Hva skal gjøres?</Label>
                  <Input
                    id="task-title"
                    value={taskForm.title}
                    onChange={(event) => {
                      setTaskError('');
                      setTaskForm({ ...taskForm, title: event.target.value });
                    }}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="task-assignee">Ansvarlig</Label>
                    <SelectField
                      id="task-assignee"
                      value={taskForm.assignee}
                      onChange={(event) => {
                        setTaskError('');
                        setTaskForm({ ...taskForm, assignee: event.target.value });
                      }}
                    >
                      {/* Always include current user as an option */}
                      {(!members.some((m) => m.name === currentUserName)) && (
                        <option key="current-user" value={currentUserName}>
                          {currentUserName}
                        </option>
                      )}
                      {members.map((member) => (
                        <option key={member.id} value={member.name}>
                          {member.name}
                        </option>
                      ))}
                    </SelectField>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="task-date">Frist</Label>
                    <Input
                      id="task-date"
                      type="date"
                      value={taskForm.dueDate}
                      onChange={(event) => {
                        setTaskError('');
                        setTaskForm({ ...taskForm, dueDate: event.target.value });
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-category">Kategori</Label>
                  <SelectField
                    id="task-category"
                    value={taskForm.category}
                    onChange={(event) => {
                      setTaskError('');
                      setTaskForm({
                        ...taskForm,
                        category: event.target.value as TaskCategory,
                      });
                    }}
                  >
                    <option value="OTHER">Annet</option>
                    <option value="CLEANING">Vasking</option>
                    <option value="SHOPPING">Handling</option>
                  </SelectField>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="task-xp">XP</Label>
                    <input
                      id="task-xp"
                      type="number"
                      min={0}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-base"
                      value={taskForm.xp}
                      onChange={(e) => setTaskForm({ ...taskForm, xp: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-7">
                    <input
                      id="task-recurring"
                      type="checkbox"
                      checked={taskForm.recurring}
                      onChange={(e) => setTaskForm({ ...taskForm, recurring: e.target.checked })}
                    />
                    <Label htmlFor="task-recurring">Gjentakende</Label>
                  </div>
                </div>

                {taskError && <StatusMessage tone="rose">{taskError}</StatusMessage>}

                <Button className="w-full" type="submit">
                  Opprett oppgave
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border px-4 py-4 shadow-sm"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--muted-foreground)'
            }}
          >
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Dine åpne oppgaver</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
              {myTasks.length}
            </p>
          </div>
          <div className="rounded-2xl border px-4 py-4 shadow-sm"
            style={{
              background: 'var(--muted)',
              borderColor: 'var(--border)',
              color: 'var(--muted-foreground)'
            }}
          >
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Fullføringsgrad</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
              {completionRate}%
            </p>
          </div>
          <div className="rounded-2xl border px-4 py-4 shadow-sm"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--muted-foreground)'
            }}
          >
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Handleliste</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
              {pendingShoppingItems.length} igjen
            </p>
          </div>
        </div>
      </PageHeader>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">Alle</TabsTrigger>
          <TabsTrigger value="mine">Mine</TabsTrigger>
          <TabsTrigger value="shopping">Handleliste</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-4">
          <SectionCard
            title={`Aktive oppgaver (${activeTasks.length})`}
            description="Det som fortsatt gjenstår å gjøre."
          >
            {activeTasks.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Ingen aktive oppgaver"
                description="Du er ajour. Nye oppgaver dukker opp her."
              />
            ) : (
              <div className="space-y-3">
                {activeTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={toggleTask}
                    onEdit={handleEditTask}
                    onDelete={handleDeleteTask}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {completedTasks.length > 0 && (
            <SectionCard
              title={`Nylig fullført (${completedTasks.length})`}
              description="Oppgaver som allerede er krysset av."
            >
              <div className="space-y-3">
                {completedTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={toggleTask}
                    onEdit={handleEditTask}
                    onDelete={handleDeleteTask}
                  />
                ))}
              </div>
            </SectionCard>
          )}

          {/* Edit Task Dialog - always rendered at top level */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle>Rediger oppgave</DialogTitle>
              </DialogHeader>
              {editTask && (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitEditTask(editTask);
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="edit-task-title">Tittel</Label>
                    <Input
                      id="edit-task-title"
                      value={editTask.title}
                      onChange={(e) => setEditTask({ ...editTask, title: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-task-assignee">Ansvarlig</Label>
                      <SelectField
                        id="edit-task-assignee"
                        value={editTask.assignee}
                        onChange={(e) => setEditTask({ ...editTask, assignee: e.target.value })}
                      >
                        {members.map((member) => (
                          <option key={member.id} value={member.name}>
                            {member.name}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-task-date">Frist</Label>
                      <Input
                        id="edit-task-date"
                        type="date"
                        value={editTask.dueDate}
                        onChange={(e) => setEditTask({ ...editTask, dueDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-task-category">Kategori</Label>
                    <SelectField
                      id="edit-task-category"
                      value={editTask.category}
                      onChange={(e) => setEditTask({ ...editTask, category: e.target.value as TaskCategory })}
                    >
                      <option value="OTHER">Annet</option>
                      <option value="CLEANING">Vasking</option>
                      <option value="SHOPPING">Handling</option>
                    </SelectField>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-task-xp">XP</Label>
                      <input
                        id="edit-task-xp"
                        type="number"
                        min={0}
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-base"
                        value={editTask.xp}
                        onChange={(e) => setEditTask({ ...editTask, xp: Number(e.target.value) })}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-7">
                      <input
                        id="edit-task-recurring"
                        type="checkbox"
                        checked={editTask.recurring}
                        onChange={(e) => setEditTask({ ...editTask, recurring: e.target.checked })}
                      />
                      <Label htmlFor="edit-task-recurring">Gjentakende</Label>
                    </div>
                  </div>
                  <Button className="w-full" type="submit">
                    Lagre endringer
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>

          {/* Delete Task Dialog - always rendered at top level */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle>Slett oppgave</DialogTitle>
              </DialogHeader>
              <div className="py-4">Er du sikker på at du vil slette denne oppgaven? Dette kan ikke angres.</div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                  Avbryt
                </Button>
                <Button variant="destructive" onClick={confirmDeleteTask}>
                  Slett
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="mine" className="mt-4">
          <SectionCard
            title={`Dine oppgaver (${myTasks.length})`}
            description="Oppgaver som er tildelt deg akkurat nå."
          >
            {myTasks.length === 0 ? (
              <EmptyState
                icon={User}
                title="Ingen oppgaver til deg"
                description="Når du blir satt opp som ansvarlig, vises oppgavene her."
              />
            ) : (
              <div className="space-y-3">
                {myTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={toggleTask}
                    onEdit={handleEditTask}
                    onDelete={handleDeleteTask}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="shopping" className="mt-4">
          <SectionCard
            title="Felles handleliste"
            description="Legg inn det som mangler hjemme, og kryss av når det er kjøpt."
          >
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void addShoppingItem();
              }}
            >
              <Input
                placeholder="Legg til en vare"
                value={newItem}
                onChange={(event) => setNewItem(event.target.value)}
              />
              <Button className="sm:w-auto" type="submit">
                <Plus className="size-4" />
                Legg til
              </Button>
            </form>

            {shoppingList.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="Handlelisten er tom"
                description="Det er bare å legge inn det som trengs hjemme."
              />
            ) : (
              <div className="space-y-3">
                {shoppingList.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm ${
                      item.completed
                        ? 'border-emerald-200 bg-emerald-50/70'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <label className="flex min-w-0 flex-1 items-center gap-3">
                      <Checkbox
                        checked={item.completed}
                        onCheckedChange={() => void toggleShoppingItem(item.id)}
                      />
                      <div className="min-w-0">
                        <p
                          className={`truncate ${
                            item.completed ? 'text-slate-500 line-through' : 'text-slate-950'
                          }`}
                        >
                          {item.item}
                        </p>
                        <p className="text-sm text-slate-500">Lagt til av {item.addedBy}</p>
                      </div>
                    </label>

                    <Button
                      size="icon"
                      type="button"
                      variant="ghost"
                      aria-label={`Fjern ${item.item}`}
                      onClick={() => void removeShoppingItem(item.id)}
                    >
                      <Trash2 className="size-4 text-rose-600" />
                    </Button>
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
