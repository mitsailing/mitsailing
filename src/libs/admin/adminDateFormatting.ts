import { EVENTS_TIME_ZONE } from '@/lib/mit-sailing/nyTime';

export function formatAdminDate(value: Date | null, locale: string): string {
  if (!value) {
    return '';
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: EVENTS_TIME_ZONE,
  }).format(value);
}
