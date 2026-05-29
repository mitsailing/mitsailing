import { describe, expect, it } from 'vitest';
import {
  EventPaymentNotificationKind,
  PaymentStatus,
} from '@/generated/prisma/enums';
import {
  applyEventPaymentPaidTransition,
  buildManualHandledEventPaymentTransition,
  eventPaymentNeedsReminder,
  eventPaymentStatusAllowsReminder,
  eventPaymentStatusCanTransitionTo,
  eventPaymentSummaryNeedsAdminDigest,
  getEventPaymentEligibility,
  nyEventPaymentNotificationDateKey,
  shouldRunEventPaymentDailyNotifications,
} from '@/libs/mit-sailing/eventPayments';

describe('getEventPaymentEligibility', () => {
  it('marks disabled payments ineligible', () => {
    const result = getEventPaymentEligibility({
      entryFees: [{ amountCents: 2500, id: 'fee-1' }],
      paymentDeadlineAt: new Date('2026-06-01T13:00:00.000Z'),
      paymentsEnabled: false,
    });

    expect(result).toEqual({
      canCreatePayment: false,
      canSendRequest: false,
      reason: 'payments_disabled',
    });
  });

  it('marks events without a positive fee ineligible', () => {
    const result = getEventPaymentEligibility({
      entryFees: [{ amountCents: 0, id: 'fee-1' }],
      paymentDeadlineAt: new Date('2026-06-01T13:00:00.000Z'),
      paymentsEnabled: true,
    });

    expect(result).toEqual({
      canCreatePayment: false,
      canSendRequest: false,
      reason: 'no_fee',
    });
  });

  it('blocks request sending without a deadline', () => {
    const result = getEventPaymentEligibility({
      entryFees: [{ amountCents: 2500, id: 'fee-1' }],
      paymentDeadlineAt: null,
      paymentsEnabled: true,
    });

    expect(result).toEqual({
      canCreatePayment: true,
      canSendRequest: false,
      reason: 'missing_deadline',
    });
  });

  it('marks enabled events with fee and deadline eligible', () => {
    const result = getEventPaymentEligibility({
      entryFees: [{ amountCents: 2500, id: 'fee-1' }],
      paymentDeadlineAt: new Date('2026-06-01T13:00:00.000Z'),
      paymentsEnabled: true,
    });

    expect(result).toEqual({
      canCreatePayment: true,
      canSendRequest: true,
      reason: 'eligible',
    });
  });
});

describe('event payment status transitions', () => {
  it('stores stripe ids and receipt url when pending payment becomes paid', () => {
    const result = applyEventPaymentPaidTransition({
      current: { status: PaymentStatus.pending },
      stripeChargeId: 'ch_123',
      stripeCheckoutSessionId: 'cs_123',
      stripeCustomerId: 'cus_123',
      stripePaymentIntentId: 'pi_123',
      stripeReceiptUrl: 'https://pay.stripe.com/receipts/test',
    });

    expect(result).toEqual({
      notificationKind: EventPaymentNotificationKind.receipt,
      shouldCreateReceiptNotification: true,
      update: {
        status: PaymentStatus.paid,
        stripeChargeId: 'ch_123',
        stripeCheckoutSessionId: 'cs_123',
        stripeCustomerId: 'cus_123',
        stripePaymentIntentId: 'pi_123',
        stripeReceiptUrl: 'https://pay.stripe.com/receipts/test',
      },
    });
  });

  it('does not create a second receipt marker for duplicate paid transition', () => {
    const result = applyEventPaymentPaidTransition({
      current: {
        status: PaymentStatus.paid,
        stripeChargeId: 'ch_existing',
        stripeCheckoutSessionId: 'cs_existing',
        stripeCustomerId: 'cus_existing',
        stripePaymentIntentId: 'pi_existing',
        stripeReceiptUrl: 'https://pay.stripe.com/receipts/existing',
      },
      stripeChargeId: 'ch_123',
      stripeCheckoutSessionId: 'cs_123',
      stripeCustomerId: 'cus_123',
      stripePaymentIntentId: 'pi_123',
      stripeReceiptUrl: 'https://pay.stripe.com/receipts/test',
    });

    expect(result.shouldCreateReceiptNotification).toBe(false);
    expect(result.update).toEqual({
      status: PaymentStatus.paid,
      stripeChargeId: 'ch_existing',
      stripeCheckoutSessionId: 'cs_existing',
      stripeCustomerId: 'cus_existing',
      stripePaymentIntentId: 'pi_existing',
      stripeReceiptUrl: 'https://pay.stripe.com/receipts/existing',
    });
  });

  it('rejects stale paid transitions for terminal non-paid statuses', () => {
    expect(() =>
      applyEventPaymentPaidTransition({
        current: { status: PaymentStatus.refunded },
        stripePaymentIntentId: 'pi_123',
      })
    ).toThrow('Event payment status cannot transition to paid.');
  });

  it('prevents paid payments from returning to pending', () => {
    expect(
      eventPaymentStatusCanTransitionTo({
        from: PaymentStatus.paid,
        to: PaymentStatus.pending,
      })
    ).toBe(false);
  });

  it('requires note and admin id for manual handled transition', () => {
    expect(() =>
      buildManualHandledEventPaymentTransition({
        adminUserId: 'admin-1',
        note: '  ',
        now: new Date('2026-06-01T13:00:00.000Z'),
        status: PaymentStatus.pending,
      })
    ).toThrow('Manual handled payments require an internal note.');

    expect(() =>
      buildManualHandledEventPaymentTransition({
        adminUserId: '',
        note: 'Paid by check',
        now: new Date('2026-06-01T13:00:00.000Z'),
        status: PaymentStatus.pending,
      })
    ).toThrow('Manual handled payments require an admin user id.');

    expect(
      buildManualHandledEventPaymentTransition({
        adminUserId: 'admin-1',
        note: ' Paid by check ',
        now: new Date('2026-06-01T13:00:00.000Z'),
        status: PaymentStatus.pending,
      })
    ).toEqual({
      manualHandledAt: new Date('2026-06-01T13:00:00.000Z'),
      manualHandledByUserId: 'admin-1',
      manualHandledNote: 'Paid by check',
      status: PaymentStatus.handled,
    });
  });

  it.each([
    PaymentStatus.refunded,
    PaymentStatus.disputed,
    PaymentStatus.cancelled,
    PaymentStatus.handled,
    PaymentStatus.paid,
  ])('blocks reminders for terminal status %s', (status) => {
    expect(eventPaymentStatusAllowsReminder(status)).toBe(false);
  });
});

