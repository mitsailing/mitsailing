import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentStatus } from '@/generated/prisma/enums';
import { POST } from './route';

type TransactionOperation = {
  run(tx: typeof mocks.tx): Promise<unknown>;
}['run'];

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  enqueueMembershipPaymentReminderJob: vi.fn(),
  enqueueEventPaymentEmailJob: vi.fn(),
  env: {
    STRIPE_WEBHOOK_SECRET: 'stripe_webhook_secret' as string | undefined,
  },
  getDefaultQueue: vi.fn(() => ({ queue: true })),
  getStripeClient: vi.fn(),
  logger: {
    error: vi.fn(),
  },
  prisma: {
    $transaction: vi.fn(async (operation: TransactionOperation) => {
      const result = await operation(mocks.tx);
      return result;
    }),
    stripeWebhookEvent: {
      update: vi.fn(),
    },
  },
  tx: {
    payment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    eventPaymentNotification: {
      upsert: vi.fn(),
    },
    sailingCardSubscription: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    stripeWebhookEvent: {
      createMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/Env', () => ({
  Env: mocks.env,
}));

vi.mock('@/libs/Logger', () => ({
  logger: mocks.logger,
}));

vi.mock('@/libs/DB', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/libs/stripe/stripeClient', () => ({
  getStripeClient: mocks.getStripeClient,
}));

vi.mock('@/worker/defaultQueue', () => ({
  getDefaultQueue: mocks.getDefaultQueue,
}));

vi.mock('@/worker/eventPaymentEmailJob', () => ({
  enqueueEventPaymentEmailJob: mocks.enqueueEventPaymentEmailJob,
}));

vi.mock('@/worker/membershipPaymentReminderJob', () => ({
  enqueueMembershipPaymentReminderJob:
    mocks.enqueueMembershipPaymentReminderJob,
}));

function stripeRequest(options: {
  body?: string;
  signature?: string | null;
}): Request {
  const headers = new Headers();
  if (options.signature !== null) {
    headers.set('stripe-signature', options.signature ?? 't=1,v1=sig');
  }
  return new Request('https://mitsailing.test/api/stripe/webhooks', {
    body: options.body ?? '{"id":"evt_test"}',
    headers,
    method: 'POST',
  });
}

function stripeEvent(type: string, object: Record<string, unknown>) {
  return {
    created: 1_777_636_800,
    data: { object },
    id: `evt_${type.replaceAll('.', '_')}`,
    object: 'event',
    type,
  };
}

function mockStripeEvent(type: string, object: Record<string, unknown>) {
  mocks.constructEvent.mockReturnValueOnce(stripeEvent(type, object));
}

function eventPaymentStripePayload(overrides?: Record<string, unknown>) {
  return {
    amount_received: 4200,
    currency: 'usd',
    id: 'pi_test',
    metadata: { paymentId: 'payment-1' },
    ...overrides,
  };
}

function mockPaymentIntentSucceededEvent() {
  mockStripeEvent('payment_intent.succeeded', eventPaymentStripePayload());
}

function mockCheckoutCompletedEvent() {
  mockStripeEvent('checkout.session.completed', {
    amount_total: 4200,
    currency: 'usd',
    customer: 'cus_test',
    id: 'cs_test',
    metadata: { paymentId: 'payment-1' },
    payment_status: 'paid',
    payment_intent: 'pi_test',
  });
}

function mockDuplicateStoredWebhookEvent(options: {
  processedAt: Date | null;
  processingError: string | null;
}) {
  mocks.tx.stripeWebhookEvent.createMany.mockResolvedValueOnce({ count: 0 });
  mocks.tx.stripeWebhookEvent.findUnique.mockResolvedValueOnce({
    id: 'stored-event-1',
    processedAt: options.processedAt,
    processingError: options.processingError,
  });
}

async function expectDuplicateOkResponse(response: Response) {
  await expect(response.json()).resolves.toEqual({
    duplicate: true,
    ok: true,
  });
  expect(response.status).toBe(200);
}

async function expectReceiptPendingFailureResponse(
  response: Response,
  expectedProcessingError: string
) {
  await expect(response.json()).resolves.toEqual({ ok: false });
  expect(response.status).toBe(500);
  expect(mocks.tx.stripeWebhookEvent.update).toHaveBeenCalledWith({
    data: { processingError: 'receipt_enqueue_pending' },
    where: { id: 'stored-event-1' },
  });
  expect(mocks.prisma.stripeWebhookEvent.update).toHaveBeenCalledWith({
    data: { processingError: expectedProcessingError },
    where: { id: 'stored-event-1' },
  });
}

