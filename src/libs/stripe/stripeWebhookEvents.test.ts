import { describe, expect, it, vi } from 'vitest';
import { PaymentStatus } from '@/generated/prisma/enums';
import type { PaymentStatus as PaymentStatusType } from '@/generated/prisma/enums';
import {
  constructStripeWebhookEvent,
  processStripeWebhookEvent,
  stripeEventCreatedAtDate,
} from '@/libs/stripe/stripeWebhookEvents';
import type { StripeWebhookDispatchHandler } from '@/libs/stripe/stripeWebhookEvents';

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
          processingError: 'receipt_enqueue_pending',
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
      stripeWebhookEventId: 'webhook_event_123',
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
          {
            processingError: {
              lt: expect.stringMatching(/^processing:/u),
              startsWith: 'processing:',
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
          processingError: null,
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

  it('creates new webhook events with a processing claim', async () => {
    const db = {
      payment: {
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn(),
      },
      eventPaymentNotification: {
        upsert: vi.fn(),
      },
      stripeWebhookEvent: {
        create: vi.fn().mockResolvedValue({ id: 'webhook_event_123' }),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    await processStripeWebhookEvent({
      db,
      event: {
        created: 1_777_636_800,
        data: {
          object: {
            id: 'sub_123',
            metadata: { domain: 'sailing_card_membership' },
          },
        },
        id: 'evt_customer_subscription_updated',
        type: 'customer.subscription.updated',
      },
    });

    expect(db.stripeWebhookEvent.create).toHaveBeenCalledWith({
      data: {
        eventType: 'customer.subscription.updated',
        processingError: expect.stringMatching(/^processing:/u),
        stripeCreatedAt: new Date('2026-05-01T12:00:00.000Z'),
        stripeEventId: 'evt_customer_subscription_updated',
      },
    });
  });

  it('leaves all-unhandled events retryable for future domains', async () => {
    const updateWebhookEvent = vi.fn();
    const db = {
      payment: {
        findFirst: vi.fn(),
        updateMany: vi.fn(),
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
            id: 'sub_123',
            metadata: { domain: 'sailing_card_membership' },
          },
        },
        id: 'evt_customer_subscription_updated',
        type: 'customer.subscription.updated',
      },
    });

    expect(result).toEqual({ ok: false });
    expect(db.payment.findFirst).not.toHaveBeenCalled();
    expect(updateWebhookEvent).toHaveBeenCalledWith({
      data: {
        processingError:
          'Unhandled Stripe webhook event: customer.subscription.updated',
      },
      where: { id: 'webhook_event_123' },
    });
    expect(updateWebhookEvent.mock.calls[0]?.[0].data).not.toHaveProperty(
      'processedAt'
    );
  });

  it('leaves membership invoice events retryable when domain is on subscription metadata', async () => {
    const updateWebhookEvent = vi.fn();
    const db = {
      payment: {
        findFirst: vi.fn(),
        updateMany: vi.fn(),
      },
      eventPaymentNotification: {
        upsert: vi.fn(),
      },
      stripeWebhookEvent: {
        create: vi.fn().mockResolvedValue({ id: 'webhook_event_invoice' }),
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
            id: 'in_123',
            subscription_details: {
              metadata: { domain: 'sailing_card_membership' },
            },
          },
        },
        id: 'evt_invoice_paid',
        type: 'invoice.paid',
      },
    });

    expect(result).toEqual({ ok: false });
    expect(updateWebhookEvent).toHaveBeenCalledWith({
      data: {
        processingError: 'Unhandled Stripe webhook event: invoice.paid',
      },
      where: { id: 'webhook_event_invoice' },
    });
    expect(updateWebhookEvent.mock.calls[0]?.[0].data).not.toHaveProperty(
      'processedAt'
    );
  });

  it('marks unmatched non-membership payment events processed as no-ops', async () => {
    const updateWebhookEvent = vi.fn();
    const db = {
      payment: {
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn(),
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
            id: 'pi_other',
            amount_received: 4200,
            currency: 'usd',
          },
        },
        id: 'evt_payment_intent_succeeded_unmatched',
        type: 'payment_intent.succeeded',
      },
    });

    expect(result).toEqual({ ok: true });
    expect(updateWebhookEvent).toHaveBeenCalledWith({
      data: { processedAt: expect.any(Date), processingError: null },
      where: { id: 'webhook_event_123' },
    });
  });

  it('dispatches non-event-payment events to a later domain handler', async () => {
    const updateWebhookEvent = vi.fn();
    const membershipHandler: StripeWebhookDispatchHandler = vi.fn(async () => {
      await Promise.resolve();
      return { handled: true };
    });
    const db = {
      payment: {
        findFirst: vi.fn(),
        updateMany: vi.fn(),
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
    const event = {
      created: 1_777_636_800,
      data: {
        object: {
          id: 'sub_123',
          metadata: { domain: 'sailing_card_membership' },
        },
      },
      id: 'evt_customer_subscription_updated',
      type: 'customer.subscription.updated',
    };

    const result = await processStripeWebhookEvent({
      db,
      event,
      handlers: [membershipHandler],
    });

    expect(result).toEqual({ ok: true });
    expect(membershipHandler).toHaveBeenCalledWith({
      db,
      event,
      persistReceiptJob: expect.any(Function),
      retryingReceiptEnqueue: false,
      retryingUnprocessedEvent: false,
    });
    expect(updateWebhookEvent).toHaveBeenCalledWith({
      data: { processedAt: expect.any(Date), processingError: null },
      where: { id: 'webhook_event_123' },
    });
  });

  it('does not requeue receipts for a separate paid Stripe event', async () => {
    const updateWebhookEvent = vi.fn();
    const updatePayment = vi.fn().mockResolvedValue({ count: 1 });
    const upsertReceipt = vi.fn();
    const db = {
      payment: {
        findFirst: vi.fn().mockResolvedValue({
          amountCents: 4200,
          currency: 'usd',
          id: 'payment_123',
          status: PaymentStatus.paid,
        }),
        updateMany: updatePayment,
      },
      eventPaymentNotification: {
        upsert: upsertReceipt,
      },
      stripeWebhookEvent: {
        create: vi.fn().mockResolvedValue({ id: 'webhook_event_456' }),
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
            id: 'pi_456',
            amount_received: 4200,
            currency: 'usd',
            metadata: { paymentId: 'payment_123' },
          },
        },
        id: 'evt_payment_intent_succeeded_later',
        type: 'payment_intent.succeeded',
      },
    });

    expect(result).toEqual({ ok: true });
    expect(upsertReceipt).not.toHaveBeenCalled();
    expect(updatePayment).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: PaymentStatus.paid,
        stripePaymentIntentId: 'pi_456',
      }),
      where: { id: 'payment_123', status: PaymentStatus.paid },
    });
    expect(updateWebhookEvent).toHaveBeenCalledWith({
      data: { processedAt: expect.any(Date), processingError: null },
      where: { id: 'webhook_event_456' },
    });
  });

  it('does not synthesize receipts when retrying a failed later event that never created one', async () => {
    const updateWebhookEvent = vi.fn();
    const updateManyWebhookEvent = vi.fn().mockResolvedValue({ count: 1 });
    const updatePayment = vi.fn().mockResolvedValue({ count: 1 });
    const upsertReceipt = vi.fn();
    const db = {
      payment: {
        findFirst: vi.fn().mockResolvedValue({
          amountCents: 4200,
          currency: 'usd',
          id: 'payment_123',
          status: PaymentStatus.paid,
        }),
        updateMany: updatePayment,
      },
      eventPaymentNotification: {
        upsert: upsertReceipt,
      },
      stripeWebhookEvent: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: 'webhook_event_456' })
          .mockRejectedValueOnce(
            Object.assign(new Error('duplicate'), { code: 'P2002' })
          ),
        findUnique: vi.fn().mockResolvedValue({
          id: 'webhook_event_456',
          processedAt: null,
          processingError: 'membership handler down',
        }),
        update: updateWebhookEvent,
        updateMany: updateManyWebhookEvent,
      },
    };
    const event = {
      created: 1_777_636_800,
      data: {
        object: {
          id: 'pi_456',
          amount_received: 4200,
          currency: 'usd',
          metadata: { paymentId: 'payment_123' },
        },
      },
      id: 'evt_payment_intent_succeeded_later',
      type: 'payment_intent.succeeded',
    };
    const failingLaterHandler: StripeWebhookDispatchHandler = vi.fn(
      async () => {
        await Promise.resolve();
        throw new Error('membership handler down');
      }
    );
    const succeedingLaterHandler: StripeWebhookDispatchHandler = vi.fn(
      async () => {
        await Promise.resolve();
        return { handled: true };
      }
    );

    await expect(
      processStripeWebhookEvent({
        db,
        event,
        handlers: [failingLaterHandler],
      })
    ).resolves.toEqual({ ok: false });
    await expect(
      processStripeWebhookEvent({
        db,
        event,
        handlers: [succeedingLaterHandler],
      })
    ).resolves.toEqual({ ok: true });

    expect(upsertReceipt).not.toHaveBeenCalled();
    expect(updateManyWebhookEvent).toHaveBeenCalled();
    expect(updateWebhookEvent).toHaveBeenLastCalledWith({
      data: { processedAt: expect.any(Date), processingError: null },
      where: { id: 'webhook_event_456' },
    });
  });

  it('does not claim unpaid membership checkout sessions as event payments', async () => {
    const updateWebhookEvent = vi.fn();
    const db = {
      payment: {
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn(),
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
            id: 'cs_membership',
            client_reference_id: 'membership-payment-1',
            metadata: {
              domain: 'sailing_card_membership',
              paymentId: 'membership-payment-1',
            },
            payment_status: 'unpaid',
          },
        },
        id: 'evt_checkout_session_completed',
        type: 'checkout.session.completed',
      },
    });

    expect(result).toEqual({ ok: false });
    expect(db.payment.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { id: 'membership-payment-1' },
          { stripeCheckoutSessionId: 'cs_membership' },
        ],
        purpose: 'event_payment',
      },
    });
    expect(updateWebhookEvent).toHaveBeenCalledWith({
      data: {
        processingError:
          'Unhandled Stripe webhook event: checkout.session.completed',
      },
      where: { id: 'webhook_event_123' },
    });
  });

  it('recovers receipts when marker creation fails after the paid transition', async () => {
    const updateWebhookEvent = vi.fn();
    const updateManyWebhookEvent = vi.fn().mockResolvedValue({ count: 1 });
    const updatePayment = vi.fn().mockResolvedValue({ count: 1 });
    const upsertReceipt = vi
      .fn()
      .mockRejectedValueOnce(new Error('receipt marker down'))
      .mockResolvedValueOnce({});
    const paymentState: {
      amountCents: number;
      currency: string;
      id: string;
      status: PaymentStatusType;
    } = {
      amountCents: 4200,
      currency: 'usd',
      id: 'payment_123',
      status: PaymentStatus.pending,
    };
    const db = {
      payment: {
        findFirst: vi.fn(async () => {
          await Promise.resolve();
          return paymentState;
        }),
        updateMany: updatePayment,
      },
      eventPaymentNotification: {
        upsert: upsertReceipt,
      },
      stripeWebhookEvent: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: 'webhook_event_123' })
          .mockRejectedValueOnce(
            Object.assign(new Error('duplicate'), { code: 'P2002' })
          ),
        findUnique: vi.fn().mockResolvedValue({
          id: 'webhook_event_123',
          processedAt: null,
          processingError: 'receipt_enqueue_pending:receipt marker down',
        }),
        update: updateWebhookEvent,
        updateMany: updateManyWebhookEvent,
      },
    };
    const event = {
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
    };

    await expect(processStripeWebhookEvent({ db, event })).resolves.toEqual({
      ok: false,
    });
    paymentState.status = PaymentStatus.paid;
    await expect(processStripeWebhookEvent({ db, event })).resolves.toEqual({
      ok: true,
      receiptJob: { dateKey: '2026-05-01', paymentId: 'payment_123' },
      stripeWebhookEventId: 'webhook_event_123',
    });

    expect(upsertReceipt).toHaveBeenCalledTimes(2);
    expect(updateWebhookEvent).toHaveBeenCalledWith({
      data: {
        processingError: 'receipt_enqueue_pending:receipt marker down',
      },
      where: { id: 'webhook_event_123' },
    });
  });

  it('recovers receipts when persisting the receipt-pending marker first fails', async () => {
    const updateWebhookEvent = vi
      .fn()
      .mockRejectedValueOnce(new Error('webhook marker down'))
      .mockResolvedValue({});
    const updateManyWebhookEvent = vi.fn().mockResolvedValue({ count: 1 });
    const updatePayment = vi.fn().mockResolvedValue({ count: 1 });
    const upsertReceipt = vi.fn().mockResolvedValue({});
    const paymentState: {
      amountCents: number;
      currency: string;
      id: string;
      status: PaymentStatusType;
    } = {
      amountCents: 4200,
      currency: 'usd',
      id: 'payment_123',
      status: PaymentStatus.pending,
    };
    const db = {
      payment: {
        findFirst: vi.fn(async () => {
          await Promise.resolve();
          return paymentState;
        }),
        updateMany: updatePayment,
      },
      eventPaymentNotification: {
        upsert: upsertReceipt,
      },
      stripeWebhookEvent: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: 'webhook_event_123' })
          .mockRejectedValueOnce(
            Object.assign(new Error('duplicate'), { code: 'P2002' })
          ),
        findUnique: vi.fn().mockResolvedValue({
          id: 'webhook_event_123',
          processedAt: null,
          processingError: 'receipt_enqueue_pending:webhook marker down',
        }),
        update: updateWebhookEvent,
        updateMany: updateManyWebhookEvent,
      },
    };
    const event = {
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
    };

    await expect(processStripeWebhookEvent({ db, event })).resolves.toEqual({
      ok: false,
    });
    paymentState.status = PaymentStatus.paid;
    await expect(processStripeWebhookEvent({ db, event })).resolves.toEqual({
      ok: true,
      receiptJob: { dateKey: '2026-05-01', paymentId: 'payment_123' },
      stripeWebhookEventId: 'webhook_event_123',
    });

    expect(updateWebhookEvent).toHaveBeenCalledWith({
      data: {
        processingError: 'receipt_enqueue_pending:webhook marker down',
      },
      where: { id: 'webhook_event_123' },
    });
    expect(upsertReceipt).toHaveBeenCalledTimes(1);
  });

  it('retries later-domain failures without duplicating event-payment receipts', async () => {
    const updateWebhookEvent = vi.fn();
    const updateManyWebhookEvent = vi.fn().mockResolvedValue({ count: 1 });
    const updatePayment = vi.fn().mockResolvedValue({ count: 1 });
    const upsertReceipt = vi.fn().mockResolvedValue({});
    const paymentState: {
      amountCents: number;
      currency: string;
      id: string;
      status: PaymentStatusType;
    } = {
      amountCents: 4200,
      currency: 'usd',
      id: 'payment_123',
      status: PaymentStatus.pending,
    };
    const db = {
      payment: {
        findFirst: vi.fn(async () => {
          await Promise.resolve();
          return paymentState;
        }),
        updateMany: updatePayment,
      },
      eventPaymentNotification: {
        upsert: upsertReceipt,
      },
      stripeWebhookEvent: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: 'webhook_event_123' })
          .mockRejectedValueOnce(
            Object.assign(new Error('duplicate'), { code: 'P2002' })
          ),
        findUnique: vi.fn().mockResolvedValue({
          id: 'webhook_event_123',
          processedAt: null,
          processingError: 'receipt_enqueue_pending:membership handler down',
        }),
        update: updateWebhookEvent,
        updateMany: updateManyWebhookEvent,
      },
    };
    const event = {
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
    };
    const failingLaterHandler: StripeWebhookDispatchHandler = vi.fn(
      async () => {
        await Promise.resolve();
        throw new Error('membership handler down');
      }
    );
    const succeedingLaterHandler: StripeWebhookDispatchHandler = vi.fn(
      async () => {
        await Promise.resolve();
        return { handled: true };
      }
    );

    await expect(
      processStripeWebhookEvent({
        db,
        event,
        handlers: [failingLaterHandler],
      })
    ).resolves.toEqual({ ok: false });
    paymentState.status = PaymentStatus.paid;
    await expect(
      processStripeWebhookEvent({
        db,
        event,
        handlers: [succeedingLaterHandler],
      })
    ).resolves.toEqual({
      ok: true,
      receiptJob: { dateKey: '2026-05-01', paymentId: 'payment_123' },
      stripeWebhookEventId: 'webhook_event_123',
    });

    expect(upsertReceipt).toHaveBeenCalledTimes(2);
    expect(updateManyWebhookEvent).toHaveBeenCalled();
    expect(updateWebhookEvent).toHaveBeenLastCalledWith({
      data: { processingError: 'receipt_enqueue_pending' },
      where: { id: 'webhook_event_123' },
    });
  });
});
