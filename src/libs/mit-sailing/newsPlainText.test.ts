import { describe, expect, it } from 'vitest';
import { plainTextFromNewsHtmlish } from '@/libs/mit-sailing/newsPlainText';

describe('plainTextFromNewsHtmlish', () => {
  it('decodes html entities after stripping tags', () => {
    expect(
      plainTextFromNewsHtmlish('<p>Fish &amp; chips &lt;today&gt;</p>')
    ).toBe('Fish & chips <today>');
  });
});
