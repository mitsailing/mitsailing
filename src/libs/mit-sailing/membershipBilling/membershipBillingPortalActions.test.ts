import { describe, expect, it, vi } from 'vitest';
import { createMembershipBillingPortalSession } from '@/libs/mit-sailing/membershipBilling/membershipBillingPortalSession';

vi.mock('server-only', () => ({}));

describe('membershipBillingPortalActions', () => {
  it('creates a configured Customer Portal session for profile membership management', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'bps_test',
      url: 'https://billing.stripe.com/session/test',
    });

    const result = await createMembershipBillingPortalSession({
      configurationId: 'bpc_membership',
      customerId: 'cus_test',
      returnUrl: 'https://sailing.mit.edu/profile',
      stripe: { billingPortal: { sessions: { create } } },
    });

    expect(result).toEqual({
      url: 'https://billing.stripe.com/session/test',
    });
    expect(create).toHaveBeenCalledWith({
      configuration: 'bpc_membership',
      customer: 'cus_test',
      return_url: 'https://sailing.mit.edu/profile',
    });
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty('flow_data');
  });

  it('fails closed when Stripe does not return a portal URL', async () => {
    await expect(
      createMembershipBillingPortalSession({
        configurationId: 'bpc_membership',
        customerId: 'cus_test',
        returnUrl: 'https://sailing.mit.edu/profile',
        stripe: {
          billingPortal: {
            sessions: { create: vi.fn().mockResolvedValue({ id: 'bps_test' }) },
          },
        },
      })
    ).rejects.toThrow('Stripe did not return a Billing Portal URL.');
  });
});
