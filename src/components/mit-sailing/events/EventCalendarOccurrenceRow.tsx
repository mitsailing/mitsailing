import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';
import { formatEasternEventCalendarLine } from '@/libs/mit-sailing/easternTimeFormat';
import type { EventCalendarOccurrenceRow as EventCalendarOccurrence } from '@/libs/mit-sailing/eventCalendar';
import { eventUsesLearnToSailWaitlist } from '@/libs/mit-sailing/learnToSailEvents';

type EventCalendarOccurrenceRowProps = {
  learnToSailWaitlistLabel?: string;
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
  const usesLearnToSailWaitlist = eventUsesLearnToSailWaitlist(props.row.event);
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
        <p
          className={cn(
            'mb-0.5 text-xs leading-snug font-semibold text-mit-text',
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
        <Link
          className={cn(
            'flex min-h-11 items-center text-sm leading-tight font-semibold text-mit-red no-underline hover:underline dark:text-mit-red-ink',
            textFocusRingClassName,
            '[overflow-wrap:anywhere] whitespace-normal'
          )}
          href={`/events/${props.row.event.slug}`}
        >
          {props.row.event.shortName}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.6875rem] leading-tight font-semibold text-muted-foreground">
          <span>{props.row.category.name}</span>
          {usesLearnToSailWaitlist && props.learnToSailWaitlistLabel ? (
            <span className="rounded-full bg-mit-red-highlight px-1.5 py-0.5 text-[0.625rem] text-mit-red">
              {props.learnToSailWaitlistLabel}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
