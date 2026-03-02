import { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Checkbox } from './ui/checkbox';
import { CheckCircle2, Circle, Plus, Trash2, User, Calendar, ShoppingCart, Sparkles, AlertCircle } from 'lucide-react';
import { Progress } from './ui/progress';
import { api } from '../lib/api';
import type { ShoppingItem, Task } from '../lib/types';

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState('');

  useEffect(() => {
    const load = async () => {
      const [taskData, shoppingData] = await Promise.all([api.get<Task[]>('/tasks'), api.get<ShoppingItem[]>('/tasks/shopping')]);
      setTasks(taskData);
      setShoppingList(shoppingData);
    };

    load();
  }, []);

  const toggleTask = async (id: number) => {
    const updated = await api.patch<Task>(`/tasks/${id}/toggle`);
    setTasks(tasks.map(task => (task.id === id ? updated : task)));
  };

  const toggleShoppingItem = async (id: number) => {
    const updated = await api.patch<ShoppingItem>(`/tasks/shopping/${id}/toggle`);
    setShoppingList(shoppingList.map(item => (item.id === id ? updated : item)));
  };

  const addShoppingItem = async () => {
    if (!newItem.trim()) return;
    const created = await api.post<ShoppingItem>('/tasks/shopping', { item: newItem, addedBy: 'Kasper' });
    setShoppingList([...shoppingList, created]);
    setNewItem('');
  };

  const removeShoppingItem = async (id: number) => {
    await api.delete(`/tasks/shopping/${id}`);
    setShoppingList(shoppingList.filter(item => item.id !== id));
  };

  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const myTasks = tasks.filter(t => t.assignee === 'Kasper' && !t.completed);

  const completionRate = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'SHOPPING':
        return <ShoppingCart className="w-4 h-4" />;
      case 'CLEANING':
        return <Sparkles className="w-4 h-4" />;
      default:
        return <Circle className="w-4 h-4" />;
    }
  };

  const getDaysUntil = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'I dag';
    if (diffDays === 1) return 'I morgen';
    if (diffDays < 0) return 'Forsinket';
    return `${diffDays} dager`;
  };

  const TaskItem = ({ task }: { task: Task }) => {
    const daysUntil = getDaysUntil(task.dueDate);
    const isOverdue = daysUntil === 'Forsinket';

    return (
      <div
        className={`p-4 bg-white rounded-lg border-2 transition-all ${
          task.completed
            ? 'border-green-200 bg-green-50/50'
            : isOverdue
              ? 'border-red-200 bg-red-50/50'
              : 'border-gray-200 hover:border-purple-300'
        }`}
      >
        <div className="flex items-start gap-3">
          <button onClick={() => void toggleTask(task.id)} className="mt-1 flex-shrink-0">
            {task.completed ? (
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            ) : (
              <Circle className="w-6 h-6 text-gray-400 hover:text-purple-600" />
            )}
          </button>

          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={task.completed ? 'line-through text-gray-500' : ''}>{task.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    <User className="w-3 h-3 mr-1" />
                    {task.assignee}
                  </Badge>
                  <Badge variant={isOverdue ? 'destructive' : 'secondary'} className="text-xs">
                    <Calendar className="w-3 h-3 mr-1" />
                    {daysUntil}
                  </Badge>
                  {task.recurring && (
                    <Badge variant="outline" className="text-xs bg-blue-50">
                      Gjentagende
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">+{task.xp} XP</Badge>
                {getCategoryIcon(task.category)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white mb-1">Oppgaveoversikt</h2>
            <p className="text-purple-100 text-sm">{myTasks.length} oppgaver tildelt deg</p>
          </div>
          <div className="text-right">
            <p className="text-3xl">{completionRate}%</p>
            <p className="text-sm text-purple-100">Fullført</p>
          </div>
        </div>
        <Progress value={completionRate} className="h-2 bg-white/30" />
      </Card>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white/80 backdrop-blur">
          <TabsTrigger value="all">Alle</TabsTrigger>
          <TabsTrigger value="mine">Mine oppgaver</TabsTrigger>
          <TabsTrigger value="shopping">Handleliste</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-4">
          <div className="space-y-3">
            <h3 className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-purple-600" />
              Aktive oppgaver ({activeTasks.length})
            </h3>
            {activeTasks.length === 0 ? (
              <Card className="p-8 text-center bg-white/80">
                <p className="text-gray-500">Ingen aktive oppgaver</p>
              </Card>
            ) : (
              activeTasks.map(task => <TaskItem key={task.id} task={task} />)
            )}
          </div>

          {completedTasks.length > 0 && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                Fullført ({completedTasks.length})
              </h3>
              {completedTasks.map(task => <TaskItem key={task.id} task={task} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mine" className="space-y-3 mt-4">
          <h3 className="flex items-center gap-2">
            <User className="w-5 h-5 text-purple-600" />
            Dine oppgaver ({myTasks.length})
          </h3>
          {myTasks.length === 0 ? (
            <Card className="p-8 text-center bg-white/80">
              <p className="text-gray-500">Du har ingen aktive oppgaver</p>
            </Card>
          ) : (
            myTasks.map(task => <TaskItem key={task.id} task={task} />)
          )}
        </TabsContent>

        <TabsContent value="shopping" className="space-y-4 mt-4">
          <Card className="p-6 bg-white/80 backdrop-blur">
            <h3 className="mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-purple-600" />
              Felles handleliste
            </h3>

            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Legg til vare..."
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void addShoppingItem()}
                className="bg-white"
              />
              <Button onClick={() => void addShoppingItem()} className="bg-gradient-to-r from-purple-500 to-pink-500">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {shoppingList.map(item => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                    item.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox checked={item.completed} onCheckedChange={() => void toggleShoppingItem(item.id)} />
                    <div>
                      <p className={item.completed ? 'line-through text-gray-500' : ''}>{item.item}</p>
                      <p className="text-xs text-gray-500">Lagt til av {item.addedBy}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => void removeShoppingItem(item.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
