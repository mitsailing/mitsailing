import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
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

export const revalidate = 900;

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    month?: string | string[];
    category?: string | string[];
  }>;
};

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

export default async function EventsListPage(props: PageProps) {
  const { locale } = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(locale);

  const reference = new Date();
  const requestedMonth = parseEventCalendarMonthParam(
    firstSearchParamValue(searchParams.month),
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
  const selectedCategoryCandidate = firstSearchParamValue(
    searchParams.category
  );
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
