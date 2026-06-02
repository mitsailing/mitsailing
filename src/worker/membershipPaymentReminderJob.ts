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
  if (
    !payment ||
    payment.purpose !== PaymentPurpose.membership ||
    !eligibleReminderStatuses.has(payment.status) ||
    cardType === null ||
    payment.cardYear === null ||
    !payment.user?.email
  ) {
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

    let result: SendEmailResult;
    try {
      result = await sendMembershipPaymentReminderEmail({
        amount: formatUsdMinorUnitsAsCurrency(payment.amountCents, 'en-US'),
        cardType: payment.cardType,
        cardYear: payment.cardYear,
        emailDedupeKey: `${payment.id}:${params.dateKey}`,
        onboardingUrl: onboardingUrl(),
        paymentId: payment.id,
        recipientEmail: payment.user.email,
        userId: payment.user.id,
      });
    } catch (error) {
      await clearNotificationClaim({
        claimId: marker.claimId,
        notificationId: marker.id,
      });
      throw error;
    }
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
