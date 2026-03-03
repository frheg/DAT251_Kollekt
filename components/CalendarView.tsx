import { useEffect, useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Calendar, ChevronLeft, ChevronRight, Plus, Users, PartyPopper, Film, Pizza } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { api } from '../lib/api';
import type { CalendarEvent, EventType } from '../lib/types';

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [form, setForm] = useState({ title: '', date: '', time: '', description: '', organizer: 'Kasper', type: 'OTHER' as EventType });

  useEffect(() => {
    const load = async () => {
      const data = await api.get<CalendarEvent[]>('/events');
      setEvents(data);
    };
    load();
  }, []);

  const monthNames = ['Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Desember'];
  const dayNames = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days: (number | null)[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(day);

    return days;
  };

  const getEventsForDay = (day: number | null) => {
    if (!day) return [];
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.date === dateStr);
  };

  const isToday = (day: number | null) => {
    if (!day) return false;
    const today = new Date();
    return day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'PARTY':
        return <PartyPopper className="w-4 h-4" />;
      case 'MOVIE':
        return <Film className="w-4 h-4" />;
      case 'DINNER':
        return <Pizza className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'PARTY':
        return 'from-pink-500 to-purple-500';
      case 'MOVIE':
        return 'from-blue-500 to-cyan-500';
      case 'DINNER':
        return 'from-orange-500 to-red-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const saveEvent = async () => {
    if (!form.title || !form.date || !form.time) return;
    const created = await api.post<CalendarEvent>('/events', {
      title: form.title,
      date: form.date,
      time: form.time,
      description: form.description || null,
      organizer: form.organizer,
      attendees: 1,
      type: form.type,
    });
    setEvents([...events, created]);
    setForm({ title: '', date: '', time: '', description: '', organizer: 'Kasper', type: 'OTHER' });
  };

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const upcomingEvents = events.filter(e => new Date(e.date) >= new Date()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white mb-1">Felles kalender</h2>
            <p className="text-blue-100 text-sm">{upcomingEvents.length} kommende events</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-white text-purple-600 hover:bg-gray-100">
                <Plus className="w-4 h-4 mr-2" />
                Nytt event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Opprett nytt event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Tittel</Label>
                  <Input placeholder="F.eks. Filmkveld" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Dato</Label>
                    <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div>
                    <Label>Tid</Label>
                    <Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Beskrivelse</Label>
                  <Textarea placeholder="Valgfri beskrivelse..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                <Button className="w-full bg-gradient-to-r from-purple-500 to-pink-500" onClick={() => void saveEvent()}>
                  Opprett event
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Card>

      <Card className="p-6 bg-white/80 backdrop-blur">
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" size="sm" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3>
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {dayNames.map(day => (
            <div key={day} className="text-center text-sm text-gray-600 p-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {getDaysInMonth(currentDate).map((day, index) => {
            const dayEvents = getEventsForDay(day);
            const today = isToday(day);

            return (
              <div
                key={index}
                className={`min-h-20 p-2 rounded-lg border-2 transition-all ${
                  !day
                    ? 'bg-gray-50 border-gray-100'
                    : today
                      ? 'bg-gradient-to-br from-purple-100 to-pink-100 border-purple-300'
                      : dayEvents.length > 0
                        ? 'bg-blue-50 border-blue-200 hover:border-blue-400 cursor-pointer'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                {day && (
                  <>
                    <div className={`text-sm mb-1 ${today ? 'font-bold text-purple-600' : ''}`}>{day}</div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map(event => (
                        <div key={event.id} className={`text-xs p-1 rounded bg-gradient-to-r ${getEventColor(event.type)} text-white truncate`}>
                          {event.time.substring(0, 5)}
                        </div>
                      ))}
                      {dayEvents.length > 2 && <div className="text-xs text-gray-600">+{dayEvents.length - 2}</div>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6 bg-white/80 backdrop-blur">
        <h3 className="mb-4">Kommende events</h3>
        <div className="space-y-3">
          {upcomingEvents.map(event => (
            <div key={event.id} className={`p-4 rounded-lg bg-gradient-to-r ${getEventColor(event.type)} text-white`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white/20 rounded-lg mt-1">{getEventIcon(event.type)}</div>
                  <div>
                    <h4 className="text-white mb-1">{event.title}</h4>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
                      <span>{new Date(event.date).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}</span>
                      <span>•</span>
                      <span>{event.time.substring(0, 5)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {event.attendees}
                      </span>
                    </div>
                    <p className="text-xs text-white/70 mt-1">Arrangert av {event.organizer}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
