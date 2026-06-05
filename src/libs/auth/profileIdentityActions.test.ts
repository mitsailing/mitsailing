import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma/client';
import {
  MitDataWarehousePersonType,
  SailingAffiliation,
  SailingCardRequestStatus,
} from '@/generated/prisma/enums';
import type * as MitDataWarehouseModule from '@/libs/mit-sailing/mitDataWarehouse';

const {
  getI18nPath,
  getSession,
  lookupMitDataWarehouseIdentity,
  revalidatePath,
  sailingCardRequestUpdateMany,
  userFindUnique,
  userUpdate,
  transaction,
} = vi.hoisted(() => ({
  getI18nPath: vi.fn((url: string) => url),
  getSession: vi.fn(),
  lookupMitDataWarehouseIdentity: vi.fn(),
  revalidatePath: vi.fn(),
  sailingCardRequestUpdateMany: vi.fn(),
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath,
}));

vi.mock('@/libs/auth/dal', () => ({
  getSession,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    $transaction: transaction,
    sailingCardRequest: {
      updateMany: sailingCardRequestUpdateMany,
    },
    user: {
      findUnique: userFindUnique,
      update: userUpdate,
    },
  },
}));

vi.mock('@/libs/mit-sailing/mitDataWarehouse', async (importOriginal) => {
  const actual = await importOriginal<typeof MitDataWarehouseModule>();
  return {
    ...actual,
    lookupMitDataWarehouseIdentity,
  };
});

vi.mock('@/libs/mit-sailing/sailingCardValidity', () => ({
  getCurrentSailingCardYear: () => 2026,
}));

vi.mock('@/utils/Helpers', () => ({
  getI18nPath,
}));

type ProfileIdentityTestTx = {
  readonly sailingCardRequest: {
    readonly updateMany: typeof sailingCardRequestUpdateMany;
  };
  readonly user: {
    readonly update: typeof userUpdate;
  };
};

beforeEach(() => {
  getI18nPath.mockReset();
  getSession.mockReset();
  lookupMitDataWarehouseIdentity.mockReset();
  revalidatePath.mockReset();
  sailingCardRequestUpdateMany.mockReset();
  transaction.mockReset();
  userFindUnique.mockReset();
  userUpdate.mockReset();

  getI18nPath.mockImplementation((url: string) => url);
  getSession.mockResolvedValue({ user: { id: 'user-1' } });
  userFindUnique.mockResolvedValue({
    email: 'sailor@example.com',
    emailVerified: true,
    mitDataWarehouseVerifiedAt: null,
    mitId: null,
    sailingAffiliation: null,
  });
  transaction.mockImplementation(
    async (operation: (tx: ProfileIdentityTestTx) => Promise<unknown>) => {
      await Promise.resolve();
      return operation({
        sailingCardRequest: {
          updateMany: sailingCardRequestUpdateMany,
        },
        user: {
          update: userUpdate,
        },
      });
    }
  );
  userUpdate.mockResolvedValue({});
  sailingCardRequestUpdateMany.mockResolvedValue({ count: 1 });
});

