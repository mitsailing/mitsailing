import type { JobsOptions, Queue } from 'bullmq';
import * as z from 'zod';
import {
  EventPaymentNotificationKind,
  PaymentPurpose,
  PaymentStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';
import { sendMembershipPaymentReminderEmail } from '@/libs/email/membership-payment-emails';
import type { SendEmailResult } from '@/libs/email/sendTransactional';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';
import {
  clearNotificationClaim,
  ensureNotificationMarker,
  recordProviderMessageId,
} from './eventPaymentNotificationStore';

export const MEMBERSHIP_PAYMENT_REMINDER_JOB_NAME =
  'membership-payment-reminder';

const membershipPaymentReminderJobSchema = z.object({
  dateKey: z.string().min(1),
  paymentId: z.string().min(1),
});

const MEMBERSHIP_PAYMENT_REMINDER_JOB_OPTS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 60_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
};

type MembershipPaymentReminderJobData = z.infer<
  typeof membershipPaymentReminderJobSchema
>;

type MembershipPaymentReminderQueue = Pick<
  Queue<MembershipPaymentReminderJobData>,
  'add'
>;

type MembershipPaymentReminderPayment = {
  readonly amountCents: number;
  readonly cardType: SailingCardType | null;
  readonly cardYear: number | null;
  readonly currency: string;
  readonly id: string;
  readonly purpose: PaymentPurpose;
  readonly status: PaymentStatus;
  readonly user: { readonly email: string; readonly id: string } | null;
};

type EligibleMembershipPayment = MembershipPaymentReminderPayment & {
  readonly cardYear: number;
  readonly user: { readonly email: string; readonly id: string };
};

const eligibleReminderStatuses: ReadonlySet<PaymentStatus> = new Set([
  PaymentStatus.pending,
  PaymentStatus.checkout_created,
]);

function onboardingUrl(): string {
  return new URL('/onboarding', Env.NEXT_PUBLIC_APP_URL).toString();
}

function membershipCardType(
  value: SailingCardType | null
): 'racing' | 'team_racing' | null {
  if (value === SailingCardType.racing) {
    return 'racing';
  }
  if (value === SailingCardType.team_racing) {
    return 'team_racing';
  }
  return null;
}

function eligibleMembershipPayment(
  payment: MembershipPaymentReminderPayment | null
): payment is EligibleMembershipPayment {
  return (
    payment?.purpose === PaymentPurpose.membership &&
    eligibleReminderStatuses.has(payment.status) &&
    payment.cardYear !== null &&
    Boolean(payment.user?.email)
  );
}

async function findMembershipPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    select: {
      amountCents: true,
      cardType: true,
      cardYear: true,
      currency: true,
      id: true,
      purpose: true,
      status: true,
      user: { select: { email: true, id: true } },
    },
    where: { id: paymentId },
  });
  const cardType = membershipCardType(payment?.cardType ?? null);
  if (!eligibleMembershipPayment(payment) || cardType === null) {
    return null;
  }
  return {
    ...payment,
    cardType,
    cardYear: payment.cardYear,
    user: payment.user,
  };
}

export async function enqueueMembershipPaymentReminderJob(
  queue: MembershipPaymentReminderQueue,
  data: MembershipPaymentReminderJobData
): Promise<void> {
  await queue.add(MEMBERSHIP_PAYMENT_REMINDER_JOB_NAME, data, {
    ...MEMBERSHIP_PAYMENT_REMINDER_JOB_OPTS,
    jobId: `${MEMBERSHIP_PAYMENT_REMINDER_JOB_NAME}:${data.paymentId}:${data.dateKey}`,
  });
}

async function sendReminderForPayment(options: {
  readonly dateKey: string;
  readonly marker: { readonly claimId: string; readonly id: string };
  readonly payment: NonNullable<
    Awaited<ReturnType<typeof findMembershipPayment>>
  >;
}) {
  try {
    return await sendMembershipPaymentReminderEmail({
      amount: formatUsdMinorUnitsAsCurrency(
        options.payment.amountCents,
        'en-US'
      ),
      cardType: options.payment.cardType,
      cardYear: options.payment.cardYear,
      emailDedupeKey: `${options.payment.id}:${options.dateKey}`,
      onboardingUrl: onboardingUrl(),
      paymentId: options.payment.id,
      recipientEmail: options.payment.user.email,
      userId: options.payment.user.id,
    });
  } catch (error) {
    await clearNotificationClaim({
      claimId: options.marker.claimId,
      notificationId: options.marker.id,
    });
    throw error;
  }
}

export async function processMembershipPaymentReminderJob(
  data: unknown
): Promise<void> {
  const params = membershipPaymentReminderJobSchema.parse(data);
  try {
    const payment = await findMembershipPayment(params.paymentId);
    if (!payment) {
      return;
    }
    const marker = await ensureNotificationMarker({
      dateKey: params.dateKey,
      kind: EventPaymentNotificationKind.reminder,
      paymentId: payment.id,
    });
    if (!marker) {
      return;
    }

    const result: SendEmailResult = await sendReminderForPayment({
      dateKey: params.dateKey,
      marker,
      payment,
    });
    await recordProviderMessageId({
      claimId: marker.claimId,
      notificationId: marker.id,
      providerMessageId: result.providerMessageId,
    });
  } catch (error) {
    logger.error(
      '[membership-payment-reminder] error_name={errorName} error_code={errorCode}',
      {
        errorCode: safeErrorCode(error) ?? 'unknown',
        errorName: safeErrorName(error),
      }
    );
    throw error;
  }
}
