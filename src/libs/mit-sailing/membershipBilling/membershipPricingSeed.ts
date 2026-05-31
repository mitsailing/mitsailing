import {
  SailingCardMembershipBillingInterval,
  SailingCardMembershipPriceCategory,
  SailingCardMembershipPriceKind,
  SailingCardType,
} from '@/generated/prisma/enums';
import { instantForNyWallClock } from '@/lib/mit-sailing/nyTime';

export const INITIAL_MEMBERSHIP_PRICE_CHANGE_REASON =
  'Initial catalog from legacy racing-card pricing.';

const initialEffectiveAt = instantForNyWallClock(2026, 1, 1, 0, 0);

type InitialSailingCardMembershipPrice = {
  readonly amountCents: number;
  readonly billingInterval: SailingCardMembershipBillingInterval;
  readonly cardType: SailingCardType;
  readonly changeReason: typeof INITIAL_MEMBERSHIP_PRICE_CHANGE_REASON;
  readonly currency: 'usd';
  readonly effectiveAt: Date;
  readonly id: string;
  readonly active: true;
  readonly priceCategory: SailingCardMembershipPriceCategory;
  readonly priceKind: SailingCardMembershipPriceKind;
  readonly stripePriceId: null;
  readonly stripeSyncError: null;
  readonly stripeSyncedAt: null;
};

type LegacyAmountSet = {
  readonly full: number;
  readonly spring: number;
};

const racingAmounts: Record<
  SailingCardMembershipPriceCategory,
  LegacyAmountSet
> = {
  [SailingCardMembershipPriceCategory.student]: {
    spring: 2500,
    full: 4000,
  },
  [SailingCardMembershipPriceCategory.under_30]: {
    spring: 7000,
    full: 12_500,
  },
  [SailingCardMembershipPriceCategory.thirty_or_over]: {
    spring: 10_000,
    full: 17_500,
  },
};

const teamRacingAmounts: Record<
  SailingCardMembershipPriceCategory,
  LegacyAmountSet
> = {
  [SailingCardMembershipPriceCategory.student]: {
    spring: 2500,
    full: 2500,
  },
  [SailingCardMembershipPriceCategory.under_30]: {
    spring: 7000,
    full: 7000,
  },
  [SailingCardMembershipPriceCategory.thirty_or_over]: {
    spring: 10_000,
    full: 10_000,
  },
};

const amountSets: Record<
  SailingCardType,
  Record<SailingCardMembershipPriceCategory, LegacyAmountSet> | null
> = {
  [SailingCardType.normal]: null,
  [SailingCardType.racing]: racingAmounts,
  [SailingCardType.team_racing]: teamRacingAmounts,
};

function membershipPriceRow(props: {
  readonly amountCents: number;
  readonly billingInterval: SailingCardMembershipBillingInterval;
  readonly cardType: SailingCardType;
  readonly priceCategory: SailingCardMembershipPriceCategory;
  readonly priceKind: SailingCardMembershipPriceKind;
}): InitialSailingCardMembershipPrice {
  return {
    amountCents: props.amountCents,
    billingInterval: props.billingInterval,
    cardType: props.cardType,
    changeReason: INITIAL_MEMBERSHIP_PRICE_CHANGE_REASON,
    currency: 'usd',
    effectiveAt: initialEffectiveAt,
    id: [
      'initial',
      props.cardType,
      props.priceKind,
      props.priceCategory,
      props.billingInterval,
    ].join('-'),
    active: true,
    priceCategory: props.priceCategory,
    priceKind: props.priceKind,
    stripePriceId: null,
    stripeSyncError: null,
    stripeSyncedAt: null,
  };
}

const membershipPriceRowsForCardType = (
  cardType: SailingCardType
): InitialSailingCardMembershipPrice[] => {
  const amounts = amountSets[cardType];
  if (amounts === null) {
    return [];
  }

  return Object.values(SailingCardMembershipPriceCategory).flatMap(
    (priceCategory) => {
      const categoryAmounts = amounts[priceCategory];

      return [
        membershipPriceRow({
          amountCents: categoryAmounts.spring,
          billingInterval: SailingCardMembershipBillingInterval.one_time,
          cardType,
          priceCategory,
          priceKind: SailingCardMembershipPriceKind.spring,
        }),
        membershipPriceRow({
          amountCents: categoryAmounts.full,
          billingInterval: SailingCardMembershipBillingInterval.one_time,
          cardType,
          priceCategory,
          priceKind: SailingCardMembershipPriceKind.full,
        }),
        membershipPriceRow({
          amountCents: categoryAmounts.full,
          billingInterval: SailingCardMembershipBillingInterval.annual,
          cardType,
          priceCategory,
          priceKind: SailingCardMembershipPriceKind.full,
        }),
      ];
    }
  );
};

export const initialSailingCardMembershipPrices = [
  ...membershipPriceRowsForCardType(SailingCardType.racing),
  ...membershipPriceRowsForCardType(SailingCardType.team_racing),
] as const;
