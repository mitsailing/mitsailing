'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import {
  MitDataWarehousePersonType,
  SailingAffiliation,
  SailingCardRequestStatus,
} from '@/generated/prisma/enums';
import { getSession } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import {
  lookupMitDataWarehouseIdentity,
  verifiedKerberosFromEmail,
} from '@/libs/mit-sailing/mitDataWarehouse';
import {
  normalizeManualPersonName,
  normalizeVerifiedMitDataWarehousePersonName,
} from '@/libs/mit-sailing/personName';
import {
  getSailingAffiliationOptions,
  getSailingAffiliationRule,
} from '@/libs/mit-sailing/sailingAffiliations';
import { getCurrentSailingCardYear } from '@/libs/mit-sailing/sailingCardValidity';
import { getI18nPath } from '@/utils/Helpers';

type ProfileIdentity = {
  readonly affiliation: SailingAffiliation;
  readonly firstName: string;
  readonly lastName: string;
  readonly mitClassYear: string | null;
  readonly mitId: string | null;
  readonly name: string;
  readonly lockedByMitId: boolean;
};

type ProfileIdentityInput = {
  readonly affiliation: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly mitId: string;
};

type CurrentProfileIdentityUser = {
  readonly email: string;
  readonly emailVerified: boolean;
  readonly mitDataWarehouseVerifiedAt: Date | null;
  readonly mitId: string | null;
  readonly sailingAffiliation: SailingAffiliation | null;
};

export type UpdateProfileIdentityResult =
  | { ok: true; identity: ProfileIdentity }
  | {
      ok: false;
      error:
        | 'affiliation_mismatch'
        | 'affiliation_required'
        | 'first_name_required'
        | 'identity_locked'
        | 'last_name_required'
        | 'mit_id_duplicate'
        | 'mit_id_invalid'
        | 'mit_id_required'
        | 'unauthorized';
    };

const parseProfileAffiliation = (value: string) =>
  getSailingAffiliationOptions().find((option) => option.value === value)
    ?.value ?? null;

const validatesAffiliation = (props: {
  readonly affiliation: SailingAffiliation;
  readonly personType: MitDataWarehousePersonType;
}) => {
  if (props.affiliation === SailingAffiliation.MIT_STUDENT) {
    return props.personType === MitDataWarehousePersonType.CURRENT_STUDENT;
  }
  if (
    props.affiliation === SailingAffiliation.MIT_FACULTY ||
    props.affiliation === SailingAffiliation.MIT_STAFF
  ) {
    return props.personType === MitDataWarehousePersonType.CURRENT_STAFF;
  }
  return true;
};

const uniqueConstraintTargets = (
  error: Prisma.PrismaClientKnownRequestError
) => {
  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.filter((value) => typeof value === 'string');
  }
  return typeof target === 'string' ? [target] : [];
};

const isMitIdUniqueConstraintTarget = (target: string) =>
  target === 'mitId' ||
  target === 'mit_id' ||
  target.includes('mitId') ||
  target.includes('mit_id');

const isUniqueMitIdConflict = (error: unknown) => {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }
  return uniqueConstraintTargets(error).some(isMitIdUniqueConstraintTarget);
};

const hasLinkedMitIdentity = (user: CurrentProfileIdentityUser) =>
  user.mitId !== null && user.mitDataWarehouseVerifiedAt !== null;

const isLockedIdentityChange = (props: {
  readonly affiliation: SailingAffiliation;
  readonly currentUser: CurrentProfileIdentityUser;
  readonly linkedMitIdentity: boolean;
}) =>
  props.linkedMitIdentity &&
  props.currentUser.sailingAffiliation !== null &&
  props.affiliation !== props.currentUser.sailingAffiliation;

function manualProfileIdentity(props: {
  readonly affiliation: SailingAffiliation;
  readonly input: ProfileIdentityInput;
}): UpdateProfileIdentityResult {
  const personName = normalizeManualPersonName({
    firstName: props.input.firstName,
    lastName: props.input.lastName,
  });
  if (personName.firstName === '') {
    return { ok: false, error: 'first_name_required' };
  }
  if (personName.lastName === '') {
    return { ok: false, error: 'last_name_required' };
  }
  return {
    identity: {
      affiliation: props.affiliation,
      firstName: personName.firstName,
      lastName: personName.lastName,
      lockedByMitId: false,
      mitClassYear: null,
      mitId: null,
      name: personName.name,
    },
    ok: true,
  };
}

