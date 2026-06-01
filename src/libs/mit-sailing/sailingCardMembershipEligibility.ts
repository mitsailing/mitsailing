import { SailingAffiliation, SailingCardType } from '@/generated/prisma/enums';

export type SailingCardMembershipAccess =
  | {
      readonly kind: 'free_normal';
      readonly reason:
        | 'automatic_mit_recreation_membership'
        | 'verified_mit_recreation_membership';
    }
  | { readonly kind: 'pending_recreation_verification' }
  | { readonly kind: 'paid_racing_available' };

type SailingCardMembershipUser = {
  readonly gymMembershipVerifiedAt: Date | null;
  readonly sailingAffiliation: SailingAffiliation | null;
};

type SailingCardMembershipOnboardingRequest = SailingCardMembershipUser & {
  readonly hasFitnessMembership: boolean | null;
};

type SailingCardMembershipUserFlags = {
  readonly hasVerifiedMitRecreationMembership: boolean;
  readonly sailingAffiliation: SailingAffiliation | null;
};

type SailingCardMembershipOnboardingFlags = {
  readonly hasFitnessMembership: boolean | null;
  readonly hasVerifiedMitRecreationMembership?: boolean;
  readonly sailingAffiliation: SailingAffiliation | null;
};

function membershipAccessForSailingCardFlags(
  user: SailingCardMembershipUserFlags
): SailingCardMembershipAccess {
  if (user.sailingAffiliation === SailingAffiliation.MIT_STUDENT) {
    return {
      kind: 'free_normal',
      reason: 'automatic_mit_recreation_membership',
    };
  }
  if (user.hasVerifiedMitRecreationMembership) {
    return {
      kind: 'free_normal',
      reason: 'verified_mit_recreation_membership',
    };
  }
  return { kind: 'paid_racing_available' };
}

export function membershipAccessForSailingCardUser(
  user: SailingCardMembershipUser
): SailingCardMembershipAccess {
  return membershipAccessForSailingCardFlags({
    hasVerifiedMitRecreationMembership: user.gymMembershipVerifiedAt !== null,
    sailingAffiliation: user.sailingAffiliation,
  });
}

export function membershipAccessForOnboardingFlags(
  request: SailingCardMembershipOnboardingFlags
): SailingCardMembershipAccess {
  const verifiedAccess = membershipAccessForSailingCardFlags({
    hasVerifiedMitRecreationMembership:
      request.hasVerifiedMitRecreationMembership === true,
    sailingAffiliation: request.sailingAffiliation,
  });
  if (verifiedAccess.kind !== 'paid_racing_available') {
    return verifiedAccess;
  }
  if (request.hasFitnessMembership === true) {
    return { kind: 'pending_recreation_verification' };
  }
  return verifiedAccess;
}

export function membershipAccessForOnboardingRequest(
  request: SailingCardMembershipOnboardingRequest
): SailingCardMembershipAccess {
  return membershipAccessForOnboardingFlags({
    hasFitnessMembership: request.hasFitnessMembership,
    hasVerifiedMitRecreationMembership:
      request.gymMembershipVerifiedAt !== null,
    sailingAffiliation: request.sailingAffiliation,
  });
}

export function canRequestPaidRacingMembership(props: {
  readonly access: SailingCardMembershipAccess;
  readonly cardType: SailingCardType;
}) {
  return (
    props.access.kind === 'paid_racing_available' &&
    props.cardType !== SailingCardType.normal
  );
}
