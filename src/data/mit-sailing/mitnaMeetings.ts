import { nyYmd, startOfNyCalendarDay } from '@/lib/mit-sailing/nyTime';
import { MITNA_MEETING_SEED } from './mitnaMeetingSeed';

export type MitnaMeetingListItem = {
  readonly title: string;
  /** Calendar date in America/New_York (ISO YYYY-MM-DD). */
  readonly dateYmd: string;
  readonly href?: string;
};

const meetings: MitnaMeetingListItem[] = MITNA_MEETING_SEED.map((m) => ({
  title: m.title,
  dateYmd: m.dateYmd,
  ...('href' in m && m.href ? { href: m.href } : {}),
}));

function yearFromYmd(ymd: string): number {
  return Number(ymd.slice(0, 4));
}

export type MitnaMeetingsYearGroup = {
  year: number;
  items: MitnaMeetingListItem[];
};

/** Meetings grouped by calendar year (NY date), newest years first. */
export function mitnaMeetingsByYear(): MitnaMeetingsYearGroup[] {
  const byYear = new Map<number, MitnaMeetingListItem[]>();
  for (const m of meetings) {
    const y = yearFromYmd(m.dateYmd);
    const list = byYear.get(y) ?? [];
    list.push(m);
    byYear.set(y, list);
  }
  return [...byYear.entries()]
    .toSorted((a, b) => b[0] - a[0])
    .map(([year, items]) => ({
      year,
      items: [...items].toSorted((a, b) => b.dateYmd.localeCompare(a.dateYmd)),
    }));
}

/**
 * Next dated entry on or after the NY calendar day of `now`.
 * When nothing is scheduled ahead, returns `undefined`.
 */
export function getNextMitnaMeeting(
  now: Date = new Date()
): MitnaMeetingListItem | undefined {
  const today = nyYmd(now);
  const upcoming = meetings
    .filter((m) => m.dateYmd >= today)
    .toSorted((a, b) => a.dateYmd.localeCompare(b.dateYmd));
  return upcoming[0];
}

/** Long weekday date in US Eastern for a NY calendar `YYYY-MM-DD`. */
export function formatMitnaMeetingDateLabel(dateYmd: string): string {
  const anchor = new Date(
    startOfNyCalendarDay(dateYmd).getTime() + 12 * 60 * 60 * 1000
  );
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(anchor);
}
