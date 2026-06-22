import 'server-only';
import type { Stripe } from 'stripe';
import {
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

type MembershipStripeProduct = Pick<Stripe.Product, 'active' | 'id'>;
type MembershipStripePrice = Pick<
  Stripe.Price,
  'currency' | 'id' | 'product' | 'recurring' | 'type' | 'unit_amount'
>;

export type MembershipStripePriceSyncDb = {
  readonly sailingCardMembershipPrice: {
    findUnique(args: {
      readonly where: { readonly id: string };
    }): Promise<SailingCardMembershipPriceRow | null>;
    update(args: {
      readonly data: {
        readonly stripePriceId?: string;
        readonly stripeSyncError: string | null;
        readonly stripeSyncedAt: Date | null;
      };
      readonly where: {
        readonly AND?: readonly { readonly stripePriceId: string | null }[];
        readonly active?: boolean;
        readonly id: string;
      };
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
      readonly data: readonly MembershipStripePrice[];
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
    update(
      id: string,
      params: Stripe.ProductUpdateParams,
      options: { readonly idempotencyKey: string }
    ): Promise<MembershipStripeProduct>;
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
  price: Pick<SailingCardMembershipPriceRow, 'priceKind'>
) {
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

function membershipStripePriceNickname(
  price: Pick<
    SailingCardMembershipPriceRow,
    'billingInterval' | 'cardType' | 'priceCategory' | 'priceKind'
  >
) {
  const cardTypeLabel = membershipCardTypeLabel(price.cardType);
  const categoryLabel = membershipPriceCategoryLabel(price);
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

function stripeProductId(product: Stripe.Price['product']) {
  return typeof product === 'string' ? product : product.id;
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

function isPrismaRecordMissing(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  return 'code' in error && error.code === 'P2025';
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
    if (!existingProduct.active) {
      await options.stripe.products.update(
        product.id,
        { active: true },
        {
          idempotencyKey: `membership-price-product-activate-${product.id}`,
        }
      );
    }
    return existingProduct.id;
  } catch (error) {
    if (!isStripeResourceMissing(error)) {
      throw error;
    }
  }

  await options.stripe.products.create(
    {
      active: true,
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

async function archiveMembershipStripePrice(options: {
  readonly price: Pick<SailingCardMembershipPriceRow, 'id'>;
  readonly stripe: MembershipStripePriceSyncStripe;
  readonly stripePriceId: string;
}) {
  await options.stripe.prices.update(
    options.stripePriceId,
    { active: false },
    {
      idempotencyKey: `membership-price-archive-${options.price.id}`,
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
  return existingPrices.data[0] ?? null;
}

function membershipStripePriceMatchesLocalPrice(options: {
  readonly price: Pick<
    SailingCardMembershipPriceRow,
    'amountCents' | 'billingInterval' | 'cardType' | 'currency' | 'priceKind'
  >;
  readonly stripePrice: MembershipStripePrice;
}) {
  const product = membershipStripeProductDetails(options.price);
  const samePriceTerms =
    options.stripePrice.currency === options.price.currency &&
    options.stripePrice.unit_amount === options.price.amountCents &&
    stripeProductId(options.stripePrice.product) === product.id;

  if (!samePriceTerms) {
    return false;
  }

  return (
    options.stripePrice.type === 'one_time' &&
    options.stripePrice.recurring === null
  );
}

async function createMembershipStripePrice(options: {
  readonly price: SailingCardMembershipPriceRow;
  readonly stripe: MembershipStripePriceSyncStripe;
}) {
  assertSyncablePrice(options.price);
  const existingPrice = await findMembershipStripePriceByLookupKey({
    price: options.price,
    stripe: options.stripe,
  });
  if (existingPrice !== null) {
    if (
      !membershipStripePriceMatchesLocalPrice({
        price: options.price,
        stripePrice: existingPrice,
      })
    ) {
      throw new TypeError(
        'Existing Stripe Price lookup key points to a mismatched Price.'
      );
    }
    await activateMembershipStripePrice({
      price: options.price,
      stripe: options.stripe,
      stripePriceId: existingPrice.id,
    });
    return existingPrice.id;
  }

  const productId = await ensureMembershipStripeProduct({
    price: options.price,
    stripe: options.stripe,
  });

  const price = await options.stripe.prices.create(
    {
      currency: options.price.currency,
      lookup_key: membershipStripePriceLookupKey(options.price),
      metadata: membershipStripePriceMetadata(options.price),
      nickname: membershipStripePriceNickname(options.price),
      product: productId,
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
  return price.stripePriceId !== null && price.stripeSyncedAt === null;
}

function syncedPriceUpdateWhere(price: SailingCardMembershipPriceRow) {
  return {
    AND: [{ stripePriceId: price.stripePriceId }],
    active: price.active,
    id: price.id,
  };
}

function isAlreadySyncedToStripePrice(options: {
  readonly currentPrice: SailingCardMembershipPriceRow;
  readonly price: Pick<SailingCardMembershipPriceRow, 'active'>;
  readonly stripePriceId: string;
}) {
  return (
    options.currentPrice.active === options.price.active &&
    options.currentPrice.stripePriceId === options.stripePriceId &&
    options.currentPrice.stripeSyncError === null &&
    options.currentPrice.stripeSyncedAt !== null
  );
}

async function handleChangedMembershipPrice(options: {
  readonly db: MembershipStripePriceSyncDb;
  readonly price: SailingCardMembershipPriceRow;
  readonly stripe: MembershipStripePriceSyncStripe;
  readonly stripePriceId: string;
}) {
  const currentPrice = await options.db.sailingCardMembershipPrice.findUnique({
    where: { id: options.price.id },
  });

  if (
    currentPrice !== null &&
    isAlreadySyncedToStripePrice({
      currentPrice,
      price: options.price,
      stripePriceId: options.stripePriceId,
    })
  ) {
    return currentPrice;
  }

  if (currentPrice?.active === false) {
    await archiveMembershipStripePrice({
      price: options.price,
      stripe: options.stripe,
      stripePriceId: options.stripePriceId,
    });
  }

  throw new TypeError('Membership Price changed during Stripe sync.');
}

async function markMembershipStripePriceSynced(options: {
  readonly db: MembershipStripePriceSyncDb;
  readonly now: Date;
  readonly price: SailingCardMembershipPriceRow;
  readonly stripe: MembershipStripePriceSyncStripe;
  readonly stripePriceId: string;
}) {
  try {
    return await options.db.sailingCardMembershipPrice.update({
      data: {
        stripePriceId: options.stripePriceId,
        stripeSyncError: null,
        stripeSyncedAt: options.now,
      },
      where: syncedPriceUpdateWhere(options.price),
    });
  } catch (error) {
    if (!isPrismaRecordMissing(error)) {
      throw error;
    }
    return handleChangedMembershipPrice(options);
  }
}

function membershipStripePriceSyncDb(): MembershipStripePriceSyncDb {
  return {
    sailingCardMembershipPrice: {
      findUnique: async (args) => {
        const price = await prisma.sailingCardMembershipPrice.findUnique(args);
        return price;
      },
      update: async (args) => {
        const price = await prisma.sailingCardMembershipPrice.update({
          data: {
            ...(args.data.stripePriceId === undefined
              ? {}
              : { stripePriceId: args.data.stripePriceId }),
            stripeSyncError: args.data.stripeSyncError,
            stripeSyncedAt: args.data.stripeSyncedAt,
          },
          where: {
            ...(args.where.AND === undefined
              ? {}
              : {
                  AND: args.where.AND.map((condition) => ({
                    stripePriceId: condition.stripePriceId,
                  })),
                }),
            ...(args.where.active === undefined
              ? {}
              : { active: args.where.active }),
            id: args.where.id,
          },
        });
        return price;
      },
    },
  };
}

export async function syncSailingCardMembershipPrice(options: {
  readonly db?: MembershipStripePriceSyncDb;
  readonly now?: Date;
  readonly price: SailingCardMembershipPriceRow;
  readonly stripe: MembershipStripePriceSyncStripe;
}): Promise<MembershipStripePriceSyncResult> {
  const db = options.db ?? membershipStripePriceSyncDb();
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
      await archiveMembershipStripePrice({
        price: options.price,
        stripe: options.stripe,
        stripePriceId,
      });
      status = 'archived';
    }
    const updatedPrice = await markMembershipStripePriceSynced({
      db,
      now,
      price: options.price,
      stripe: options.stripe,
      stripePriceId,
    });

    return {
      price: updatedPrice,
      status,
      stripePriceId,
    };
  } catch (error) {
    if (existingStripePriceId === null && stripePriceId !== null) {
      await archiveMembershipStripePrice({
        price: options.price,
        stripe: options.stripe,
        stripePriceId,
      });
    }
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
}
