import { describe, expect, it } from 'vitest';
import { sanitizeMarketingHtml } from '@/lib/mit-sailing/sanitizeMarketingHtml';

describe('sanitizeMarketingHtml', () => {
  it('drops script tags', () => {
    const out = sanitizeMarketingHtml('<p>Hi</p><script>alert(1)</script>');
    expect(out).not.toContain('script');
    expect(out).toContain('Hi');
  });

  it('allows safe links and strips javascript href', () => {
    const ok = sanitizeMarketingHtml('<p><a href="/classes/">x</a></p>');
    expect(ok).toContain('href="/classes/"');

    const jsProto = String.fromCodePoint(
      106,
      97,
      118,
      97,
      115,
      99,
      114,
      105,
      112,
      116,
      58
    );
    const bad = sanitizeMarketingHtml(
      `<p><a href="${jsProto}void(0)">x</a></p>`
    );
    expect(bad).not.toContain(jsProto);
  });

  it('keeps only upload-relative image src', () => {
    const good = sanitizeMarketingHtml(
      '<p><img src="/api/uploads/2026/1/x.jpg" alt=""></p>'
    );
    expect(good).toContain('/api/uploads/');

    const bad = sanitizeMarketingHtml(
      '<p><img src="https://evil.example/x.png" alt=""></p>'
    );
    expect(bad).not.toContain('evil');
  });
});
