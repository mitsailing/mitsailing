import { describe, expect, it, vi } from 'vitest';
import { PaymentStatus } from '@/generated/prisma/enums';
import type { PaymentStatus as PaymentStatusType } from '@/generated/prisma/enums';
import {
  constructStripeWebhookEvent,
  processStripeWebhookEvent,
  stripeEventCreatedAtDate,
} from '@/libs/stripe/stripeWebhookEvents';
import type {
  StripeWebhookDb,
  StripeWebhookDispatchHandler,
} from '@/libs/stripe/stripeWebhookEvents';

vi.mock('server-only', () => ({}));

type StripeWebhookPayment = NonNullable<
  Awaited<ReturnType<StripeWebhookDb['payment']['findFirst']>>
>;
type StoredWebhookEvent = NonNullable<
  Awaited<ReturnType<StripeWebhookDb['stripeWebhookEvent']['findUnique']>>
>;

const stripeEventCreated = 1_777_636_800;

function eventPayment(
  options: { id?: string; status?: PaymentStatusType } = {}
): StripeWebhookPayment {
  return {
    amountCents: 4200,
    currency: 'usd',
    id: options.id ?? 'payment_123',
    status: options.status ?? PaymentStatus.pending,
  };
}

function storedWebhookEvent(
  options: {
    id?: string;
    processedAt?: Date | null;
    processingError?: string | null;
  } = {}
): StoredWebhookEvent {
  return {
    id: options.id ?? 'webhook_event_123',
    processedAt: options.processedAt ?? null,
    processingError: options.processingError ?? null,
  };
}

function mockPaymentUpdate(result?: { count: number }) {
  return vi
    .fn<StripeWebhookDb['payment']['updateMany']>()
    .mockResolvedValue(result ?? { count: 1 });
}

function mockReceiptUpsert() {
  return vi
    .fn<StripeWebhookDb['eventPaymentNotification']['upsert']>()
    .mockResolvedValue({});
}

function mockWebhookCreateMany(result?: { count: number }) {
  return vi
    .fn<StripeWebhookDb['stripeWebhookEvent']['createMany']>()
    .mockResolvedValue(result ?? { count: 1 });
}

function mockDuplicateWebhookCreateMany() {
  return mockWebhookCreateMany({ count: 0 });
}

function mockWebhookCreateManyThenDuplicate() {
  return mockWebhookCreateMany()
    .mockResolvedValueOnce({ count: 1 })
    .mockResolvedValueOnce({ count: 0 });
}

function mockWebhookUpdate() {
  return vi
    .fn<StripeWebhookDb['stripeWebhookEvent']['update']>()
    .mockResolvedValue({});
}

function mockWebhookUpdateMany(result?: { count: number }) {
  return vi
    .fn<StripeWebhookDb['stripeWebhookEvent']['updateMany']>()
    .mockResolvedValue(result ?? { count: 1 });
}

function createWebhookDb(
  options: {
    createWebhookEventMany?: StripeWebhookDb['stripeWebhookEvent']['createMany'];
    payment?: StripeWebhookPayment | null;
    storedWebhookEvent?: StoredWebhookEvent | null;
    updateManyWebhookEvent?: StripeWebhookDb['stripeWebhookEvent']['updateMany'];
    updatePayment?: StripeWebhookDb['payment']['updateMany'];
    updateWebhookEvent?: StripeWebhookDb['stripeWebhookEvent']['update'];
    upsertReceipt?: StripeWebhookDb['eventPaymentNotification']['upsert'];
    webhookEventId?: string;
  } = {}
): StripeWebhookDb {
  const webhookEventId = options.webhookEventId ?? 'webhook_event_123';
  const hasStoredWebhookEventOption = Object.hasOwn(
    options,
    'storedWebhookEvent'
  );
  const storedWebhookEventResult = hasStoredWebhookEventOption
    ? (options.storedWebhookEvent ?? null)
    : storedWebhookEvent({ id: webhookEventId });

  return {
    payment: {
      create: vi.fn().mockResolvedValue({}),
      findFirst: vi
        .fn<StripeWebhookDb['payment']['findFirst']>()
        .mockResolvedValue(options.payment ?? null),
      updateMany: options.updatePayment ?? mockPaymentUpdate({ count: 0 }),
    },
    eventPaymentNotification: {
      upsert: options.upsertReceipt ?? mockReceiptUpsert(),
    },
    sailingCardSubscription: {
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({
        id: 'membership_subscription_123',
        userId: 'user_123',
      }),
    },
    stripeWebhookEvent: {
      createMany: options.createWebhookEventMany ?? mockWebhookCreateMany(),
      findUnique: vi
        .fn<StripeWebhookDb['stripeWebhookEvent']['findUnique']>()
        .mockResolvedValue(storedWebhookEventResult),
      update: options.updateWebhookEvent ?? mockWebhookUpdate(),
      updateMany: options.updateManyWebhookEvent ?? mockWebhookUpdateMany(),
    },
  };
}

