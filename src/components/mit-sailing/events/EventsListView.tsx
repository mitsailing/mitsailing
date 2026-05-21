import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { EventCalendarOccurrenceRow } from '@/components/mit-sailing/events/EventCalendarOccurrenceRow';
import {
  EVENTS_TIME_ZONE,
  nyMonthFirstYmd,
  startOfNyCalendarDay,
} from '@/lib/mit-sailing/nyTime';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';
import {
  addEventCalendarMonths,
  canGoToNextEventCalendarMonth,
  canGoToPreviousEventCalendarMonth,
  clampEventCalendarMonth,
  eventCalendarMonthKey,
  eventsCalendarHref,
  groupEventCalendarRowsByDay,
  groupEventCalendarRowsForMobile,
} from '@/libs/mit-sailing/eventCalendar';
import type {
  EventCalendarCategory,
  EventCalendarMonth,
  EventCalendarMonthBounds,
  EventCalendarOccurrenceRow as EventCalendarOccurrence,
} from '@/libs/mit-sailing/eventCalendar';

type EventsListViewProps = {
  locale: string;
  categories: EventCalendarCategory[];
  selectedCategoryId?: string;
  visibleMonth: EventCalendarMonth;
  currentMonth: EventCalendarMonth;
  bounds: EventCalendarMonthBounds;
  weeks: (string | null)[][];
  todayKey: string;
  reference: Date;
  occurrenceRows: EventCalendarOccurrence[];
};

function formatMonthTitle(month: EventCalendarMonth, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: EVENTS_TIME_ZONE,
    month: 'long',
    year: 'numeric',
  }).format(startOfNyCalendarDay(nyMonthFirstYmd(month.year, month.month)));
}

// Feb 1, 2026 is a Sunday; these seven consecutive YMDs yield Sun–Sat when each is
// interpreted as a NY calendar day via startOfNyCalendarDay and formatted with
// EVENTS_TIME_ZONE, matching grid column order. Static keys keep that order obvious;
// they could be replaced by a small programmatic sequence if preferred.
function weekdayLabels(locale: string): string[] {
  return [
    '2026-02-01',
    '2026-02-02',
    '2026-02-03',
    '2026-02-04',
    '2026-02-05',
    '2026-02-06',
    '2026-02-07',
  ].map((dayKey) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: EVENTS_TIME_ZONE,
      weekday: 'short',
    }).format(startOfNyCalendarDay(dayKey))
  );
}

/**
 * @param props - Calendar view props
 * @returns Server-rendered public events calendar
 */
