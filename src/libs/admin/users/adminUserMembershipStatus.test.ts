import { describe, expect, it } from 'vitest';
import { adminUserMembershipBlockers } from '@/libs/admin/users/adminUserMembershipStatus';

describe('adminUserMembershipBlockers', () => {
  it('returns payment blocker before card issuance', () => {
    expect(
      adminUserMembershipBlockers({
        cardRequest: { cardType: 'racing' },
        introClassRequired: false,
        membershipAccess: {
          access: 'blocked',
          blocker: 'payment_disputed',
        },
        recreationVerificationRequired: false,
      })
    ).toEqual([
      {
        href: '#membership-payment-status',
        key: 'admin_user_blocker_payment_disputed',
        tone: 'error',
      },
    ]);
  });

  it('returns prerequisite blockers without actions', () => {
    expect(
      adminUserMembershipBlockers({
        cardRequest: { cardType: 'normal' },
        introClassRequired: true,
        membershipAccess: { access: 'none' },
        recreationVerificationRequired: true,
      })
    ).toEqual([
      {
        href: '#sailing-card-status',
        key: 'admin_user_blocker_mit_recreation',
        tone: 'warning',
      },
      {
        href: '#sailing-card-status',
        key: 'admin_user_blocker_intro_class',
        tone: 'warning',
      },
    ]);
  });
});
