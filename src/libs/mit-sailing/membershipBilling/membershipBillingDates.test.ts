import { describe, expect, it } from 'vitest';
import { membershipAccessThroughDate } from '@/libs/mit-sailing/membershipBilling/membershipBillingDates';

describe('membership billing dates', () => {
  it('returns access-through date for profile copy', () => {
    expect(
      membershipAccessThroughDate(new Date('2027-07-14T12:00:00.000Z'))
    ).toBe('2027-07-14');
  });

  it('returns next-season access-through date on renewal day', () => {
    expect(
      membershipAccessThroughDate(new Date('2027-07-15T04:00:00.000Z'))
    ).toBe('2028-07-14');
  });
});
