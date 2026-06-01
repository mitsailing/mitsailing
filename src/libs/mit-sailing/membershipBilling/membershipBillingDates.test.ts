import { describe, expect, it } from 'vitest';
import {
  membershipAccessThroughDate,
  membershipBillingAnchorForCheckout,
  membershipPriceKindForDate,
  nextMembershipRenewalAt,
} from '@/libs/mit-sailing/membershipBilling/membershipBillingDates';

describe('membership billing dates', () => {
  it('uses spring pricing before July 15 Eastern', () => {
    expect(
      membershipPriceKindForDate(new Date('2026-07-14T20:00:00.000Z'))
    ).toBe('spring');
    expect(
      membershipPriceKindForDate(new Date('2026-07-15T03:59:59.999Z'))
    ).toBe('spring');
  });

  it('uses full pricing on July 15 Eastern', () => {
    expect(
      membershipPriceKindForDate(new Date('2026-07-15T04:00:00.000Z'))
    ).toBe('full');
  });

  it('anchors spring checkout to the next July 15 Eastern', () => {
    expect(
      membershipBillingAnchorForCheckout(
        new Date('2026-05-01T12:00:00.000Z')
      ).toISOString()
    ).toBe('2026-07-15T04:00:00.000Z');
  });

  it('anchors purchases on or after July 15 to the following July 15 renewal', () => {
    expect(
      membershipBillingAnchorForCheckout(
        new Date('2026-07-16T12:00:00.000Z')
      ).toISOString()
    ).toBe('2027-07-15T04:00:00.000Z');
  });

  it('returns access-through and next-renewal dates for profile copy', () => {
    expect(
      nextMembershipRenewalAt(
        new Date('2026-12-01T12:00:00.000Z')
      ).toISOString()
    ).toBe('2027-07-15T04:00:00.000Z');
    expect(
      membershipAccessThroughDate(new Date('2027-07-14T12:00:00.000Z'))
    ).toBe('2027-07-14');
  });
});
