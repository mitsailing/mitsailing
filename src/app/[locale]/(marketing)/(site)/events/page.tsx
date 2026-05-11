import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { connection } from 'next/server';
import { EventsListView } from '@/components/mit-sailing/events/EventsListView';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import {
  buildEventCalendarOccurrenceRows,
  buildEventCalendarWeeks,
  clampEventCalendarMonth,
  getCurrentEventCalendarDayKey,
  getCurrentEventCalendarMonth,
  getEventCalendarMonthRange,
  parseEventCalendarMonthParam,
} from '@/libs/mit-sailing/eventCalendar';
import {
  getPublishedEventCalendarMonthBounds,
  listPublishedEventDatesForCalendarMonth,
  listVisibleEventCategoriesForPublicCalendarMonth,
} from '@/libs/mit-sailing/eventQueries';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    month?: string | string[];
    category?: string | string[];
  }>;
};

/**
 * Resolves optional search param to the first value for repeated keys.
 *
 * @param value - Search param value from Next.js.
 * @returns First value when repeated, otherwise the raw value.
 */
function firstSearchParamValue(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingEvents',
  });
  return { title: t('meta_title_list') };
}

/**
 * Public events calendar. Request-bound: `connection()` plus `searchParams` (month, category)
 * tie this segment to each request; segment `revalidate` is not used (see catalog pages without
 * query input for ISR).
 *
 * @param props - Locale params and calendar filters
 * @returns Events calendar page
 */
export default async function EventsListPage(props: PageProps) {
  await connection();
  const { locale } = await props.params;
  const { month: monthParam, category: categoryParam } =
    await props.searchParams;
  setRequestLocale(locale);

  const reference = new Date();
  const requestedMonth = parseEventCalendarMonthParam(
    firstSearchParamValue(monthParam),
    reference
  );
  const [bounds, t] = await Promise.all([
    getPublishedEventCalendarMonthBounds(),
    getTranslations({ locale, namespace: 'MitSailingRoutes' }),
  ]);
  const visibleMonth = clampEventCalendarMonth(requestedMonth, bounds);
  const range = getEventCalendarMonthRange(visibleMonth);
  const categories = await listVisibleEventCategoriesForPublicCalendarMonth({
    rangeStart: range.start,
    rangeEndExclusive: range.endExclusive,
  });
  const selectedCategoryCandidate = firstSearchParamValue(categoryParam);
  const selectedCategoryId = categories.some(
    (category) => category.id === selectedCategoryCandidate
  )
    ? selectedCategoryCandidate
    : undefined;
  const eventDates = await listPublishedEventDatesForCalendarMonth({
    rangeStart: range.start,
    rangeEndExclusive: range.endExclusive,
    categoryId: selectedCategoryId,
  });
  const occurrenceRows = buildEventCalendarOccurrenceRows({
    eventDates,
    rangeStartKey: range.firstDayKey,
    rangeEndKey: range.lastDayKey,
  });

  return (
    <SiteSectionShell
      locale={locale}
      segments={[{ label: t('section_events') }]}
    >
      <SiteSectionMain maxWidth="7xl" variant="catalog">
        <EventsListView
          bounds={bounds}
          categories={categories}
          currentMonth={getCurrentEventCalendarMonth(reference)}
          locale={locale}
          occurrenceRows={occurrenceRows}
          reference={reference}
          selectedCategoryId={selectedCategoryId}
          todayKey={getCurrentEventCalendarDayKey(reference)}
          visibleMonth={visibleMonth}
          weeks={buildEventCalendarWeeks(visibleMonth)}
        />
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
