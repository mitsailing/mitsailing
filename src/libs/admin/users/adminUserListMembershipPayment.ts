import type { Prisma } from '@/generated/prisma/client';
import {
  PaymentPurpose,
  PaymentStatus,
  SailingCardRequestStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import type {
  PaymentPurpose as PaymentPurposeValue,
  PaymentStatus as PaymentStatusValue,
  SailingCardType as SailingCardTypeValue,
} from '@/generated/prisma/enums';
import { getCurrentSailingCardYear } from '@/libs/mit-sailing/sailingCardValidity';

export type AdminUsersCardTypeFilter =
  | 'all'
  | 'normal'
  | 'racing'
  | 'team_racing';

export type AdminUsersMembershipPaymentStatusFilter =
  | 'all'
  | 'checkout_started'
  | 'paid'
  | 'past_due'
  | 'unpaid';

export type AdminUserMembershipPaymentListStatus =
  | 'checkout_started'
  | 'not_applicable'
  | 'paid'
  | 'past_due'
  | 'unpaid';

const PAID_CARD_TYPES = [
  SailingCardType.racing,
  SailingCardType.team_racing,
] as const;

function currentCardYear() {
  return getCurrentSailingCardYear();
}

function isPaidCardType(cardType: SailingCardTypeValue) {
  return (
    cardType === SailingCardType.racing ||
    cardType === SailingCardType.team_racing
  );
}

/**
 * Derives the membership payment list status for a user row.
 *
 * @param user - Pending requests and current-year membership payments
 * @returns Display status for admin user list
 */
export function adminUserMembershipPaymentListStatus(user: {
  readonly payments: readonly {
    readonly cardType: SailingCardTypeValue | null;
    readonly cardYear: number | null;
    readonly createdAt: Date;
    readonly purpose: PaymentPurposeValue;
    readonly status: PaymentStatusValue;
  }[];
  readonly sailingCardRequests: readonly {
    readonly cardType: SailingCardTypeValue;
    readonly cardYear: number;
    readonly status: SailingCardRequestStatus;
  }[];
}): AdminUserMembershipPaymentListStatus {
  const year = currentCardYear();
  const pendingRequest = user.sailingCardRequests.find(
    (request) =>
      request.cardYear === year &&
      request.status === SailingCardRequestStatus.pending
  );
  if (!pendingRequest || !isPaidCardType(pendingRequest.cardType)) {
    return 'not_applicable';
  }

  const matchingPayments = user.payments
    .filter(
      (payment) =>
        payment.purpose === PaymentPurpose.membership &&
        payment.cardYear === year &&
        payment.cardType === pendingRequest.cardType
    )
    .toSorted(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
    );
  const [latest] = matchingPayments;
  if (!latest) {
    return 'unpaid';
  }
  if (latest.status === PaymentStatus.paid) {
    return 'paid';
  }
  if (latest.status === PaymentStatus.past_due) {
    return 'past_due';
  }
  if (
    latest.status === PaymentStatus.pending ||
    latest.status === PaymentStatus.checkout_created
  ) {
    return 'checkout_started';
  }
  return 'unpaid';
}

/**
 * Returns the pending card type for the current card year, if any.
 *
 * @param user - Pending sailing card requests
 * @returns Pending card type or null
 */
export function pendingCardTypeFromUser(user: {
  readonly sailingCardRequests: readonly {
    readonly cardType: SailingCardTypeValue;
    readonly cardYear: number;
    readonly status: SailingCardRequestStatus;
  }[];
}): SailingCardTypeValue | null {
  const year = currentCardYear();
  const pendingRequest = user.sailingCardRequests.find(
    (request) =>
      request.cardYear === year &&
      request.status === SailingCardRequestStatus.pending
  );
  return pendingRequest?.cardType ?? null;
}

function unpaidMembershipWhere(
  cardTypes: readonly SailingCardTypeValue[]
): Prisma.UserWhereInput {
  const year = currentCardYear();
  return {
    OR: cardTypes.map((cardType) => ({
      sailingCardRequests: {
        some: {
          cardYear: year,
          status: SailingCardRequestStatus.pending,
          cardType,
        },
      },
      payments: {
        none: {
          purpose: PaymentPurpose.membership,
          cardYear: year,
          status: PaymentStatus.paid,
          cardType,
        },
      },
    })),
  };
}

function cardTypesForFilter(
  cardType: AdminUsersCardTypeFilter
): readonly SailingCardTypeValue[] {
  if (cardType === 'all') {
    return PAID_CARD_TYPES;
  }
  return [cardType];
}

/**
 * Builds a Prisma filter for pending-request card type.
 *
 * @param filter - Selected card type filter
 * @returns User where clause or null when unfiltered
 */
export function cardTypeFilterWhere(
  filter: AdminUsersCardTypeFilter
): Prisma.UserWhereInput | null {
  if (filter === 'all') {
    return null;
  }
  return {
    sailingCardRequests: {
      some: {
        cardYear: currentCardYear(),
        status: SailingCardRequestStatus.pending,
        cardType: filter,
      },
    },
  };
}

/**
 * Builds a Prisma filter for membership payment status.
 *
 * @param filter - Selected membership payment filter
 * @param cardType - Optional card type filter scope
 * @returns User where clause or null when unfiltered
 */
export function membershipPaymentStatusFilterWhere(
  filter: AdminUsersMembershipPaymentStatusFilter,
  cardType: AdminUsersCardTypeFilter = 'all'
): Prisma.UserWhereInput | null {
  if (filter === 'all') {
    return null;
  }
  const year = currentCardYear();
  const cardTypes = cardTypesForFilter(cardType);

  if (filter === 'unpaid') {
    if (cardType !== 'all') {
      return {
        sailingCardRequests: {
          some: {
            cardYear: year,
            status: SailingCardRequestStatus.pending,
            cardType,
          },
        },
        payments: {
          none: {
            purpose: PaymentPurpose.membership,
            cardYear: year,
            status: PaymentStatus.paid,
            cardType,
          },
        },
      };
    }
    return unpaidMembershipWhere(cardTypes);
  }
  if (filter === 'checkout_started') {
    return {
      payments: {
        some: {
          purpose: PaymentPurpose.membership,
          cardYear: year,
          status: {
            in: [PaymentStatus.pending, PaymentStatus.checkout_created],
          },
          cardType: { in: [...cardTypes] },
        },
      },
    };
  }
  if (filter === 'past_due') {
    return {
      payments: {
        some: {
          purpose: PaymentPurpose.membership,
          cardYear: year,
          status: PaymentStatus.past_due,
          cardType: { in: [...cardTypes] },
        },
      },
    };
  }
  return {
    payments: {
      some: {
        purpose: PaymentPurpose.membership,
        cardYear: year,
        status: PaymentStatus.paid,
        cardType: { in: [...cardTypes] },
      },
    },
  };
}
