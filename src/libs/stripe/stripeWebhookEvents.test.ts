import { describe, expect, it, vi } from 'vitest';
import {
  constructStripeWebhookEvent,
  stripeEventCreatedAtDate,
} from '@/libs/stripe/stripeWebhookEvents';

vi.mock('server-only', () => ({}));

describe('constructStripeWebhookEvent', () => {
  it('verifies raw body with stripe webhook signature', () => {
    const rawBody = Buffer.from('{"id":"evt_123"}');
    const event = {
      created: 1_777_111_200,
      id: 'evt_123',
      object: 'event',
      type: 'checkout.session.completed',
    };
    const constructEvent = vi.fn().mockReturnValue(event);

    expect(
      constructStripeWebhookEvent({
        rawBody,
        signature: 't=1777111200,v1=signature',
        stripe: {
          webhooks: {
            constructEvent,
          },
        },
        webhookSecret: 'whsec_test',
      })
    ).toBe(event);
    expect(constructEvent).toHaveBeenCalledWith(
      rawBody,
      't=1777111200,v1=signature',
      'whsec_test'
    );
  });
});

describe('stripeEventCreatedAtDate', () => {
  it('converts stripe seconds to date', () => {
    expect(
      stripeEventCreatedAtDate({ created: 1_777_636_800 }).toISOString()
    ).toBe('2026-05-01T12:00:00.000Z');
  });
});
