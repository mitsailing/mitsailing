import { describe, expect, it } from 'vitest';
import {
  sanitizeNewsBodyHtml,
  sanitizeNewsBodyHtmlForBanner,
} from '@/libs/mit-sailing/sanitizeNewsHtml';

describe('sanitizeNewsBodyHtml', () => {
  it('keeps root-relative links', () => {
    expect(sanitizeNewsBodyHtml('<a href="/news">home</a>')).toBe(
      '<a href="/news">home</a>'
    );
  });

  it('adds rel and target on https links', () => {
    expect(sanitizeNewsBodyHtml('<a href="https://example.com/p">x</a>')).toBe(
      '<a href="https://example.com/p" rel="noopener noreferrer" target="_blank">x</a>'
    );
  });

  it('keeps paragraphs, bold, italic, br, and safe links', () => {
    expect(
      sanitizeNewsBodyHtml(
        '<p><strong>Notice</strong> <em>now</em></p><br><a href="/news">Read news</a>'
      )
    ).toBe(
      '<p><strong>Notice</strong> <em>now</em></p><br /><a href="/news">Read news</a>'
    );
  });

  it('strips attributes from p, strong, and em', () => {
    expect(
      sanitizeNewsBodyHtml(
        '<p class="x" onclick="evil()"><strong style="color:red">Bold</strong><em id="i">Italic</em></p>'
      )
    ).toBe('<p><strong>Bold</strong><em>Italic</em></p>');
  });

  it('strips headings, lists, and images while keeping text', () => {
    expect(
      sanitizeNewsBodyHtml(
        '<h2>Title</h2><ul><li>One</li></ul><img src="/x.png" alt="pic" />'
      )
    ).toBe('TitleOne');
  });

  it('strips unsupported bold tags but keeps text', () => {
    expect(sanitizeNewsBodyHtml('<b>x</b>')).toBe('x');
  });

  it('drops javascript URLs leaving link text', () => {
    expect(sanitizeNewsBodyHtml('<a href="javascript:alert(1)">bad</a>')).toBe(
      'bad'
    );
  });

  it('drops protocol-relative URLs', () => {
    expect(sanitizeNewsBodyHtml('<a href="//evil.test/">x</a>')).toBe('x');
  });

  it('strips raw-text xmp payloads before React rendering', () => {
    expect(
      sanitizeNewsBodyHtml('<xmp><img src=x onerror=alert(1)></xmp>')
    ).toBe('');
  });
});

describe('sanitizeNewsBodyHtmlForBanner', () => {
  it('keeps formatting and unwraps anchors to text', () => {
    expect(
      sanitizeNewsBodyHtmlForBanner(
        '<p><strong>Notice</strong></p><a href="/news">Read news</a>'
      )
    ).toBe('<p><strong>Notice</strong></p>Read news');
  });
});
