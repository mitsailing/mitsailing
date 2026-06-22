import { describe, expect, it } from 'vitest';
import {
  membershipAccessThroughDate,
  membershipPriceKindForDate,
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

  it('returns access-through date for profile copy', () => {
    expect(
      membershipAccessThroughDate(new Date('2027-07-14T12:00:00.000Z'))
    ).toBe('2027-07-14');
  });
});
