import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SailingCardMembershipBillingInterval,
  SailingCardMembershipPriceCategory,
  SailingCardMembershipPriceKind,
  SailingCardType,
} from '@/generated/prisma/enums';
import type { SailingCardMembershipPriceRow } from '@/libs/mit-sailing/membershipBilling/membershipPricing';
import {
  membershipStripePriceMetadata,
  membershipStripePriceNickname,
  syncSailingCardMembershipPrice,
} from '@/libs/mit-sailing/membershipBilling/membershipStripePrices';
import type {
  MembershipStripePriceSyncDb,
  MembershipStripePriceSyncStripe,
} from '@/libs/mit-sailing/membershipBilling/membershipStripePrices';

const mocks = vi.hoisted(() => ({
  productsCreate: vi.fn(),
  productsRetrieve: vi.fn(),
  pricesCreate: vi.fn(),
  pricesList: vi.fn(),
  pricesUpdate: vi.fn(),
  priceUpdate: vi.fn(),
}));

vi.mock('server-only', () => ({}));

const syncedAt = new Date('2026-06-01T12:00:00.000Z');

function priceRow(
  row: Partial<SailingCardMembershipPriceRow> = {}
): SailingCardMembershipPriceRow {
  return {
    active: row.active ?? true,
    amountCents: row.amountCents ?? 12_500,
    billingInterval:
      row.billingInterval ?? SailingCardMembershipBillingInterval.annual,
    cardType: row.cardType ?? SailingCardType.racing,
    currency: row.currency ?? 'usd',
    effectiveAt: row.effectiveAt ?? new Date('2026-01-01T05:00:00.000Z'),
    id: row.id ?? 'price-row-1',
    priceCategory:
      row.priceCategory ?? SailingCardMembershipPriceCategory.under_30,
    priceKind: row.priceKind ?? SailingCardMembershipPriceKind.full,
    stripePriceId: row.stripePriceId ?? null,
    stripeSyncError: row.stripeSyncError ?? null,
    stripeSyncedAt: row.stripeSyncedAt ?? null,
  };
}

function syncDb(): MembershipStripePriceSyncDb {
  return {
    sailingCardMembershipPrice: {
      update: mocks.priceUpdate,
    },
  };
}

function stripeClient(): MembershipStripePriceSyncStripe {
  return {
    prices: {
      create: mocks.pricesCreate,
      list: mocks.pricesList,
      update: mocks.pricesUpdate,
    },
    products: {
      create: mocks.productsCreate,
      retrieve: mocks.productsRetrieve,
    },
  };
}

