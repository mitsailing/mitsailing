import {
  SailingAffiliation,
  SailingCardMembershipBillingInterval,
  SailingCardMembershipPriceCategory,
  SailingCardMembershipPriceKind,
} from '@/generated/prisma/enums';
import type { SailingCardType } from '@/generated/prisma/enums';
import { nyYmd } from '@/lib/mit-sailing/nyTime';
import { prisma } from '@/libs/DB';
import {
  membershipBillingAnchorForCheckout,
  membershipPriceKindForDate,
} from '@/libs/mit-sailing/membershipBilling/membershipBillingDates';
import { parseSailingCardDateOfBirth } from '@/libs/mit-sailing/sailingCardDateOfBirth';
import { hasStudentPaidRacingPrice } from '@/libs/mit-sailing/sailingCardMembership';

export type SailingCardMembershipPriceRow = {
  readonly active: boolean;
  readonly amountCents: number;
  readonly billingInterval: SailingCardMembershipBillingInterval;
  readonly cardType: SailingCardType;
  readonly currency: string;
  readonly effectiveAt: Date;
  readonly id: string;
  readonly priceCategory: SailingCardMembershipPriceCategory;
  readonly priceKind: SailingCardMembershipPriceKind;
  readonly stripePriceId: string | null;
  readonly stripeSyncError: string | null;
  readonly stripeSyncedAt: Date | null;
};

type MembershipPriceFindManyArgs = {
  orderBy: { effectiveAt: 'desc' };
  select: Record<keyof SailingCardMembershipPriceRow, true>;
  where: {
    billingInterval: SailingCardMembershipBillingInterval;
    cardType: SailingCardType;
    effectiveAt: { lte: Date };
    priceCategory: SailingCardMembershipPriceCategory;
    priceKind: SailingCardMembershipPriceKind;
  };
};

export type MembershipPricingReadClient = {
  readonly sailingCardMembershipPrice: {
    findMany(
      args: MembershipPriceFindManyArgs
    ): Promise<SailingCardMembershipPriceRow[]>;
  };
};

const membershipPriceSelect: Record<keyof SailingCardMembershipPriceRow, true> =
  {
    amountCents: true,
    active: true,
    billingInterval: true,
    cardType: true,
    currency: true,
    effectiveAt: true,
    id: true,
    priceCategory: true,
    priceKind: true,
    stripePriceId: true,
    stripeSyncError: true,
    stripeSyncedAt: true,
  };

function ageOnEasternDate(props: {
  readonly birthDate: Date;
  readonly now: Date;
}) {
  const [year, month, day] = nyYmd(props.now).split('-').map(Number);
  const birthMonth = props.birthDate.getUTCMonth() + 1;
  const birthDay = props.birthDate.getUTCDate();
  const hasHadBirthday =
    (month ?? 0) > birthMonth ||
    ((month ?? 0) === birthMonth && (day ?? 0) >= birthDay);

  return hasHadBirthday
    ? (year ?? 0) - props.birthDate.getUTCFullYear()
    : (year ?? 0) - props.birthDate.getUTCFullYear() - 1;
}

export function membershipPriceCategoryForCardRequest(props: {
  readonly affiliation: SailingAffiliation | '';
  readonly dateOfBirth: string | undefined;
  readonly now: Date;
}): SailingCardMembershipPriceCategory | null {
  if (
    props.affiliation === '' ||
    props.affiliation === SailingAffiliation.MIT_STUDENT
  ) {
    return null;
  }
  if (hasStudentPaidRacingPrice(props.affiliation)) {
    return SailingCardMembershipPriceCategory.student;
  }

  const birthDate = parseSailingCardDateOfBirth({
    allowIsoDate: true,
    value: props.dateOfBirth,
  });
  if (birthDate === null) {
    return null;
  }

  return ageOnEasternDate({ birthDate, now: props.now }) >= 30
    ? SailingCardMembershipPriceCategory.thirty_or_over
    : SailingCardMembershipPriceCategory.under_30;
}

