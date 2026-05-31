import { describe, expect, it } from 'vitest';
import { SailingAffiliation, SailingCardType } from '@/generated/prisma/enums';
import {
  canRequestPaidRacingMembership,
  membershipAccessForOnboardingRequest,
  membershipAccessForSailingCardUser,
} from '@/libs/mit-sailing/sailingCardMembershipEligibility';

describe('sailing card membership eligibility', () => {
  const baseUser = {
    gymMembershipVerifiedAt: null,
    sailingAffiliation: SailingAffiliation.MIT_ALUM,
  };

  it('grants free normal membership to MIT students', () => {
    expect(
      membershipAccessForSailingCardUser({
        ...baseUser,
        sailingAffiliation: SailingAffiliation.MIT_STUDENT,
      })
    ).toEqual({
      kind: 'free_normal',
      reason: 'automatic_mit_recreation_membership',
    });
  });

  it('grants free normal membership to verified recreation members', () => {
    expect(
      membershipAccessForSailingCardUser({
        ...baseUser,
        gymMembershipVerifiedAt: new Date('2026-05-01T12:00:00.000Z'),
      })
    ).toEqual({
      kind: 'free_normal',
      reason: 'verified_mit_recreation_membership',
    });
  });

  it('keeps self-reported recreation members in pending verification', () => {
    expect(
      membershipAccessForOnboardingRequest({
        ...baseUser,
        hasFitnessMembership: true,
      })
    ).toEqual({ kind: 'pending_recreation_verification' });
  });

  it('allows paid racing only when no free normal membership applies', () => {
    expect(
      canRequestPaidRacingMembership({
        access: membershipAccessForSailingCardUser(baseUser),
        cardType: SailingCardType.racing,
      })
    ).toBe(true);
    expect(
      canRequestPaidRacingMembership({
        access: {
          kind: 'free_normal',
          reason: 'automatic_mit_recreation_membership',
        },
        cardType: SailingCardType.racing,
      })
    ).toBe(false);
    expect(
      canRequestPaidRacingMembership({
        access: membershipAccessForSailingCardUser(baseUser),
        cardType: SailingCardType.normal,
      })
    ).toBe(false);
  });
});
