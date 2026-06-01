import { describe, expect, it, vi } from 'vitest';
import {
  SailingAffiliation,
  SailingCardMembershipBillingInterval,
  SailingCardMembershipPriceCategory,
  SailingCardMembershipPriceKind,
  SailingCardType,
} from '@/generated/prisma/enums';
import {
  getActiveMembershipPrice,
  getCheckoutMembershipPrices,
  membershipPriceCategoryForCardRequest,
  selectActiveMembershipPrice,
} from '@/libs/mit-sailing/membershipBilling/membershipPricing';
import type {
  MembershipPricingReadClient,
  SailingCardMembershipPriceRow,
} from '@/libs/mit-sailing/membershipBilling/membershipPricing';

type PricingFindManyArgs = Parameters<
  MembershipPricingReadClient['sailingCardMembershipPrice']['findMany']
>[0];
type PricingLookup = Extract<
  PricingFindManyArgs['where'],
  { OR: readonly unknown[] }
>['OR'][number];
type PricingClientFixture = {
  readonly client: MembershipPricingReadClient;
  readonly findMany: ReturnType<typeof vi.fn>;
};

const effectiveAt = new Date('2026-01-01T05:00:00.000Z');

function priceRow(
  row: Partial<SailingCardMembershipPriceRow> &
    Pick<
      SailingCardMembershipPriceRow,
      'amountCents' | 'billingInterval' | 'priceCategory' | 'priceKind'
    >
): SailingCardMembershipPriceRow {
  return {
    active: row.active ?? true,
    cardType: row.cardType ?? SailingCardType.racing,
    currency: row.currency ?? 'usd',
    effectiveAt: row.effectiveAt ?? effectiveAt,
    id:
      row.id ??
      [
        row.priceKind,
        row.priceCategory,
        row.billingInterval,
        row.amountCents,
      ].join('-'),
    stripePriceId: row.stripePriceId ?? null,
    stripeSyncError: row.stripeSyncError ?? null,
    stripeSyncedAt: row.stripeSyncedAt ?? null,
    ...row,
  };
}

function pricingClientFixtureForRows(
  rows: readonly SailingCardMembershipPriceRow[]
): PricingClientFixture {
  const findMany = vi.fn(async (args: PricingFindManyArgs) => {
    await Promise.resolve();
    const lookups: readonly PricingLookup[] =
      'OR' in args.where ? args.where.OR : [args.where];
    return rows
      .filter(
        (row) =>
          row.cardType === args.where.cardType &&
          lookups.some(
            (lookup) =>
              row.billingInterval === lookup.billingInterval &&
              row.effectiveAt <= lookup.effectiveAt.lte &&
              row.priceCategory === lookup.priceCategory &&
              row.priceKind === lookup.priceKind
          )
      )
      .toSorted((a, b) => b.effectiveAt.getTime() - a.effectiveAt.getTime());
  });

  return {
    client: {
      sailingCardMembershipPrice: { findMany },
    },
    findMany,
  };
}

function pricingClientForRows(
  rows: readonly SailingCardMembershipPriceRow[]
): MembershipPricingReadClient {
  return pricingClientFixtureForRows(rows).client;
}

const baseRows: readonly SailingCardMembershipPriceRow[] = [
  priceRow({
    amountCents: 7000,
    billingInterval: SailingCardMembershipBillingInterval.one_time,
    priceCategory: SailingCardMembershipPriceCategory.under_30,
    priceKind: SailingCardMembershipPriceKind.spring,
  }),
  priceRow({
    amountCents: 12_500,
    billingInterval: SailingCardMembershipBillingInterval.one_time,
    priceCategory: SailingCardMembershipPriceCategory.under_30,
    priceKind: SailingCardMembershipPriceKind.full,
  }),
  priceRow({
    amountCents: 17_500,
    billingInterval: SailingCardMembershipBillingInterval.one_time,
    priceCategory: SailingCardMembershipPriceCategory.thirty_or_over,
    priceKind: SailingCardMembershipPriceKind.full,
  }),
  priceRow({
    amountCents: 12_500,
    billingInterval: SailingCardMembershipBillingInterval.annual,
    priceCategory: SailingCardMembershipPriceCategory.under_30,
    priceKind: SailingCardMembershipPriceKind.full,
  }),
  priceRow({
    amountCents: 17_500,
    billingInterval: SailingCardMembershipBillingInterval.annual,
    priceCategory: SailingCardMembershipPriceCategory.thirty_or_over,
    priceKind: SailingCardMembershipPriceKind.full,
  }),
  priceRow({
    amountCents: 2500,
    billingInterval: SailingCardMembershipBillingInterval.one_time,
    priceCategory: SailingCardMembershipPriceCategory.student,
    priceKind: SailingCardMembershipPriceKind.spring,
  }),
  priceRow({
    amountCents: 4000,
    billingInterval: SailingCardMembershipBillingInterval.annual,
    priceCategory: SailingCardMembershipPriceCategory.student,
    priceKind: SailingCardMembershipPriceKind.full,
  }),
];