describe('updateProfileIdentityAction', () => {
  it('stores profile details and pending sailing-card snapshots together', async () => {
    const { updateProfileDetailsAction } =
      await import('@/libs/auth/profileIdentityActions');

    await expect(
      updateProfileDetailsAction('en', {
        affiliation: SailingAffiliation.WELLESLEY,
        emergencyContactName: '  Jane Sailor  ',
        emergencyContactPhone: '+44 20 7946 0958',
        firstName: ' Grace ',
        lastName: ' Hopper ',
        mitId: '',
        phone: '(617) 555-0100',
      })
    ).resolves.toEqual({
      ok: true,
      identity: {
        affiliation: SailingAffiliation.WELLESLEY,
        firstName: 'Grace',
        lastName: 'Hopper',
        lockedByMitId: false,
        mitClassYear: null,
        mitId: null,
        name: 'Grace Hopper',
      },
    });

    expect(userUpdate).toHaveBeenCalledWith({
      data: {
        emergencyContactName: 'Jane Sailor',
        emergencyContactPhone: '+442079460958',
        firstName: 'Grace',
        lastName: 'Hopper',
        mitClassYear: null,
        mitDataWarehouseVerifiedAt: null,
        mitId: null,
        name: 'Grace Hopper',
        phone: '+16175550100',
        sailingAffiliation: SailingAffiliation.WELLESLEY,
      },
      where: { id: 'user-1' },
    });
    expect(sailingCardRequestUpdateMany).toHaveBeenCalledWith({
      data: {
        firstName: 'Grace',
        lastName: 'Hopper',
        mitClassYear: null,
        mitId: null,
        sailingAffiliation: SailingAffiliation.WELLESLEY,
      },
      where: {
        cardYear: 2026,
        status: SailingCardRequestStatus.pending,
        userId: 'user-1',
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/profile');
  });

  it('rejects invalid profile detail contact fields before persistence', async () => {
    const { updateProfileDetailsAction } =
      await import('@/libs/auth/profileIdentityActions');

    await expect(
      updateProfileDetailsAction('en', {
        affiliation: SailingAffiliation.WELLESLEY,
        emergencyContactName: 'Jane Sailor',
        emergencyContactPhone: '555',
        firstName: 'Grace',
        lastName: 'Hopper',
        mitId: '',
        phone: '(617) 555-0100',
      })
    ).resolves.toEqual({
      ok: false,
      error: 'invalid_emergency_phone',
    });

    expect(userUpdate).not.toHaveBeenCalled();
    expect(sailingCardRequestUpdateMany).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects missing profile emergency contact fields before persistence', async () => {
    const { updateProfileDetailsAction } =
      await import('@/libs/auth/profileIdentityActions');

    await expect(
      updateProfileDetailsAction('en', {
        affiliation: SailingAffiliation.WELLESLEY,
        emergencyContactName: '',
        emergencyContactPhone: '',
        firstName: 'Grace',
        lastName: 'Hopper',
        mitId: '',
        phone: '(617) 555-0100',
      })
    ).resolves.toEqual({
      ok: false,
      error: 'incomplete_emergency_contact',
    });

    expect(userUpdate).not.toHaveBeenCalled();
    expect(sailingCardRequestUpdateMany).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('stores manual member information and pending sailing-card snapshots', async () => {
    const { updateProfileIdentityAction } =
      await import('@/libs/auth/profileIdentityActions');

    await expect(
      updateProfileIdentityAction('en', {
        affiliation: SailingAffiliation.WELLESLEY,
        firstName: ' Grace ',
        lastName: ' Hopper ',
        mitId: '',
      })
    ).resolves.toEqual({
      ok: true,
      identity: {
        affiliation: SailingAffiliation.WELLESLEY,
        firstName: 'Grace',
        lastName: 'Hopper',
        lockedByMitId: false,
        mitClassYear: null,
        mitId: null,
        name: 'Grace Hopper',
      },
    });

    expect(userUpdate).toHaveBeenCalledWith({
      data: {
        firstName: 'Grace',
        lastName: 'Hopper',
        mitClassYear: null,
        mitDataWarehouseVerifiedAt: null,
        mitId: null,
        name: 'Grace Hopper',
        sailingAffiliation: SailingAffiliation.WELLESLEY,
      },
      where: { id: 'user-1' },
    });
    expect(sailingCardRequestUpdateMany).toHaveBeenCalledWith({
      data: {
        firstName: 'Grace',
        lastName: 'Hopper',
        mitClassYear: null,
        mitId: null,
        sailingAffiliation: SailingAffiliation.WELLESLEY,
      },
      where: {
        cardYear: 2026,
        status: SailingCardRequestStatus.pending,
        userId: 'user-1',
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/profile');
  });

  it('locks verified MIT ID identity to MIT-sourced names', async () => {
    const { updateProfileIdentityAction } =
      await import('@/libs/auth/profileIdentityActions');
    userFindUnique.mockResolvedValue({
      email: 'ada@mit.edu',
      emailVerified: true,
      mitDataWarehouseVerifiedAt: null,
      mitId: null,
      sailingAffiliation: null,
    });
    lookupMitDataWarehouseIdentity.mockResolvedValue({
      classYear: '2027',
      firstName: 'ADA',
      kerberos: 'ada',
      lastName: 'LOVELACE',
      mitId: '123456789',
      personType: MitDataWarehousePersonType.CURRENT_STUDENT,
    });

    const result = await updateProfileIdentityAction('en', {
      affiliation: SailingAffiliation.MIT_STUDENT,
      firstName: '',
      lastName: '',
      mitId: '123456789',
    });

    expect(result).toMatchObject({
      ok: true,
      identity: {
        affiliation: SailingAffiliation.MIT_STUDENT,
        firstName: 'Ada',
        lastName: 'Lovelace',
        lockedByMitId: true,
        mitClassYear: '2027',
        mitId: '123456789',
        name: 'Ada Lovelace',
      },
    });
    expect(userUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        firstName: 'Ada',
        lastName: 'Lovelace',
        mitClassYear: '2027',
        mitId: '123456789',
        name: 'Ada Lovelace',
        sailingAffiliation: SailingAffiliation.MIT_STUDENT,
      }),
      where: { id: 'user-1' },
    });
    expect(
      userUpdate.mock.calls[0]?.[0].data.mitDataWarehouseVerifiedAt
    ).toBeInstanceOf(Date);
  });

  it('rejects member edits that would unlink a verified MIT identity', async () => {
    const { updateProfileIdentityAction } =
      await import('@/libs/auth/profileIdentityActions');
    userFindUnique.mockResolvedValue({
      email: 'ada@mit.edu',
      emailVerified: true,
      mitDataWarehouseVerifiedAt: new Date('2026-05-31T12:00:00Z'),
      mitId: '123456789',
      sailingAffiliation: SailingAffiliation.MIT_STUDENT,
    });

    await expect(
      updateProfileIdentityAction('en', {
        affiliation: SailingAffiliation.WELLESLEY,
        firstName: 'Grace',
        lastName: 'Hopper',
        mitId: '',
      })
    ).resolves.toEqual({ ok: false, error: 'identity_locked' });

    expect(transaction).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('does not report non-MIT-ID unique failures as MIT ID duplicates', async () => {
    const { updateProfileIdentityAction } =
      await import('@/libs/auth/profileIdentityActions');
    lookupMitDataWarehouseIdentity.mockResolvedValue({
      classYear: '2027',
      firstName: 'ADA',
      kerberos: 'ada',
      lastName: 'LOVELACE',
      mitId: '123456789',
      personType: MitDataWarehousePersonType.CURRENT_STUDENT,
    });
    transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        clientVersion: 'test',
        code: 'P2002',
        meta: { target: ['email'] },
      })
    );

    await expect(
      updateProfileIdentityAction('en', {
        affiliation: SailingAffiliation.MIT_STUDENT,
        firstName: '',
        lastName: '',
        mitId: '123456789',
      })
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
