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

const memberInput = {
  affiliation: 'OTHER_NON_STUDENT',
  emergencyContactName: 'Emergency One',
  emergencyContactPhone: '+15555550102',
  firstName: 'Sailor',
  lastName: 'One',
  mitId: '',
  phone: '+15555550101',
} as const;

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
  it('requires users.edit before updating another member', async () => {
    const { updateAdminMemberDetailsAction } =
      await import('@/libs/admin/users/adminMemberDetailsActions');

    await updateAdminMemberDetailsAction('en', 'user-1', { ...memberInput });

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.USERS_EDIT,
      'en'
    );
  });

  it('revalidates the member account page after saving', async () => {
    const { updateAdminMemberDetailsAction } =
      await import('@/libs/admin/users/adminMemberDetailsActions');

    const result = await updateAdminMemberDetailsAction('en', 'user-1', {
      ...memberInput,
    });

    expect(result.ok).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/admin/users/user-1');
  });

  it('skips revalidation when contact validation fails', async () => {
    mocks.profileContactForInput.mockReturnValue({
      error: 'invalid_phone',
      ok: false,
    });

    const { updateAdminMemberDetailsAction } =
      await import('@/libs/admin/users/adminMemberDetailsActions');

    const result = await updateAdminMemberDetailsAction('en', 'user-1', {
      ...memberInput,
    });

    expect(result).toEqual({ error: 'invalid_phone', ok: false });
    expect(mocks.validateProfileIdentity).not.toHaveBeenCalled();
    expect(mocks.saveProfileDetailsForUser).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('skips revalidation when identity validation fails', async () => {
    mocks.validateProfileIdentity.mockResolvedValue({
      error: 'first_name_required',
      ok: false,
    });

    const { updateAdminMemberDetailsAction } =
      await import('@/libs/admin/users/adminMemberDetailsActions');

    const result = await updateAdminMemberDetailsAction('en', 'user-1', {
      ...memberInput,
    });

    expect(result).toEqual({ error: 'first_name_required', ok: false });
    expect(mocks.saveProfileDetailsForUser).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('skips revalidation when save returns an error', async () => {
    mocks.saveProfileDetailsForUser.mockResolvedValue({
      error: 'unauthorized',
      ok: false,
    });

    const { updateAdminMemberDetailsAction } =
      await import('@/libs/admin/users/adminMemberDetailsActions');

    const result = await updateAdminMemberDetailsAction('en', 'user-1', {
      ...memberInput,
    });

    expect(result).toEqual({ error: 'unauthorized', ok: false });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
