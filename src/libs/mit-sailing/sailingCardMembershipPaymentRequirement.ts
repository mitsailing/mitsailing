import type {
  SailingAffiliation,
  SailingCardType,
} from '@/generated/prisma/enums';
import {
  canRequestPaidRacingMembership,
  membershipAccessForOnboardingFlags,
} from '@/libs/mit-sailing/sailingCardMembershipEligibility';

export function sailingCardRequestNeedsMembershipPayment(request: {
  readonly cardType: SailingCardType;
  readonly hasFitnessMembership: boolean | null;
  readonly sailingAffiliation: SailingAffiliation | null;
  readonly user: {
    readonly gymMembershipVerifiedAt: Date | null;
  };
}) {
  const access = membershipAccessForOnboardingFlags({
    hasFitnessMembership: request.hasFitnessMembership,
    hasVerifiedMitRecreationMembership:
      request.user.gymMembershipVerifiedAt !== null,
    sailingAffiliation: request.sailingAffiliation,
  });

  return canRequestPaidRacingMembership({
    access,
    cardType: request.cardType,
  });
}
