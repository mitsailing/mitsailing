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
  syncSailingCardMembershipPrice,
} from '@/libs/mit-sailing/membershipBilling/membershipStripePrices';
import type {
  MembershipStripePriceSyncDb,
  MembershipStripePriceSyncStripe,
} from '@/libs/mit-sailing/membershipBilling/membershipStripePrices';

const mocks = vi.hoisted(() => ({
  priceFindUnique: vi.fn(),
  priceUpdate: vi.fn(),
  productsCreate: vi.fn(),
  productsRetrieve: vi.fn(),
  productsUpdate: vi.fn(),
  pricesCreate: vi.fn(),
  pricesList: vi.fn(),
  pricesUpdate: vi.fn(),
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
      findUnique: mocks.priceFindUnique,
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
      update: mocks.productsUpdate,
    },
  };
}

type StripePriceListRow = Awaited<
  ReturnType<MembershipStripePriceSyncStripe['prices']['list']>
>['data'][number];

function annualRecurringPrice(
  price: Partial<StripePriceListRow> = {}
): StripePriceListRow {
  return {
    currency: 'usd',
    id: 'price_recovered',
    product: 'mitsailing_sailing_card_membership_racing_annual',
    recurring: {
      interval: 'year',
      interval_count: 1,
      meter: null,
      trial_period_days: null,
      usage_type: 'licensed',
    },
    type: 'recurring',
    unit_amount: 12_500,
    ...price,
  };
}

function expectSyncedPriceUpdate(options: {
  readonly previousStripePriceId: string | null;
  readonly stripePriceId: string;
  readonly syncedAt: Date;
}) {
  expect(mocks.priceUpdate).toHaveBeenCalledWith({
    data: {
      stripePriceId: options.stripePriceId,
      stripeSyncError: null,
      stripeSyncedAt: options.syncedAt,
    },
    where: {
      AND: [{ stripePriceId: options.previousStripePriceId }],
      active: true,
      id: 'price-row-1',
    },
  });
}