function paymentIntentSucceededEvent(
  options: {
    latestCharge?: string;
    paymentId?: string;
    paymentIntentId?: string;
    stripeEventId?: string;
  } = {}
) {
  return {
    created: stripeEventCreated,
    data: {
      object: {
        id: options.paymentIntentId ?? 'pi_123',
        amount_received: 4200,
        currency: 'usd',
        latest_charge: options.latestCharge,
        metadata: { paymentId: options.paymentId ?? 'payment_123' },
      },
    },
    id: options.stripeEventId ?? 'evt_payment_intent_succeeded',
    type: 'payment_intent.succeeded',
  };
}

function membershipSubscriptionEvent() {
  return {
    created: stripeEventCreated,
    data: {
      object: {
        id: 'sub_123',
        metadata: { domain: 'sailing_card_membership' },
      },
    },
    id: 'evt_customer_subscription_updated',
    type: 'customer.subscription.updated',
  };
}

function failingMembershipHandler(): StripeWebhookDispatchHandler {
  return vi.fn(async () => {
    await Promise.resolve();
    throw new Error('membership handler down');
  });
}

function succeedingMembershipHandler(): StripeWebhookDispatchHandler {
  return vi.fn(async () => {
    await Promise.resolve();
    return { handled: true };
  });
}

function createReceiptRecoveryScenario(options: {
  processingError: string;
  updateWebhookEvent?: StripeWebhookDb['stripeWebhookEvent']['update'];
  upsertReceipt?: StripeWebhookDb['eventPaymentNotification']['upsert'];
}) {
  const updateWebhookEvent = options.updateWebhookEvent ?? mockWebhookUpdate();
  const updateManyWebhookEvent = mockWebhookUpdateMany();
  const updatePayment = mockPaymentUpdate();
  const upsertReceipt = options.upsertReceipt ?? mockReceiptUpsert();
  const paymentState = eventPayment();
  const db = createWebhookDb({
    createWebhookEventMany: mockWebhookCreateManyThenDuplicate(),
    payment: paymentState,
    storedWebhookEvent: storedWebhookEvent({
      processingError: options.processingError,
    }),
    updateManyWebhookEvent,
    updatePayment,
    updateWebhookEvent,
    upsertReceipt,
  });

  return {
    db,
    event: paymentIntentSucceededEvent(),
    paymentState,
    updateManyWebhookEvent,
    updatePayment,
    updateWebhookEvent,
    upsertReceipt,
  };
}

async function expectReceiptRecoveryAfterInitialFailure(options: {
  db: StripeWebhookDb;
  event: ReturnType<typeof paymentIntentSucceededEvent>;
  paymentState: StripeWebhookPayment;
}) {
  await expect(
    processStripeWebhookEvent({ db: options.db, event: options.event })
  ).resolves.toEqual({ ok: false });
  options.paymentState.status = PaymentStatus.paid;
  await expect(
    processStripeWebhookEvent({ db: options.db, event: options.event })
  ).resolves.toEqual({
    ok: true,
    receiptJob: { dateKey: '2026-05-01', paymentId: 'payment_123' },
    stripeWebhookEventId: 'webhook_event_123',
  });
}

