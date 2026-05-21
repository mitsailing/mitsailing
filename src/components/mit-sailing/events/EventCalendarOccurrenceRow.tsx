import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';
import { formatEasternEventCalendarLine } from '@/libs/mit-sailing/easternTimeFormat';
import type { EventCalendarOccurrenceRow as EventCalendarOccurrence } from '@/libs/mit-sailing/eventCalendar';

type EventCalendarOccurrenceRowProps = {
  row: EventCalendarOccurrence;
  showBottomBorder: boolean;
  wrapTitle?: boolean;
};

/**
 * @param props - Calendar row props
 * @returns Event occurrence line for calendar cells and mobile lists
 */
export function EventCalendarOccurrenceRow(
  props: EventCalendarOccurrenceRowProps
) {
  return (
    <div
      className={cn(
        'flex gap-2 py-1.5',
        props.showBottomBorder ? 'border-b border-mit-line' : undefined
      )}
    >
      <div
        aria-hidden
        className={cn(
          'w-[3px] shrink-0 rounded-sm',
          props.row.category.accentClassName
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-[0.6875rem] leading-tight font-semibold tracking-wide text-muted-foreground uppercase">
          {props.row.category.name}
        </p>
        <Link
          className={cn(
            'block text-sm leading-tight font-semibold text-mit-red no-underline hover:underline dark:text-mit-red-ink',
            textFocusRingClassName,
            '[overflow-wrap:anywhere] whitespace-normal'
          )}
          href={`/events/${props.row.event.slug}/`}
        >
          {props.row.event.name}
        </Link>
        <p
          className={cn(
            'mt-0.5 text-xs leading-snug text-mit-text',
            props.wrapTitle
              ? '[overflow-wrap:anywhere]'
              : '[overflow-wrap:anywhere] whitespace-normal'
          )}
        >
          {formatEasternEventCalendarLine({
            start: props.row.start,
            end: props.row.end,
            segment: props.row.listSegment,
          })}
        </p>
      </div>
    </div>
  );
}
