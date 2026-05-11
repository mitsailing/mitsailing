import { describe, expect, it } from 'vitest';
import {
  normalizeLegacyPlainTextToCmsRichTextHtml,
  plainTextFromCmsRichTextHtml,
  sanitizeCmsRichTextHtml,
} from '@/libs/mit-sailing/cmsRichText';

describe('sanitizeCmsRichTextHtml', () => {
  it('normalizes legacy plain text into paragraphs', () => {
    expect(sanitizeCmsRichTextHtml('First line\nsecond line\n\nNext')).toBe(
      '<p>First line<br />second line</p><p>Next</p>'
    );
    expect(sanitizeCmsRichTextHtml('5 < 7')).toBe('<p>5 &lt; 7</p>');
    expect(sanitizeCmsRichTextHtml('Please email <support>')).toBe(
      '<p>Please email &lt;support&gt;</p>'
    );
    expect(sanitizeCmsRichTextHtml('a<b')).toBe('<p>a&lt;b</p>');
  });

  it('keeps semantic rich text and safe links', () => {
    expect(
      sanitizeCmsRichTextHtml(
        '<h2>Intro</h2><p><strong>Bold</strong> and <em>italic</em> <a href="/about">about</a> <a href="https://example.com">remote</a> <a href="mailto:sailing@mit.edu">email</a> <a href="tel:+16172534880">call</a></p><ul><li>One</li></ul>'
      )
    ).toBe(
      '<h2>Intro</h2><p><strong>Bold</strong> and <em>italic</em> <a href="/about">about</a> <a href="https://example.com" rel="noopener noreferrer" target="_blank">remote</a> <a href="mailto:sailing@mit.edu">email</a> <a href="tel:+16172534880">call</a></p><ul><li>One</li></ul>'
    );
  });

  it('strips unsafe markup and presentation attributes', () => {
    expect(
      sanitizeCmsRichTextHtml(
        '<p class="red" style="color:red"><span>Text</span><script>alert(1)</script><font color="red"> color</font> <a href="javascript:alert(1)">bad</a></p>'
      )
    ).toBe('<p>Text color bad</p>');
  });

  it('strips links with obfuscated unsafe schemes', () => {
    expect(
      sanitizeCmsRichTextHtml(
        '<p><a href="java\u0000script:alert(1)">null</a> <a href="java\tscript:alert(2)">tab</a></p>'
      )
    ).toBe('<p>null tab</p>');
  });

  it('strips internal links with path traversal segments', () => {
    expect(
      sanitizeCmsRichTextHtml('<p><a href="/about/../admin">x</a></p>')
    ).toBe('<p>x</p>');
  });

  it('strips internal links with backslashes in path', () => {
    expect(sanitizeCmsRichTextHtml('<p><a href="/foo\\bar">x</a></p>')).toBe(
      '<p>x</p>'
    );
  });

  it('strips internal links with ascii control characters in path', () => {
    expect(
      sanitizeCmsRichTextHtml('<p><a href="/about\u0000/foo">x</a></p>')
    ).toBe('<p>x</p>');
  });

  it('keeps internal links with query and fragment on safe paths', () => {
    expect(sanitizeCmsRichTextHtml('<p><a href="/ok?x=1#h">z</a></p>')).toBe(
      '<p><a href="/ok?x=1#h">z</a></p>'
    );
  });

  it('keeps cms media images with normalized alignment', () => {
    expect(
      sanitizeCmsRichTextHtml(
        '<p>Race day</p><img class="x" style="width:10px" src="/cms-media/asset-1/race-day.png" alt="Race" data-align="right" width="200" height="120"><img src="/cms-media/asset-2/photo.webp" data-align="sideways" width="100%">'
      )
    ).toBe(
      '<p>Race day</p><img alt="Race" data-align="right" height="120" src="/cms-media/asset-1/race-day.png" width="200" /><img alt="" data-align="center" src="/cms-media/asset-2/photo.webp" />'
    );
  });

  it('removes remote images and svg media paths', () => {
    expect(
      sanitizeCmsRichTextHtml(
        '<p>Images</p><img src="https://example.com/a.png"><img src="/cms-media/asset-1/bad.svg"><img src="data:image/png;base64,aaa">'
      )
    ).toBe('<p>Images</p>');
  });

  it('removes cms media images with traversal paths', () => {
    expect(
      sanitizeCmsRichTextHtml(
        '<p>Images</p><img src="/cms-media/%2e%2e/race-day.png"><img src="/cms-media/asset-1/../race-day.png">'
      )
    ).toBe('<p>Images</p>');
  });
});

describe('plainTextFromCmsRichTextHtml', () => {
  it('extracts plain text from rich text for previews', () => {
    expect(
      plainTextFromCmsRichTextHtml(
        '<h2>Intro</h2><p>First <strong>body</strong></p>'
      )
    ).toBe('Intro First body');
  });

  it('preserves line breaks from br in plain text extraction', () => {
    expect(
      plainTextFromCmsRichTextHtml('First line\nsecond line\n\nNext')
    ).toBe('First line second line Next');
    expect(plainTextFromCmsRichTextHtml('<p>a<br>b<br/>c<BR />d</p>')).toBe(
      'a b c d'
    );
  });
});

describe('normalizeLegacyPlainTextToCmsRichTextHtml', () => {
  it('escapes html characters', () => {
    expect(normalizeLegacyPlainTextToCmsRichTextHtml('5 < 7')).toBe(
      '<p>5 &lt; 7</p>'
    );
  });

  it('normalizes crlf before splitting paragraphs and single line breaks', () => {
    expect(
      normalizeLegacyPlainTextToCmsRichTextHtml('line1\r\n\r\nline2\r\nline3')
    ).toBe('<p>line1</p><p>line2<br />line3</p>');
  });
});