async function expectHandlerFailureThenSuccess(options: {
  beforeSuccess?: () => void;
  db: StripeWebhookDb;
  event: ReturnType<typeof paymentIntentSucceededEvent>;
  successResult: Awaited<ReturnType<typeof processStripeWebhookEvent>>;
}) {
  await expect(
    processStripeWebhookEvent({
      db: options.db,
      event: options.event,
      handlers: [failingMembershipHandler()],
    })
  ).resolves.toEqual({ ok: false });
  options.beforeSuccess?.();
  await expect(
    processStripeWebhookEvent({
      db: options.db,
      event: options.event,
      handlers: [succeedingMembershipHandler()],
    })
  ).resolves.toEqual(options.successResult);
}

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
    const updatePayment = mockPaymentUpdate();
    const updateWebhookEvent = mockWebhookUpdate();
    const db = createWebhookDb({
      payment: eventPayment({ status: PaymentStatus.refunded }),
      updatePayment,
      updateWebhookEvent,
    });

    const result = await processStripeWebhookEvent({
      db,
      event: paymentIntentSucceededEvent(),
    });

    expect(result).toEqual({ ok: true });
    expect(updatePayment).not.toHaveBeenCalled();
    expect(updateWebhookEvent).toHaveBeenCalledWith({
      data: { processedAt: expect.any(Date), processingError: null },
      where: { id: 'webhook_event_123' },
    });
  });

  it('claims unprocessed duplicate events before retrying payment updates', async () => {
    const updateManyWebhookEvent = mockWebhookUpdateMany();
    const updatePayment = mockPaymentUpdate();
    const db = createWebhookDb({
      createWebhookEventMany: mockDuplicateWebhookCreateMany(),
      payment: eventPayment(),
      storedWebhookEvent: storedWebhookEvent({
        processingError: 'receipt_enqueue_pending',
      }),
      updateManyWebhookEvent,
      updatePayment,
      upsertReceipt: mockReceiptUpsert(),
    });

    const result = await processStripeWebhookEvent({
      db,
      event: paymentIntentSucceededEvent(),
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
    const db = createWebhookDb({
      createWebhookEventMany: mockDuplicateWebhookCreateMany(),
      storedWebhookEvent: storedWebhookEvent(),
      updateManyWebhookEvent: mockWebhookUpdateMany({ count: 0 }),
    });

    const result = await processStripeWebhookEvent({
      db,
      event: paymentIntentSucceededEvent(),
    });

    expect(result).toEqual({ ok: false });
    expect(db.payment.findFirst).not.toHaveBeenCalled();
  });

  it('creates new webhook events with a processing claim', async () => {
    const db = createWebhookDb();

    await processStripeWebhookEvent({
      db,
      event: membershipSubscriptionEvent(),
    });

    expect(db.stripeWebhookEvent.createMany).toHaveBeenCalledWith({
      data: {
        eventType: 'customer.subscription.updated',
        processingError: expect.stringMatching(/^processing:/u),
        stripeCreatedAt: new Date('2026-05-01T12:00:00.000Z'),
        stripeEventId: 'evt_customer_subscription_updated',
      },
      skipDuplicates: true,
    });
  });

  it('records all-unhandled events for future domains without forcing Stripe retries', async () => {
    const updateWebhookEvent = mockWebhookUpdate();
    const db = createWebhookDb({ updateWebhookEvent });

    const result = await processStripeWebhookEvent({
      db,
      event: membershipSubscriptionEvent(),
    });

    expect(result).toEqual({ ok: true });
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

  it('records membership invoice events when domain is on subscription metadata', async () => {
    const updateWebhookEvent = mockWebhookUpdate();
    const db = createWebhookDb({
      updateWebhookEvent,
      webhookEventId: 'webhook_event_invoice',
    });

    const result = await processStripeWebhookEvent({
      db,
      event: {
        created: stripeEventCreated,
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

    expect(result).toEqual({ ok: true });
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

  it('records membership invoice events when domain is on parent subscription metadata', async () => {
    const updateWebhookEvent = mockWebhookUpdate();
    const db = createWebhookDb({
      updateWebhookEvent,
      webhookEventId: 'webhook_event_parent_invoice',
    });

    const result = await processStripeWebhookEvent({
      db,
      event: {
        created: stripeEventCreated,
        data: {
          object: {
            id: 'in_parent',
            parent: {
              subscription_details: {
                metadata: { purpose: 'membership' },
              },
            },
          },
        },
        id: 'evt_invoice_parent_paid',
        type: 'invoice.paid',
      },
    });

    expect(result).toEqual({ ok: true });
    expect(updateWebhookEvent).toHaveBeenCalledWith({
      data: {
        processingError: 'Unhandled Stripe webhook event: invoice.paid',
      },
      where: { id: 'webhook_event_parent_invoice' },
    });
    expect(updateWebhookEvent.mock.calls[0]?.[0].data).not.toHaveProperty(
      'processedAt'
    );
  });

  it('marks unmatched non-membership payment events processed as no-ops', async () => {
    const updateWebhookEvent = mockWebhookUpdate();
    const db = createWebhookDb({ updateWebhookEvent });

    const result = await processStripeWebhookEvent({
      db,
      event: {
        created: stripeEventCreated,
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

  it('marks malformed non-payment event objects processed as no-ops', async () => {
    const updateWebhookEvent = mockWebhookUpdate();
    const db = createWebhookDb({ updateWebhookEvent });

    const result = await processStripeWebhookEvent({
      db,
      event: {
        created: stripeEventCreated,
        data: { object: null },
        id: 'evt_customer_created_malformed',
        type: 'customer.created',
      },
    });

    expect(result).toEqual({ ok: true });
    expect(db.payment.findFirst).not.toHaveBeenCalled();
    expect(updateWebhookEvent).toHaveBeenCalledWith({
      data: { processedAt: expect.any(Date), processingError: null },
      where: { id: 'webhook_event_123' },
    });
  });

  it('fails when the webhook event reservation cannot be re-read', async () => {
    const db = createWebhookDb({
      storedWebhookEvent: null,
    });

    await expect(
      processStripeWebhookEvent({
        db,
        event: paymentIntentSucceededEvent(),
      })
    ).rejects.toThrow('Stripe webhook event reservation missing.');
  });

  it('marks unpaid Checkout completion handled without creating a receipt', async () => {
    const updatePayment = mockPaymentUpdate();
    const updateWebhookEvent = mockWebhookUpdate();
    const upsertReceipt = mockReceiptUpsert();
    const db = createWebhookDb({
      payment: eventPayment(),
      updatePayment,
      updateWebhookEvent,
      upsertReceipt,
    });

    const result = await processStripeWebhookEvent({
      db,
      event: {
        created: stripeEventCreated,
        data: {
          object: {
            id: 'cs_unpaid',
            amount_total: 4200,
            currency: 'usd',
            metadata: { paymentId: 'payment_123' },
            payment_status: 'unpaid',
          },
        },
        id: 'evt_checkout_session_completed_unpaid',
        type: 'checkout.session.completed',
      },
    });

    expect(result).toEqual({ ok: true });
    expect(updatePayment).not.toHaveBeenCalled();
    expect(upsertReceipt).not.toHaveBeenCalled();
    expect(updateWebhookEvent).toHaveBeenCalledWith({
      data: { processedAt: expect.any(Date), processingError: null },
      where: { id: 'webhook_event_123' },
    });
  });

  it('records processing error when Stripe amount differs from local payment', async () => {
    const updateWebhookEvent = mockWebhookUpdate();
    const db = createWebhookDb({
      payment: {
        ...eventPayment(),
        amountCents: 5000,
      },
      updateWebhookEvent,
    });

    const result = await processStripeWebhookEvent({
      db,
      event: paymentIntentSucceededEvent(),
    });

    expect(result).toEqual({ ok: false });
    expect(updateWebhookEvent).toHaveBeenCalledWith({
      data: {
        processingError: 'Stripe webhook amount does not match event payment.',
      },
      where: { id: 'webhook_event_123' },
    });
  });

  it('records generic processing error for non-Error failures', async () => {
    const updateWebhookEvent = mockWebhookUpdate();
    const updatePayment = vi
      .fn<StripeWebhookDb['payment']['updateMany']>()
      .mockRejectedValue('database unavailable');
    const db = createWebhookDb({
      payment: eventPayment(),
      updatePayment,
      updateWebhookEvent,
    });

    const result = await processStripeWebhookEvent({
      db,
      event: paymentIntentSucceededEvent(),
    });

    expect(result).toEqual({ ok: false });
    expect(updateWebhookEvent).toHaveBeenCalledWith({
      data: {
        processingError: 'Unknown Stripe webhook error',
      },
      where: { id: 'webhook_event_123' },
    });
  });

  it('marks charge succeeded without identifiers processed as no-op', async () => {
    const updateWebhookEvent = mockWebhookUpdate();
    const db = createWebhookDb({ updateWebhookEvent });

    const result = await processStripeWebhookEvent({
      db,
      event: {
        created: stripeEventCreated,
        data: { object: {} },
        id: 'evt_charge_succeeded_no_identifiers',
        type: 'charge.succeeded',
      },
    });

    expect(result).toEqual({ ok: true });
    expect(db.payment.findFirst).not.toHaveBeenCalled();
    expect(updateWebhookEvent).toHaveBeenCalledWith({
      data: { processedAt: expect.any(Date), processingError: null },
      where: { id: 'webhook_event_123' },
    });
  });

  it('keeps unmatched membership charge events pending for future handling', async () => {
    const updateWebhookEvent = mockWebhookUpdate();
    const db = createWebhookDb({ updateWebhookEvent });

    const result = await processStripeWebhookEvent({
      db,
      event: {
        created: stripeEventCreated,
        data: {
          object: {
            id: 'ch_membership',
            metadata: { domain: 'sailing_card_membership' },
            payment_intent: { id: 'pi_membership' },
          },
        },
        id: 'evt_charge_succeeded_membership_unmatched',
        type: 'charge.succeeded',
      },
    });

    expect(result).toEqual({ ok: true });
    expect(updateWebhookEvent).toHaveBeenCalledWith({
      data: {
        processingError: 'Unhandled Stripe webhook event: charge.succeeded',
      },
      where: { id: 'webhook_event_123' },
    });
    expect(updateWebhookEvent.mock.calls[0]?.[0].data).not.toHaveProperty(
      'processedAt'
    );
  });

  it('keeps unmatched membership refund events pending for future handling', async () => {
    const updateWebhookEvent = mockWebhookUpdate();
    const db = createWebhookDb({ updateWebhookEvent });

    const result = await processStripeWebhookEvent({
      db,
      event: {
        created: stripeEventCreated,
        data: {
          object: {
            id: 're_membership',
            metadata: { domain: 'sailing_card_membership' },
          },
        },
        id: 'evt_charge_refunded_membership_unmatched',
        type: 'charge.refunded',
      },
    });

    expect(result).toEqual({ ok: true });
    expect(updateWebhookEvent).toHaveBeenCalledWith({
      data: {
        processingError: 'Unhandled Stripe webhook event: charge.refunded',
      },
      where: { id: 'webhook_event_123' },
    });
    expect(updateWebhookEvent.mock.calls[0]?.[0].data).not.toHaveProperty(
      'processedAt'
    );
  });

  it('dispatches non-event-payment events to a later domain handler', async () => {
    const updateWebhookEvent = mockWebhookUpdate();
    const membershipHandler: StripeWebhookDispatchHandler = vi.fn(async () => {
      await Promise.resolve();
      return { handled: true };
    });
    const db = createWebhookDb({ updateWebhookEvent });
    const event = membershipSubscriptionEvent();

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
    const updateWebhookEvent = mockWebhookUpdate();
    const updatePayment = mockPaymentUpdate();
    const upsertReceipt = mockReceiptUpsert();
    const db = createWebhookDb({
      payment: eventPayment({ status: PaymentStatus.paid }),
      updatePayment,
      updateWebhookEvent,
      upsertReceipt,
      webhookEventId: 'webhook_event_456',
    });

    const result = await processStripeWebhookEvent({
      db,
      event: paymentIntentSucceededEvent({
        paymentIntentId: 'pi_456',
        stripeEventId: 'evt_payment_intent_succeeded_later',
      }),
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

  it('merges charge receipt fields when a concurrent paid transition wins first', async () => {
    const updatePayment = mockPaymentUpdate({ count: 0 });
    const upsertReceipt = mockReceiptUpsert();
    const db = createWebhookDb({
      payment: eventPayment(),
      updatePayment,
      upsertReceipt,
    });

    const result = await processStripeWebhookEvent({
      db,
      event: {
        created: stripeEventCreated,
        data: {
          object: {
            id: 'ch_123',
            amount: 4200,
            currency: 'usd',
            metadata: { paymentId: 'payment_123' },
            payment_intent: 'pi_123',
            receipt_url: 'https://pay.stripe.com/receipts/test',
          },
        },
        id: 'evt_charge_succeeded',
        type: 'charge.succeeded',
      },
    });

    expect(result).toEqual({ ok: true });
    expect(updatePayment).toHaveBeenLastCalledWith({
      data: {
        status: PaymentStatus.paid,
        stripeChargeId: 'ch_123',
        stripePaymentIntentId: 'pi_123',
        stripeReceiptUrl: 'https://pay.stripe.com/receipts/test',
      },
      where: { id: 'payment_123', status: PaymentStatus.paid },
    });
    expect(upsertReceipt).not.toHaveBeenCalled();
  });

  it('recovers duplicate charge receipts using charge Stripe references', async () => {
    const updateWebhookEvent = mockWebhookUpdate();
    const updateManyWebhookEvent = mockWebhookUpdateMany();
    const updatePayment = mockPaymentUpdate();
    const upsertReceipt = mockReceiptUpsert();
    const db = createWebhookDb({
      createWebhookEventMany: mockDuplicateWebhookCreateMany(),
      payment: eventPayment({ status: PaymentStatus.paid }),
      storedWebhookEvent: storedWebhookEvent({
        id: 'webhook_event_charge',
        processingError: 'receipt_enqueue_pending:receipt marker down',
      }),
      updateManyWebhookEvent,
      updatePayment,
      updateWebhookEvent,
      upsertReceipt,
    });

    const result = await processStripeWebhookEvent({
      db,
      event: {
        created: stripeEventCreated,
        data: {
          object: {
            id: 'ch_123',
            amount: 4200,
            currency: 'usd',
            metadata: { paymentId: 'payment_123' },
            payment_intent: 'pi_123',
          },
        },
        id: 'evt_charge_succeeded',
        type: 'charge.succeeded',
      },
    });

    expect(result).toEqual({
      ok: true,
      receiptJob: { dateKey: '2026-05-01', paymentId: 'payment_123' },
      stripeWebhookEventId: 'webhook_event_charge',
    });
    expect(db.payment.findFirst).toHaveBeenLastCalledWith({
      where: {
        OR: [
          { id: 'payment_123' },
          { stripePaymentIntentId: 'pi_123' },
          { stripeChargeId: 'ch_123' },
        ],
        purpose: 'event_payment',
      },
    });
    expect(updateManyWebhookEvent).toHaveBeenCalled();
    expect(upsertReceipt).toHaveBeenCalledWith({
      create: {
        kind: 'receipt',
        paymentId: 'payment_123',
        sentDateKey: '2026-05-01',
      },
      update: {},
      where: {
        paymentId_kind_sentDateKey: {
          kind: 'receipt',
          paymentId: 'payment_123',
          sentDateKey: '2026-05-01',
        },
      },
    });
  });

  it('finishes duplicate receipt recovery when payment disappears between reads', async () => {
    const updateManyWebhookEvent = mockWebhookUpdateMany();
    const updatePayment = mockPaymentUpdate();
    const db = createWebhookDb({
      createWebhookEventMany: mockDuplicateWebhookCreateMany(),
      payment: eventPayment({ status: PaymentStatus.paid }),
      storedWebhookEvent: storedWebhookEvent({
        processingError: 'receipt_enqueue_pending:payment removed',
      }),
      updateManyWebhookEvent,
      updatePayment,
    });
    vi.mocked(db.payment.findFirst)
      .mockResolvedValueOnce(eventPayment({ status: PaymentStatus.paid }))
      .mockResolvedValueOnce(null);

    const result = await processStripeWebhookEvent({
      db,
      event: paymentIntentSucceededEvent(),
    });

    expect(result).toEqual({ ok: true });
    expect(updatePayment).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: PaymentStatus.paid,
        stripePaymentIntentId: 'pi_123',
      }),
      where: { id: 'payment_123', status: PaymentStatus.paid },
    });
    expect(db.eventPaymentNotification.upsert).not.toHaveBeenCalled();
    expect(updateManyWebhookEvent).toHaveBeenCalled();
  });

  it('records terminal events without optional Stripe references', async () => {
    const updatePayment = mockPaymentUpdate();
    const db = createWebhookDb({
      payment: eventPayment({ status: PaymentStatus.paid }),
      updatePayment,
    });

    const result = await processStripeWebhookEvent({
      db,
      event: {
        created: stripeEventCreated,
        data: {
          object: {
            metadata: { paymentId: 'payment_123' },
          },
        },
        id: 'evt_refund_created_no_references',
        type: 'refund.created',
      },
    });

    expect(result).toEqual({ ok: true });
    expect(updatePayment).toHaveBeenCalledWith({
      data: { status: PaymentStatus.refunded },
      where: { id: 'payment_123', status: PaymentStatus.paid },
    });
  });

  it('does not synthesize receipts when retrying a failed later event that never created one', async () => {
    const updateWebhookEvent = mockWebhookUpdate();
    const updateManyWebhookEvent = mockWebhookUpdateMany();
    const updatePayment = mockPaymentUpdate();
    const upsertReceipt = mockReceiptUpsert();
    const db = createWebhookDb({
      createWebhookEventMany: mockWebhookCreateManyThenDuplicate(),
      payment: eventPayment({ status: PaymentStatus.paid }),
      storedWebhookEvent: storedWebhookEvent({
        id: 'webhook_event_456',
        processingError: 'membership handler down',
      }),
      updateManyWebhookEvent,
      updatePayment,
      updateWebhookEvent,
      upsertReceipt,
    });
    const event = paymentIntentSucceededEvent({
      paymentIntentId: 'pi_456',
      stripeEventId: 'evt_payment_intent_succeeded_later',
    });
    await expectHandlerFailureThenSuccess({
      db,
      event,
      successResult: { ok: true },
    });

    expect(upsertReceipt).not.toHaveBeenCalled();
    expect(updateManyWebhookEvent).toHaveBeenCalled();
    expect(updateWebhookEvent).toHaveBeenLastCalledWith({
      data: { processedAt: expect.any(Date), processingError: null },
      where: { id: 'webhook_event_456' },
    });
  });

  it('does not claim unpaid membership checkout sessions as event payments', async () => {
    const updateWebhookEvent = mockWebhookUpdate();
    const db = createWebhookDb({ updateWebhookEvent });

    const result = await processStripeWebhookEvent({
      db,
      event: {
        created: stripeEventCreated,
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

    expect(result).toEqual({ ok: true });
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
    const upsertReceipt = mockReceiptUpsert();
    upsertReceipt.mockRejectedValueOnce(new Error('receipt marker down'));
    const { db, event, paymentState, updateWebhookEvent } =
      createReceiptRecoveryScenario({
        processingError: 'receipt_enqueue_pending:receipt marker down',
        upsertReceipt,
      });

    await expectReceiptRecoveryAfterInitialFailure({
      db,
      event,
      paymentState,
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
    const updateWebhookEvent = mockWebhookUpdate();
    updateWebhookEvent.mockRejectedValueOnce(new Error('webhook marker down'));
    const upsertReceipt = mockReceiptUpsert();
    const { db, event, paymentState } = createReceiptRecoveryScenario({
      processingError: 'receipt_enqueue_pending:webhook marker down',
      updateWebhookEvent,
      upsertReceipt,
    });

    await expectReceiptRecoveryAfterInitialFailure({
      db,
      event,
      paymentState,
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
    const {
      db,
      event,
      paymentState,
      updateManyWebhookEvent,
      updateWebhookEvent,
      upsertReceipt,
    } = createReceiptRecoveryScenario({
      processingError: 'receipt_enqueue_pending:membership handler down',
    });
    await expectHandlerFailureThenSuccess({
      beforeSuccess: () => {
        paymentState.status = PaymentStatus.paid;
      },
      db,
      event,
      successResult: {
        ok: true,
        receiptJob: { dateKey: '2026-05-01', paymentId: 'payment_123' },
        stripeWebhookEventId: 'webhook_event_123',
      },
    });

    expect(upsertReceipt).toHaveBeenCalledTimes(2);
    expect(updateManyWebhookEvent).toHaveBeenCalled();
    expect(updateWebhookEvent).toHaveBeenLastCalledWith({
      data: { processingError: 'receipt_enqueue_pending' },
      where: { id: 'webhook_event_123' },
    });
  });
});
