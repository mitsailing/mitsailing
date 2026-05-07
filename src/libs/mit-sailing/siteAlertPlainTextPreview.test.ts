import { describe, expect, it } from 'vitest';
import {
  plainTextFromSiteAlertHtmlish,
  siteAlertPlainTextPreview,
} from '@/libs/mit-sailing/siteAlertPlainTextPreview';

describe('plainTextFromSiteAlertHtmlish', () => {
  it('strips tags and collapses whitespace', () => {
    expect(
      plainTextFromSiteAlertHtmlish(
        'Line <a href="/alerts">one</a>\n\n<br> two'
      )
    ).toBe('Line one two');
  });
});

describe('siteAlertPlainTextPreview', () => {
  it('matches plain text from HTML-ish markup', () => {
    expect(
      siteAlertPlainTextPreview('Line <a href="/alerts">one</a>\n\n<br> two')
    ).toBe('Line one two');
  });

  it('returns full body text without truncation', () => {
    const long = `Start ${'x'.repeat(500)} end`;
    expect(siteAlertPlainTextPreview(long)).toBe(long);
  });
});
