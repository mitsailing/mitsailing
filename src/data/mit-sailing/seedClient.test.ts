import { afterEach, describe, expect, it, vi } from 'vitest';
import { seedDatabaseUrl } from '../../../prisma/seedClient';

describe(seedDatabaseUrl, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns DATABASE_URL from process.env', () => {
    vi.stubEnv('DATABASE_URL', 'postgres://seed-db');
    expect(seedDatabaseUrl()).toBe('postgres://seed-db');
  });

  it('throws when DATABASE_URL is missing', () => {
    vi.stubEnv('DATABASE_URL', '');
    expect(() => seedDatabaseUrl()).toThrow('DATABASE_URL is not set');
  });
});
