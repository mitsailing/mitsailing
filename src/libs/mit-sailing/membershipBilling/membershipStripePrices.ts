import 'server-only';
import type { Stripe } from 'stripe';
import {
  SailingCardMembershipBillingInterval,
  SailingCardMembershipPriceKind,
  SailingCardType,
} from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';
import type { SailingCardMembershipPriceRow } from '@/libs/mit-sailing/membershipBilling/membershipPricing';

type MembershipStripeProductDetails = {
  readonly description: string;
  readonly id: string;
  readonly name: string;
};

type MembershipStripePriceSyncStatus =
  | 'archived'
  | 'created'
  | 'failed'
  | 'reused'
  | 'skipped';

type MembershipStripeProduct = Pick<Stripe.Product, 'id'>;

export type MembershipStripePriceSyncDb = {
  readonly sailingCardMembershipPrice: {
    update(args: {
      readonly data: {
        readonly stripePriceId?: string;
        readonly stripeSyncError: string | null;
        readonly stripeSyncedAt: Date | null;
      };
      readonly where: { readonly id: string };
    }): Promise<SailingCardMembershipPriceRow>;
  };
};

export type MembershipStripePriceSyncStripe = {
  readonly prices: {
    create(
      params: Stripe.PriceCreateParams,
      options: { readonly idempotencyKey: string }
    ): Promise<Pick<Stripe.Price, 'id'>>;
    list(params: Stripe.PriceListParams): Promise<{
      readonly data: readonly Pick<Stripe.Price, 'id'>[];
    }>;
    update(
      id: string,
      params: Stripe.PriceUpdateParams,
      options: { readonly idempotencyKey: string }
    ): Promise<Pick<Stripe.Price, 'id'>>;
  };
  readonly products: {
    create(
      params: Stripe.ProductCreateParams,
      options: { readonly idempotencyKey: string }
    ): Promise<MembershipStripeProduct>;
    retrieve(id: string): Promise<MembershipStripeProduct>;
  };
};

export type MembershipStripePriceSyncResult = {
  readonly error?: string;
  readonly price: SailingCardMembershipPriceRow;
  readonly status: MembershipStripePriceSyncStatus;
  readonly stripePriceId: string | null;
};

const stripeMetadataDomain = 'sailing_card_membership';

function membershipCardTypeLabel(cardType: SailingCardType) {
  switch (cardType) {
    case SailingCardType.normal: {
      throw new TypeError('Normal sailing cards do not use Stripe prices.');
    }
    case SailingCardType.racing: {
      return 'racing';
    }
    case SailingCardType.team_racing: {
      return 'team racing';
    }
    default: {
      throw new TypeError('Unknown sailing card type.');
    }
  }
}

function membershipPriceCategoryLabel(
  price: Pick<SailingCardMembershipPriceRow, 'priceCategory'>
) {
  switch (price.priceCategory) {
    case 'student': {
      return 'student';
    }
    case 'under_30': {
      return 'under 30';
    }
    case 'thirty_or_over': {
      return '30 or over';
    }
    default: {
      throw new TypeError('Unknown membership price category.');
    }
  }
}

function membershipStripeProductRole(
  price: Pick<SailingCardMembershipPriceRow, 'billingInterval' | 'priceKind'>
) {
  if (
    price.billingInterval === SailingCardMembershipBillingInterval.annual &&
    price.priceKind === SailingCardMembershipPriceKind.full
  ) {
    return 'annual';
  }
  if (price.priceKind === SailingCardMembershipPriceKind.spring) {
    return 'spring';
  }
  return 'current_season';
}

function membershipStripeProductDetails(
  price: Pick<
    SailingCardMembershipPriceRow,
    'billingInterval' | 'cardType' | 'priceKind'
  >
): MembershipStripeProductDetails {
  const cardTypeLabel = membershipCardTypeLabel(price.cardType);
  const role = membershipStripeProductRole(price);
  const id = `mitsailing_sailing_card_membership_${price.cardType}_${role}`;
  const description = `MIT Sailing ${cardTypeLabel} membership.`;
  if (role === 'annual') {
    return {
      description,
      id,
      name: `Annual ${cardTypeLabel} membership renewal every July 15`,
    };
  }
  if (role === 'spring') {
    return {
      description,
      id,
      name: `Spring ${cardTypeLabel} membership through July 14`,
    };
  }
  return {
    description,
    id,
    name: `Current-season ${cardTypeLabel} membership through July 14`,
  };
}

