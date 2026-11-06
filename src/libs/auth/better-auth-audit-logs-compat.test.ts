import { getIP } from 'better-auth/api';
import { describe, expect, it } from 'vitest';

describe('better-auth-audit-logs compatibility', () => {
  it('keeps the getIP export that audit-logs imports from better-auth/api', () => {
    expect(typeof getIP).toBe('function');
  });
});
