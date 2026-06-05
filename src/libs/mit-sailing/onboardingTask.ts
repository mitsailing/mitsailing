import 'server-only';
import {
  PaymentPurpose,
  PaymentStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';
import {
  getCurrentSailingCardYear,
  hasCompletedCurrentYearSailingCardRequest,
} from '@/libs/mit-sailing/sailingCardValidity';

const paidCardTypes: ReadonlySet<SailingCardType> = new Set([
  SailingCardType.racing,
  SailingCardType.team_racing,
]);

export async function getOnboardingTaskHrefForUser(options: {
  readonly userId: string;
}): Promise<'/onboarding' | null> {
  const cardYear = getCurrentSailingCardYear();
  const user = await prisma.user.findUnique({
    where: { id: options.userId },
    select: {
      sailingCardRequests: {
        orderBy: { requestedAt: 'desc' },
        take: 1,
        where: { cardYear },
        select: {
          cardYear: true,
          cardType: true,
          legalAgreementAcceptance: {
            select: {
              acceptedUserId: true,
              agreementHash: true,
              agreementVersion: true,
              source: true,
            },
          },
          status: true,
          userId: true,
          user: {
            select: {
              emergencyContactName: true,
              emergencyContactPhone: true,
              phone: true,
            },
          },
        },
      },
    },
  });
  const request = user?.sailingCardRequests.at(0) ?? null;
  if (request === null || !hasCompletedCurrentYearSailingCardRequest(request)) {
    return '/onboarding';
  }
  if (!paidCardTypes.has(request.cardType)) {
    return null;
  }

  const paidPayment = await prisma.payment.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
    where: {
      cardType: request.cardType,
      cardYear,
      purpose: PaymentPurpose.membership,
      status: PaymentStatus.paid,
      userId: options.userId,
    },
  });
  return paidPayment === null ? '/onboarding' : null;
}
