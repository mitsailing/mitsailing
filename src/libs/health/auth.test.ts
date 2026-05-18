import { describe, expect, it } from 'vitest';
import { isAuthorizedHealthRequest } from './auth';

describe('isAuthorizedHealthRequest', () => {
  it('accepts matching bearer secret', () => {
    expect(
      isAuthorizedHealthRequest({
        authorizationHeader: 'Bearer test-health-secret',
        secret: 'test-health-secret',
      })
    ).toBe(true);
  });

  it('rejects missing header', () => {
    expect(
      isAuthorizedHealthRequest({
        authorizationHeader: null,
        secret: 'test-health-secret',
      })
    ).toBe(false);
  });

  it('rejects mismatched bearer secret', () => {
    expect(
      isAuthorizedHealthRequest({
        authorizationHeader: 'Bearer wrong-secret',
        secret: 'test-health-secret',
      })
    ).toBe(false);
  });
});
