import { describe, expect, it } from 'vitest';
import { normalizeRole, Role } from '@/libs/auth/roles';

describe('normalizeRole', () => {
  it('Preserves known roles for admin and user', () => {
    expect(normalizeRole(Role.ADMIN)).toBe(Role.ADMIN);
    expect(normalizeRole(Role.USER)).toBe(Role.USER);
  });

  it('Defaults unknown roles to user', () => {
    expect(normalizeRole('super-admin')).toBe(Role.USER);
    expect(normalizeRole(null)).toBe(Role.USER);
  });
});
