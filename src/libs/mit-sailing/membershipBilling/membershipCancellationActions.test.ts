import { describe, expect, it, vi } from 'vitest';
import { turnOffMembershipAutoRenew } from '@/libs/mit-sailing/membershipBilling/membershipCancellationActions';

vi.mock('server-only', () => ({}));

describe('membershipCancellationActions', () => {
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
});
