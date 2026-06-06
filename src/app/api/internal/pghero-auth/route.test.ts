import { afterEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@/libs/auth/roles';
import { GET, HEAD } from './route';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/libs/auth/dal', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

describe('PgHero internal auth route', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('allows top-level app admins', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: Role.ADMIN,
    });

    const response = await GET();

    expect(response.status).toBe(204);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('rejects signed-out visitors', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('rejects non-top-level admin roles', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: 'dock-master-1',
      role: Role.DOCK_MASTER,
    });

    const response = await GET();

    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('allows top-level admins for nginx head checks', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: Role.ADMIN,
    });

    const response = await HEAD();

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });
});
