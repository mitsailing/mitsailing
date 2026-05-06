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

  it('keeps CKEditor image layout markup', () => {
    const out = sanitizeMarketingHtml(
      '<figure class="image image-style-align-right image_resized bad" style="width: 50%; color: red"><img src="/api/uploads/2026/1/x.jpg" alt="Boat"><figcaption>Caption</figcaption></figure>'
    );
    expect(out).toContain('<figure');
    expect(out).toContain('figcaption');
    expect(out).toContain('image-style-align-right');
    expect(out).toContain('image_resized');
    expect(out).toContain('style="width: 50%;"');
    expect(out).not.toContain('bad');
    expect(out).not.toContain('color');
  });

  it('drops out-of-range CKEditor width styles', () => {
    const out = sanitizeMarketingHtml(
      '<figure class="image image_resized" style="width: 100.5%"><img src="/api/uploads/2026/1/x.jpg" alt=""></figure>'
    );
    expect(out).not.toContain('style');
  });

  it('keeps legacy inline right image classes', () => {
    const out = sanitizeMarketingHtml(
      '<img class="image-inline image-style-align-right unknown" src="/api/uploads/2026/1/x.jpg" alt="">'
    );
    expect(out).toContain('image-inline');
    expect(out).toContain('image-style-align-right');
    expect(out).not.toContain('unknown');
  });

  it('keeps only safe link rel values', () => {
    const out = sanitizeMarketingHtml(
      '<a href="https://mit.edu" target="_blank" rel="noopener bad noreferrer">MIT</a>'
    );
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).not.toContain('bad');
  });
});
