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
    expect(normalizeLegacyPlainTextToCmsRichTextHtml('5 < 7')).toBe(
      '<p>5 &lt; 7</p>'
    );
  });

  it('keeps semantic rich text and safe links', () => {
    expect(
      sanitizeCmsRichTextHtml(
        '<h2>Intro</h2><p><strong>Bold</strong> and <em>italic</em> <a href="/about">about</a> <a href="https://example.com">remote</a> <a href="tel:+16172534880">call</a></p><ul><li>One</li></ul>'
      )
    ).toBe(
      '<h2>Intro</h2><p><strong>Bold</strong> and <em>italic</em> <a href="/about">about</a> <a href="https://example.com" rel="noopener noreferrer" target="_blank">remote</a> <a href="tel:+16172534880" rel="noopener noreferrer" target="_blank">call</a></p><ul><li>One</li></ul>'
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

  it('extracts plain text from rich text for previews', () => {
    expect(
      plainTextFromCmsRichTextHtml(
        '<h2>Intro</h2><p>First <strong>body</strong></p>'
      )
    ).toBe('Intro First body');
  });
});
