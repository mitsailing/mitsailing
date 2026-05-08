import { describe, expect, it } from 'vitest';
import { plainTextFromSiteAlertHtmlish } from '@/libs/mit-sailing/siteAlertPlainText';

describe('plainTextFromSiteAlertHtmlish', () => {
  it('strips tags and collapses whitespace', () => {
    expect(
      plainTextFromSiteAlertHtmlish(
        'Line <a href="/alerts">one</a>\n\n<br> two'
      )
    ).toBe('Line one two');
  });

  it('returns full text without truncation', () => {
    const long = `Start ${'x'.repeat(500)} end`;
    expect(plainTextFromSiteAlertHtmlish(long)).toBe(long);
  });
});
