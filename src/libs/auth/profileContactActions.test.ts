import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UpdateProfileContactResult } from '@/libs/auth/profileContactActions';

const { getI18nPath, getSession, revalidatePath, userUpdate } = vi.hoisted(
  () => ({
    getI18nPath: vi.fn((url: string) => url),
    getSession: vi.fn(),
    revalidatePath: vi.fn(),
    userUpdate: vi.fn(),
  })
);

vi.mock('next/cache', () => ({
  revalidatePath,
}));

vi.mock('@/libs/auth/dal', () => ({
  getSession,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    user: {
      update: userUpdate,
    },
  },
}));

vi.mock('@/utils/Helpers', () => ({
  getI18nPath,
}));

beforeEach(() => {
  getI18nPath.mockReset();
  getSession.mockReset();
  revalidatePath.mockReset();
  userUpdate.mockReset();

  getI18nPath.mockImplementation((url: string) => url);
  getSession.mockResolvedValue({ user: { id: 'user-1' } });
  userUpdate.mockResolvedValue({});
});

async function expectContactUpdateResult(options: {
  emergencyContactName: string;
  emergencyContactPhone: string;
  phone: string;
  result: UpdateProfileContactResult;
}) {
  const { updateProfileContactAction } =
    await import('@/libs/auth/profileContactActions');

  await expect(
    updateProfileContactAction('en', {
      emergencyContactName: options.emergencyContactName,
      emergencyContactPhone: options.emergencyContactPhone,
      phone: options.phone,
    })
  ).resolves.toEqual(options.result);
}

const contactUpdateRejectionCases = [
  {
    emergencyContactName: '',
    emergencyContactPhone: '',
    error: 'invalid_phone',
    phone: '+44 20 7946 0958',
    title: 'rejects non-US primary phone',
  },
  {
    authenticated: false,
    emergencyContactName: '',
    emergencyContactPhone: '',
    error: 'unauthorized',
    phone: '(617) 555-0100',
    title: 'rejects unauthenticated contact updates',
  },
  {
    emergencyContactName: 'Jane Sailor',
    emergencyContactPhone: '',
    error: 'incomplete_emergency_contact',
    phone: '(617) 555-0100',
    title: 'requires emergency contact name and phone together',
  },
  {
    emergencyContactName: '',
    emergencyContactPhone: '+44 20 7946 0958',
    error: 'incomplete_emergency_contact',
    phone: '(617) 555-0100',
    title: 'requires emergency contact phone and name together',
  },
  {
    emergencyContactName: 'Jane Sailor',
    emergencyContactPhone: '555',
    error: 'invalid_emergency_phone',
    phone: '(617) 555-0100',
    title: 'rejects invalid emergency contact phones',
  },
] as const;

describe('updateProfileContactAction', () => {
  it('stores normalized US primary phone and international emergency phone', async () => {
    const { updateProfileContactAction } =
      await import('@/libs/auth/profileContactActions');

    await expect(
      updateProfileContactAction('en', {
        emergencyContactName: '  Jane Sailor  ',
        emergencyContactPhone: '+44 20 7946 0958',
        phone: '(617) 555-0100',
      })
    ).resolves.toEqual({ ok: true });

    expect(userUpdate).toHaveBeenCalledWith({
      data: {
        emergencyContactName: 'Jane Sailor',
        emergencyContactPhone: '+442079460958',
        phone: '+16175550100',
      },
      where: { id: 'user-1' },
    });
  });

  it.each(contactUpdateRejectionCases)('$title', async (testCase) => {
    if ('authenticated' in testCase) {
      getSession.mockResolvedValue(null);
    }
    await expectContactUpdateResult({
      emergencyContactName: testCase.emergencyContactName,
      emergencyContactPhone: testCase.emergencyContactPhone,
      phone: testCase.phone,
      result: { ok: false, error: testCase.error },
    });

    expect(userUpdate).not.toHaveBeenCalled();
  });

  it('stores a primary phone without optional emergency contact fields', async () => {
    await expectContactUpdateResult({
      emergencyContactName: '   ',
      emergencyContactPhone: '   ',
      phone: '(617) 555-0100',
      result: { ok: true },
    });

    expect(userUpdate).toHaveBeenCalledWith({
      data: {
        emergencyContactName: null,
        emergencyContactPhone: null,
        phone: '+16175550100',
      },
      where: { id: 'user-1' },
    });
  });
});