describe('event payment reminder and digest timing', () => {
  it('uses America New York date keys', () => {
    expect(
      nyEventPaymentNotificationDateKey(new Date('2026-06-01T03:30:00.000Z'))
    ).toBe('2026-05-31');
  });

  it('runs daily notifications at 7:00 AM America New York', () => {
    expect(
      shouldRunEventPaymentDailyNotifications(
        new Date('2026-06-01T11:00:00.000Z')
      )
    ).toBe(true);
    expect(
      shouldRunEventPaymentDailyNotifications(
        new Date('2026-06-01T10:59:00.000Z')
      )
    ).toBe(false);
    expect(
      shouldRunEventPaymentDailyNotifications(
        new Date('2026-01-05T12:00:00.000Z')
      )
    ).toBe(true);
  });

  it('marks unpaid payments eligible for reminders at seven before the deadline', () => {
    expect(
      eventPaymentNeedsReminder({
        eventStartAt: new Date('2026-06-02T13:00:00.000Z'),
        notificationSentDateKeys: [],
        now: new Date('2026-06-01T11:00:00.000Z'),
        paymentDeadlineAt: new Date('2026-06-01T20:00:00.000Z'),
        status: PaymentStatus.checkout_created,
      })
    ).toBe(true);
  });

  it('keeps overdue unpaid payments eligible for reminders at seven', () => {
    expect(
      eventPaymentNeedsReminder({
        eventStartAt: new Date('2026-06-02T13:00:00.000Z'),
        notificationSentDateKeys: [],
        now: new Date('2026-06-01T11:00:00.000Z'),
        paymentDeadlineAt: new Date('2026-06-01T10:59:00.000Z'),
        status: PaymentStatus.checkout_created,
      })
    ).toBe(true);
  });

  it('skips reminders outside seven or after a same-day marker', () => {
    expect(
      eventPaymentNeedsReminder({
        eventStartAt: new Date('2026-06-02T13:00:00.000Z'),
        notificationSentDateKeys: [],
        now: new Date('2026-06-01T11:01:00.000Z'),
        paymentDeadlineAt: new Date('2026-06-01T10:59:00.000Z'),
        status: PaymentStatus.pending,
      })
    ).toBe(false);
    expect(
      eventPaymentNeedsReminder({
        eventStartAt: new Date('2026-06-02T13:00:00.000Z'),
        notificationSentDateKeys: ['2026-06-01'],
        now: new Date('2026-06-01T11:00:00.000Z'),
        paymentDeadlineAt: new Date('2026-06-01T10:59:00.000Z'),
        status: PaymentStatus.pending,
      })
    ).toBe(false);
  });

  it('marks admin digest eligible for overdue unpaid payments at seven', () => {
    expect(
      eventPaymentSummaryNeedsAdminDigest({
        eventStartAt: new Date('2026-06-02T13:00:00.000Z'),
        notificationSentDateKeys: [],
        now: new Date('2026-06-01T11:00:00.000Z'),
        paymentDeadlineAt: new Date('2026-06-01T10:59:00.000Z'),
        status: PaymentStatus.past_due,
      })
    ).toBe(true);
  });

  it('skips admin digest before the payment deadline', () => {
    expect(
      eventPaymentSummaryNeedsAdminDigest({
        eventStartAt: new Date('2026-06-02T13:00:00.000Z'),
        notificationSentDateKeys: [],
        now: new Date('2026-06-01T11:00:00.000Z'),
        paymentDeadlineAt: new Date('2026-06-01T20:00:00.000Z'),
        status: PaymentStatus.pending,
      })
    ).toBe(false);
  });
});
