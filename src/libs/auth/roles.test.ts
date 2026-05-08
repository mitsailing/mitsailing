import { describe, expect, it } from 'vitest';
import { normalizeRole, Role } from '@/libs/auth/roles';

describe('normalizeRole', () => {
  it('admin and sailor keep known roles', () => {
    expect(normalizeRole(Role.ADMIN)).toBe(Role.ADMIN);
    expect(normalizeRole(Role.USER)).toBe(Role.USER);
  });

  it('sailor is the safe default for unknown roles', () => {
    expect(normalizeRole('super-admin')).toBe(Role.USER);
    expect(normalizeRole(null)).toBe(Role.USER);
  });
});
