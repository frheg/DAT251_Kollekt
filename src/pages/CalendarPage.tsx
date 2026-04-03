import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import { useUser } from '../context/UserContext';
import { connectCollectiveRealtime } from '../lib/realtime';
import type { CalendarEvent, EventType } from '../lib/types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const EVENT_TYPES: EventType[] = ['PARTY', 'MOVIE', 'DINNER', 'OTHER'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const typeColors: Record<EventType, string> = {
  PARTY:  'bg-secondary/20 border-l-secondary',
  MOVIE:  'bg-accent/20 border-l-accent',
  DINNER: 'bg-primary/20 border-l-primary',
  OTHER:  'bg-destructive/20 border-l-destructive',
};
const typeEmoji: Record<EventType, string> = {
  PARTY: '🎉', MOVIE: '🎬', DINNER: '🍝', OTHER: '📌',
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

export default function CalendarPage() {
  const { currentUser } = useUser();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('12:00');
  const [newType, setNewType] = useState<EventType>('OTHER');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const name = currentUser?.name ?? '';

  const fetchEvents = async () => {
    if (!name) return;
    const res = await api.get<CalendarEvent[]>(`/events?memberName=${encodeURIComponent(name)}`);
    setEvents(res);
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
    if (!name) return;
    api.get<{ connected: boolean }>(`/google-calendar/status?memberName=${encodeURIComponent(name)}`)
      .then((r) => setGoogleConnected(r.connected))
      .catch(() => {});
  }, [name]);

  useEffect(() => {
    if (!name) return;
    const disconnect = connectCollectiveRealtime(name, (event) => {
      if (['EVENT_CREATED', 'EVENT_DELETED', 'EVENT_UPDATED'].includes(event.type)) {
        fetchEvents();
      }
    });
    return disconnect;
  }, [name]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setSelectedDay(1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setSelectedDay(1);
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    const created = await api.post<CalendarEvent>('/events', {
      title: newTitle,
      date,
      time: newTime,
      type: newType,
      organizer: name,
      attendees: 1,
      // Ask backend to mirror events to Google when account tokens are available.
      syncToGoogle: true,
    });
    setEvents((prev) => [...prev, created]);
    setNewTitle(''); setNewTime('12:00'); setNewType('OTHER');
    setShowAdd(false);
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/events/${id}`);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const handleGoogleSync = async () => {
    if (!name) return;
    if (googleConnected) {
      await api.delete(`/google-calendar/disconnect?memberName=${encodeURIComponent(name)}`);
      setGoogleConnected(false);
    } else {
      const authWindow = window.open('', '_blank');
      try {
        const res = await api.get<{ url: string }>(`/google-calendar/auth-url?memberName=${encodeURIComponent(name)}`);
        if (authWindow) {
          authWindow.location.href = res.url;
        } else {
          window.location.href = res.url;
        }
      } catch {
        authWindow?.close();
      }
    }
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = now.getFullYear() === year && now.getMonth() === month ? now.getDate() : -1;

  const selectedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  const dayEvents = events.filter((e) => e.date === selectedDateStr).sort((a, b) => a.time.localeCompare(b.time));
  const eventDays = new Set(events.map((e) => {
    const d = new Date(e.date);
    if (d.getFullYear() === year && d.getMonth() === month) return d.getDate();
    return null;
  }).filter(Boolean));

  if (loading) return <div className="space-y-3 pt-4 animate-pulse"><div className="glass rounded-2xl h-64" /></div>;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">{MONTH_NAMES[month]} {year}</h2>
        <div className="flex gap-1">
          <button onClick={prevMonth} className="h-8 w-8 rounded-lg glass flex items-center justify-center"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={nextMonth} className="h-8 w-8 rounded-lg glass flex items-center justify-center"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Month grid */}
      <div className="glass rounded-2xl p-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS.map((d) => <p key={d} className="text-center text-[10px] text-muted-foreground font-medium">{d}</p>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
            <button key={day} onClick={() => setSelectedDay(day)}
              className={`relative w-full aspect-square rounded-lg text-xs font-medium flex items-center justify-center transition-all ${
                day === selectedDay ? 'gradient-primary text-primary-foreground'
                : day === today ? 'bg-primary/20 text-primary'
                : 'hover:bg-muted'
              }`}>
              {day}
              {eventDays.has(day) && day !== selectedDay && (
                <div className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Google Calendar sync */}
      <button onClick={handleGoogleSync}
        className={`w-full glass rounded-xl p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors ${googleConnected ? 'border-primary/30' : ''}`}>
        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium">Sync Google Calendar</p>
          <p className="text-[10px] text-muted-foreground">
            {googleConnected ? 'Connected — click to disconnect' : 'Connect to import & export events'}
          </p>
        </div>
        {googleConnected && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">Connected</span>}
      </button>

      {/* Events for selected day */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {selectedDay === today ? 'Today' : `${MONTH_NAMES[month]} ${selectedDay}`}
          </h3>
          <button onClick={() => setShowAdd(true)} className="h-8 w-8 rounded-xl gradient-primary flex items-center justify-center">
            <Plus className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>

        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="glass rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">New Event</p>
                  <button onClick={() => setShowAdd(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
                </div>
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Event title..."
                  className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
                <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)}
                  className="w-full bg-muted/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]" />
                <div className="flex gap-2">
                  {EVENT_TYPES.map((t) => (
                    <button key={t} onClick={() => setNewType(t)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all ${newType === t ? 'gradient-primary text-primary-foreground' : 'glass text-muted-foreground'}`}>
                      {typeEmoji[t]} {t}
                    </button>
                  ))}
                </div>
                <button onClick={handleAdd} className="w-full gradient-primary rounded-lg py-2 text-sm font-semibold text-primary-foreground">
                  Add Event
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {dayEvents.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No events for this day</p>
        )}

        {dayEvents.map((e, i) => (
          <motion.div key={e.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
            className={`glass rounded-xl p-3 border-l-2 ${typeColors[e.type]} flex items-center gap-3`}>
            <span className="text-xs text-muted-foreground w-12 shrink-0">{e.time}</span>
            <span className="text-lg shrink-0">{typeEmoji[e.type]}</span>
            <span className="text-sm font-medium flex-1">{e.title}</span>
            <button onClick={() => handleDelete(e.id)} className="h-7 w-7 rounded-lg glass flex items-center justify-center shrink-0">
              <Trash2 className="h-3 w-3 text-destructive" />
            </button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
