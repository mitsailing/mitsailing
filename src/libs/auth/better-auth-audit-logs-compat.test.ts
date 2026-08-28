import { getIp } from 'better-auth/api';
import { describe, expect, it } from 'vitest';

describe('better-auth-audit-logs compatibility', () => {
  it('keeps the getIp export that audit-logs imports from better-auth/api', () => {
    expect(typeof getIp).toBe('function');
  });
});