function isStripeReadyPrice(price: SailingCardMembershipPriceRow) {
  return (
    price.stripePriceId !== null &&
    price.stripeSyncError === null &&
    price.stripeSyncedAt !== null
  );
}

export function selectActiveMembershipPrice(
  prices: readonly SailingCardMembershipPriceRow[],
  options: {
    readonly now: Date;
    readonly requireStripeReady?: boolean;
  }
): SailingCardMembershipPriceRow | null {
  const sortedPrices = [...prices].toSorted(
    (a, b) => b.effectiveAt.getTime() - a.effectiveAt.getTime()
  );

  return (
    sortedPrices.find(
      (price) =>
        price.active &&
        price.effectiveAt.getTime() <= options.now.getTime() &&
        (options.requireStripeReady !== true || isStripeReadyPrice(price))
    ) ?? null
  );
}

export async function getActiveMembershipPrice(options: {
  readonly billingInterval: SailingCardMembershipBillingInterval;
  readonly cardType: SailingCardType;
  readonly client?: MembershipPricingReadClient;
  readonly now: Date;
  readonly priceCategory: SailingCardMembershipPriceCategory;
  readonly priceKind: SailingCardMembershipPriceKind;
  readonly requireStripeReady?: boolean;
}): Promise<SailingCardMembershipPriceRow | null> {
  const client = options.client ?? prisma;
  const prices = await client.sailingCardMembershipPrice.findMany({
    orderBy: { effectiveAt: 'desc' },
    select: membershipPriceSelect,
    where: {
      billingInterval: options.billingInterval,
      cardType: options.cardType,
      effectiveAt: { lte: options.now },
      priceCategory: options.priceCategory,
      priceKind: options.priceKind,
    },
  });

  return selectActiveMembershipPrice(prices, {
    now: options.now,
    requireStripeReady: options.requireStripeReady,
  });
}

export async function getCheckoutMembershipPrices(options: {
  readonly affiliation: SailingAffiliation | '';
  readonly cardType: SailingCardType;
  readonly client?: MembershipPricingReadClient;
  readonly dateOfBirth: string | undefined;
  readonly now: Date;
  readonly requireStripeReady?: boolean;
}): Promise<{
  readonly dueTodayPrice: SailingCardMembershipPriceRow;
  readonly renewalPrice: SailingCardMembershipPriceRow;
} | null> {
  const dueTodayCategory = membershipPriceCategoryForCardRequest({
    affiliation: options.affiliation,
    dateOfBirth: options.dateOfBirth,
    now: options.now,
  });
  const renewalAt = membershipBillingAnchorForCheckout(options.now);
  const renewalCategory = membershipPriceCategoryForCardRequest({
    affiliation: options.affiliation,
    dateOfBirth: options.dateOfBirth,
    now: renewalAt,
  });

  if (dueTodayCategory === null || renewalCategory === null) {
    return null;
  }

  const dueTodayPrice = await getActiveMembershipPrice({
    billingInterval: SailingCardMembershipBillingInterval.one_time,
    cardType: options.cardType,
    client: options.client,
    now: options.now,
    priceCategory: dueTodayCategory,
    priceKind: membershipPriceKindForDate(options.now),
    requireStripeReady: options.requireStripeReady ?? true,
  });
  const renewalPrice = await getActiveMembershipPrice({
    billingInterval: SailingCardMembershipBillingInterval.annual,
    cardType: options.cardType,
    client: options.client,
    now: renewalAt,
    priceCategory: renewalCategory,
    priceKind: SailingCardMembershipPriceKind.full,
    requireStripeReady: options.requireStripeReady ?? true,
  });

  if (dueTodayPrice === null || renewalPrice === null) {
    return null;
  }

  return { dueTodayPrice, renewalPrice };
}
