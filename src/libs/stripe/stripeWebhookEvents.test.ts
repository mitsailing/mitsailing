import { describe, expect, it, vi } from 'vitest';
import { PaymentStatus } from '@/generated/prisma/enums';
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
      payment: {
        findFirst: vi.fn().mockResolvedValue({
          amountCents: 4200,
          currency: 'usd',
          id: 'payment_123',
          status: PaymentStatus.refunded,
        }),
        updateMany: updatePayment,
      },
      eventPaymentNotification: {
        upsert: vi.fn(),
      },
      stripeWebhookEvent: {
        create: vi.fn().mockResolvedValue({ id: 'webhook_event_123' }),
        findUnique: vi.fn(),
        update: updateWebhookEvent,
        updateMany: vi.fn(),
      },
    };

    const result = await processStripeWebhookEvent({
      db,
      event: {
        created: 1_777_636_800,
        data: {
          object: {
            id: 'pi_123',
            amount_received: 4200,
            currency: 'usd',
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

  it('claims unprocessed duplicate events before retrying payment updates', async () => {
    const updateManyWebhookEvent = vi.fn().mockResolvedValue({ count: 1 });
    const updatePayment = vi.fn().mockResolvedValue({ count: 1 });
    const db = {
      payment: {
        findFirst: vi.fn().mockResolvedValue({
          amountCents: 4200,
          currency: 'usd',
          id: 'payment_123',
          status: PaymentStatus.pending,
        }),
        updateMany: updatePayment,
      },
      eventPaymentNotification: {
        upsert: vi.fn().mockResolvedValue({}),
      },
      stripeWebhookEvent: {
        create: vi.fn().mockRejectedValue(
          Object.assign(new Error('duplicate'), {
            code: 'P2002',
          })
        ),
        findUnique: vi.fn().mockResolvedValue({
          id: 'webhook_event_123',
          processedAt: null,
        }),
        update: vi.fn(),
        updateMany: updateManyWebhookEvent,
      },
    };

    const result = await processStripeWebhookEvent({
      db,
      event: {
        created: 1_777_636_800,
        data: {
          object: {
            id: 'pi_123',
            amount_received: 4200,
            currency: 'usd',
            metadata: { paymentId: 'payment_123' },
          },
        },
        id: 'evt_payment_intent_succeeded',
        type: 'payment_intent.succeeded',
      },
    });

    expect(result).toEqual({
      ok: true,
      receiptJob: { dateKey: '2026-05-01', paymentId: 'payment_123' },
    });
    expect(updateManyWebhookEvent).toHaveBeenCalledWith({
      data: { processingError: expect.stringMatching(/^processing:/u) },
      where: {
        id: 'webhook_event_123',
        processedAt: null,
        OR: [
          { processingError: null },
          {
            processingError: {
              not: { startsWith: 'processing:' },
            },
          },
        ],
      },
    });
    expect(updatePayment).toHaveBeenCalled();
  });

  it('fails unprocessed duplicate events when claim is unavailable', async () => {
    const db = {
      payment: {
        findFirst: vi.fn(),
        updateMany: vi.fn(),
      },
      eventPaymentNotification: {
        upsert: vi.fn(),
      },
      stripeWebhookEvent: {
        create: vi.fn().mockRejectedValue(
          Object.assign(new Error('duplicate'), {
            code: 'P2002',
          })
        ),
        findUnique: vi.fn().mockResolvedValue({
          id: 'webhook_event_123',
          processedAt: null,
        }),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const result = await processStripeWebhookEvent({
      db,
      event: {
        created: 1_777_636_800,
        data: {
          object: {
            id: 'pi_123',
            amount_received: 4200,
            currency: 'usd',
            metadata: { paymentId: 'payment_123' },
          },
        },
        id: 'evt_payment_intent_succeeded',
        type: 'payment_intent.succeeded',
      },
    });

    expect(result).toEqual({ ok: false });
    expect(db.payment.findFirst).not.toHaveBeenCalled();
  });
});
