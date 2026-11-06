import { describe, expect, it } from 'vitest';
import { newsBodyEditorHtml } from '@/libs/mit-sailing/newsBodyEditorHtml';

describe('newsBodyEditorHtml', () => {
  it('turns plain-text newlines into line breaks', () => {
    expect(newsBodyEditorHtml('First line\r\nsecond line\n\nAfter')).toBe(
      '<p>First line<br>second line<br><br>After</p>'
    );
    expect(newsBodyEditorHtml('5 < 7 & "boats"')).toBe(
      '<p>5 &lt; 7 &amp; &quot;boats&quot;</p>'
    );
  });

  it('keeps existing markup and newlines beside tags', () => {
    expect(newsBodyEditorHtml('<p>\nAlready <strong>bold</strong>\n</p>')).toBe(
      '<p>Already <strong>bold</strong></p>'
    );
    expect(newsBodyEditorHtml('See\n<a href="/news">news</a>')).toBe(
      'See<br><a href="/news">news</a>'
    );
    expect(newsBodyEditorHtml('<p>Hello</p>\n<p>World</p>')).toBe(
      '<p>Hello</p><p>World</p>'
    );
  });

  it('returns an empty paragraph for blank input', () => {
    expect(newsBodyEditorHtml('  \n')).toBe('<p></p>');
  });
});
