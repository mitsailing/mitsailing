import { describe, expect, it, vi } from 'vitest';
import { MitDataWarehousePersonType } from '@/generated/prisma/enums';
import { lookupMitDataWarehouseIdentity } from '@/libs/mit-sailing/mitDataWarehouse';

describe('mitDataWarehouse', () => {
  it('returns normalized identity for matching mit id', async () => {
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

  it('returns null when valid mit id has no warehouse match', async () => {
    const db = {
      mitDataWarehousePerson: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };

    await expect(
      lookupMitDataWarehouseIdentity({
        db,
        mitId: '123456789',
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

  it('returns identity when warehouse kerberos is blank', async () => {
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
      })
    ).resolves.toEqual({
      mitId: '123456789',
      firstName: 'Ada',
      lastName: 'Lovelace',
      kerberos: null,
      classYear: '2027',
      personType: MitDataWarehousePersonType.CURRENT_STUDENT,
    });
  });

  it('returns null for invalid mit id shape', async () => {
    const db = {
      mitDataWarehousePerson: {
        findUnique: vi.fn(),
      },
    };

    await expect(
      lookupMitDataWarehouseIdentity({
        db,
        mitId: 'abc',
      })
    ).resolves.toBeNull();
    expect(db.mitDataWarehousePerson.findUnique).not.toHaveBeenCalled();
  });

  it('returns null for mit id with alphabetic surrounding text', async () => {
    const db = {
      mitDataWarehousePerson: {
        findUnique: vi.fn(),
      },
    };

    await expect(
      lookupMitDataWarehouseIdentity({
        db,
        mitId: 'abc123456789xyz',
      })
    ).resolves.toBeNull();
    expect(db.mitDataWarehousePerson.findUnique).not.toHaveBeenCalled();
  });
});
