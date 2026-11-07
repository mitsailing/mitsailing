import { describe, expect, it } from 'vitest';
import { trustedClientIp } from '@/libs/newsletter/newsletterClientIp';

describe('trusted client ip', () => {
  it('uses the replaced real-ip header ahead of a forwarded chain', () => {
    const headerList = new Headers({
      'x-forwarded-for': '198.51.100.5, 203.0.113.10',
      'x-real-ip': '203.0.113.10',
    });

    expect(trustedClientIp(headerList)).toBe('203.0.113.10');
  });

  it('ignores a multi-value forwarded-for header', () => {
    const headerList = new Headers({
      'x-forwarded-for': '198.51.100.5, 203.0.113.10',
    });

    expect(trustedClientIp(headerList)).toBeNull();
  });

  it('accepts one forwarded-for address when real-ip is absent', () => {
    const headerList = new Headers({
      'x-forwarded-for': '2001:DB8::10',
    });

    expect(trustedClientIp(headerList)).toBe('2001:db8::10');
  });
});
