import type {
  SailingAffiliation,
  SailingCardType,
} from '@/generated/prisma/enums';
import {
  canRequestPaidRacingMembership,
  membershipAccessForOnboardingFlags,
} from '@/libs/mit-sailing/sailingCardMembershipEligibility';

/**
 * Determines whether a sailing card request must collect membership payment.
 *
 * @param request - Card type, affiliation, and membership evidence
 * @returns Whether the request needs paid membership checkout
 */
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
