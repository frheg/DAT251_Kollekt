const shortDateFormatter = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'short',
});

const longDateFormatter = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('nb-NO', {
  hour: '2-digit',
  minute: '2-digit',
});

export function formatShortDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return shortDateFormatter.format(date);
}

export function formatLongDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return longDateFormatter.format(date);
}

export function formatDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return dateTimeFormatter.format(date);
}

export function formatTime(value: string): string {
  if (/^\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 5);
  }

  return timeFormatter.format(new Date(value));
}

export function formatAmount(value: number): string {
  return `${Math.round(value)} kr`;
}

export function getRelativeDayLabel(dateString: string): string {
  const targetDate = new Date(dateString);
  targetDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const differenceInDays = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (differenceInDays === 0) return 'I dag';
  if (differenceInDays === 1) return 'I morgen';
  if (differenceInDays < 0) return `${Math.abs(differenceInDays)} dager forsinket`;
  return `${differenceInDays} dager igjen`;
}

export function isOverdueDate(dateString: string): boolean {
  const targetDate = new Date(dateString);
  targetDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return targetDate.getTime() < today.getTime();
}

export function isUpcomingDate(dateString: string): boolean {
  const targetDate = new Date(dateString);
  targetDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return targetDate.getTime() >= today.getTime();
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const avatarToneClasses = [
  'bg-slate-900 text-white',
  'bg-blue-700 text-white',
  'bg-emerald-700 text-white',
  'bg-amber-600 text-white',
  'bg-stone-700 text-white',
];

export function getAvatarToneClass(name: string): string {
  return avatarToneClasses[name.length % avatarToneClasses.length];
}