describe('membership Stripe Prices', () => {
  beforeEach(() => {
    mocks.priceFindUnique.mockReset();
    mocks.priceUpdate.mockReset();
    mocks.productsCreate.mockReset();
    mocks.productsRetrieve.mockReset();
    mocks.productsUpdate.mockReset();
    mocks.pricesCreate.mockReset();
    mocks.pricesList.mockReset();
    mocks.pricesUpdate.mockReset();

    mocks.priceFindUnique.mockResolvedValue(priceRow());
    mocks.productsRetrieve.mockImplementation(async (id: string) => {
      await Promise.resolve();
      return { active: true, id };
    });
    mocks.productsCreate.mockResolvedValue({
      active: true,
      id: 'created_product',
    });
    mocks.productsUpdate.mockResolvedValue({
      active: true,
      id: 'updated_product',
    });
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
    expectSyncedPriceUpdate({
      previousStripePriceId: 'price_existing',
      stripePriceId: 'price_existing',
      syncedAt,
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
    expectSyncedPriceUpdate({
      previousStripePriceId: 'price_existing',
      stripePriceId: 'price_existing',
      syncedAt: new Date('2026-06-01T13:00:00.000Z'),
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
    expectSyncedPriceUpdate({
      previousStripePriceId: null,
      stripePriceId: 'price_123',
      syncedAt,
    });
  });

  it('recovers a previously created Stripe Price by lookup key before creating', async () => {
    const price = priceRow();
    mocks.pricesList.mockResolvedValueOnce({
      data: [annualRecurringPrice()],
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
    expectSyncedPriceUpdate({
      previousStripePriceId: null,
      stripePriceId: 'price_recovered',
      syncedAt,
    });
  });

  it.each([
    {
      label: 'amount',
      stripePrice: annualRecurringPrice({ unit_amount: 13_000 }),
    },
    {
      label: 'currency',
      stripePrice: annualRecurringPrice({ currency: 'eur' }),
    },
    {
      label: 'product',
      stripePrice: annualRecurringPrice({
        product: 'mitsailing_sailing_card_membership_racing_spring',
      }),
    },
    {
      label: 'type',
      stripePrice: annualRecurringPrice({
        recurring: null,
        type: 'one_time',
      }),
    },
    {
      label: 'interval count',
      stripePrice: annualRecurringPrice({
        recurring: {
          interval: 'year',
          interval_count: 2,
          meter: null,
          trial_period_days: null,
          usage_type: 'licensed',
        },
      }),
    },
    {
      label: 'usage type',
      stripePrice: annualRecurringPrice({
        recurring: {
          interval: 'year',
          interval_count: 1,
          meter: null,
          trial_period_days: null,
          usage_type: 'metered',
        },
      }),
    },
  ])(
    'rejects recovered Stripe Prices with mismatched $label',
    async ({ stripePrice }) => {
      mocks.pricesList.mockResolvedValueOnce({
        data: [stripePrice],
      });

      await expect(
        syncSailingCardMembershipPrice({
          db: syncDb(),
          now: syncedAt,
          price: priceRow(),
          stripe: stripeClient(),
        })
      ).resolves.toMatchObject({
        error: 'Existing Stripe Price lookup key points to a mismatched Price.',
        status: 'failed',
        stripePriceId: null,
      });

      expect(mocks.pricesUpdate).not.toHaveBeenCalled();
      expect(mocks.pricesCreate).not.toHaveBeenCalled();
      expect(mocks.priceUpdate).toHaveBeenCalledWith({
        data: {
          stripeSyncError:
            'Existing Stripe Price lookup key points to a mismatched Price.',
          stripeSyncedAt: null,
        },
        where: { id: 'price-row-1' },
      });
    }
  );

  it('rejects inactive rows with unverified existing Stripe Price ids', async () => {
    const price = priceRow({
      active: false,
      stripePriceId: 'price_unverified',
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

  it('archives created Stripe Prices when the local row changes before persistence', async () => {
    mocks.priceFindUnique.mockResolvedValueOnce(priceRow({ active: false }));
    mocks.priceUpdate
      .mockRejectedValueOnce(
        Object.assign(new Error('Record not found'), { code: 'P2025' })
      )
      .mockResolvedValueOnce(
        priceRow({
          active: false,
          stripeSyncError: 'Membership Price changed during Stripe sync.',
        })
      );

    await expect(
      syncSailingCardMembershipPrice({
        db: syncDb(),
        now: syncedAt,
        price: priceRow(),
        stripe: stripeClient(),
      })
    ).resolves.toMatchObject({
      error: 'Membership Price changed during Stripe sync.',
      status: 'failed',
      stripePriceId: null,
    });

    expect(mocks.pricesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        lookup_key: 'mitsailing_membership_price-row-1',
      }),
      { idempotencyKey: 'membership-price-sync-price-row-1' }
    );
    expect(mocks.priceUpdate).toHaveBeenNthCalledWith(1, {
      data: {
        stripePriceId: 'price_123',
        stripeSyncError: null,
        stripeSyncedAt: syncedAt,
      },
      where: {
        AND: [{ stripePriceId: null }],
        active: true,
        id: 'price-row-1',
      },
    });
    expect(mocks.pricesUpdate).toHaveBeenCalledWith(
      'price_123',
      { active: false },
      { idempotencyKey: 'membership-price-archive-price-row-1' }
    );
    expect(mocks.priceUpdate).toHaveBeenNthCalledWith(2, {
      data: {
        stripeSyncError: 'Membership Price changed during Stripe sync.',
        stripeSyncedAt: null,
      },
      where: { id: 'price-row-1' },
    });
  });

  it('preserves concurrent successful syncs for the same Stripe Price', async () => {
    mocks.pricesList.mockResolvedValueOnce({
      data: [annualRecurringPrice({ id: 'price_123' })],
    });
    mocks.priceFindUnique.mockResolvedValueOnce(
      priceRow({ stripePriceId: 'price_123', stripeSyncedAt: syncedAt })
    );
    mocks.priceUpdate.mockRejectedValueOnce(
      Object.assign(new Error('Record not found'), { code: 'P2025' })
    );

    await expect(
      syncSailingCardMembershipPrice({
        db: syncDb(),
        now: syncedAt,
        price: priceRow(),
        stripe: stripeClient(),
      })
    ).resolves.toMatchObject({
      status: 'created',
      stripePriceId: 'price_123',
    });

    expect(mocks.pricesCreate).not.toHaveBeenCalled();
    expect(mocks.pricesUpdate).toHaveBeenCalledWith(
      'price_123',
      { active: true },
      { idempotencyKey: 'membership-price-activate-price-row-1' }
    );
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
    expect(mocks.pricesCreate.mock.calls[0]?.[0].nickname).toBe(
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
        active: true,
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

  it('reactivates the card-type Stripe Product before creating a Price when archived', async () => {
    mocks.productsRetrieve.mockResolvedValueOnce({
      active: false,
      id: 'mitsailing_sailing_card_membership_team_racing_annual',
    });

    await syncSailingCardMembershipPrice({
      db: syncDb(),
      now: syncedAt,
      price: priceRow({ cardType: SailingCardType.team_racing }),
      stripe: stripeClient(),
    });

    expect(mocks.productsUpdate).toHaveBeenCalledWith(
      'mitsailing_sailing_card_membership_team_racing_annual',
      { active: true },
      {
        idempotencyKey:
          'membership-price-product-activate-mitsailing_sailing_card_membership_team_racing_annual',
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
