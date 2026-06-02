import { beforeEach, describe, expect, it, vi } from 'vitest';
import { turnOffMembershipAutoRenew } from '@/libs/mit-sailing/membershipBilling/membershipCancellationActions';

vi.mock('server-only', () => ({}));

const loggerError = vi.hoisted(() => vi.fn());

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: loggerError,
  },
}));

describe('membershipCancellationActions', () => {
  beforeEach(() => {
    loggerError.mockReset();
  });

  it('turns off auto-renew in Stripe before updating local state', async () => {
    const updateSubscription = vi.fn().mockResolvedValue({ id: 'sub_test' });
    const updateLocal = vi.fn().mockResolvedValue({});

    const result = await turnOffMembershipAutoRenew({
      client: {
        sailingCardSubscription: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'local_sub',
            stripeSubscriptionId: 'sub_test',
          }),
          update: updateLocal,
        },
      },
      note: 'Not sailing next season',
      now: new Date('2026-06-01T12:00:00.000Z'),
      reason: 'not_sailing_next_season',
      stripe: {
        subscriptions: {
          update: updateSubscription,
        },
      },
      subscriptionId: 'local_sub',
      userId: 'user_1',
    });

    expect(result).toEqual({ ok: true });
    expect(updateSubscription).toHaveBeenCalledWith('sub_test', {
      cancel_at_period_end: true,
    });
    expect(updateLocal).toHaveBeenCalledWith({
      data: expect.objectContaining({
        autoRenew: false,
        cancelAtPeriodEnd: true,
        cancellationReason: 'not_sailing_next_season',
      }),
      where: { id: 'local_sub' },
    });
  });

  it('does not update local state when Stripe fails', async () => {
    const updateLocal = vi.fn();

    const result = await turnOffMembershipAutoRenew({
      client: {
        sailingCardSubscription: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'local_sub',
            stripeSubscriptionId: 'sub_test',
          }),
          update: updateLocal,
        },
      },
      note: '',
      now: new Date('2026-06-01T12:00:00.000Z'),
      reason: 'other',
      stripe: {
        subscriptions: {
          update: vi.fn().mockRejectedValue(new Error('Stripe down')),
        },
      },
      subscriptionId: 'local_sub',
      userId: 'user_1',
    });

    expect(result).toEqual({ error: 'stripe_failed', ok: false });
    expect(updateLocal).not.toHaveBeenCalled();
  });

  it('restores Stripe auto-renew when local cancellation persistence fails', async () => {
    const error = new Error('database unavailable');
    const updateSubscription = vi.fn().mockResolvedValue({ id: 'sub_test' });
    const updateLocal = vi.fn().mockRejectedValue(error);

    const result = await turnOffMembershipAutoRenew({
      client: {
        sailingCardSubscription: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'local_sub',
            stripeSubscriptionId: 'sub_test',
          }),
          update: updateLocal,
        },
      },
      note: 'Not sailing next season',
      now: new Date('2026-06-01T12:00:00.000Z'),
      reason: 'not_sailing_next_season',
      stripe: {
        subscriptions: {
          update: updateSubscription,
        },
      },
      subscriptionId: 'local_sub',
      userId: 'user_1',
    });

    expect(result).toEqual({ error: 'db_update_failed', ok: false });
    expect(updateSubscription).toHaveBeenNthCalledWith(1, 'sub_test', {
      cancel_at_period_end: true,
    });
    expect(updateSubscription).toHaveBeenNthCalledWith(2, 'sub_test', {
      cancel_at_period_end: false,
    });
    expect(loggerError).toHaveBeenCalledWith(
      '[membership:auto-renew-cancel] db_update_failed subscription_id={subscriptionId} stripe_subscription_id={stripeSubscriptionId} reason={reason}',
      {
        error,
        reason: 'not_sailing_next_season',
        revertError: null,
        stripeSubscriptionId: 'sub_test',
        subscriptionId: 'local_sub',
      }
    );
  });
});
