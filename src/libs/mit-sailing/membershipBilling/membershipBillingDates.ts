import { SailingCardMembershipPriceKind } from '@/generated/prisma/enums';
import { addNyCalendarDays, nyYmd } from '@/lib/mit-sailing/nyTime';

const renewalMonth = 7;
const renewalDay = 15;

const renewalDateKey = (year: number) =>
  [
    year.toString(),
    renewalMonth.toString().padStart(2, '0'),
    renewalDay.toString().padStart(2, '0'),
  ].join('-');

/**
 * Selects the membership price kind active on a New York calendar date.
 *
 * @param now - Instant to evaluate in America/New_York.
 * @returns Spring pricing before July 15 Eastern; full pricing on or after it.
 */
export function membershipPriceKindForDate(now: Date) {
  const dateKey = nyYmd(now);
  const year = Number(dateKey.slice(0, 4));

  return dateKey < renewalDateKey(year)
    ? SailingCardMembershipPriceKind.spring
    : SailingCardMembershipPriceKind.full;
}

function nextMembershipSeasonStartDateKey(now: Date): string {
  const dateKey = nyYmd(now);
  const year = Number(dateKey.slice(0, 4));

  return dateKey < renewalDateKey(year)
    ? renewalDateKey(year)
    : renewalDateKey(year + 1);
}

/**
 * Computes the last local date covered by a membership bought now.
 *
 * @param now - Instant to evaluate in America/New_York.
 * @returns ISO calendar date immediately before the next July 15 season.
 */
export function membershipAccessThroughDate(now: Date): string {
  return addNyCalendarDays(nextMembershipSeasonStartDateKey(now), -1);
}