async function verifiedMitProfileIdentity(props: {
  readonly affiliation: SailingAffiliation;
  readonly mitId: string;
  readonly verifiedKerberos: string | null;
}): Promise<UpdateProfileIdentityResult> {
  const dataWarehouseIdentity = await lookupMitDataWarehouseIdentity({
    mitId: props.mitId,
    verifiedKerberos: props.verifiedKerberos,
  });
  if (dataWarehouseIdentity === null) {
    return { ok: false, error: 'mit_id_invalid' };
  }
  if (
    !validatesAffiliation({
      affiliation: props.affiliation,
      personType: dataWarehouseIdentity.personType,
    })
  ) {
    return { ok: false, error: 'affiliation_mismatch' };
  }
  const personName = normalizeVerifiedMitDataWarehousePersonName(
    dataWarehouseIdentity
  );
  return {
    identity: {
      affiliation: props.affiliation,
      firstName: personName.firstName,
      lastName: personName.lastName,
      lockedByMitId: true,
      mitClassYear: dataWarehouseIdentity.classYear,
      mitId: dataWarehouseIdentity.mitId,
      name: personName.name,
    },
    ok: true,
  };
}

function profileIdentityForInput(props: {
  readonly affiliation: SailingAffiliation;
  readonly currentUser: CurrentProfileIdentityUser;
  readonly input: ProfileIdentityInput;
  readonly linkedMitIdentity: boolean;
  readonly rule: ReturnType<typeof getSailingAffiliationRule>;
}): Promise<UpdateProfileIdentityResult> | UpdateProfileIdentityResult {
  const verifiedKerberos = verifiedKerberosFromEmail({
    email: props.currentUser.email,
    emailVerified: props.currentUser.emailVerified,
  });
  const requestedMitId = props.linkedMitIdentity
    ? (props.currentUser.mitId ?? '')
    : props.input.mitId;
  const hasMitIdInput = requestedMitId.trim() !== '';
  const shouldVerifyMitId =
    props.rule.mitIdMode === 'required' ||
    (props.rule.mitIdMode === 'optional' && hasMitIdInput);
  if (!shouldVerifyMitId) {
    return manualProfileIdentity({
      affiliation: props.affiliation,
      input: props.input,
    });
  }
  if (!hasMitIdInput) {
    return { ok: false, error: 'mit_id_required' };
  }
  return verifiedMitProfileIdentity({
    affiliation: props.affiliation,
    mitId: requestedMitId,
    verifiedKerberos,
  });
}

async function persistProfileIdentity(props: {
  readonly identity: ProfileIdentity;
  readonly userId: string;
}) {
  const identityVerifiedAt = props.identity.lockedByMitId ? new Date() : null;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      data: {
        firstName: props.identity.firstName,
        lastName: props.identity.lastName,
        mitClassYear: props.identity.mitClassYear,
        mitDataWarehouseVerifiedAt: identityVerifiedAt,
        mitId: props.identity.mitId,
        name: props.identity.name,
        sailingAffiliation: props.identity.affiliation,
      },
      where: { id: props.userId },
    });
    await tx.sailingCardRequest.updateMany({
      data: {
        firstName: props.identity.firstName,
        lastName: props.identity.lastName,
        mitClassYear: props.identity.mitClassYear,
        mitId: props.identity.mitId,
        sailingAffiliation: props.identity.affiliation,
      },
      where: {
        cardYear: getCurrentSailingCardYear(),
        status: SailingCardRequestStatus.pending,
        userId: props.userId,
      },
    });
  });
}

export async function updateProfileIdentityAction(
  locale: string,
  input: ProfileIdentityInput
): Promise<UpdateProfileIdentityResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: 'unauthorized' };
  }

  const currentUser = await prisma.user.findUnique({
    select: {
      email: true,
      emailVerified: true,
      mitDataWarehouseVerifiedAt: true,
      mitId: true,
      sailingAffiliation: true,
    },
    where: { id: session.user.id },
  });
  if (!currentUser) {
    return { ok: false, error: 'unauthorized' };
  }

  const affiliation = parseProfileAffiliation(input.affiliation);
  if (affiliation === null) {
    return { ok: false, error: 'affiliation_required' };
  }

  const rule = getSailingAffiliationRule(affiliation);
  const linkedMitIdentity = hasLinkedMitIdentity(currentUser);
  if (
    isLockedIdentityChange({
      affiliation,
      currentUser,
      linkedMitIdentity,
    })
  ) {
    return { ok: false, error: 'identity_locked' };
  }
  if (linkedMitIdentity && rule.mitIdMode === 'hidden') {
    return { ok: false, error: 'identity_locked' };
  }

  const identityResult = await profileIdentityForInput({
    affiliation,
    currentUser,
    input,
    linkedMitIdentity,
    rule,
  });
  if (!identityResult.ok) {
    return identityResult;
  }

  try {
    await persistProfileIdentity({
      identity: identityResult.identity,
      userId: session.user.id,
    });
  } catch (error) {
    if (isUniqueMitIdConflict(error)) {
      return { ok: false, error: 'mit_id_duplicate' };
    }
    throw error;
  }

  revalidatePath(getI18nPath('/profile', locale));
  return { identity: identityResult.identity, ok: true };
}