describe('membership Stripe Prices', () => {
  beforeEach(() => {
    mocks.productsCreate.mockReset();
    mocks.productsRetrieve.mockReset();
    mocks.pricesCreate.mockReset();
    mocks.pricesList.mockReset();
    mocks.pricesUpdate.mockReset();
    mocks.priceUpdate.mockReset();

    mocks.productsRetrieve.mockImplementation(async (id: string) => {
      await Promise.resolve();
      return { id };
    });
    mocks.productsCreate.mockResolvedValue({ id: 'created_product' });
    mocks.pricesCreate.mockResolvedValue({ id: 'price_123' });
    mocks.pricesList.mockResolvedValue({ data: [] });
    mocks.pricesUpdate.mockResolvedValue({ id: 'price_existing' });
    mocks.priceUpdate.mockResolvedValue(
      priceRow({ stripePriceId: 'price_123', stripeSyncedAt: syncedAt })
    );
  });

  it('reuses an existing synced Stripe Price id and makes it active in Stripe', async () => {
    const price = priceRow({
      stripePriceId: 'price_existing',
      stripeSyncedAt: syncedAt,
    });

    await expect(
      syncSailingCardMembershipPrice({
        db: syncDb(),
        now: syncedAt,
        price,
        stripe: stripeClient(),
      })
    ).resolves.toMatchObject({
      status: 'reused',
      stripePriceId: 'price_existing',
    });

    expect(mocks.productsRetrieve).not.toHaveBeenCalled();
    expect(mocks.pricesUpdate).toHaveBeenCalledWith(
      'price_existing',
      { active: true },
      { idempotencyKey: 'membership-price-activate-price-row-1' }
    );
    expect(mocks.pricesCreate).not.toHaveBeenCalled();
    expect(mocks.priceUpdate).toHaveBeenCalledWith({
      data: {
        stripePriceId: 'price_existing',
        stripeSyncError: null,
        stripeSyncedAt: syncedAt,
      },
      where: { id: 'price-row-1' },
    });
  });

  it('does not make an active row checkout-ready from an unverified existing Stripe Price id', async () => {
    const price = priceRow({
      stripePriceId: 'price_unverified',
      stripeSyncError: 'Previous sync failed',
    });

    await expect(
      syncSailingCardMembershipPrice({
        db: syncDb(),
        now: syncedAt,
        price,
        stripe: stripeClient(),
      })
    ).resolves.toMatchObject({
      error: 'Existing Stripe Price ID is not verified for checkout.',
      status: 'failed',
      stripePriceId: 'price_unverified',
    });

    expect(mocks.pricesCreate).not.toHaveBeenCalled();
    expect(mocks.pricesUpdate).not.toHaveBeenCalled();
    expect(mocks.priceUpdate).toHaveBeenCalledWith({
      data: {
        stripeSyncError:
          'Existing Stripe Price ID is not verified for checkout.',
        stripeSyncedAt: null,
      },
      where: { id: 'price-row-1' },
    });
  });

  it('retries previously verified Stripe Price ids after a transient sync failure', async () => {
    const price = priceRow({
      stripePriceId: 'price_existing',
      stripeSyncError: 'Stripe timeout',
      stripeSyncedAt: syncedAt,
    });

    await expect(
      syncSailingCardMembershipPrice({
        db: syncDb(),
        now: new Date('2026-06-01T13:00:00.000Z'),
        price,
        stripe: stripeClient(),
      })
    ).resolves.toMatchObject({
      status: 'reused',
      stripePriceId: 'price_existing',
    });

    expect(mocks.pricesUpdate).toHaveBeenCalledWith(
      'price_existing',
      { active: true },
      { idempotencyKey: 'membership-price-activate-price-row-1' }
    );
    expect(mocks.priceUpdate).toHaveBeenCalledWith({
      data: {
        stripePriceId: 'price_existing',
        stripeSyncError: null,
        stripeSyncedAt: new Date('2026-06-01T13:00:00.000Z'),
      },
      where: { id: 'price-row-1' },
    });
  });

  it('creates recurring annual Stripe Prices for full annual prices', async () => {
    const price = priceRow();

    await expect(
      syncSailingCardMembershipPrice({
        db: syncDb(),
        now: syncedAt,
        price,
        stripe: stripeClient(),
      })
    ).resolves.toMatchObject({
      status: 'created',
      stripePriceId: 'price_123',
    });

    expect(mocks.pricesCreate).toHaveBeenCalledWith(
      {
        currency: 'usd',
        lookup_key: 'mitsailing_membership_price-row-1',
        metadata: membershipStripePriceMetadata(price),
        nickname: 'Annual racing membership renewal every July 15 (under 30)',
        product: 'mitsailing_sailing_card_membership_racing_annual',
        recurring: { interval: 'year' },
        unit_amount: 12_500,
      },
      { idempotencyKey: 'membership-price-sync-price-row-1' }
    );
    expect(mocks.priceUpdate).toHaveBeenCalledWith({
      data: {
        stripePriceId: 'price_123',
        stripeSyncError: null,
        stripeSyncedAt: syncedAt,
      },
      where: { id: 'price-row-1' },
    });
  });

  it('recovers a previously created Stripe Price by lookup key before creating', async () => {
    const price = priceRow();
    mocks.pricesList.mockResolvedValueOnce({
      data: [{ id: 'price_recovered' }],
    });

    await expect(
      syncSailingCardMembershipPrice({
        db: syncDb(),
        now: syncedAt,
        price,
        stripe: stripeClient(),
      })
    ).resolves.toMatchObject({
      status: 'created',
      stripePriceId: 'price_recovered',
    });

    expect(mocks.pricesList).toHaveBeenCalledWith({
      limit: 1,
      lookup_keys: ['mitsailing_membership_price-row-1'],
    });
    expect(mocks.pricesCreate).not.toHaveBeenCalled();
    expect(mocks.pricesUpdate).toHaveBeenCalledWith(
      'price_recovered',
      { active: true },
      { idempotencyKey: 'membership-price-activate-price-row-1' }
    );
    expect(mocks.priceUpdate).toHaveBeenCalledWith({
      data: {
        stripePriceId: 'price_recovered',
        stripeSyncError: null,
        stripeSyncedAt: syncedAt,
      },
      where: { id: 'price-row-1' },
    });
  });

  it('creates one-time Stripe Prices for spring and full current-season prices', async () => {
    const springPrice = priceRow({
      billingInterval: SailingCardMembershipBillingInterval.one_time,
      priceKind: SailingCardMembershipPriceKind.spring,
    });
    const fullPrice = priceRow({
      billingInterval: SailingCardMembershipBillingInterval.one_time,
      id: 'price-row-2',
    });

    await syncSailingCardMembershipPrice({
      db: syncDb(),
      now: syncedAt,
      price: springPrice,
      stripe: stripeClient(),
    });
    await syncSailingCardMembershipPrice({
      db: syncDb(),
      now: syncedAt,
      price: fullPrice,
      stripe: stripeClient(),
    });

    expect(mocks.pricesCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        product: 'mitsailing_sailing_card_membership_racing_spring',
      }),
      { idempotencyKey: 'membership-price-sync-price-row-1' }
    );
    expect(mocks.pricesCreate.mock.calls[0]?.[0]).not.toHaveProperty(
      'recurring'
    );
    expect(membershipStripePriceNickname(springPrice)).toBe(
      'Spring racing membership through July 14 (under 30)'
    );
    expect(mocks.pricesCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        lookup_key: 'mitsailing_membership_price-row-2',
        nickname: 'Current-season racing membership through July 14 (under 30)',
        product: 'mitsailing_sailing_card_membership_racing_current_season',
      }),
      { idempotencyKey: 'membership-price-sync-price-row-2' }
    );
  });

  it('creates the card-type Stripe Product before creating a Price when missing', async () => {
    mocks.productsRetrieve.mockRejectedValueOnce(
      Object.assign(new Error('No such product'), {
        code: 'resource_missing',
        statusCode: 404,
      })
    );

    await syncSailingCardMembershipPrice({
      db: syncDb(),
      now: syncedAt,
      price: priceRow({ cardType: SailingCardType.team_racing }),
      stripe: stripeClient(),
    });

    expect(mocks.productsCreate).toHaveBeenCalledWith(
      {
        description: 'MIT Sailing team racing membership.',
        id: 'mitsailing_sailing_card_membership_team_racing_annual',
        metadata: {
          billingInterval: 'annual',
          cardType: 'team_racing',
          domain: 'sailing_card_membership',
          priceKind: 'full',
        },
        name: 'Annual team racing membership renewal every July 15',
      },
      {
        idempotencyKey:
          'membership-price-product-mitsailing_sailing_card_membership_team_racing_annual',
      }
    );
    expect(mocks.pricesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        product: 'mitsailing_sailing_card_membership_team_racing_annual',
      }),
      { idempotencyKey: 'membership-price-sync-price-row-1' }
    );
  });

  it('stores Stripe sync failures without marking the row synced', async () => {
    mocks.pricesCreate.mockRejectedValueOnce(new Error('Stripe unavailable'));

    await expect(
      syncSailingCardMembershipPrice({
        db: syncDb(),
        now: syncedAt,
        price: priceRow(),
        stripe: stripeClient(),
      })
    ).resolves.toMatchObject({
      error: 'Stripe unavailable',
      status: 'failed',
    });

    expect(mocks.priceUpdate).toHaveBeenCalledWith({
      data: {
        stripeSyncError: 'Stripe unavailable',
        stripeSyncedAt: null,
      },
      where: { id: 'price-row-1' },
    });
  });

  it('preserves prior Stripe sync timestamps when a verified Price fails to resync', async () => {
    mocks.pricesUpdate.mockRejectedValueOnce(new Error('Stripe timeout'));

    await expect(
      syncSailingCardMembershipPrice({
        db: syncDb(),
        now: new Date('2026-06-01T13:00:00.000Z'),
        price: priceRow({
          stripePriceId: 'price_existing',
          stripeSyncedAt: syncedAt,
        }),
        stripe: stripeClient(),
      })
    ).resolves.toMatchObject({
      error: 'Stripe timeout',
      status: 'failed',
      stripePriceId: 'price_existing',
    });

    expect(mocks.priceUpdate).toHaveBeenCalledWith({
      data: {
        stripeSyncError: 'Stripe timeout',
        stripeSyncedAt: syncedAt,
      },
      where: { id: 'price-row-1' },
    });
  });

  it('archives existing Stripe Prices when local rows are inactive', async () => {
    await expect(
      syncSailingCardMembershipPrice({
        db: syncDb(),
        now: syncedAt,
        price: priceRow({
          active: false,
          stripePriceId: 'price_existing',
          stripeSyncedAt: syncedAt,
        }),
        stripe: stripeClient(),
      })
    ).resolves.toMatchObject({
      status: 'archived',
      stripePriceId: 'price_existing',
    });

    expect(mocks.pricesUpdate).toHaveBeenCalledWith(
      'price_existing',
      { active: false },
      { idempotencyKey: 'membership-price-archive-price-row-1' }
    );
    expect(mocks.pricesCreate).not.toHaveBeenCalled();
  });
});
