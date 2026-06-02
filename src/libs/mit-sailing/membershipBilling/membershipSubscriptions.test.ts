import { describe, expect, it } from 'vitest';
import {
  PaymentStatus,
  SailingCardSubscriptionStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import {
  membershipProfileState,
  selectCanonicalMembershipSubscription,
} from '@/libs/mit-sailing/membershipBilling/membershipSubscriptions';

const periodEnd = new Date('2026-07-15T04:00:00.000Z');

const subscription = (
  overrides: Partial<
    Parameters<typeof membershipProfileState>[0]['subscription']
  > = {}
) => ({
  autoRenew: true,
  cancelAtPeriodEnd: false,
  canonicalSubscriptionId: null,
  cardType: SailingCardType.racing,
  currentPeriodEnd: periodEnd,
  id: 'sub_local_1',
  status: SailingCardSubscriptionStatus.active,
  stripeCustomerId: 'cus_test',
  stripeSubscriptionId: 'sub_test',
  ...overrides,
});

const payment = (
  overrides: Partial<
    Parameters<typeof membershipProfileState>[0]['latestPayment']
  > = {}
) => ({
  amountCents: 7000,
  id: 'pay_1',
  issueKind: null,
  status: PaymentStatus.paid,
  stripeReceiptUrl: 'https://pay.stripe.com/receipts/test',
  ...overrides,
});

describe('membershipSubscriptions', () => {
  it('selects the canonical active subscription before duplicates', () => {
    const canonical = subscription({ id: 'canonical' });
    const duplicate = subscription({
      canonicalSubscriptionId: 'canonical',
      id: 'duplicate',
      status: SailingCardSubscriptionStatus.duplicate,
    });

    expect(
      selectCanonicalMembershipSubscription([duplicate, canonical])?.id
    ).toBe('canonical');
  });

  it('maps active and trialing subscriptions to paid active profile state', () => {
    expect(
      membershipProfileState({
        access: 'paid_racing_available',
        latestPayment: payment(),
        subscription: subscription(),
      })
    ).toMatchObject({
      kind: 'active_paid',
      canOpenBillingPortal: true,
      canTurnOffAutoRenew: true,
      receiptUrl: 'https://pay.stripe.com/receipts/test',
    });

    expect(
      membershipProfileState({
        access: 'paid_racing_available',
        latestPayment: payment(),
        subscription: subscription({
          status: SailingCardSubscriptionStatus.trialing,
        }),
      }).kind
    ).toBe('active_paid');
  });

  it('maps incomplete checkout to a recoverable pending state', () => {
    expect(
      membershipProfileState({
        access: 'paid_racing_available',
        latestPayment: payment({ status: PaymentStatus.checkout_created }),
        subscription: subscription({
          status: SailingCardSubscriptionStatus.incomplete,
        }),
      })
    ).toMatchObject({
      canOpenBillingPortal: false,
      canTurnOffAutoRenew: false,
      kind: 'pending_checkout',
    });
  });

  it('maps past due subscriptions to payment attention state', () => {
    expect(
      membershipProfileState({
        access: 'paid_racing_available',
        latestPayment: payment({ status: PaymentStatus.past_due }),
        subscription: subscription({
          status: SailingCardSubscriptionStatus.past_due,
        }),
      })
    ).toMatchObject({
      canOpenBillingPortal: true,
      canTurnOffAutoRenew: true,
      kind: 'past_due',
    });
  });

  it('shows auto-renew off through the paid access end date', () => {
    expect(
      membershipProfileState({
        access: 'paid_racing_available',
        latestPayment: payment(),
        subscription: subscription({ cancelAtPeriodEnd: true }),
      })
    ).toMatchObject({
      canTurnOffAutoRenew: false,
      kind: 'cancel_at_period_end',
    });
  });

  it('flags paid renewals that may be unnecessary after free-normal eligibility appears', () => {
    expect(
      membershipProfileState({
        access: 'free_normal',
        latestPayment: payment(),
        subscription: subscription(),
      })
    ).toMatchObject({
      canTurnOffAutoRenew: true,
      kind: 'free_normal_active_paid',
    });
  });

  it('maps missing paid subscription to free normal or no paid membership state', () => {
    expect(
      membershipProfileState({
        access: 'free_normal',
        latestPayment: null,
        subscription: null,
      }).kind
    ).toBe('free_normal');

    expect(
      membershipProfileState({
        access: 'paid_racing_available',
        latestPayment: null,
        subscription: null,
      }).kind
    ).toBe('no_paid_membership');
  });

  it('maps checkout-created payment without a subscription to pending checkout', () => {
    expect(
      membershipProfileState({
        access: 'paid_racing_available',
        latestPayment: payment({ status: PaymentStatus.checkout_created }),
        subscription: null,
      }).kind
    ).toBe('pending_checkout');
  });

  it('does not treat paused or duplicate subscriptions as active paid access', () => {
    for (const status of [
      SailingCardSubscriptionStatus.paused,
      SailingCardSubscriptionStatus.duplicate,
    ]) {
      expect(
        membershipProfileState({
          access: 'paid_racing_available',
          latestPayment: payment(),
          subscription: subscription({ status }),
        })
      ).toMatchObject({
        canOpenBillingPortal: false,
        canTurnOffAutoRenew: false,
        kind: 'no_paid_membership',
      });
    }
  });
});
