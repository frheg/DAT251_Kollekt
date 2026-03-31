import { useEffect, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Film,
  Link,
  PartyPopper,
  Pizza,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { api, getUserMessage } from '../lib/api';
import { connectCollectiveRealtime } from '../lib/realtime';
import { formatLongDate, formatShortDate, formatTime, isUpcomingDate } from '../lib/ui';
import {
  EmptyState,
  PageHeader,
  PageStack,
  SectionCard,
  SelectField,
  StatusMessage,
} from './shared/page';
import type { CalendarEvent, EventType } from '../lib/types';

interface CalendarViewProps {
  currentUserName: string;
}

const monthNames = [
  'Januar',
  'Februar',
  'Mars',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const dayNames = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];

const eventAppearance: Record<
  EventType,
  {
    label: string;
    icon: typeof Calendar;
    badgeClassName: string;
    softClassName: string;
  }
> = {
  PARTY: {
    label: 'Sosialt',
    icon: PartyPopper,
    badgeClassName: 'bg-rose-100 text-rose-700',
    softClassName: 'border-rose-200 bg-rose-50/80',
  },
  MOVIE: {
    label: 'Film',
    icon: Film,
    badgeClassName: 'bg-blue-100 text-blue-700',
    softClassName: 'border-blue-200 bg-blue-50/80',
  },
  DINNER: {
    label: 'Middag',
    icon: Pizza,
    badgeClassName: 'bg-amber-100 text-amber-700',
    softClassName: 'border-amber-200 bg-amber-50/80',
  },
  OTHER: {
    label: 'Annet',
    icon: Calendar,
    badgeClassName: 'bg-slate-100 text-slate-700',
    softClassName: 'border-slate-200 bg-slate-50/80',
  },
};

export function CalendarView({ currentUserName }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [eventError, setEventError] = useState('');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [syncToGoogle, setSyncToGoogle] = useState(false);
  const [form, setForm] = useState({
    title: '',
    date: '',
    time: '',
    description: '',
    organizer: currentUserName,
    type: 'OTHER' as EventType,
  });

  useEffect(() => {
    const load = async () => {
      const data = await api.get<CalendarEvent[]>(
        `/events?memberName=${encodeURIComponent(currentUserName)}`,
      );
      setEvents(data);
    };

    void load();
  }, [currentUserName]);

  useEffect(() => {
    setForm((previous) => ({ ...previous, organizer: currentUserName }));
  }, [currentUserName]);

  useEffect(() => {
    const load = async () => {
      const data = await api.get<CalendarEvent[]>(
        `/events?memberName=${encodeURIComponent(currentUserName)}`,
      );
      setEvents(data);
    };
    return connectCollectiveRealtime(currentUserName, (event) => {
      if (event.type === 'EVENT_CREATED' || event.type === 'EVENT_DELETED') {
        void load();
      }
    });
  }, [currentUserName]);

  useEffect(() => {
    const checkGoogle = async () => {
      try {
        const result = await api.get<{ connected: boolean }>(
          `/google-calendar/status?memberName=${encodeURIComponent(currentUserName)}`,
        );
        setGoogleConnected(result.connected);
      } catch {
        setGoogleConnected(false);
      }
    };
    void checkGoogle();
  }, [currentUserName]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const days: Array<number | null> = [];

    for (let index = 0; index < startingDayOfWeek; index += 1) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      days.push(day);
    }

    return days;
  };

  const getEventsForDay = (day: number | null) => {
    if (!day) return [];

    const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(
      2,
      '0',
    )}-${String(day).padStart(2, '0')}`;

    return events.filter((event) => event.date === dateString);
  };

  const isToday = (day: number | null) => {
    if (!day) return false;

    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const saveEvent = async () => {
    if (!form.title || !form.date || !form.time) {
      setEventError('Fyll inn tittel, dato og tidspunkt før du lagrer.');
      return;
    }

    try {
      const createdEvent = await api.post<CalendarEvent>('/events', {
        title: form.title.trim(),
        date: form.date,
        time: form.time,
        description: form.description || null,
        organizer: form.organizer,
        attendees: 1,
        type: form.type,
        syncToGoogle,
      });

      setEvents((previous) => [...previous, createdEvent]);
      setForm({
        title: '',
        date: '',
        time: '',
        description: '',
        organizer: currentUserName,
        type: 'OTHER',
      });
      setEventError('');
      setIsDialogOpen(false);
    } catch (error) {
      setEventError(getUserMessage(error, 'Kunne ikke lagre planen akkurat nå.'));
    }
  };

  const deleteEvent = async (eventId: number) => {
    try {
      await api.delete(`/events/${eventId}`);
      setEvents((previous) => previous.filter((e) => e.id !== eventId));
    } catch (error) {
      setEventError(getUserMessage(error, 'Kunne ikke slette planen akkurat nå.'));
    }
  };

  const nextMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const previousMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const upcomingEvents = events
    .filter((event) => isUpcomingDate(event.date))
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
    .slice(0, 6);

  const thisMonthEvents = events.filter(
    (event) =>
      new Date(event.date).getMonth() === currentDate.getMonth() &&
      new Date(event.date).getFullYear() === currentDate.getFullYear(),
  );

  return (
    <PageStack>
      <PageHeader
        icon={Calendar}
        eyebrow="Kalender"
        title="Felles kalender"
        description="Planlegg middager, filmkvelder og alt annet dere vil få på plass sammen."
        action={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Ny plan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Legg inn noe i kalenderen</DialogTitle>
                <DialogDescription>
                  Skriv inn det viktigste, så dukker det opp for hele kollektivet.
                </DialogDescription>
              </DialogHeader>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveEvent();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="event-title">Tittel</Label>
                  <Input
                    id="event-title"
                    placeholder="For eksempel filmkveld"
                    value={form.title}
                    onChange={(event) => {
                      setEventError('');
                      setForm({ ...form, title: event.target.value });
                    }}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="event-date">Dato</Label>
                    <Input
                      id="event-date"
                      type="date"
                      value={form.date}
                      onChange={(event) => {
                        setEventError('');
                        setForm({ ...form, date: event.target.value });
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="event-time">Tidspunkt</Label>
                    <Input
                      id="event-time"
                      type="time"
                      value={form.time}
                      onChange={(event) => {
                        setEventError('');
                        setForm({ ...form, time: event.target.value });
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-type">Type</Label>
                  <SelectField
                    id="event-type"
                    value={form.type}
                    onChange={(event) => {
                      setEventError('');
                      setForm({ ...form, type: event.target.value as EventType });
                    }}
                  >
                    <option value="OTHER">Annet</option>
                    <option value="PARTY">Sosialt</option>
                    <option value="MOVIE">Film</option>
                    <option value="DINNER">Middag</option>
                  </SelectField>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event-description">Kort beskjed</Label>
                  <Textarea
                    id="event-description"
                    placeholder="Hva trenger folk å vite?"
                    value={form.description}
                    onChange={(event) => {
                      setEventError('');
                      setForm({ ...form, description: event.target.value });
                    }}
                  />
                </div>

                {googleConnected && (
                  <div className="flex items-center gap-2">
                    <input
                      id="sync-google"
                      type="checkbox"
                      checked={syncToGoogle}
                      onChange={(e) => setSyncToGoogle(e.target.checked)}
                      className="size-4 rounded border-slate-300"
                    />
                    <Label htmlFor="sync-google" className="text-sm font-normal text-slate-600">
                      Legg til i Google Kalender
                    </Label>
                  </div>
                )}

                {eventError && <StatusMessage tone="rose">{eventError}</StatusMessage>}

                <Button className="w-full" type="submit">
                  Lagre plan
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-sm text-slate-500">Denne måneden</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {thisMonthEvents.length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
            <p className="text-sm text-slate-500">Neste plan</p>
            <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
              {upcomingEvents[0] ? formatLongDate(upcomingEvents[0].date) : 'Ikke satt'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-sm text-slate-500">Google Kalender</p>
            {googleConnected ? (
              <p className="mt-2 text-lg font-semibold tracking-tight text-emerald-600">Tilkoblet</p>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  const result = await api.get<{ url: string }>(
                    `/google-calendar/auth-url?memberName=${encodeURIComponent(currentUserName)}`,
                  );
                  window.location.href = result.url;
                }}
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
              >
                <Link className="size-3.5" />
                Koble til
              </button>
            )}
          </div>
        </div>
      </PageHeader>

      <SectionCard
        title={`${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
        description="Månedsvisning av alt som ligger i kalenderen."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" type="button" onClick={previousMonth}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon" type="button" onClick={nextMonth}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <div className="min-w-[42rem]">
            <div className="grid grid-cols-7 gap-2">
              {dayNames.map((day) => (
                <div key={day} className="px-2 py-2 text-center text-sm font-medium text-slate-500">
                  {day}
                </div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-2">
              {getDaysInMonth(currentDate).map((day, index) => {
                const eventsForDay = getEventsForDay(day);
                const today = isToday(day);

                return (
                  <div
                    key={`${day ?? 'empty'}-${index}`}
                    className={`min-h-28 rounded-2xl border px-2 py-2 ${
                      !day
                        ? 'border-transparent bg-transparent'
                        : today
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : eventsForDay.length > 0
                            ? 'border-slate-200 bg-slate-50/80'
                            : 'border-slate-200 bg-white'
                    }`}
                  >
                    {day && (
                      <>
                        <p className={`text-sm font-semibold ${today ? 'text-white' : 'text-slate-900'}`}>
                          {day}
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {eventsForDay.slice(0, 2).map((event) => {
                            const appearance = eventAppearance[event.type] ?? eventAppearance.OTHER;
                            return (
                              <div
                                key={event.id}
                                className={`rounded-xl px-2 py-1 text-xs font-medium ${
                                  today ? 'bg-white/15 text-white' : appearance.badgeClassName
                                }`}
                              >
                                {formatTime(event.time)} {event.title}
                              </div>
                            );
                          })}
                          {eventsForDay.length > 2 && (
                            <div className={`px-1 text-xs ${today ? 'text-slate-200' : 'text-slate-500'}`}>
                              +{eventsForDay.length - 2} flere
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Neste planer"
        description="Det som ligger nærmest i tid akkurat nå."
      >
        {upcomingEvents.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Ingen planer enda"
            description="Legg inn neste middag, husmøte eller sosiale kveld her."
          />
        ) : (
          <div className="space-y-3">
            {upcomingEvents.map((event) => {
              const appearance = eventAppearance[event.type] ?? eventAppearance.OTHER;
              const Icon = appearance.icon;

              return (
                <div
                  key={event.id}
                  className={`rounded-2xl border px-4 py-4 shadow-sm ${appearance.softClassName}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                        <Icon className="size-5" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-950">{event.title}</p>
                          <Badge className={appearance.badgeClassName}>{appearance.label}</Badge>
                        </div>
                        <p className="text-sm text-slate-600">
                          {formatShortDate(event.date)} kl. {formatTime(event.time)}
                        </p>
                        {event.description && (
                          <p className="text-sm leading-6 text-slate-600">{event.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                          <span>Arrangør: {event.organizer}</span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="size-4" />
                            {event.attendees}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteEvent(event.id)}
                      className="shrink-0 self-start text-slate-400 transition-colors hover:text-rose-600"
                      aria-label="Slett plan"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </PageStack>
  );
}