export function membershipStripePriceMetadata(
  price: Pick<
    SailingCardMembershipPriceRow,
    'billingInterval' | 'cardType' | 'id' | 'priceCategory' | 'priceKind'
  >
) {
  return {
    appPriceId: price.id,
    billingInterval: price.billingInterval,
    cardType: price.cardType,
    domain: stripeMetadataDomain,
    priceCategory: price.priceCategory,
    priceKind: price.priceKind,
  };
}

export function membershipStripePriceNickname(
  price: Pick<
    SailingCardMembershipPriceRow,
    'billingInterval' | 'cardType' | 'priceCategory' | 'priceKind'
  >
) {
  const cardTypeLabel = membershipCardTypeLabel(price.cardType);
  const categoryLabel = membershipPriceCategoryLabel(price);
  if (
    price.billingInterval === SailingCardMembershipBillingInterval.annual &&
    price.priceKind === SailingCardMembershipPriceKind.full
  ) {
    return `Annual ${cardTypeLabel} membership renewal every July 15 (${categoryLabel})`;
  }
  if (price.priceKind === SailingCardMembershipPriceKind.spring) {
    return `Spring ${cardTypeLabel} membership through July 14 (${categoryLabel})`;
  }
  return `Current-season ${cardTypeLabel} membership through July 14 (${categoryLabel})`;
}

function membershipStripePriceLookupKey(
  price: Pick<SailingCardMembershipPriceRow, 'id'>
) {
  return `mitsailing_membership_${price.id}`;
}

function isStripeResourceMissing(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const code =
    'code' in error && typeof error.code === 'string' ? error.code : null;
  const statusCode =
    'statusCode' in error && typeof error.statusCode === 'number'
      ? error.statusCode
      : null;

  return code === 'resource_missing' || statusCode === 404;
}

function stripeSyncErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown Stripe sync error.';
}

function assertSyncablePrice(price: SailingCardMembershipPriceRow) {
  if (price.currency !== 'usd') {
    throw new TypeError('Membership Stripe prices only support usd currency.');
  }
  if (!Number.isInteger(price.amountCents) || price.amountCents <= 0) {
    throw new TypeError('Membership Stripe prices require positive cents.');
  }
  if (
    price.billingInterval === SailingCardMembershipBillingInterval.annual &&
    price.priceKind !== SailingCardMembershipPriceKind.full
  ) {
    throw new TypeError('Only full membership prices can renew annually.');
  }
}

async function ensureMembershipStripeProduct(options: {
  readonly price: Pick<
    SailingCardMembershipPriceRow,
    'billingInterval' | 'cardType' | 'priceKind'
  >;
  readonly stripe: MembershipStripePriceSyncStripe;
}) {
  const product = membershipStripeProductDetails(options.price);
  try {
    const existingProduct = await options.stripe.products.retrieve(product.id);
    return existingProduct.id;
  } catch (error) {
    if (!isStripeResourceMissing(error)) {
      throw error;
    }
  }

  await options.stripe.products.create(
    {
      description: product.description,
      id: product.id,
      metadata: {
        billingInterval: options.price.billingInterval,
        cardType: options.price.cardType,
        domain: stripeMetadataDomain,
        priceKind: options.price.priceKind,
      },
      name: product.name,
    },
    { idempotencyKey: `membership-price-product-${product.id}` }
  );
  return product.id;
}

async function activateMembershipStripePrice(options: {
  readonly price: Pick<SailingCardMembershipPriceRow, 'id'>;
  readonly stripe: MembershipStripePriceSyncStripe;
  readonly stripePriceId: string;
}) {
  await options.stripe.prices.update(
    options.stripePriceId,
    { active: true },
    {
      idempotencyKey: `membership-price-activate-${options.price.id}`,
    }
  );
}

