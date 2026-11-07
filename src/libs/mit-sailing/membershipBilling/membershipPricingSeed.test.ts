import { describe, expect, it } from 'vitest';
import {
  SailingAffiliation,
  SailingCardMembershipBillingInterval,
  SailingCardMembershipPriceCategory,
  SailingCardMembershipPriceKind,
  SailingCardType,
} from '@/generated/prisma/enums';
import {
  initialSailingCardMembershipPrices,
  INITIAL_MEMBERSHIP_PRICE_CHANGE_REASON,
} from '@/libs/mit-sailing/membershipBilling/membershipPricingSeed';
import {
  hasStudentPaidRacingPrice,
  sailingCardMembershipPriceCents,
} from '@/libs/mit-sailing/sailingCardMembership';

type SeedPriceRow = (typeof initialSailingCardMembershipPrices)[number];

const studentPaidAffiliations = Object.values(SailingAffiliation).filter(
  hasStudentPaidRacingPrice
);

const agePricedAffiliations = Object.values(SailingAffiliation).filter(
  (affiliation) =>
    affiliation !== SailingAffiliation.MIT_STUDENT &&
    !studentPaidAffiliations.includes(affiliation)
);

const findSeedPrice = (props: {
  billingInterval: SailingCardMembershipBillingInterval;
  cardType: SailingCardType;
  priceCategory: SailingCardMembershipPriceCategory;
}): SeedPriceRow => {
  const price = initialSailingCardMembershipPrices.find(
    (row) =>
      row.billingInterval === props.billingInterval &&
      row.cardType === props.cardType &&
      row.priceCategory === props.priceCategory &&
      row.priceKind === SailingCardMembershipPriceKind.full
  );
  if (price === undefined) {
    throw new Error('Expected initial sailing card membership seed price.');
  }

  return price;
};

describe('initial sailing card membership prices', () => {
  it('creates a stable full-year row for each paid price category', () => {
    expect(initialSailingCardMembershipPrices).toHaveLength(6);
    expect(
      new Set(initialSailingCardMembershipPrices.map((row) => row.id)).size
    ).toBe(initialSailingCardMembershipPrices.length);
    expect(
      initialSailingCardMembershipPrices.every(
        (row) =>
          row.active &&
          row.changeReason === INITIAL_MEMBERSHIP_PRICE_CHANGE_REASON &&
          row.currency === 'usd' &&
          row.priceKind === SailingCardMembershipPriceKind.full &&
          row.stripePriceId === null &&
          row.stripeSyncError === null &&
          row.stripeSyncedAt === null
      )
    ).toBe(true);
  });

  it('matches full-year racing prices for student and age categories', () => {
    expect(
      findSeedPrice({
        billingInterval: SailingCardMembershipBillingInterval.one_time,
        cardType: SailingCardType.racing,
        priceCategory: SailingCardMembershipPriceCategory.student,
      }).amountCents
    ).toBe(4000);
    expect(
      findSeedPrice({
        billingInterval: SailingCardMembershipBillingInterval.one_time,
        cardType: SailingCardType.racing,
        priceCategory: SailingCardMembershipPriceCategory.under_30,
      }).amountCents
    ).toBe(12_500);
    expect(
      findSeedPrice({
        billingInterval: SailingCardMembershipBillingInterval.one_time,
        cardType: SailingCardType.racing,
        priceCategory: SailingCardMembershipPriceCategory.thirty_or_over,
      }).amountCents
    ).toBe(17_500);
  });

  it('matches team racing prices for student and age categories', () => {
    expect(
      findSeedPrice({
        billingInterval: SailingCardMembershipBillingInterval.one_time,
        cardType: SailingCardType.team_racing,
        priceCategory: SailingCardMembershipPriceCategory.student,
      }).amountCents
    ).toBe(2500);
    expect(
      findSeedPrice({
        billingInterval: SailingCardMembershipBillingInterval.one_time,
        cardType: SailingCardType.team_racing,
        priceCategory: SailingCardMembershipPriceCategory.under_30,
      }).amountCents
    ).toBe(7000);
    expect(
      findSeedPrice({
        billingInterval: SailingCardMembershipBillingInterval.one_time,
        cardType: SailingCardType.team_racing,
        priceCategory: SailingCardMembershipPriceCategory.thirty_or_over,
      }).amountCents
    ).toBe(10_000);
  });

  it.each(studentPaidAffiliations)(
    'matches non-MIT student paid prices for %s before and after July 15',
    (affiliation) => {
      const expected = findSeedPrice({
        billingInterval: SailingCardMembershipBillingInterval.one_time,
        cardType: SailingCardType.racing,
        priceCategory: SailingCardMembershipPriceCategory.student,
      }).amountCents;

      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.racing,
          dateOfBirth: '01/02/1990',
          now: new Date('2026-06-01T12:00:00.000Z'),
        })
      ).toBe(expected);
      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.racing,
          dateOfBirth: '01/02/1990',
          now: new Date('2026-07-15T12:00:00.000Z'),
        })
      ).toBe(expected);
    }
  );

  it.each(agePricedAffiliations)(
    'matches age-priced paid prices for %s before and after July 15',
    (affiliation) => {
      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.racing,
          dateOfBirth: '01/02/2000',
          now: new Date('2026-06-01T12:00:00.000Z'),
        })
      ).toBe(
        findSeedPrice({
          billingInterval: SailingCardMembershipBillingInterval.one_time,
          cardType: SailingCardType.racing,
          priceCategory: SailingCardMembershipPriceCategory.under_30,
        }).amountCents
      );
      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.racing,
          dateOfBirth: '01/02/1990',
          now: new Date('2026-07-15T12:00:00.000Z'),
        })
      ).toBe(
        findSeedPrice({
          billingInterval: SailingCardMembershipBillingInterval.one_time,
          cardType: SailingCardType.racing,
          priceCategory: SailingCardMembershipPriceCategory.thirty_or_over,
        }).amountCents
      );
    }
  );

  it('does not create paid rows for MIT students', () => {
    expect(
      sailingCardMembershipPriceCents({
        affiliation: SailingAffiliation.MIT_STUDENT,
        cardType: SailingCardType.racing,
        dateOfBirth: '01/02/2000',
        now: new Date('2026-07-15T12:00:00.000Z'),
      })
    ).toBe(0);
  });
});
