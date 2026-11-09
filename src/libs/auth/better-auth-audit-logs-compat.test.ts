import { getIP } from 'better-auth/api';
import { describe, expect, it } from 'vitest';

describe('better-auth-audit-logs compatibility', () => {
  it('keeps the getIP export that audit-logs resolves from better-auth/api', () => {
    // better-auth 1.7 renamed getIp -> getIP. audit-logs 0.4 resolves
    // `getIP ?? getIp`, so the canonical export must stay callable.
    expect(typeof getIP).toBe('function');
  });
});