describe('membership pricing', () => {
  it('selects active full racing prices on or after July 15', async () => {
    await expect(
      getActiveMembershipPrice({
        billingInterval: SailingCardMembershipBillingInterval.one_time,
        cardType: SailingCardType.racing,
        client: pricingClientForRows(baseRows),
        now: new Date('2026-07-15T12:00:00.000Z'),
        priceCategory: SailingCardMembershipPriceCategory.under_30,
        priceKind: SailingCardMembershipPriceKind.full,
      })
    ).resolves.toMatchObject({ amountCents: 12_500 });
  });

  it('selects active spring racing prices before July 15', async () => {
    await expect(
      getActiveMembershipPrice({
        billingInterval: SailingCardMembershipBillingInterval.one_time,
        cardType: SailingCardType.racing,
        client: pricingClientForRows(baseRows),
        now: new Date('2026-06-01T12:00:00.000Z'),
        priceCategory: SailingCardMembershipPriceCategory.under_30,
        priceKind: SailingCardMembershipPriceKind.spring,
      })
    ).resolves.toMatchObject({ amountCents: 7000 });
  });

  it('returns spring due today and annual July 15 renewal pricing before July 15', async () => {
    const fixture = pricingClientFixtureForRows(baseRows);

    await expect(
      getCheckoutMembershipPrices({
        affiliation: SailingAffiliation.MIT_ALUM,
        cardType: SailingCardType.racing,
        client: fixture.client,
        dateOfBirth: '07/16/1996',
        now: new Date('2026-06-01T12:00:00.000Z'),
        requireStripeReady: false,
      })
    ).resolves.toMatchObject({
      status: 'ready',
      dueTodayPrice: { amountCents: 7000 },
      renewalPrice: { amountCents: 12_500 },
    });
    expect(fixture.findMany).toHaveBeenCalledTimes(1);
  });

  it('returns no checkout prices by default until Stripe sync succeeds', async () => {
    await expect(
      getCheckoutMembershipPrices({
        affiliation: SailingAffiliation.MIT_ALUM,
        cardType: SailingCardType.racing,
        client: pricingClientForRows(baseRows),
        dateOfBirth: '07/16/1996',
        now: new Date('2026-06-01T12:00:00.000Z'),
      })
    ).resolves.toMatchObject({ status: 'missing_due_today_price' });
  });

  it('distinguishes ineligible requests from missing membership prices', async () => {
    await expect(
      getCheckoutMembershipPrices({
        affiliation: SailingAffiliation.MIT_STUDENT,
        cardType: SailingCardType.racing,
        client: pricingClientForRows(baseRows),
        dateOfBirth: '07/16/1996',
        now: new Date('2026-06-01T12:00:00.000Z'),
        requireStripeReady: false,
      })
    ).resolves.toEqual({ status: 'not_eligible' });
  });

  it('uses the renewal age band at the July 15 billing anchor', async () => {
    await expect(
      getCheckoutMembershipPrices({
        affiliation: SailingAffiliation.MIT_ALUM,
        cardType: SailingCardType.racing,
        client: pricingClientForRows(baseRows),
        dateOfBirth: '07/15/1996',
        now: new Date('2026-06-01T12:00:00.000Z'),
        requireStripeReady: false,
      })
    ).resolves.toMatchObject({
      status: 'ready',
      dueTodayPrice: { amountCents: 7000 },
      renewalPrice: { amountCents: 17_500 },
    });
  });

  it.each([
    ['July 14 birthday', '07/14/1996', 17_500],
    ['July 16 birthday', '07/16/1996', 12_500],
  ])(
    'uses the renewal age band for a %s',
    async (_label, dateOfBirth, amount) => {
      await expect(
        getCheckoutMembershipPrices({
          affiliation: SailingAffiliation.MIT_ALUM,
          cardType: SailingCardType.racing,
          client: pricingClientForRows(baseRows),
          dateOfBirth,
          now: new Date('2026-06-01T12:00:00.000Z'),
          requireStripeReady: false,
        })
      ).resolves.toMatchObject({
        status: 'ready',
        renewalPrice: { amountCents: amount },
      });
    }
  );

  it('treats the 30th birthday as thirty or over in Eastern time', () => {
    expect(
      membershipPriceCategoryForCardRequest({
        affiliation: SailingAffiliation.MIT_ALUM,
        dateOfBirth: '07/15/1996',
        now: new Date('2026-07-15T03:59:59.999Z'),
      })
    ).toBe(SailingCardMembershipPriceCategory.under_30);
    expect(
      membershipPriceCategoryForCardRequest({
        affiliation: SailingAffiliation.MIT_ALUM,
        dateOfBirth: '07/15/1996',
        now: new Date('2026-07-15T04:00:00.000Z'),
      })
    ).toBe(SailingCardMembershipPriceCategory.thirty_or_over);
  });

  it('keeps non-MIT student paid pricing separate from age bands', () => {
    expect(
      membershipPriceCategoryForCardRequest({
        affiliation: SailingAffiliation.WELLESLEY,
        dateOfBirth: '01/02/1990',
        now: new Date('2026-07-15T12:00:00.000Z'),
      })
    ).toBe(SailingCardMembershipPriceCategory.student);
  });

  it('ignores future and inactive rows when selecting active prices', () => {
    const selected = selectActiveMembershipPrice(
      [
        priceRow({
          amountCents: 7000,
          active: false,
          billingInterval: SailingCardMembershipBillingInterval.one_time,
          priceCategory: SailingCardMembershipPriceCategory.under_30,
          priceKind: SailingCardMembershipPriceKind.spring,
        }),
        priceRow({
          amountCents: 7500,
          billingInterval: SailingCardMembershipBillingInterval.one_time,
          effectiveAt: new Date('2026-06-01T04:00:00.000Z'),
          priceCategory: SailingCardMembershipPriceCategory.under_30,
          priceKind: SailingCardMembershipPriceKind.spring,
        }),
        priceRow({
          amountCents: 8000,
          billingInterval: SailingCardMembershipBillingInterval.one_time,
          effectiveAt: new Date('2026-07-01T04:00:00.000Z'),
          priceCategory: SailingCardMembershipPriceCategory.under_30,
          priceKind: SailingCardMembershipPriceKind.spring,
        }),
      ],
      { now: new Date('2026-06-15T12:00:00.000Z') }
    );

    expect(selected).toMatchObject({ amountCents: 7500 });
  });

  it('can require Stripe-synced prices for checkout selection', () => {
    const selected = selectActiveMembershipPrice(
      [
        priceRow({
          amountCents: 9000,
          billingInterval: SailingCardMembershipBillingInterval.one_time,
          effectiveAt: new Date('2026-06-10T04:00:00.000Z'),
          priceCategory: SailingCardMembershipPriceCategory.under_30,
          priceKind: SailingCardMembershipPriceKind.spring,
          stripePriceId: 'price_failed_sync',
          stripeSyncError: 'Stripe unavailable',
          stripeSyncedAt: new Date('2026-06-10T04:30:00.000Z'),
        }),
        priceRow({
          amountCents: 8000,
          billingInterval: SailingCardMembershipBillingInterval.one_time,
          effectiveAt: new Date('2026-06-01T04:00:00.000Z'),
          priceCategory: SailingCardMembershipPriceCategory.under_30,
          priceKind: SailingCardMembershipPriceKind.spring,
          stripePriceId: 'price_unsynced',
        }),
        priceRow({
          amountCents: 8500,
          active: false,
          billingInterval: SailingCardMembershipBillingInterval.one_time,
          effectiveAt: new Date('2026-07-01T04:00:00.000Z'),
          priceCategory: SailingCardMembershipPriceCategory.under_30,
          priceKind: SailingCardMembershipPriceKind.spring,
          stripePriceId: 'price_inactive',
          stripeSyncedAt: new Date('2026-06-01T04:30:00.000Z'),
        }),
        priceRow({
          amountCents: 7500,
          billingInterval: SailingCardMembershipBillingInterval.one_time,
          effectiveAt: new Date('2026-05-01T04:00:00.000Z'),
          priceCategory: SailingCardMembershipPriceCategory.under_30,
          priceKind: SailingCardMembershipPriceKind.spring,
          stripePriceId: 'price_synced',
          stripeSyncedAt: new Date('2026-05-01T04:30:00.000Z'),
        }),
      ],
      {
        now: new Date('2026-06-15T12:00:00.000Z'),
        requireStripeReady: true,
      }
    );

    expect(selected).toMatchObject({ amountCents: 7500 });
  });
});
