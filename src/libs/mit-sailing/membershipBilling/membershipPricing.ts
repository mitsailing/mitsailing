import {
  SailingAffiliation,
  SailingCardMembershipBillingInterval,
  SailingCardMembershipPriceCategory,
} from '@/generated/prisma/enums';
import type {
  SailingCardType,
  SailingCardMembershipPriceKind,
} from '@/generated/prisma/enums';
import { nyYmd } from '@/lib/mit-sailing/nyTime';
import { prisma } from '@/libs/DB';
import { membershipPriceKindForDate } from '@/libs/mit-sailing/membershipBilling/membershipBillingDates';
import { parseSailingCardDateOfBirth } from '@/libs/mit-sailing/sailingCardDateOfBirth';
import { hasStudentPaidRacingPrice } from '@/libs/mit-sailing/sailingCardMembership';

/**
 * Active membership price catalog row used for request pricing and checkout.
 */
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
    cardType: SailingCardType;
  } & (MembershipPriceLookup | { OR: readonly MembershipPriceLookup[] });
};

type MembershipPriceLookup = {
  readonly billingInterval: SailingCardMembershipBillingInterval;
  readonly effectiveAt: { readonly lte: Date };
  readonly priceCategory: SailingCardMembershipPriceCategory;
  readonly priceKind: SailingCardMembershipPriceKind;
};

/**
 * Minimal Prisma-compatible reader for sailing-card membership prices.
 */
export type MembershipPricingReadClient = {
  readonly sailingCardMembershipPrice: {
    findMany(
      args: MembershipPriceFindManyArgs
    ): Promise<SailingCardMembershipPriceRow[]>;
  };
};

type CheckoutMembershipPricesReady = {
  readonly dueTodayPrice: SailingCardMembershipPriceRow;
  readonly status: 'ready';
};

/**
 * Result of resolving the due-today price for checkout.
 */
export type CheckoutMembershipPricesResult =
  | CheckoutMembershipPricesReady
  | { readonly status: 'missing_due_today_price' }
  | { readonly status: 'not_eligible' };

const membershipPriceSelect: Record<keyof SailingCardMembershipPriceRow, true> =
  {
    active: true,
    amountCents: true,
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
  const [year, month, day, extra] = nyYmd(props.now).split('-').map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    extra !== undefined ||
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    throw new TypeError('nyYmd returned an invalid date for ageOnEasternDate.');
  }

  const birthMonth = props.birthDate.getUTCMonth() + 1;
  const birthDay = props.birthDate.getUTCDate();
  const hasHadBirthday =
    month > birthMonth || (month === birthMonth && day >= birthDay);

  return hasHadBirthday
    ? year - props.birthDate.getUTCFullYear()
    : year - props.birthDate.getUTCFullYear() - 1;
}

/**
 * Resolves the paid membership price category for a card request.
 *
 * @param props - Request affiliation, optional date of birth, and pricing date.
 * @returns Price category, or null for unpaid/unknown eligibility.
 * @throws TypeError when New York date formatting returns an invalid date.
 */
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

function membershipPriceMatchesLookup(
  price: SailingCardMembershipPriceRow,
  lookup: MembershipPriceLookup
) {
  return (
    price.billingInterval === lookup.billingInterval &&
    price.effectiveAt.getTime() <= lookup.effectiveAt.lte.getTime() &&
    price.priceCategory === lookup.priceCategory &&
    price.priceKind === lookup.priceKind
  );
}

/**
 * Selects the newest active price effective at the requested instant.
 *
 * @param prices - Candidate catalog rows for one price lookup.
 * @param options - Pricing instant and optional Stripe readiness requirement.
 * @returns Matching price row, or null when none are active and usable.
 */
export function selectActiveMembershipPrice(
  prices: readonly SailingCardMembershipPriceRow[],
  options: {
    readonly now: Date;
    readonly requireStripeReady?: boolean;
  }
): SailingCardMembershipPriceRow | null {
  const sortedPrices = prices.toSorted(
    (a, b) => b.effectiveAt.getTime() - a.effectiveAt.getTime()
  );
  const currentPrice =
    sortedPrices.find(
      (price) =>
        price.active && price.effectiveAt.getTime() <= options.now.getTime()
    ) ?? null;

  if (
    currentPrice === null ||
    (options.requireStripeReady === true && !isStripeReadyPrice(currentPrice))
  ) {
    return null;
  }

  return currentPrice;
}

/**
 * Reads and selects one active catalog price from the configured client.
 *
 * @param options - Catalog key, pricing instant, client, and Stripe readiness.
 * @returns Matching price row, or null when the catalog lacks a usable row.
 * @throws Error when the configured read client cannot load catalog prices.
 */
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

/**
 * Reads the due-today price required for Stripe Checkout.
 *
 * @param options - Card request facts, pricing instant, client, and Stripe readiness.
 * @returns Ready prices or a status explaining why checkout cannot proceed.
 * @throws Error when the configured read client cannot load catalog prices.
 * @throws TypeError when New York date formatting returns an invalid date.
 */
export async function getCheckoutMembershipPrices(options: {
  readonly affiliation: SailingAffiliation | '';
  readonly cardType: SailingCardType;
  readonly client?: MembershipPricingReadClient;
  readonly dateOfBirth: string | undefined;
  readonly now: Date;
  readonly requireStripeReady?: boolean;
}): Promise<CheckoutMembershipPricesResult> {
  const dueTodayCategory = membershipPriceCategoryForCardRequest({
    affiliation: options.affiliation,
    dateOfBirth: options.dateOfBirth,
    now: options.now,
  });

  if (dueTodayCategory === null) {
    return { status: 'not_eligible' };
  }

  const dueTodayLookup: MembershipPriceLookup = {
    billingInterval: SailingCardMembershipBillingInterval.one_time,
    effectiveAt: { lte: options.now },
    priceCategory: dueTodayCategory,
    priceKind: membershipPriceKindForDate(options.now),
  };
  const prices = await (
    options.client ?? prisma
  ).sailingCardMembershipPrice.findMany({
    orderBy: { effectiveAt: 'desc' },
    select: membershipPriceSelect,
    where: {
      cardType: options.cardType,
      ...dueTodayLookup,
    },
  });
  const requireStripeReady = options.requireStripeReady ?? true;
  const dueTodayPrice = selectActiveMembershipPrice(
    prices.filter((price) =>
      membershipPriceMatchesLookup(price, dueTodayLookup)
    ),
    {
      now: options.now,
      requireStripeReady,
    }
  );

  if (dueTodayPrice === null) {
    return { status: 'missing_due_today_price' };
  }

  return { dueTodayPrice, status: 'ready' };
}
