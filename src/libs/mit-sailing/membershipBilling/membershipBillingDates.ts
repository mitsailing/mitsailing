import { SailingCardMembershipPriceKind } from '@/generated/prisma/enums';
import {
  addNyCalendarDays,
  instantForNyWallClock,
  nyYmd,
} from '@/lib/mit-sailing/nyTime';

const renewalMonth = 7;
const renewalDay = 15;

const renewalDateKey = (year: number) =>
  [
    year.toString(),
    renewalMonth.toString().padStart(2, '0'),
    renewalDay.toString().padStart(2, '0'),
  ].join('-');

const renewalAt = (year: number) =>
  instantForNyWallClock(year, renewalMonth, renewalDay, 0, 0);

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

/**
 * Finds the annual subscription billing anchor for checkout.
 *
 * @param now - Instant to evaluate in America/New_York.
 * @returns The next July 15 Eastern renewal instant.
 */
export function membershipBillingAnchorForCheckout(now: Date): Date {
  const dateKey = nyYmd(now);
  const year = Number(dateKey.slice(0, 4));

  return dateKey < renewalDateKey(year) ? renewalAt(year) : renewalAt(year + 1);
}

/**
 * Computes the last local date covered by a membership bought now.
 *
 * @param now - Instant to evaluate in America/New_York.
 * @returns ISO calendar date immediately before the next July 15 renewal.
 */
export function membershipAccessThroughDate(now: Date): string {
  return addNyCalendarDays(nyYmd(membershipBillingAnchorForCheckout(now)), -1);
}
