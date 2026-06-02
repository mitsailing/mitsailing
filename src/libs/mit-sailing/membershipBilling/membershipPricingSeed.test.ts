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
  priceKind: SailingCardMembershipPriceKind;
}): SeedPriceRow => {
  const price = initialSailingCardMembershipPrices.find(
    (row) =>
      row.billingInterval === props.billingInterval &&
      row.cardType === props.cardType &&
      row.priceCategory === props.priceCategory &&
      row.priceKind === props.priceKind
  );
  if (price === undefined) {
    throw new Error('Expected initial sailing card membership seed price.');
  }

  return price;
};

describe('initial sailing card membership prices', () => {
  it('creates a stable row for each legacy price category', () => {
    expect(initialSailingCardMembershipPrices).toHaveLength(18);
    expect(
      new Set(initialSailingCardMembershipPrices.map((row) => row.id)).size
    ).toBe(initialSailingCardMembershipPrices.length);
    expect(
      initialSailingCardMembershipPrices.every(
        (row) =>
          row.active &&
          row.changeReason === INITIAL_MEMBERSHIP_PRICE_CHANGE_REASON &&
          row.currency === 'usd' &&
          row.stripePriceId === null &&
          row.stripeSyncError === null &&
          row.stripeSyncedAt === null
      )
    ).toBe(true);
  });

  it('matches legacy racing prices for student and age categories', () => {
    expect(
      findSeedPrice({
        billingInterval: SailingCardMembershipBillingInterval.one_time,
        cardType: SailingCardType.racing,
        priceCategory: SailingCardMembershipPriceCategory.student,
        priceKind: SailingCardMembershipPriceKind.spring,
      }).amountCents
    ).toBe(2500);
    expect(
      findSeedPrice({
        billingInterval: SailingCardMembershipBillingInterval.one_time,
        cardType: SailingCardType.racing,
        priceCategory: SailingCardMembershipPriceCategory.student,
        priceKind: SailingCardMembershipPriceKind.full,
      }).amountCents
    ).toBe(4000);
    expect(
      findSeedPrice({
        billingInterval: SailingCardMembershipBillingInterval.one_time,
        cardType: SailingCardType.racing,
        priceCategory: SailingCardMembershipPriceCategory.under_30,
        priceKind: SailingCardMembershipPriceKind.spring,
      }).amountCents
    ).toBe(7000);
    expect(
      findSeedPrice({
        billingInterval: SailingCardMembershipBillingInterval.annual,
        cardType: SailingCardType.racing,
        priceCategory: SailingCardMembershipPriceCategory.thirty_or_over,
        priceKind: SailingCardMembershipPriceKind.full,
      }).amountCents
    ).toBe(17_500);
  });

  it('matches legacy team racing prices for student and age categories', () => {
    expect(
      findSeedPrice({
        billingInterval: SailingCardMembershipBillingInterval.one_time,
        cardType: SailingCardType.team_racing,
        priceCategory: SailingCardMembershipPriceCategory.student,
        priceKind: SailingCardMembershipPriceKind.spring,
      }).amountCents
    ).toBe(2500);
    expect(
      findSeedPrice({
        billingInterval: SailingCardMembershipBillingInterval.annual,
        cardType: SailingCardType.team_racing,
        priceCategory: SailingCardMembershipPriceCategory.under_30,
        priceKind: SailingCardMembershipPriceKind.full,
      }).amountCents
    ).toBe(7000);
    expect(
      findSeedPrice({
        billingInterval: SailingCardMembershipBillingInterval.one_time,
        cardType: SailingCardType.team_racing,
        priceCategory: SailingCardMembershipPriceCategory.thirty_or_over,
        priceKind: SailingCardMembershipPriceKind.full,
      }).amountCents
    ).toBe(10_000);
  });

  it.each(studentPaidAffiliations)(
    'matches legacy non-MIT student paid prices for %s',
    (affiliation) => {
      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.racing,
          dateOfBirth: '01/02/1990',
          now: new Date('2026-06-01T12:00:00.000Z'),
        })
      ).toBe(
        findSeedPrice({
          billingInterval: SailingCardMembershipBillingInterval.one_time,
          cardType: SailingCardType.racing,
          priceCategory: SailingCardMembershipPriceCategory.student,
          priceKind: SailingCardMembershipPriceKind.spring,
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
          billingInterval: SailingCardMembershipBillingInterval.annual,
          cardType: SailingCardType.racing,
          priceCategory: SailingCardMembershipPriceCategory.student,
          priceKind: SailingCardMembershipPriceKind.full,
        }).amountCents
      );
    }
  );

  it.each(agePricedAffiliations)(
    'matches legacy age-priced paid prices for %s',
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
          priceKind: SailingCardMembershipPriceKind.spring,
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
          billingInterval: SailingCardMembershipBillingInterval.annual,
          cardType: SailingCardType.racing,
          priceCategory: SailingCardMembershipPriceCategory.thirty_or_over,
          priceKind: SailingCardMembershipPriceKind.full,
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
