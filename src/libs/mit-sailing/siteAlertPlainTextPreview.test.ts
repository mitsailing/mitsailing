import { describe, expect, it } from 'vitest';
import { siteAlertPlainTextPreview } from '@/libs/mit-sailing/siteAlertPlainTextPreview';

describe('siteAlertPlainTextPreview', () => {
  it('strips tags and collapses whitespace', () => {
    expect(
      siteAlertPlainTextPreview({
        htmlish: 'Line <a href="/alerts">one</a>\n\n<br> two',
        maxLength: 40,
      })
    ).toBe('Line one two');
  });

  it('truncates long previews with an ellipsis', () => {
    expect(
      siteAlertPlainTextPreview({
        htmlish: '1234567890',
        maxLength: 6,
      })
    ).toBe('12345…');
  });
});
