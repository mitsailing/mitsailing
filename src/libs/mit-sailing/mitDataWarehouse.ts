import type { MitDataWarehousePersonType } from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';

export type MitDataWarehouseIdentity = {
  readonly mitId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly kerberos: string | null;
  readonly classYear: string | null;
  readonly personType: MitDataWarehousePersonType;
};

type MitDataWarehouseDb = {
  readonly mitDataWarehousePerson: {
    readonly findUnique: (args: {
      readonly where: { readonly mitId: string };
      readonly select: {
        readonly mitId: true;
        readonly firstName: true;
        readonly lastName: true;
        readonly kerberos: true;
        readonly classYear: true;
        readonly personType: true;
      };
    }) => Promise<MitDataWarehouseIdentity | null>;
  };
};

export const normalizeMitId = (mitId: string) => {
  const trimmed = mitId.trim();
  if (!/^\d{3}[-\s]?\d{2}[-\s]?\d{4}$/.test(trimmed)) {
    return null;
  }

  const normalized = trimmed.replaceAll(/[-\s]/g, '');
  return normalized.length === 9 ? normalized : null;
};

const doesVerifiedKerberosMatch = (
  dataWarehouseKerberos: string | null,
  verifiedKerberos: string | null
) => {
  if (dataWarehouseKerberos === null || verifiedKerberos === null) {
    return false;
  }

  return (
    dataWarehouseKerberos.trim().toLowerCase() ===
    verifiedKerberos.trim().toLowerCase()
  );
};

export const lookupMitDataWarehouseIdentity = async (props: {
  readonly db?: MitDataWarehouseDb;
  readonly mitId: string;
  readonly verifiedKerberos: string | null;
}) => {
  const normalizedMitId = normalizeMitId(props.mitId);

  if (normalizedMitId === null) {
    return null;
  }

  const db = props.db ?? prisma;

  const identity = await db.mitDataWarehousePerson.findUnique({
    where: { mitId: normalizedMitId },
    select: {
      mitId: true,
      firstName: true,
      lastName: true,
      kerberos: true,
      classYear: true,
      personType: true,
    },
  });

  if (identity === null) {
    return null;
  }

  if (!doesVerifiedKerberosMatch(identity.kerberos, props.verifiedKerberos)) {
    return null;
  }

  return identity;
};

export const verifiedKerberosFromEmail = (props: {
  readonly email: string | null;
  readonly emailVerified: boolean;
}) => {
  if (!props.emailVerified || props.email === null) {
    return null;
  }

  const emailParts = props.email.split('@');
  if (emailParts.length !== 2) {
    return null;
  }

  const [localPart = '', domain = ''] = emailParts;
  if (domain.trim().toLowerCase() !== 'mit.edu') {
    return null;
  }

  const kerberos = localPart.trim().toLowerCase();
  return kerberos === '' ? null : kerberos;
};
