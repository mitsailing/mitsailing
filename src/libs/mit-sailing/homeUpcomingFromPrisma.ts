import {
  addNyCalendarDays,
  EVENTS_TIME_ZONE,
  nyYmd,
  startOfNyCalendarDay,
} from '@/lib/mit-sailing/nyTime';
import { prisma } from '@/libs/DB';
import { formatEasternSameDayTimeRange } from '@/libs/mit-sailing/easternTimeFormat';

export type HomeUpcomingRow = {
  rowKey: string;
  eventName: string;
  eventSlug: string;
  line: string;
  /** Event category id (for accent color) */
  categoryId: string;
};

export type HomeUpcomingDayGroup = {
  dateKey: string;
  isToday: boolean;
  headingLabel: string;
  rows: HomeUpcomingRow[];
};

function formatCalendarDayHeading(
  dateKey: string,
  referenceYear: number
): string {
  const d = startOfNyCalendarDay(dateKey);
  const y = Number(dateKey.slice(0, 4));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: EVENTS_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(y === referenceYear ? {} : { year: 'numeric' as const }),
  }).format(d);
}

/**
 * Upcoming public events in the next 7 NY calendar days, for the home page sidebar
 * (aligns with mit-redesign `getUpcomingOccurrences` + `groupUpcomingByStartDay`).
 *
 * @returns Day groups with event rows, ordered by Eastern day and start time
 */
export async function getHomeUpcomingDayGroups(): Promise<
  HomeUpcomingDayGroup[]
> {
  const ref = new Date();
  const todayKey = nyYmd(ref);
  const windowEndKey = addNyCalendarDays(todayKey, 6);
  const refYear = Number(todayKey.slice(0, 4));

  const found = await prisma.eventDate.findMany({
    where: {
      startDateTime: { gte: ref },
      event: { isPublished: true },
    },
    orderBy: { startDateTime: 'asc' },
    take: 200,
    include: { event: true },
  });

  const inWindow = found.filter((d) => nyYmd(d.startDateTime) <= windowEndKey);

  const flat: { dayKey: string; sort: number; row: HomeUpcomingRow }[] = [];
  for (const d of inWindow) {
    const start = d.startDateTime;
    const end = d.endDateTime;
    const dayKey = nyYmd(start);
    flat.push({
      dayKey,
      sort: start.getTime(),
      row: {
        rowKey: d.id,
        eventName: d.event.name,
        eventSlug: d.event.slug,
        line: formatEasternSameDayTimeRange(start, end),
        categoryId: d.event.eventCategoryId,
      },
    });
  }

  const byDay = new Map<string, HomeUpcomingRow[]>();
  for (const { dayKey, row } of flat.toSorted((a, b) => a.sort - b.sort)) {
    if (!byDay.has(dayKey)) {
      byDay.set(dayKey, []);
    }
    const dayRows = byDay.get(dayKey);
    if (dayRows) {
      dayRows.push(row);
    }
  }

  const keys = [...byDay.keys()].toSorted();
  return keys.map((dateKey) => ({
    dateKey,
    isToday: dateKey === todayKey,
    headingLabel:
      dateKey === todayKey
        ? 'Today'
        : formatCalendarDayHeading(dateKey, refYear),
    rows: byDay.get(dateKey) ?? [],
  }));
}
