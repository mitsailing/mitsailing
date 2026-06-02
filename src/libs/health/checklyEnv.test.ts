import { describe, expect, it } from 'vitest';
import {
  checklyEnvironmentUrl,
  checklyHealthcheckSecret,
} from '../../../checkly/env';

describe('checkly env helpers', () => {
  it('falls back when environment URL is blank', () => {
    expect(
      checklyEnvironmentUrl({
        ENVIRONMENT_URL: '',
        NEXT_PUBLIC_APP_URL: 'https://mitsailing.com',
      })
    ).toBe('https://mitsailing.com');
  });

  it('uses local URL when no absolute target is configured', () => {
    expect(
      checklyEnvironmentUrl({
        ENVIRONMENT_URL: ' ',
        NEXT_PUBLIC_APP_URL: '',
      })
    ).toBe('http://localhost:3000');
  });

  it('treats blank readiness secret as absent', () => {
    expect(
      checklyHealthcheckSecret({
        HEALTHCHECK_SECRET: ' ',
      })
    ).toBeUndefined();
  });
});
