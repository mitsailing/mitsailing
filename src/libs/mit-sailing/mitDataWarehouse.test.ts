import { describe, expect, it, vi } from 'vitest';
import { MitDataWarehousePersonType } from '@/generated/prisma/enums';
import {
  lookupMitDataWarehouseIdentity,
  verifiedKerberosFromEmail,
} from '@/libs/mit-sailing/mitDataWarehouse';

describe('mitDataWarehouse', () => {
  it('returns normalized identity for matching mit id', async () => {
    const verifiedKerberos = verifiedKerberosFromEmail({
      email: 'ada@mit.edu',
      emailVerified: true,
    });
    const db = {
      mitDataWarehousePerson: {
        findUnique: vi.fn().mockResolvedValue({
          mitId: '123456789',
          firstName: 'Ada',
          lastName: 'Lovelace',
          kerberos: 'ada',
          classYear: '2027',
          personType: MitDataWarehousePersonType.CURRENT_STUDENT,
        }),
      },
    };

    await expect(
      lookupMitDataWarehouseIdentity({
        db,
        mitId: ' 123-45-6789 ',
        verifiedKerberos,
      })
    ).resolves.toEqual({
      mitId: '123456789',
      firstName: 'Ada',
      lastName: 'Lovelace',
      kerberos: 'ada',
      classYear: '2027',
      personType: MitDataWarehousePersonType.CURRENT_STUDENT,
    });
  });

  it('rejects identity when kerberos does not match email local part', async () => {
    const verifiedKerberos = verifiedKerberosFromEmail({
      email: 'claimant@mit.edu',
      emailVerified: true,
    });
    const db = {
      mitDataWarehousePerson: {
        findUnique: vi.fn().mockResolvedValue({
          mitId: '123456789',
          firstName: 'Ada',
          lastName: 'Lovelace',
          kerberos: 'victim',
          classYear: '2027',
          personType: MitDataWarehousePersonType.CURRENT_STUDENT,
        }),
      },
    };

    await expect(
      lookupMitDataWarehouseIdentity({
        db,
        mitId: '123456789',
        verifiedKerberos,
      })
    ).resolves.toBeNull();
  });

  it('returns null when valid mit id has no warehouse match', async () => {
    const verifiedKerberos = verifiedKerberosFromEmail({
      email: 'ada@mit.edu',
      emailVerified: true,
    });
    const db = {
      mitDataWarehousePerson: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };

    await expect(
      lookupMitDataWarehouseIdentity({
        db,
        mitId: '123456789',
        verifiedKerberos,
      })
    ).resolves.toBeNull();
    expect(db.mitDataWarehousePerson.findUnique).toHaveBeenCalledWith({
      select: {
        classYear: true,
        firstName: true,
        kerberos: true,
        lastName: true,
        mitId: true,
        personType: true,
      },
      where: { mitId: '123456789' },
    });
  });

  it('does not derive kerberos from unverified email', () => {
    expect(
      verifiedKerberosFromEmail({
        email: 'ada@mit.edu',
        emailVerified: false,
      })
    ).toBeNull();
  });

  it('does not derive kerberos from non mit email', () => {
    expect(
      verifiedKerberosFromEmail({
        email: 'ada@gmail.com',
        emailVerified: true,
      })
    ).toBeNull();
  });

  it('does not derive kerberos from malformed email', () => {
    expect(
      verifiedKerberosFromEmail({
        email: 'ada@mit.edu@example.com',
        emailVerified: true,
      })
    ).toBeNull();
  });

  it('derives kerberos from verified mit email', () => {
    expect(
      verifiedKerberosFromEmail({
        email: 'ada@mit.edu',
        emailVerified: true,
      })
    ).toBe('ada');
  });

  it('rejects identity without kerberos', async () => {
    const verifiedKerberos = verifiedKerberosFromEmail({
      email: 'ada@mit.edu',
      emailVerified: true,
    });
    const db = {
      mitDataWarehousePerson: {
        findUnique: vi.fn().mockResolvedValue({
          mitId: '123456789',
          firstName: 'Ada',
          lastName: 'Lovelace',
          kerberos: null,
          classYear: '2027',
          personType: MitDataWarehousePersonType.CURRENT_STUDENT,
        }),
      },
    };

    await expect(
      lookupMitDataWarehouseIdentity({
        db,
        mitId: '123456789',
        verifiedKerberos,
      })
    ).resolves.toBeNull();
  });

  it('rejects identity without verified kerberos', async () => {
    const db = {
      mitDataWarehousePerson: {
        findUnique: vi.fn().mockResolvedValue({
          mitId: '123456789',
          firstName: 'Ada',
          lastName: 'Lovelace',
          kerberos: 'ada',
          classYear: '2027',
          personType: MitDataWarehousePersonType.CURRENT_STUDENT,
        }),
      },
    };

    await expect(
      lookupMitDataWarehouseIdentity({
        db,
        mitId: '123456789',
        verifiedKerberos: null,
      })
    ).resolves.toBeNull();
  });

  it('returns null for invalid mit id shape', async () => {
    const verifiedKerberos = verifiedKerberosFromEmail({
      email: 'ada@mit.edu',
      emailVerified: true,
    });
    const db = {
      mitDataWarehousePerson: {
        findUnique: vi.fn(),
      },
    };

    await expect(
      lookupMitDataWarehouseIdentity({
        db,
        mitId: 'abc',
        verifiedKerberos,
      })
    ).resolves.toBeNull();
    expect(db.mitDataWarehousePerson.findUnique).not.toHaveBeenCalled();
  });

  it('returns null for mit id with alphabetic surrounding text', async () => {
    const verifiedKerberos = verifiedKerberosFromEmail({
      email: 'ada@mit.edu',
      emailVerified: true,
    });
    const db = {
      mitDataWarehousePerson: {
        findUnique: vi.fn(),
      },
    };

    await expect(
      lookupMitDataWarehouseIdentity({
        db,
        mitId: 'abc123456789xyz',
        verifiedKerberos,
      })
    ).resolves.toBeNull();
    expect(db.mitDataWarehousePerson.findUnique).not.toHaveBeenCalled();
  });
});