export async function EventsListView(props: EventsListViewProps) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingEvents',
  });

  const monthTitle = formatMonthTitle(props.visibleMonth, props.locale);
  const resetMonth = clampEventCalendarMonth(props.currentMonth, props.bounds);
  const resetMonthTitle = formatMonthTitle(resetMonth, props.locale);
  const visibleMonthKey = eventCalendarMonthKey(props.visibleMonth);
  const isViewingResetMonth =
    visibleMonthKey === eventCalendarMonthKey(resetMonth);
  const canGoPrevious = canGoToPreviousEventCalendarMonth(
    props.visibleMonth,
    props.bounds
  );
  const canGoNext = canGoToNextEventCalendarMonth(
    props.visibleMonth,
    props.bounds
  );
  const previousMonth = addEventCalendarMonths(props.visibleMonth, -1);
  const nextMonth = addEventCalendarMonths(props.visibleMonth, 1);
  const rowsByDay = groupEventCalendarRowsByDay(props.occurrenceRows);
  const mobileDayGroups = groupEventCalendarRowsForMobile({
    rows: props.occurrenceRows,
    reference: props.reference,
    locale: props.locale,
    todayLabel: t('today'),
  });
  const weekCells = props.weeks.map((week) => {
    const weekDates = week.filter(
      (dateKey): dateKey is string => typeof dateKey === 'string'
    );
    const weekKey = `${visibleMonthKey}-${weekDates.join('-')}`;
    return {
      key: weekKey,
      cells: week.map((dateKey, dayIndex) => ({
        key: dateKey ?? `${weekKey}-pad-${dayIndex}`,
        dateKey,
      })),
    };
  });

  return (
    <>
      <header className="mb-10">
        <h1 className="mb-3 font-mit-serif text-[clamp(1.75rem,4vw,2.25rem)] leading-tight font-semibold tracking-tight text-mit-text">
          {t('list_heading')}
        </h1>
      </header>

      <nav
        aria-label={t('category_filter_label')}
        className="mb-8 flex flex-wrap gap-2"
      >
        <Link
          aria-current={props.selectedCategoryId ? undefined : 'true'}
          className={cn(
            'rounded-lg border border-mit-line px-3.5 py-2 text-xs font-semibold text-mit-text no-underline',
            textFocusRingClassName,
            props.selectedCategoryId
              ? 'bg-background hover:bg-mit-surface'
              : 'bg-mit-red-highlight text-mit-red dark:border-white/40 dark:bg-white/10 dark:text-white'
          )}
          href={eventsCalendarHref(props.visibleMonth)}
        >
          {t('category_all')}
        </Link>
        {props.categories.map((category) => {
          const isActive = props.selectedCategoryId === category.id;
          return (
            <Link
              aria-current={isActive ? 'true' : undefined}
              className={cn(
                'rounded-lg border border-mit-line px-3.5 py-2 text-xs font-semibold text-mit-text no-underline',
                textFocusRingClassName,
                isActive
                  ? 'bg-mit-red-highlight text-mit-red dark:border-white/40 dark:bg-white/10 dark:text-white'
                  : 'bg-background hover:bg-mit-surface'
              )}
              href={eventsCalendarHref(props.visibleMonth, category.id)}
              key={category.id}
            >
              {category.name}
            </Link>
          );
        })}
      </nav>

      <nav
        aria-label={t('month_nav_label')}
        className="mb-6 grid w-full grid-cols-[auto_1fr_auto] items-center gap-3"
      >
        <div className="flex items-center gap-1.5 justify-self-start">
          {canGoPrevious ? (
            <Link
              aria-label={t('previous_month')}
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-mit-line bg-background text-mit-text no-underline hover:bg-mit-surface',
                textFocusRingClassName
              )}
              href={eventsCalendarHref(previousMonth, props.selectedCategoryId)}
            >
              <ChevronLeft aria-hidden size={20} />
            </Link>
          ) : (
            <button
              aria-label={t('previous_month')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-mit-line bg-background text-mit-text opacity-40"
              disabled
              type="button"
            >
              <ChevronLeft aria-hidden size={20} />
            </button>
          )}
          {canGoNext ? (
            <Link
              aria-label={t('next_month')}
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-mit-line bg-background text-mit-text no-underline hover:bg-mit-surface',
                textFocusRingClassName
              )}
              href={eventsCalendarHref(nextMonth, props.selectedCategoryId)}
            >
              <ChevronRight aria-hidden size={20} />
            </Link>
          ) : (
            <button
              aria-label={t('next_month')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-mit-line bg-background text-mit-text opacity-40"
              disabled
              type="button"
            >
              <ChevronRight aria-hidden size={20} />
            </button>
          )}
        </div>

        <div className="flex min-w-0 justify-center px-2 text-center">
          {isViewingResetMonth ? (
            <time
              className="font-mit-serif text-xl font-semibold text-mit-text md:text-2xl"
              dateTime={visibleMonthKey}
            >
              {monthTitle}
            </time>
          ) : (
            <Link
              aria-label={t('return_to_month', { month: resetMonthTitle })}
              className={cn(
                'rounded-md px-2 py-1 font-mit-serif text-xl font-semibold text-mit-red no-underline hover:underline md:text-2xl dark:text-mit-red-ink',
                textFocusRingClassName
              )}
              href={eventsCalendarHref(resetMonth, props.selectedCategoryId)}
              title={t('return_to_month', { month: resetMonthTitle })}
            >
              {monthTitle}
            </Link>
          )}
        </div>
        <div className="w-10 justify-self-end sm:w-[5.5rem]" aria-hidden />
      </nav>

      <section
        aria-label={t('calendar_grid_label', { month: monthTitle })}
        className="hidden w-full min-w-0 rounded-xl border border-mit-line shadow-sm lg:block"
      >
        <div className="grid w-full min-w-0 grid-cols-7 divide-x divide-mit-line bg-mit-surface">
          {weekdayLabels(props.locale).map((weekday) => (
            <div
              className="px-1.5 py-2 text-center text-xs font-semibold text-mit-text"
              key={weekday}
            >
              {weekday}
            </div>
          ))}
        </div>
        <div className="flex w-full min-w-0 flex-col divide-y divide-mit-line bg-background">
          {weekCells.map((week) => (
            <div
              className="grid w-full min-w-0 grid-cols-7 divide-x divide-mit-line"
              key={week.key}
            >
              {week.cells.map((cell) => {
                const { dateKey } = cell;
                const dayRows = dateKey ? (rowsByDay.get(dateKey) ?? []) : [];
                return (
                  <div
                    className="min-h-28 min-w-0 bg-background p-1.5 align-top"
                    key={cell.key}
                  >
                    {dateKey ? (
                      <>
                        <div
                          className={cn(
                            'mb-1 text-xs font-semibold text-mit-text',
                            dateKey === props.todayKey
                              ? 'text-mit-red underline dark:text-mit-red-ink'
                              : undefined
                          )}
                        >
                          {Number(dateKey.slice(8, 10))}
                        </div>
                        <div>
                          {dayRows.map((row, rowIndex) => (
                            <EventCalendarOccurrenceRow
                              key={row.rowKey}
                              row={row}
                              showBottomBorder={rowIndex < dayRows.length - 1}
                              wrapTitle
                            />
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-xl border border-mit-line p-6 shadow-sm lg:hidden">
        <h2 className="mb-5 font-mit-serif text-xl font-semibold text-mit-text">
          {monthTitle}
        </h2>
        {mobileDayGroups.length === 0 ? (
          <p className="text-sm leading-relaxed text-mit-text">
            {t('mobile_empty', { month: monthTitle })}
          </p>
        ) : (
          <div>
            {mobileDayGroups.map((group, groupIndex) => (
              <section
                aria-labelledby={`events-day-${group.dateKey}`}
                className={groupIndex > 0 ? 'mt-4' : undefined}
                key={group.dateKey}
              >
                <h3
                  className={cn(
                    'border-b border-mit-line pb-1 text-xs font-semibold text-mit-text',
                    group.isToday
                      ? 'text-mit-red underline dark:text-mit-red-ink'
                      : undefined
                  )}
                  id={`events-day-${group.dateKey}`}
                >
                  {group.headingLabel}
                </h3>
                <div>
                  {group.rows.map((row, rowIndex) => {
                    const isLast =
                      groupIndex === mobileDayGroups.length - 1 &&
                      rowIndex === group.rows.length - 1;
                    return (
                      <EventCalendarOccurrenceRow
                        key={row.rowKey}
                        row={row}
                        showBottomBorder={!isLast}
                        wrapTitle
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
