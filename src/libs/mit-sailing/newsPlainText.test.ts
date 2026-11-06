import { describe, expect, it } from 'vitest';
import { plainTextFromNewsHtmlish } from '@/libs/mit-sailing/newsPlainText';

describe('plainTextFromNewsHtmlish', () => {
  it('strips tags and collapses whitespace', () => {
    expect(
      plainTextFromNewsHtmlish('Line <a href="/news">one</a>\n\n<br> two')
    ).toBe('Line one two');
  });

  it('returns full text without truncation', () => {
    const long = `Start ${'x'.repeat(500)} end`;
    expect(plainTextFromNewsHtmlish(long)).toBe(long);
  });
});
