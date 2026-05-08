import { describe, expect, it } from 'vitest';
import { normalizeRole, Role } from '@/libs/auth/roles';

describe('normalizeRole', () => {
  it('preserves known roles for admin and user', () => {
    expect(normalizeRole(Role.ADMIN)).toBe(Role.ADMIN);
    expect(normalizeRole(Role.USER)).toBe(Role.USER);
  });

  it('defaults unknown roles to user', () => {
    expect(normalizeRole('super-admin')).toBe(Role.USER);
    expect(normalizeRole(null)).toBe(Role.USER);
  });
});
