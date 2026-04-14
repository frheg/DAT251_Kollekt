import i18n from './index';

function getLocale(language = i18n.resolvedLanguage ?? i18n.language): string {
  return language === 'no' ? 'nb-NO' : 'en-US';
}

function parseDateInput(value: string | Date): Date {
  if (value instanceof Date) return value;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }

  if (/^\d{2}:\d{2}/.test(value)) {
    return new Date(`1970-01-01T${value}`);
  }

  return new Date(value);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
): string {
  return new Intl.DateTimeFormat(getLocale(), options).format(parseDateInput(value));
}

export function formatTime(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
): string {
  return new Intl.DateTimeFormat(getLocale(), options).format(parseDateInput(value));
}

export function formatDateTime(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  },
): string {
  return new Intl.DateTimeFormat(getLocale(), options).format(parseDateInput(value));
}

export function formatMonthYear(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat(getLocale(), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, monthIndex, 1));
}

export function formatMonthDay(date: string | Date): string {
  return formatDate(date, { month: 'long', day: 'numeric' });
}

export function getWeekdayLabels(): string[] {
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(getLocale(), { weekday: 'short' }).format(
      new Date(Date.UTC(2024, 0, 1 + index)),
    ));
}

export function translateKey(baseKey: string, value: string | null | undefined, fallback?: string): string {
  if (!value) return fallback ?? '';
  return i18n.t(`${baseKey}.${value}`, { defaultValue: fallback ?? value });
}

export function translateLowerKey(baseKey: string, value: string | null | undefined, fallback?: string): string {
  if (!value) return fallback ?? '';
  return i18n.t(`${baseKey}.${value.toLowerCase()}`, { defaultValue: fallback ?? value });
}
