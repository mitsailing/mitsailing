import { describe, expect, it, vi } from 'vitest';
import { getOrCreateMembershipStripeCustomer } from '@/libs/mit-sailing/membershipBilling/membershipStripeCustomers';

vi.mock('server-only', () => ({}));

describe('membershipStripeCustomers', () => {
  it('reuses the latest local customer id before calling Stripe', async () => {
    const customerId = await getOrCreateMembershipStripeCustomer({
      client: {
        payment: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ stripeCustomerId: 'cus_local' }),
        },
        sailingCardSubscription: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      email: 'member@example.com',
      name: 'Member Example',
      stripe: {
        customers: {
          create: vi.fn(),
          search: vi.fn(),
        },
      },
      userId: 'user_1',
    });

    expect(customerId).toBe('cus_local');
  });

  it('falls back to Stripe customer search by email', async () => {
    const search = vi.fn().mockResolvedValue({
      data: [{ id: 'cus_search' }],
    });

    const customerId = await getOrCreateMembershipStripeCustomer({
      client: {
        payment: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        sailingCardSubscription: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      email: 'member@example.com',
      name: null,
      stripe: {
        customers: {
          create: vi.fn(),
          search,
        },
      },
      userId: 'user_1',
    });

    expect(customerId).toBe('cus_search');
    expect(search).toHaveBeenCalledWith({
      limit: 1,
      query: "email:'member@example.com'",
    });
  });

  it('creates a customer with app metadata when no existing customer matches', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'cus_new' });

    const customerId = await getOrCreateMembershipStripeCustomer({
      client: {
        payment: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        sailingCardSubscription: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      email: 'member@example.com',
      name: 'Member Example',
      stripe: {
        customers: {
          create,
          search: vi.fn().mockResolvedValue({ data: [] }),
        },
      },
      userId: 'user_1',
    });

    expect(customerId).toBe('cus_new');
    expect(create).toHaveBeenCalledWith({
      email: 'member@example.com',
      metadata: {
        domain: 'sailing_card_membership',
        userId: 'user_1',
      },
      name: 'Member Example',
    });
  });
});
