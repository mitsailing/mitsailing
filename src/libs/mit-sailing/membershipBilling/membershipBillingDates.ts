import { SailingCardMembershipPriceKind } from '@/generated/prisma/enums';
import {
  addNyCalendarDays,
  instantForNyWallClock,
  nyYmd,
} from '@/lib/mit-sailing/nyTime';

const renewalMonth = 7;
const renewalDay = 15;

const renewalDateKey = (year: number) =>
  [year, renewalMonth, renewalDay]
    .map((part) => part.toString().padStart(2, '0'))
    .join('-');

const renewalAt = (year: number) =>
  instantForNyWallClock(year, renewalMonth, renewalDay, 0, 0);

export function membershipPriceKindForDate(now: Date) {
  const dateKey = nyYmd(now);
  const year = Number(dateKey.slice(0, 4));

  return dateKey < renewalDateKey(year)
    ? SailingCardMembershipPriceKind.spring
    : SailingCardMembershipPriceKind.full;
}

export function membershipBillingAnchorForCheckout(now: Date): Date {
  const dateKey = nyYmd(now);
  const year = Number(dateKey.slice(0, 4));

  return dateKey < renewalDateKey(year) ? renewalAt(year) : renewalAt(year + 1);
}

export function nextMembershipRenewalAt(now: Date): Date {
  return membershipBillingAnchorForCheckout(now);
}

export function membershipAccessThroughDate(now: Date): string {
  return addNyCalendarDays(nyYmd(nextMembershipRenewalAt(now)), -1);
}
