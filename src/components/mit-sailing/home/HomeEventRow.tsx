import {
  mitAccentLinkClassName,
  textFocusRingClassName,
} from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';
import type { HomeUpcomingRow } from '@/libs/mit-sailing/homeUpcomingFromPrisma';

function categoryBarClass(categoryId: string | undefined): string {
  if (categoryId === 'cat-racing') {
    return 'bg-mit-red';
  }
  if (categoryId === 'cat-class') {
    return 'bg-mit-success';
  }
  return 'bg-mit-cat';
}

type HomeEventRowProps = {
  row: HomeUpcomingRow;
  showBottomBorder: boolean;
};

/**
 * @param props - Row display props
 * @param props.row - Event summary for the list
 * @param props.showBottomBorder - Separator under the row
 * @returns Home sidebar event line
 */
export function HomeEventRow(props: HomeEventRowProps) {
  return (
    <div
      className={
        props.showBottomBorder
          ? 'flex gap-2 border-b border-mit-line py-1.5'
          : 'flex gap-2 py-1.5'
      }
    >
      <div
        aria-hidden
        className={`w-[3px] shrink-0 rounded-sm ${categoryBarClass(
          props.row.categoryId
        )}`}
        title={props.row.categoryId}
      />
      <div className="min-w-0 flex-1">
        <Link
          className={`block truncate no-underline hover:underline ${textFocusRingClassName} ${mitAccentLinkClassName} leading-tight`}
          href={`/events/${props.row.eventSlug}/`}
          title={props.row.eventName}
        >
          {props.row.eventName}
        </Link>
        <p className="mt-0.5 truncate text-xs leading-snug text-mit-text">
          {props.row.line}
        </p>
      </div>
    </div>
  );
}
