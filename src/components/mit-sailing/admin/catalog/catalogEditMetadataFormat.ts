import type { CatalogEditContributor } from '@/libs/admin/catalog/types';

const dateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/New_York',
} as const;

export function catalogEditTimestamp(value: string): number | null {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export function formatCatalogEditDate(value: string, locale: string): string {
  const time = catalogEditTimestamp(value);
  if (time === null) {
    return value;
  }
  const parts = new Intl.DateTimeFormat(locale, dateTimeFormatOptions)
    .formatToParts(new Date(time))
    .filter((part) => part.type !== 'literal');
  const partValue = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const month = partValue('month');
  const day = partValue('day');
  const year = partValue('year');
  const hour = partValue('hour');
  const minute = partValue('minute');
  const dayPeriod = partValue('dayPeriod');
  if (!month || !day || !year || !hour || !minute || !dayPeriod) {
    return value;
  }
  return `${month} ${day}, ${year}, ${hour}:${minute} ${dayPeriod}`;
}

export function formatCatalogEditRelativeTime(
  value: string,
  locale: string,
  now = Date.now()
): string {
  const time = catalogEditTimestamp(value);
  if (time === null) {
    return value;
  }
  const seconds = Math.round((time - now) / 1000);
  const absSeconds = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (absSeconds < 60) {
    return formatter.format(seconds, 'second');
  }
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) {
    return formatter.format(minutes, 'minute');
  }
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return formatter.format(hours, 'hour');
  }
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 14) {
    return formatter.format(days, 'day');
  }
  return formatCatalogEditDate(value, locale);
}

export function catalogEditContributorLabel(
  contributor: CatalogEditContributor,
  date: string,
  locale: string
): string {
  return `${contributor.name} · ${formatCatalogEditDate(date, locale)}`;
}