async function findMembershipStripePriceByLookupKey(options: {
  readonly price: Pick<SailingCardMembershipPriceRow, 'id'>;
  readonly stripe: MembershipStripePriceSyncStripe;
}) {
  const existingPrices = await options.stripe.prices.list({
    limit: 1,
    lookup_keys: [membershipStripePriceLookupKey(options.price)],
  });
  return existingPrices.data[0]?.id ?? null;
}

async function createMembershipStripePrice(options: {
  readonly price: SailingCardMembershipPriceRow;
  readonly stripe: MembershipStripePriceSyncStripe;
}) {
  assertSyncablePrice(options.price);
  const existingPriceId = await findMembershipStripePriceByLookupKey({
    price: options.price,
    stripe: options.stripe,
  });
  if (existingPriceId !== null) {
    await activateMembershipStripePrice({
      price: options.price,
      stripe: options.stripe,
      stripePriceId: existingPriceId,
    });
    return existingPriceId;
  }

  const productId = await ensureMembershipStripeProduct({
    price: options.price,
    stripe: options.stripe,
  });
  const recurring =
    options.price.billingInterval ===
    SailingCardMembershipBillingInterval.annual
      ? { recurring: { interval: 'year' } as const }
      : {};

  const price = await options.stripe.prices.create(
    {
      currency: options.price.currency,
      lookup_key: membershipStripePriceLookupKey(options.price),
      metadata: membershipStripePriceMetadata(options.price),
      nickname: membershipStripePriceNickname(options.price),
      product: productId,
      ...recurring,
      unit_amount: options.price.amountCents,
    },
    { idempotencyKey: `membership-price-sync-${options.price.id}` }
  );
  return price.id;
}

function shouldSkipStripeSync(price: SailingCardMembershipPriceRow) {
  return price.active ? false : price.stripePriceId === null;
}

function existingStripePriceNeedsVerification(
  price: SailingCardMembershipPriceRow
) {
  return (
    price.active &&
    price.stripePriceId !== null &&
    price.stripeSyncedAt === null
  );
}

export async function syncSailingCardMembershipPrice(options: {
  readonly db?: MembershipStripePriceSyncDb;
  readonly now?: Date;
  readonly price: SailingCardMembershipPriceRow;
  readonly stripe: MembershipStripePriceSyncStripe;
}): Promise<MembershipStripePriceSyncResult> {
  const db = options.db ?? prisma;
  const now = options.now ?? new Date();

  if (shouldSkipStripeSync(options.price)) {
    return {
      price: options.price,
      status: 'skipped',
      stripePriceId: null,
    };
  }

  let status: Exclude<MembershipStripePriceSyncStatus, 'failed' | 'skipped'>;
  const { stripePriceId: existingStripePriceId } = options.price;
  let stripePriceId = existingStripePriceId;
  try {
    if (existingStripePriceNeedsVerification(options.price)) {
      throw new TypeError(
        'Existing Stripe Price ID is not verified for checkout.'
      );
    }
    if (stripePriceId === null) {
      stripePriceId = await createMembershipStripePrice({
        price: options.price,
        stripe: options.stripe,
      });
      status = 'created';
    } else if (options.price.active) {
      await activateMembershipStripePrice({
        price: options.price,
        stripe: options.stripe,
        stripePriceId,
      });
      status = 'reused';
    } else {
      await options.stripe.prices.update(
        stripePriceId,
        { active: false },
        {
          idempotencyKey: `membership-price-archive-${options.price.id}`,
        }
      );
      status = 'archived';
    }
  } catch (error) {
    const message = stripeSyncErrorMessage(error);
    const updatedPrice = await db.sailingCardMembershipPrice.update({
      data: {
        stripeSyncError: message,
        stripeSyncedAt: options.price.stripeSyncedAt,
      },
      where: { id: options.price.id },
    });

    return {
      error: message,
      price: updatedPrice,
      status: 'failed',
      stripePriceId: options.price.stripePriceId,
    };
  }

  const updatedPrice = await db.sailingCardMembershipPrice.update({
    data: {
      stripePriceId,
      stripeSyncError: null,
      stripeSyncedAt: now,
    },
    where: { id: options.price.id },
  });

  return {
    price: updatedPrice,
    status,
    stripePriceId,
  };
}
