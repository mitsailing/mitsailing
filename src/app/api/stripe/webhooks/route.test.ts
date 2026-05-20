import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventPaymentStatus } from '@/generated/prisma/enums';
import { POST } from './route';

type TransactionOperation = {
  run(client: typeof mocks.tx): Promise<unknown>;
}['run'];

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  enqueueEventPaymentEmailJob: vi.fn(),
  env: {
    STRIPE_WEBHOOK_SECRET: 'stripe_webhook_secret',
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
  },
  tx: {
    eventPayment: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    eventPaymentNotification: {
      upsert: vi.fn(),
    },
    stripeWebhookEvent: {
      create: vi.fn(),
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

describe('stripe webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.STRIPE_WEBHOOK_SECRET = 'stripe_webhook_secret';
    mocks.getStripeClient.mockReturnValue({
      webhooks: { constructEvent: mocks.constructEvent },
    });
    mocks.tx.stripeWebhookEvent.create.mockResolvedValue({
      id: 'stored-event-1',
    });
    mocks.tx.stripeWebhookEvent.findUnique.mockResolvedValue(null);
    mocks.tx.stripeWebhookEvent.update.mockResolvedValue({});
    mocks.tx.stripeWebhookEvent.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.eventPayment.findFirst.mockResolvedValue({
      amountCents: 4200,
      currency: 'usd',
      id: 'payment-1',
      status: EventPaymentStatus.pending,
    });
    mocks.tx.eventPayment.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.eventPaymentNotification.upsert.mockResolvedValue({});
    mocks.enqueueEventPaymentEmailJob.mockImplementation(async () => {
      await Promise.resolve();
    });
  });

  it('rejects missing signatures before constructing events or mutating data', async () => {
    const response = await POST(stripeRequest({ signature: null }));

    await expect(response.json()).resolves.toEqual({ ok: false });
    expect(response.status).toBe(400);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.tx.stripeWebhookEvent.create).not.toHaveBeenCalled();
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
    expect(mocks.tx.eventPayment.updateMany).not.toHaveBeenCalled();
  });

  it('skips duplicate Stripe event ids', async () => {
    mocks.constructEvent.mockReturnValueOnce(
      stripeEvent('checkout.session.completed', {
        id: 'cs_test',
        metadata: { paymentId: 'payment-1' },
        payment_intent: 'pi_test',
      })
    );
    mocks.tx.stripeWebhookEvent.create.mockRejectedValueOnce(
      Object.assign(new Error('duplicate'), { code: 'P2002' })
    );
    mocks.tx.stripeWebhookEvent.findUnique.mockResolvedValueOnce({
      id: 'stored-event-1',
      processedAt: new Date('2026-05-01T12:01:00.000Z'),
    });

    const response = await POST(stripeRequest({}));

    await expect(response.json()).resolves.toEqual({
      duplicate: true,
      ok: true,
    });
    expect(response.status).toBe(200);
    expect(mocks.tx.eventPayment.findFirst).not.toHaveBeenCalled();
    expect(mocks.tx.eventPayment.updateMany).not.toHaveBeenCalled();
    expect(mocks.enqueueEventPaymentEmailJob).not.toHaveBeenCalled();
  });

  it('requeues receipt jobs for processed paid duplicates', async () => {
    mocks.constructEvent.mockReturnValueOnce(
      stripeEvent('payment_intent.succeeded', {
        amount_received: 4200,
        currency: 'usd',
        id: 'pi_test',
        metadata: { paymentId: 'payment-1' },
      })
    );
    mocks.tx.stripeWebhookEvent.create.mockRejectedValueOnce(
      Object.assign(new Error('duplicate'), { code: 'P2002' })
    );
    mocks.tx.stripeWebhookEvent.findUnique.mockResolvedValueOnce({
      id: 'stored-event-1',
      processedAt: new Date('2026-05-01T12:01:00.000Z'),
    });
    mocks.tx.eventPayment.findFirst.mockResolvedValueOnce({
      amountCents: 4200,
      currency: 'usd',
      id: 'payment-1',
      status: EventPaymentStatus.paid,
    });

    const response = await POST(stripeRequest({}));

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.enqueueEventPaymentEmailJob).toHaveBeenCalledWith(
      { queue: true },
      expect.objectContaining({
        dateKey: '2026-05-01',
        kind: 'receipt',
        paymentId: 'payment-1',
      })
    );
  });

  it('retries duplicate Stripe event ids that previously failed processing', async () => {
    mocks.constructEvent.mockReturnValueOnce(
      stripeEvent('payment_intent.succeeded', {
        amount_received: 4200,
        currency: 'usd',
        id: 'pi_test',
        metadata: { paymentId: 'payment-1' },
      })
    );
    mocks.tx.stripeWebhookEvent.create.mockRejectedValueOnce(
      Object.assign(new Error('duplicate'), { code: 'P2002' })
    );
    mocks.tx.stripeWebhookEvent.findUnique.mockResolvedValueOnce({
      id: 'stored-event-1',
      processedAt: null,
    });

    const response = await POST(stripeRequest({}));

    expect(response.status).toBe(200);
    expect(mocks.tx.eventPayment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: EventPaymentStatus.paid,
        stripePaymentIntentId: 'pi_test',
      }),
      where: { id: 'payment-1', status: EventPaymentStatus.pending },
    });
  });

  it('marks checkout completion as paid and queues a receipt email', async () => {
    mocks.constructEvent.mockReturnValueOnce(
      stripeEvent('checkout.session.completed', {
        amount_total: 4200,
        currency: 'usd',
        customer: 'cus_test',
        id: 'cs_test',
        metadata: { paymentId: 'payment-1' },
        payment_status: 'paid',
        payment_intent: 'pi_test',
      })
    );

    const response = await POST(stripeRequest({}));

    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.tx.stripeWebhookEvent.create).toHaveBeenCalledWith({
      data: {
        eventType: 'checkout.session.completed',
        stripeCreatedAt: new Date('2026-05-01T12:00:00.000Z'),
        stripeEventId: 'evt_checkout_session_completed',
      },
    });
    expect(mocks.tx.eventPayment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: EventPaymentStatus.paid,
        stripeCheckoutSessionId: 'cs_test',
        stripeCustomerId: 'cus_test',
        stripePaymentIntentId: 'pi_test',
      }),
      where: { id: 'payment-1', status: EventPaymentStatus.pending },
    });
    expect(mocks.enqueueEventPaymentEmailJob).toHaveBeenCalledWith(
      { queue: true },
      expect.objectContaining({
        kind: 'receipt',
        paymentId: 'payment-1',
      })
    );
  });

  it('marks payment intent success as paid', async () => {
    mocks.constructEvent.mockReturnValueOnce(
      stripeEvent('payment_intent.succeeded', {
        amount_received: 4200,
        currency: 'usd',
        id: 'pi_test',
        latest_charge: 'ch_test',
        metadata: { paymentId: 'payment-1' },
      })
    );

    const response = await POST(stripeRequest({}));

    expect(response.status).toBe(200);
    expect(mocks.tx.eventPayment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: EventPaymentStatus.paid,
        stripeChargeId: 'ch_test',
        stripePaymentIntentId: 'pi_test',
      }),
      where: { id: 'payment-1', status: EventPaymentStatus.pending },
    });
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
    expect(mocks.tx.eventPayment.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: EventPaymentStatus.paid,
        stripeChargeId: 'ch_test',
        stripePaymentIntentId: 'pi_test',
        stripeReceiptUrl: 'https://pay.stripe.com/receipts/test',
      }),
      where: { id: 'payment-1', status: EventPaymentStatus.pending },
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
    expect(mocks.tx.eventPayment.updateMany).toHaveBeenCalledWith({
      data: {
        status: EventPaymentStatus.refunded,
        stripeChargeId: 'ch_test',
        stripePaymentIntentId: 'pi_test',
      },
      where: { id: 'payment-1', status: EventPaymentStatus.pending },
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
    expect(mocks.tx.eventPayment.updateMany).toHaveBeenCalledWith({
      data: {
        status: EventPaymentStatus.disputed,
        stripeChargeId: 'ch_test',
        stripePaymentIntentId: 'pi_test',
      },
      where: { id: 'payment-1', status: EventPaymentStatus.pending },
    });
    expect(mocks.enqueueEventPaymentEmailJob).not.toHaveBeenCalled();
  });

  it('persists processing errors on the stored webhook event', async () => {
    mocks.constructEvent.mockReturnValueOnce(
      stripeEvent('payment_intent.succeeded', {
        amount_received: 4200,
        currency: 'usd',
        id: 'pi_test',
        metadata: { paymentId: 'payment-1' },
      })
    );
    mocks.tx.eventPayment.updateMany.mockRejectedValueOnce(
      new Error('DB down')
    );

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
});
