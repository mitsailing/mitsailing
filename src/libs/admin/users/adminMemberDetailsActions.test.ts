import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@/libs/auth/permissions';

const mocks = vi.hoisted(() => ({
  profileContactForInput: vi.fn(),
  requirePermission: vi.fn(),
  revalidatePath: vi.fn(),
  saveProfileDetailsForUser: vi.fn(),
  validateProfileIdentity: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/libs/auth/dal', () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/libs/auth/profileIdentityActions', () => ({
  profileContactForInput: mocks.profileContactForInput,
  saveProfileDetailsForUser: mocks.saveProfileDetailsForUser,
  validateProfileIdentity: mocks.validateProfileIdentity,
}));

beforeEach(() => {
  mocks.profileContactForInput.mockReset();
  mocks.requirePermission.mockReset();
  mocks.revalidatePath.mockReset();
  mocks.saveProfileDetailsForUser.mockReset();
  mocks.validateProfileIdentity.mockReset();

  mocks.requirePermission.mockResolvedValue({
    session: { impersonatedBy: null },
    user: { id: 'staff-1' },
  });
  mocks.profileContactForInput.mockReturnValue({
    contact: {
      emergencyContactName: 'Emergency One',
      emergencyContactPhone: '+15555550102',
      phone: '+15555550101',
    },
    ok: true,
  });
  mocks.validateProfileIdentity.mockResolvedValue({
    identity: {
      affiliation: 'OTHER_NON_STUDENT',
      firstName: 'Sailor',
      lastName: 'One',
      lockedByMitId: false,
      mitClassYear: null,
      mitId: null,
      name: 'Sailor One',
    },
    ok: true,
    userId: 'user-1',
  });
  mocks.saveProfileDetailsForUser.mockResolvedValue(null);
});

describe('updateAdminMemberDetailsAction', () => {
  it('requires users.view before updating another member', async () => {
    const { updateAdminMemberDetailsAction } =
      await import('@/libs/admin/users/adminMemberDetailsActions');

    await updateAdminMemberDetailsAction('en', 'user-1', {
      affiliation: 'OTHER_NON_STUDENT',
      emergencyContactName: 'Emergency One',
      emergencyContactPhone: '+15555550102',
      firstName: 'Sailor',
      lastName: 'One',
      mitId: '',
      phone: '+15555550101',
    });

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.USERS_VIEW,
      'en'
    );
  });

  it('revalidates the member account page after saving', async () => {
    const { updateAdminMemberDetailsAction } =
      await import('@/libs/admin/users/adminMemberDetailsActions');

    const result = await updateAdminMemberDetailsAction('en', 'user-1', {
      affiliation: 'OTHER_NON_STUDENT',
      emergencyContactName: 'Emergency One',
      emergencyContactPhone: '+15555550102',
      firstName: 'Sailor',
      lastName: 'One',
      mitId: '',
      phone: '+15555550101',
    });

    expect(result.ok).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/users/user-1');
  });
});
