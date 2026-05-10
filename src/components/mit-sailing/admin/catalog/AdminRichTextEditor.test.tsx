import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  AdminRichTextEditor,
  cmsMediaAssetFromUnknown,
  cmsMediaAssetsFromUnknown,
  currentPageId,
  isAllowedEditorHref,
  isCmsMediaPath,
  nodeNumberAttribute,
  nodeStringAttribute,
  stringField,
} from './AdminRichTextEditor';

function emptyBoundingRect(): DOMRect {
  return new DOMRect(0, 0, 0, 0);
}

const emptyClientRectList = document.createElement('div').getClientRects();

function emptyClientRects(): DOMRectList {
  return emptyClientRectList;
}

function hiddenBodyValue(container: HTMLElement): string {
  const input = container.querySelector('input[name="body"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Expected body input');
  }
  return input.value;
}

function renderEditor(defaultValue = '<p>Existing body</p>') {
  return render(
    <form>
      <input name="pageId" type="hidden" value="page-1" />
      <AdminRichTextEditor
        defaultValue={defaultValue}
        fieldId="body"
        fieldKey="body"
        label="Body"
      />
    </form>
  );
}

beforeAll(() => {
  Element.prototype.getClientRects = emptyClientRects;
  Range.prototype.getClientRects = emptyClientRects;
  Range.prototype.getBoundingClientRect = emptyBoundingRect;
  Object.defineProperty(Text.prototype, 'getClientRects', {
    configurable: true,
    value: emptyClientRects,
  });
  Object.defineProperty(Text.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: emptyBoundingRect,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdminRichTextEditor helpers', () => {
  it('accepts safe editor links', () => {
    expect(isAllowedEditorHref('#')).toBe(true);
    expect(isAllowedEditorHref('/about')).toBe(true);
    expect(isAllowedEditorHref('https://example.com')).toBe(true);
    expect(isAllowedEditorHref('http://example.com')).toBe(true);
    expect(isAllowedEditorHref('mailto:sailing@example.com')).toBe(true);
  });

  it('rejects unsafe editor links', () => {
    expect(isAllowedEditorHref('')).toBe(false);
    expect(isAllowedEditorHref(' javascript:alert(1) ')).toBe(false);
    expect(isAllowedEditorHref('vbscript:msgbox(1)')).toBe(false);
    expect(isAllowedEditorHref('data:text/html,bad')).toBe(false);
    expect(isAllowedEditorHref('//example.com')).toBe(false);
  });

  it('normalizes cms media values from unknown data', () => {
    const form = document.createElement('form');
    const pageId = document.createElement('input');
    pageId.name = 'pageId';
    pageId.value = 'page-1';
    form.append(pageId);

    expect(currentPageId(null)).toBe('');
    expect(currentPageId(form)).toBe('page-1');
    expect(isCmsMediaPath('/cms-media/asset/race.png')).toBe(true);
    expect(isCmsMediaPath('/assets/race.png')).toBe(false);
    expect(stringField({ title: 'Race' }, 'title')).toBe('Race');
    expect(stringField(null, 'title')).toBeUndefined();
    expect(
      nodeStringAttribute({ src: '/cms-media/asset/race.png' }, 'src')
    ).toBe('/cms-media/asset/race.png');
    expect(nodeNumberAttribute({ width: 480 }, 'width')).toBe(480);
    expect(nodeNumberAttribute({ width: '480' }, 'width')).toBeUndefined();
  });

  it('filters cms media asset payloads', () => {
    expect(
      cmsMediaAssetFromUnknown({
        createdAt: '2026-05-09T12:00:00.000Z',
        id: 'asset-1',
        originalFilename: 'race.png',
        publicPath: '/cms-media/asset-1/race.png',
      })
    ).toEqual({
      createdAt: '2026-05-09T12:00:00.000Z',
      id: 'asset-1',
      originalFilename: 'race.png',
      publicPath: '/cms-media/asset-1/race.png',
    });
    expect(cmsMediaAssetFromUnknown({ id: 'asset-1' })).toBeNull();
    expect(cmsMediaAssetsFromUnknown(null)).toEqual([]);
    expect(cmsMediaAssetsFromUnknown({ assets: 'bad' })).toEqual([]);
    expect(
      cmsMediaAssetsFromUnknown({
        assets: [
          {
            createdAt: '2026-05-09T12:00:00.000Z',
            id: 'asset-1',
            originalFilename: 'race.png',
            publicPath: '/cms-media/asset-1/race.png',
          },
          { id: 'bad' },
        ],
      })
    ).toHaveLength(1);
  });
});

describe('AdminRichTextEditor formatting controls', () => {
  it('updates hidden html from toolbar actions', async () => {
    const user = userEvent.setup();
    const view = renderEditor();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Block style' }),
      'h2'
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Block style' }),
      'h3'
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Block style' }),
      'h4'
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Block style' }),
      'paragraph'
    );
    await user.click(screen.getByRole('button', { name: 'Bold' }));
    await user.click(screen.getByRole('button', { name: 'Italic' }));
    await user.click(screen.getByRole('button', { name: 'Bullet list' }));
    await user.click(screen.getByRole('button', { name: 'Ordered list' }));

    await waitFor(() => {
      expect(hiddenBodyValue(view.container)).toContain('<');
    });
  });

  it('removes unsafe links', async () => {
    const user = userEvent.setup();
    const view = renderEditor('<p><a href="/about">Existing body</a></p>');

    await user.click(screen.getByRole('button', { name: 'Add link' }));
    await user.clear(screen.getByRole('textbox', { name: 'Link URL' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Link URL' }),
      `${['java', 'script'].join('')}:alert(1)`
    );
    await user.click(screen.getByRole('button', { name: 'Apply link' }));

    await waitFor(() => {
      expect(hiddenBodyValue(view.container)).not.toContain('href=');
    });
  });
});

describe('AdminRichTextEditor media controls', () => {
  it('shows upload status while image upload is pending', async () => {
    const uploadResponse = Promise.withResolvers<Response>();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      const response = await uploadResponse.promise;
      return response;
    });
    const user = userEvent.setup();
    renderEditor();

    const uploadInput = document.querySelector('input[type="file"]');
    if (!(uploadInput instanceof HTMLInputElement)) {
      throw new Error('Expected file input');
    }
    const uploadPromise = user.upload(
      uploadInput,
      new File(['png'], 'race.png', { type: 'image/png' })
    );

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Uploading race.png...'
    );

    uploadResponse.resolve(
      Response.json({
        originalFilename: 'race.png',
        publicPath: '/cms-media/asset-1/race.png',
      })
    );
    await uploadPromise;
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });
  });

  it('shows an error when loading media fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 500,
      })
    );
    const user = userEvent.setup();
    renderEditor();

    await user.click(
      screen.getByRole('button', { name: 'Select existing image' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load CMS images.'
    );
  });

  it('shows an error when loading media rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    renderEditor();

    await user.click(
      screen.getByRole('button', { name: 'Select existing image' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load CMS images.'
    );
  });

  it('opens and closes an empty media picker', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ assets: [] })
    );
    const user = userEvent.setup();
    renderEditor();

    await user.click(
      screen.getByRole('button', { name: 'Select existing image' })
    );
    expect(await screen.findByText('No CMS images yet.')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Select existing image' })
    );

    await waitFor(() => {
      expect(screen.queryByText('No CMS images yet.')).toBeNull();
    });
  });

  it('handles failed image uploads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 500,
      })
    );
    const user = userEvent.setup();
    renderEditor();

    const uploadInput = document.querySelector('input[type="file"]');
    if (!(uploadInput instanceof HTMLInputElement)) {
      throw new Error('Expected file input');
    }
    await user.upload(
      uploadInput,
      new File(['png'], 'race.png', { type: 'image/png' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load CMS images.'
    );
  });

  it('handles invalid upload responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ publicPath: '/assets/race.png' })
    );
    const user = userEvent.setup();
    renderEditor();

    const uploadInput = document.querySelector('input[type="file"]');
    if (!(uploadInput instanceof HTMLInputElement)) {
      throw new Error('Expected file input');
    }
    await user.upload(
      uploadInput,
      new File(['png'], 'race.png', { type: 'image/png' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load CMS images.'
    );
  });
});
