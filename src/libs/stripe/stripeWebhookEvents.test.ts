import { describe, expect, it, vi } from 'vitest';
import { EventPaymentStatus } from '@/generated/prisma/enums';
import {
  constructStripeWebhookEvent,
  processStripeWebhookEvent,
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
        webhookSecret: 'stripe_webhook_secret',
      })
    ).toBe(event);
    expect(constructEvent).toHaveBeenCalledWith(
      rawBody,
      't=1777111200,v1=signature',
      'stripe_webhook_secret'
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

describe('processStripeWebhookEvent', () => {
  it('records stale paid events without reverting terminal local status', async () => {
    const updatePayment = vi.fn();
    const updateWebhookEvent = vi.fn();
    const db = {
      eventPayment: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'payment_123',
          status: EventPaymentStatus.refunded,
        }),
        update: updatePayment,
      },
      stripeWebhookEvent: {
        create: vi.fn().mockResolvedValue({ id: 'webhook_event_123' }),
        findUnique: vi.fn(),
        update: updateWebhookEvent,
      },
    };

    const result = await processStripeWebhookEvent({
      db,
      event: {
        created: 1_777_636_800,
        data: {
          object: {
            id: 'pi_123',
            metadata: { paymentId: 'payment_123' },
          },
        },
        id: 'evt_payment_intent_succeeded',
        type: 'payment_intent.succeeded',
      },
    });

    expect(result).toEqual({ ok: true });
    expect(updatePayment).not.toHaveBeenCalled();
    expect(updateWebhookEvent).toHaveBeenCalledWith({
      data: { processedAt: expect.any(Date), processingError: null },
      where: { id: 'webhook_event_123' },
    });
  });
});
