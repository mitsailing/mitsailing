import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  adminRichTextDefaultImageStyle,
  adminRichTextImageResizeOptions,
  adminRichTextImageStyleOptions,
  adminRichTextImageToolbarItems,
  adminRichTextToolbarItems,
} from '@/components/mit-sailing/admin/catalog/adminRichTextEditorConfig';
import {
  marketingRichTextArticleClassName,
  marketingRichTextCompactClassName,
} from '@/lib/mit-sailing/marketingRichTextContentClassName';

describe('adminRichTextEditorConfig', () => {
  it('includes writing and history controls in the toolbar', () => {
    expect(adminRichTextToolbarItems).toEqual([
      'heading',
      '|',
      'bold',
      'italic',
      'link',
      'bulletedList',
      'numberedList',
      'blockQuote',
      'codeBlock',
      '|',
      'uploadImage',
      'adminMediaLibrary',
      '|',
      'undo',
      'redo',
    ]);
  });

  it('includes image editing controls', () => {
    expect(adminRichTextImageToolbarItems).toContain('imageTextAlternative');
    expect(adminRichTextImageToolbarItems).toContain('linkImage');
    expect(adminRichTextImageToolbarItems).toContain('resizeImage');
    expect(adminRichTextDefaultImageStyle).toBe('alignRight');
    expect(adminRichTextImageStyleOptions).toContain('alignLeft');
    expect(adminRichTextImageStyleOptions).toContain('alignRight');
    expect(adminRichTextImageStyleOptions).toContain('alignCenter');
    expect(adminRichTextImageStyleOptions).not.toContain('inline');
    expect(adminRichTextImageResizeOptions).toContainEqual({
      label: 'Medium',
      name: 'resizeImage:50',
      value: '50',
    });
  });

  it('keeps the editor full width and auto-growing', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');
    expect(css).toContain('.admin-rich-text-ckeditor .ck.ck-editor');
    expect(css).toContain('width: 100%');
    expect(css).toContain('min-height: 62vh');
    expect(css).toContain('overflow: visible');
    expect(css).toContain('.cms-rich-text .image.image-style-align-right');
    expect(css).toContain('float: right');
    expect(css).toContain('.cms-rich-text::after');
  });

  it('uses CKEditor content styling for public rich text', () => {
    expect(marketingRichTextArticleClassName).toContain('ck-content');
    expect(marketingRichTextCompactClassName).toContain('ck-content');
  });
});
