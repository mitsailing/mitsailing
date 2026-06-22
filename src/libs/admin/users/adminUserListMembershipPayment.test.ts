import { describe, expect, it } from 'vitest';
import {
  PaymentPurpose,
  PaymentStatus,
  SailingCardRequestStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import {
  adminUserMembershipPaymentListStatus,
  cardTypeFilterWhere,
  membershipPaymentStatusFilterWhere,
  pendingCardTypeFromUser,
} from '@/libs/admin/users/adminUserListMembershipPayment';
import { getCurrentSailingCardYear } from '@/libs/mit-sailing/sailingCardValidity';

const cardYear = getCurrentSailingCardYear();

describe('adminUserMembershipPaymentListStatus', () => {
  it('returns not applicable without a paid-card pending request', () => {
    expect(
      adminUserMembershipPaymentListStatus({
        payments: [],
        sailingCardRequests: [
          {
            cardType: SailingCardType.normal,
            cardYear,
            status: SailingCardRequestStatus.pending,
          },
        ],
      })
    ).toBe('not_applicable');
  });

  it('returns unpaid when racing request has no membership payment', () => {
    expect(
      adminUserMembershipPaymentListStatus({
        payments: [],
        sailingCardRequests: [
          {
            cardType: SailingCardType.racing,
            cardYear,
            status: SailingCardRequestStatus.pending,
          },
        ],
      })
    ).toBe('unpaid');
  });

  it('returns checkout started for pending membership payment', () => {
    expect(
      adminUserMembershipPaymentListStatus({
        payments: [
          {
            cardType: SailingCardType.racing,
            cardYear,
            createdAt: new Date('2026-01-02T00:00:00.000Z'),
            purpose: PaymentPurpose.membership,
            status: PaymentStatus.checkout_created,
          },
        ],
        sailingCardRequests: [
          {
            cardType: SailingCardType.racing,
            cardYear,
            status: SailingCardRequestStatus.pending,
          },
        ],
      })
    ).toBe('checkout_started');
  });
});

describe('pendingCardTypeFromUser', () => {
  it('returns the current-year pending card type', () => {
    expect(
      pendingCardTypeFromUser({
        sailingCardRequests: [
          {
            cardType: SailingCardType.team_racing,
            cardYear,
            status: SailingCardRequestStatus.pending,
          },
        ],
      })
    ).toBe(SailingCardType.team_racing);
  });
});

describe('membershipPaymentStatusFilterWhere', () => {
  it('builds unpaid filter scoped to card type', () => {
    expect(membershipPaymentStatusFilterWhere('unpaid', 'racing')).toEqual({
      payments: {
        none: {
          cardType: 'racing',
          cardYear,
          purpose: PaymentPurpose.membership,
          status: PaymentStatus.paid,
        },
      },
      sailingCardRequests: {
        some: {
          cardType: 'racing',
          cardYear,
          status: SailingCardRequestStatus.pending,
        },
      },
    });
  });
});

describe('cardTypeFilterWhere', () => {
  it('returns null for all', () => {
    expect(cardTypeFilterWhere('all')).toBeNull();
  });
});
