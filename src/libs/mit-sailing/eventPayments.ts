import {
  EventPaymentNotificationKind,
  PaymentStatus,
} from '@/generated/prisma/enums';
import type { PaymentStatus as PaymentStatusType } from '@/generated/prisma/enums';
import { EVENTS_TIME_ZONE, nyYmd } from '@/lib/mit-sailing/nyTime';

export type EventPaymentEligibilityReason =
  | 'eligible'
  | 'missing_deadline'
  | 'no_fee'
  | 'payments_disabled';

export type EventPaymentEligibility = {
  canCreatePayment: boolean;
  canSendRequest: boolean;
  reason: EventPaymentEligibilityReason;
};

type EventPaymentEligibilityInput = {
  entryFees: readonly { amountCents: number; id: string }[];
  paymentDeadlineAt: Date | null;
  paymentsEnabled: boolean;
};

type PaidTransitionCurrentPayment = {
  status: PaymentStatusType;
  stripeChargeId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeCustomerId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeReceiptUrl?: string | null;
};

type PaidTransitionInput = {
  current: PaidTransitionCurrentPayment;
  stripeChargeId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeCustomerId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeReceiptUrl?: string | null;
};

type PaidTransitionUpdate = {
  status: typeof PaymentStatus.paid;
  stripeChargeId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeCustomerId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeReceiptUrl?: string | null;
};

type ReminderEligibilityInput = {
  eventStartAt?: Date | null;
  notificationSentDateKeys: readonly string[];
  now: Date;
  paymentDeadlineAt: Date | null;
  status: PaymentStatusType;
};

const notificationTimeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  hour12: false,
  minute: '2-digit',
  timeZone: EVENTS_TIME_ZONE,
});

const terminalStatuses = new Set<PaymentStatusType>([
  PaymentStatus.cancelled,
  PaymentStatus.disputed,
  PaymentStatus.handled,
  PaymentStatus.paid,
  PaymentStatus.refunded,
]);

const reminderStatuses = new Set<PaymentStatusType>([
  PaymentStatus.checkout_created,
  PaymentStatus.past_due,
  PaymentStatus.pending,
]);

export function getEventPaymentEligibility(
  input: EventPaymentEligibilityInput
): EventPaymentEligibility {
  if (!input.paymentsEnabled) {
    return {
      canCreatePayment: false,
      canSendRequest: false,
      reason: 'payments_disabled',
    };
  }

  if (!input.entryFees.some((fee) => fee.amountCents > 0)) {
    return {
      canCreatePayment: false,
      canSendRequest: false,
      reason: 'no_fee',
    };
  }

  if (!input.paymentDeadlineAt) {
    return {
      canCreatePayment: true,
      canSendRequest: false,
      reason: 'missing_deadline',
    };
  }

  return {
    canCreatePayment: true,
    canSendRequest: true,
    reason: 'eligible',
  };
}

export function eventPaymentStatusCanTransitionTo(options: {
  from: PaymentStatusType;
  to: PaymentStatusType;
}): boolean {
  if (options.from === options.to) {
    return true;
  }
  if (terminalStatuses.has(options.from)) {
    return false;
  }
  if (options.from === PaymentStatus.paid) {
    return false;
  }
  return true;
}

function keepExistingStripeValue(
  current: string | null | undefined,
  next: string | null | undefined
): string | null | undefined {
  return current ?? next;
}

export function applyEventPaymentPaidTransition(input: PaidTransitionInput): {
  notificationKind: typeof EventPaymentNotificationKind.receipt;
  shouldCreateReceiptNotification: boolean;
  update: PaidTransitionUpdate;
} {
  if (
    input.current.status !== PaymentStatus.paid &&
    !eventPaymentStatusCanTransitionTo({
      from: input.current.status,
      to: PaymentStatus.paid,
    })
  ) {
    throw new TypeError('Event payment status cannot transition to paid.');
  }

  const update: PaidTransitionUpdate = {
    status: PaymentStatus.paid,
    stripeChargeId: keepExistingStripeValue(
      input.current.stripeChargeId,
      input.stripeChargeId
    ),
    stripeCheckoutSessionId: keepExistingStripeValue(
      input.current.stripeCheckoutSessionId,
      input.stripeCheckoutSessionId
    ),
    stripeCustomerId: keepExistingStripeValue(
      input.current.stripeCustomerId,
      input.stripeCustomerId
    ),
    stripePaymentIntentId: keepExistingStripeValue(
      input.current.stripePaymentIntentId,
      input.stripePaymentIntentId
    ),
    stripeReceiptUrl: keepExistingStripeValue(
      input.current.stripeReceiptUrl,
      input.stripeReceiptUrl
    ),
  };

  return {
    notificationKind: EventPaymentNotificationKind.receipt,
    shouldCreateReceiptNotification:
      input.current.status !== PaymentStatus.paid,
    update,
  };
}

export function buildManualHandledEventPaymentTransition(options: {
  adminUserId: string;
  note: string;
  now: Date;
  status: PaymentStatusType;
}): {
  manualHandledAt: Date;
  manualHandledByUserId: string;
  manualHandledNote: string;
  status: typeof PaymentStatus.handled;
} {
  const note = options.note.trim();
  const adminUserId = options.adminUserId.trim();
  if (!note) {
    throw new TypeError('Manual handled payments require an internal note.');
  }
  if (!adminUserId) {
    throw new TypeError('Manual handled payments require an admin user id.');
  }
  if (
    !eventPaymentStatusCanTransitionTo({
      from: options.status,
      to: PaymentStatus.handled,
    })
  ) {
    throw new TypeError('Event payment status cannot transition to handled.');
  }
  return {
    manualHandledAt: options.now,
    manualHandledByUserId: adminUserId,
    manualHandledNote: note,
    status: PaymentStatus.handled,
  };
}

export function eventPaymentStatusAllowsReminder(
  status: PaymentStatusType
): boolean {
  return reminderStatuses.has(status);
}

export function nyEventPaymentNotificationDateKey(now: Date): string {
  return nyYmd(now);
}

function nyHourMinute(now: Date): { hour: number; minute: number } {
  const parts = notificationTimeFormatter.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? Number.NaN);
  return {
    hour: get('hour'),
    minute: get('minute'),
  };
}

export function shouldRunEventPaymentDailyNotifications(now: Date): boolean {
  const parts = nyHourMinute(now);
  return parts.hour === 7 && parts.minute === 0;
}

function isOverdue(input: ReminderEligibilityInput): boolean {
  return (
    input.paymentDeadlineAt !== null &&
    input.paymentDeadlineAt.getTime() <= input.now.getTime()
  );
}

function isBeforeEventStart(input: ReminderEligibilityInput): boolean {
  return (
    !input.eventStartAt || input.eventStartAt.getTime() > input.now.getTime()
  );
}

function isBasePaymentNotificationEligible(
  input: ReminderEligibilityInput
): boolean {
  const dateKey = nyEventPaymentNotificationDateKey(input.now);
  return (
    shouldRunEventPaymentDailyNotifications(input.now) &&
    eventPaymentStatusAllowsReminder(input.status) &&
    isBeforeEventStart(input) &&
    !input.notificationSentDateKeys.includes(dateKey)
  );
}

export function eventPaymentNeedsReminder(
  input: ReminderEligibilityInput
): boolean {
  return isBasePaymentNotificationEligible(input);
}

export function eventPaymentSummaryNeedsAdminDigest(
  input: ReminderEligibilityInput
): boolean {
  return isBasePaymentNotificationEligible(input) && isOverdue(input);
}
