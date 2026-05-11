import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';
import { formatEasternEventCalendarLine } from '@/libs/mit-sailing/easternTimeFormat';
import type { EventCalendarOccurrenceRow as EventCalendarOccurrence } from '@/libs/mit-sailing/eventCalendar';

function categoryAccentClassName(categoryId: string): string {
  if (categoryId === 'cat-racing') {
    return 'bg-mit-red';
  }
  if (categoryId === 'cat-class') {
    return 'bg-mit-success';
  }
  return 'bg-mit-cat';
}

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
          categoryAccentClassName(props.row.category.id)
        )}
      />
      <div className="min-w-0 flex-1">
        <Link
          className={cn(
            'block text-sm leading-tight font-semibold text-mit-red-ink no-underline hover:underline',
            textFocusRingClassName,
            props.wrapTitle
              ? '[overflow-wrap:anywhere] whitespace-normal'
              : 'truncate'
          )}
          href={`/events/${props.row.event.slug}/`}
          title={props.row.event.name}
        >
          {props.row.event.name}
        </Link>
        <p
          className={cn(
            'mt-0.5 text-xs leading-snug text-mit-text',
            props.wrapTitle ? '[overflow-wrap:anywhere]' : 'truncate'
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