describe('stripe webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.STRIPE_WEBHOOK_SECRET = 'stripe_webhook_secret';
    mocks.getStripeClient.mockReturnValue({
      webhooks: { constructEvent: mocks.constructEvent },
    });
    mocks.tx.stripeWebhookEvent.createMany.mockResolvedValue({ count: 1 });
    mocks.tx.stripeWebhookEvent.findUnique.mockResolvedValue({
      id: 'stored-event-1',
      processedAt: null,
      processingError: null,
    });
    mocks.tx.stripeWebhookEvent.update.mockResolvedValue({});
    mocks.tx.stripeWebhookEvent.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.stripeWebhookEvent.update.mockResolvedValue({});
    mocks.tx.payment.create.mockResolvedValue({});
    mocks.tx.payment.findFirst.mockResolvedValue({
      amountCents: 4200,
      currency: 'usd',
      id: 'payment-1',
      status: PaymentStatus.pending,
    });
    mocks.tx.payment.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.eventPaymentNotification.upsert.mockResolvedValue({});
    mocks.tx.sailingCardSubscription.findFirst.mockResolvedValue(null);
    mocks.tx.sailingCardSubscription.upsert.mockResolvedValue({
      id: 'membership-subscription-1',
      userId: 'user-1',
    });
    mocks.enqueueEventPaymentEmailJob.mockImplementation(async () => {
      await Promise.resolve();
    });
    mocks.enqueueMembershipPaymentReminderJob.mockImplementation(async () => {
      await Promise.resolve();
    });
  });

  it('rejects missing signatures before constructing events or mutating data', async () => {
    const response = await POST(stripeRequest({ signature: null }));

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(400);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.tx.stripeWebhookEvent.createMany).not.toHaveBeenCalled();
  });

  it('rejects invalid signatures before mutating data', async () => {
    mocks.constructEvent.mockImplementationOnce(() => {
      throw new Error('Invalid signature');
    });

    const response = await POST(stripeRequest({}));

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(400);
    expect(mocks.constructEvent).toHaveBeenCalledWith(
      '{"id":"evt_test"}',
      't=1,v1=sig',
      'stripe_webhook_secret'
    );
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.tx.payment.updateMany).not.toHaveBeenCalled();
  });

  it('rejects requests when the webhook secret is not configured', async () => {
    mocks.env.STRIPE_WEBHOOK_SECRET = undefined;

    const response = await POST(stripeRequest({}));

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(503);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('passes an empty raw body to Stripe for empty signed requests', async () => {
    mockPaymentIntentSucceededEvent();
    const headers = new Headers({
      'stripe-signature': 't=1,v1=sig',
    });

    const response = await POST(
      new Request('https://mitsailing.test/api/stripe/webhooks', {
        headers,
        method: 'POST',
      })
    );

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.constructEvent).toHaveBeenCalledWith(
      '',
      't=1,v1=sig',
      'stripe_webhook_secret'
    );
  });

  it('rejects oversized declared content length before reading the body', async () => {
    const headers = new Headers({
      'content-length': String(256 * 1024 + 1),
      'stripe-signature': 't=1,v1=sig',
    });

    const response = await POST(
      new Request('https://mitsailing.test/api/stripe/webhooks', {
        body: '{}',
        headers,
        method: 'POST',
      })
    );

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(413);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects oversized payloads before constructing events or mutating data', async () => {
    const response = await POST(
      stripeRequest({ body: 'x'.repeat(256 * 1024 + 1) })
    );

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(413);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('skips duplicate Stripe event ids', async () => {
    mockStripeEvent('checkout.session.completed', {
      id: 'cs_test',
      metadata: { paymentId: 'payment-1' },
      payment_intent: 'pi_test',
    });
    mockDuplicateStoredWebhookEvent({
      processedAt: new Date('2026-05-01T12:01:00.000Z'),
      processingError: null,
    });

    const response = await POST(stripeRequest({}));

    await expectDuplicateOkResponse(response);
    expect(mocks.tx.payment.findFirst).not.toHaveBeenCalled();
    expect(mocks.tx.payment.updateMany).not.toHaveBeenCalled();
    expect(mocks.enqueueEventPaymentEmailJob).not.toHaveBeenCalled();
  });

  it('skips processed paid duplicates without replaying receipt side effects', async () => {
    mockPaymentIntentSucceededEvent();
    mockDuplicateStoredWebhookEvent({
      processedAt: new Date('2026-05-01T12:01:00.000Z'),
      processingError: null,
    });

    const response = await POST(stripeRequest({}));

    await expectDuplicateOkResponse(response);
    expect(mocks.tx.payment.findFirst).not.toHaveBeenCalled();
    expect(mocks.enqueueEventPaymentEmailJob).not.toHaveBeenCalled();
  });

  it('retries duplicate Stripe event ids that previously failed processing', async () => {
    mockPaymentIntentSucceededEvent();
    mockDuplicateStoredWebhookEvent({
      processedAt: null,
      processingError: 'receipt_enqueue_pending',
    });

    const response = await POST(stripeRequest({}));

    expect(response.status).toBe(200);
    expect(mocks.tx.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: PaymentStatus.paid,
        stripePaymentIntentId: 'pi_test',
      }),
      where: { id: 'payment-1', status: PaymentStatus.pending },
    });
  });

  it('marks checkout completion as paid and queues a receipt email', async () => {
    mockCheckoutCompletedEvent();

    const response = await POST(stripeRequest({}));

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.tx.stripeWebhookEvent.createMany).toHaveBeenCalledWith({
      data: {
        eventType: 'checkout.session.completed',
        processingError: expect.stringMatching(/^processing:/u),
        stripeCreatedAt: new Date('2026-05-01T12:00:00.000Z'),
        stripeEventId: 'evt_checkout_session_completed',
      },
      skipDuplicates: true,
    });
    expect(mocks.tx.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: PaymentStatus.paid,
        stripeCheckoutSessionId: 'cs_test',
        stripeCustomerId: 'cus_test',
        stripePaymentIntentId: 'pi_test',
      }),
      where: { id: 'payment-1', status: PaymentStatus.pending },
    });
    expect(mocks.enqueueEventPaymentEmailJob).toHaveBeenCalledWith(
      { queue: true },
      expect.objectContaining({
        kind: 'receipt',
        paymentId: 'payment-1',
      })
    );
    expect(mocks.prisma.stripeWebhookEvent.update).toHaveBeenCalledWith({
      data: { processedAt: expect.any(Date), processingError: null },
      where: { id: 'stored-event-1' },
    });
  });

  it('queues a membership payment reminder when subscription Checkout expires with recovery', async () => {
    mockStripeEvent('checkout.session.expired', {
      after_expiration: {
        recovery: {
          url: 'https://checkout.stripe.com/c/pay/cs_recover',
        },
      },
      id: 'cs_test',
      metadata: {
        domain: 'sailing_card_membership',
        localPaymentId: 'payment-1',
      },
    });
    mocks.tx.payment.findFirst.mockResolvedValue({
      amountCents: 7000,
      cardType: 'racing',
      cardYear: 2026,
      currency: 'usd',
      id: 'payment-1',
      purpose: 'membership',
      status: PaymentStatus.checkout_created,
      stripeCheckoutSessionId: 'cs_test',
      userId: 'user-1',
    });

    const response = await POST(stripeRequest({}));

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.tx.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: PaymentStatus.pending,
        stripeCheckoutSessionUrl:
          'https://checkout.stripe.com/c/pay/cs_recover',
      }),
      where: { id: 'payment-1', status: PaymentStatus.checkout_created },
    });
    expect(mocks.enqueueMembershipPaymentReminderJob).toHaveBeenCalledWith(
      { queue: true },
      {
        dateKey: '2026-05-01',
        paymentId: 'payment-1',
      }
    );
  });

  it('does not queue membership reminders when expired Checkout lacks a recovery URL', async () => {
    mockStripeEvent('checkout.session.expired', {
      id: 'cs_test',
      metadata: {
        domain: 'sailing_card_membership',
        localPaymentId: 'payment-1',
      },
    });
    mocks.tx.payment.findFirst.mockResolvedValue({
      amountCents: 7000,
      cardType: 'racing',
      cardYear: 2026,
      currency: 'usd',
      id: 'payment-1',
      purpose: 'membership',
      status: PaymentStatus.checkout_created,
      stripeCheckoutSessionId: 'cs_test',
      userId: 'user-1',
    });

    const response = await POST(stripeRequest({}));

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.enqueueMembershipPaymentReminderJob).not.toHaveBeenCalled();
    expect(mocks.tx.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: PaymentStatus.cancelled,
        stripeCheckoutSessionUrl: null,
      }),
      where: { id: 'payment-1', status: PaymentStatus.checkout_created },
    });
  });

  it('returns server error when membership reminder queueing fails', async () => {
    mockStripeEvent('checkout.session.expired', {
      after_expiration: {
        recovery: {
          url: 'https://checkout.stripe.com/c/pay/cs_recover',
        },
      },
      id: 'cs_test',
      metadata: {
        domain: 'sailing_card_membership',
        localPaymentId: 'payment-1',
      },
    });
    mocks.tx.payment.findFirst.mockResolvedValue({
      amountCents: 7000,
      cardType: 'racing',
      cardYear: 2026,
      currency: 'usd',
      id: 'payment-1',
      purpose: 'membership',
      status: PaymentStatus.checkout_created,
      stripeCheckoutSessionId: 'cs_test',
      userId: 'user-1',
    });
    const error = new Error('queue down');
    mocks.enqueueMembershipPaymentReminderJob.mockRejectedValueOnce(error);

    const response = await POST(stripeRequest({}));

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(500);
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Failed to enqueue membership payment reminder job: {error}',
      { error }
    );
  });

  it('leaves receipt-producing events retryable when queueing fails', async () => {
    mockCheckoutCompletedEvent();
    mocks.enqueueEventPaymentEmailJob.mockRejectedValueOnce(
      new Error('Queue down')
    );

    const response = await POST(stripeRequest({}));

    await expectReceiptPendingFailureResponse(
      response,
      'receipt_enqueue_pending:Queue down'
    );
  });

  it('re-persists receipt pending when a duplicate retry queueing fails again', async () => {
    mockPaymentIntentSucceededEvent();
    mockDuplicateStoredWebhookEvent({
      processedAt: null,
      processingError: 'receipt_enqueue_pending:Queue down',
    });
    mocks.tx.payment.findFirst.mockResolvedValue({
      amountCents: 4200,
      currency: 'usd',
      id: 'payment-1',
      status: PaymentStatus.paid,
    });
    mocks.enqueueEventPaymentEmailJob.mockRejectedValueOnce(
      new Error('Queue still down')
    );

    const response = await POST(stripeRequest({}));

    await expectReceiptPendingFailureResponse(
      response,
      'receipt_enqueue_pending:Queue still down'
    );
  });

  it('marks payment intent success as paid', async () => {
    mockStripeEvent('payment_intent.succeeded', {
      ...eventPaymentStripePayload({
        latest_charge: 'ch_test',
      }),
    });

    const response = await POST(stripeRequest({}));

    expect(response.status).toBe(200);
    expect(mocks.tx.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: PaymentStatus.paid,
        stripeChargeId: 'ch_test',
        stripePaymentIntentId: 'pi_test',
      }),
      where: { id: 'payment-1', status: PaymentStatus.pending },
    });
  });

  it('keeps receipt-producing events retryable when persisting queue error detail fails', async () => {
    mockCheckoutCompletedEvent();
    mocks.enqueueEventPaymentEmailJob.mockRejectedValueOnce(
      new Error('Queue down')
    );
    mocks.prisma.stripeWebhookEvent.update.mockRejectedValueOnce(
      new Error('DB down')
    );

    const response = await POST(stripeRequest({}));

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(500);
    expect(mocks.tx.stripeWebhookEvent.update).toHaveBeenCalledWith({
      data: { processingError: 'receipt_enqueue_pending' },
      where: { id: 'stored-event-1' },
    });
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Failed to persist Stripe webhook receipt enqueue error: {error}',
      { error: expect.any(Error) }
    );
  });

  it('captures receipt URLs from charge success', async () => {
    mocks.constructEvent.mockReturnValueOnce(
      stripeEvent('charge.succeeded', {
        amount: 4200,
        currency: 'usd',
        id: 'ch_test',
        metadata: { paymentId: 'payment-1' },
        payment_intent: 'pi_test',
        receipt_url: 'https://pay.stripe.com/receipts/test',
      })
    );

    const response = await POST(stripeRequest({}));

    expect(response.status).toBe(200);
    expect(mocks.tx.payment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: PaymentStatus.paid,
        stripeChargeId: 'ch_test',
        stripePaymentIntentId: 'pi_test',
        stripeReceiptUrl: 'https://pay.stripe.com/receipts/test',
      }),
      where: { id: 'payment-1', status: PaymentStatus.pending },
    });
  });

  it('marks refunded payments terminal without queuing receipts', async () => {
    mocks.constructEvent.mockReturnValueOnce(
      stripeEvent('charge.refunded', {
        id: 'ch_test',
        metadata: { paymentId: 'payment-1' },
        payment_intent: 'pi_test',
      })
    );

    const response = await POST(stripeRequest({}));

    expect(response.status).toBe(200);
    expect(mocks.tx.payment.updateMany).toHaveBeenCalledWith({
      data: {
        status: PaymentStatus.refunded,
        stripeChargeId: 'ch_test',
        stripePaymentIntentId: 'pi_test',
      },
      where: { id: 'payment-1', status: PaymentStatus.pending },
    });
    expect(mocks.enqueueEventPaymentEmailJob).not.toHaveBeenCalled();
  });

  it('marks disputed payments terminal without queuing receipts', async () => {
    mocks.constructEvent.mockReturnValueOnce(
      stripeEvent('charge.dispute.created', {
        charge: 'ch_test',
        id: 'dp_test',
        metadata: { paymentId: 'payment-1' },
        payment_intent: 'pi_test',
      })
    );

    const response = await POST(stripeRequest({}));

    expect(response.status).toBe(200);
    expect(mocks.tx.payment.updateMany).toHaveBeenCalledWith({
      data: {
        status: PaymentStatus.disputed,
        stripeChargeId: 'ch_test',
        stripePaymentIntentId: 'pi_test',
      },
      where: { id: 'payment-1', status: PaymentStatus.pending },
    });
    expect(mocks.enqueueEventPaymentEmailJob).not.toHaveBeenCalled();
  });

  it('persists processing errors on the stored webhook event', async () => {
    mockPaymentIntentSucceededEvent();
    mocks.tx.payment.updateMany.mockRejectedValueOnce(new Error('DB down'));

    const response = await POST(stripeRequest({}));

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(500);
    expect(mocks.tx.stripeWebhookEvent.update).toHaveBeenCalledWith({
      data: {
        processingError: 'DB down',
      },
      where: { id: 'stored-event-1' },
    });
  });

  it('keeps contextless membership subscription events pending for future handling', async () => {
    mocks.constructEvent.mockReturnValueOnce(
      stripeEvent('customer.subscription.updated', {
        id: 'sub_test',
        metadata: { domain: 'sailing_card_membership' },
      })
    );

    const response = await POST(stripeRequest({}));

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(200);
    expect(mocks.tx.sailingCardSubscription.findFirst).toHaveBeenCalledWith({
      where: { stripeSubscriptionId: 'sub_test' },
    });
    expect(mocks.tx.payment.findFirst).not.toHaveBeenCalled();
    expect(mocks.tx.sailingCardSubscription.upsert).not.toHaveBeenCalled();
    expect(mocks.tx.stripeWebhookEvent.update).toHaveBeenCalledWith({
      data: {
        processingError:
          'Unhandled Stripe webhook event: customer.subscription.updated',
      },
      where: { id: 'stored-event-1' },
    });
    expect(
      mocks.tx.stripeWebhookEvent.update.mock.calls[0]?.[0].data
    ).not.toHaveProperty('processedAt');
  });

  it('marks generic unrelated Stripe events processed as no-ops', async () => {
    mockStripeEvent('customer.created', {
      id: 'cus_test',
    });

    const response = await POST(stripeRequest({}));

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.status).toBe(200);
    expect(mocks.tx.payment.findFirst).not.toHaveBeenCalled();
    expect(mocks.tx.stripeWebhookEvent.update).toHaveBeenCalledWith({
      data: { processedAt: expect.any(Date), processingError: null },
      where: { id: 'stored-event-1' },
    });
  });

  it('returns server error when the processing transaction fails', async () => {
    mockPaymentIntentSucceededEvent();
    mocks.prisma.$transaction.mockRejectedValueOnce(new Error('DB down'));

    const response = await POST(stripeRequest({}));

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(500);
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Failed to process Stripe webhook: {error}',
      { error: expect.any(Error) }
    );
  });
});
