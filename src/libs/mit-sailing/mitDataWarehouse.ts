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

/**
 * Looks up a warehouse identity by MIT ID.
 *
 * @param props - MIT ID and optional Prisma client override
 * @returns Matching warehouse identity, or null when the ID is invalid or missing
 */
export async function lookupMitDataWarehouseIdentity(props: {
  readonly db?: MitDataWarehouseDb;
  readonly mitId: string;
}) {
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
  return identity;
}
