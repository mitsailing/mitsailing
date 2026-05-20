import { describe, expect, it, vi } from 'vitest';
import { CATALOG_RESOURCE_IDS } from '@/libs/admin/catalog/catalogDefinitions';

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {},
}));

vi.mock('@/libs/zenstack/auth', () => ({
  zenstackForAuthContext: vi.fn(),
}));

vi.stubEnv('SKIP_ENV_VALIDATION', 'true');

const { getCatalogServerHandlers } =
  await import('@/libs/admin/catalog/catalogServerRegistry');

describe('catalogServerRegistry', () => {
  it('resolves handlers for every registered catalog resource', () => {
    for (const resourceId of CATALOG_RESOURCE_IDS) {
      expect(() => getCatalogServerHandlers(resourceId)).not.toThrow();
    }
  });
});
