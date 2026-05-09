import { describe, expect, it } from 'vitest';
import { rawAdminUserUpdateFromFormData } from '@/libs/admin/users/usersAdminSchemas';
import { Role } from '@/libs/auth/roles';

function baseUserFormData(): FormData {
  const formData = new FormData();
  formData.set('email', 'sailor@example.com');
  formData.set('name', 'Sailor');
  formData.set('role', Role.USER);
  formData.set('newPassword', '');
  return formData;
}

describe('rawAdminUserUpdateFromFormData', () => {
  it('admin keeps checked boolean fields from browser checkbox payloads', () => {
    const formData = baseUserFormData();
    formData.append('emailVerified', 'false');
    formData.append('emailVerified', 'true');
    formData.append('banned', 'false');
    formData.append('banned', 'true');

    expect(rawAdminUserUpdateFromFormData(formData)).toMatchObject({
      banned: true,
      emailVerified: true,
    });
  });

  it('admin clears unchecked boolean fields from hidden fallback payloads', () => {
    const formData = baseUserFormData();
    formData.append('emailVerified', 'false');
    formData.append('banned', 'false');

    expect(rawAdminUserUpdateFromFormData(formData)).toMatchObject({
      banned: false,
      emailVerified: false,
    });
  });
});
