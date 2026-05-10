import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AdminCatalogForm } from '@/components/mit-sailing/admin/catalog/AdminCatalogForm';
import { AdminCatalogHistoryPanelView } from '@/components/mit-sailing/admin/catalog/AdminCatalogHistoryPanelView';
import { AdminCmsHistoryPanelView } from '@/components/mit-sailing/admin/catalog/AdminCmsHistoryPanelView';
import { AdminCmsRevisionCompareView } from '@/components/mit-sailing/admin/catalog/AdminCmsRevisionCompareView';
import { catalogResourceDefinitions } from '@/libs/admin/catalog/catalogDefinitions';

function emptyBoundingRect(): DOMRect {
  return new DOMRect(0, 0, 0, 0);
}

const emptyClientRectList = document.createElement('div').getClientRects();

function emptyClientRects(): DOMRectList {
  return emptyClientRectList;
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

async function formAction() {
  await Promise.resolve();
}

function renderCmsBlockForm(body = '<p>Existing body</p>') {
  return render(
    <AdminCatalogForm
      definition={catalogResourceDefinitions.cms_page_blocks}
      formAction={formAction}
      headingKey="edit_heading"
      row={{
        body,
        displayOrder: 1,
        id: 'block-1',
        isVisible: true,
        kind: 'text_section',
        pageId: 'page-1',
        title: 'Overview',
      }}
    />
  );
}

function hiddenBodyValue(container: HTMLElement): string {
  const input = container.querySelector('input[name="body"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Expected body input');
  }
  return input.value;
}

function textNodeContaining(root: HTMLElement, text: string): Text {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node instanceof Text && node.data.includes(text)) {
      return node;
    }
    node = walker.nextNode();
  }
  throw new Error(`Expected editor text "${text}"`);
}

function selectEditorText(text: string) {
  const editor = screen.getByLabelText('Body');
  if (!(editor instanceof HTMLElement)) {
    throw new Error('Expected rich text editor');
  }
  editor.focus();
  const textNode = textNodeContaining(editor, text);
  const start = textNode.data.indexOf(text);
  const range = document.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, start + text.length);
  const selection = window.getSelection();
  if (!selection) {
    throw new Error('Expected window selection');
  }
  selection.removeAllRanges();
  selection.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
}

describe('AdminCatalogForm rich text fields', () => {
  it('renders rich editor only for cms block body', () => {
    const view = render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.cms_page_blocks}
        formAction={formAction}
        headingKey="edit_heading"
        row={{
          body: '<p>Existing body</p>',
          displayOrder: 1,
          id: 'block-1',
          isVisible: true,
          kind: 'text_section',
          pageId: 'page-1',
          title: 'Overview',
        }}
      />
    );

    expect(screen.getByLabelText('Block style')).toBeVisible();
    expect(screen.queryByLabelText('Display order')).toBeNull();
    expect(view.container.querySelector('input[name="body"]')).toHaveAttribute(
      'type',
      'hidden'
    );
    expect(view.container.querySelector('textarea[name="body"]')).toBeNull();
    expect(
      view.container.querySelector('textarea[name="subtitle"]')
    ).not.toBeNull();
  });

  it('keeps other text fields as plain textareas', () => {
    const view = render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.site_alerts}
        formAction={formAction}
        headingKey="edit_heading"
        row={{
          body: 'Plain alert',
          id: 'alert-1',
          isPublished: true,
          lastDate: '2026-05-10',
          startDate: '2026-05-09',
        }}
      />
    );

    expect(screen.queryByLabelText('Block style')).toBeNull();
    expect(
      view.container.querySelector('textarea[name="body"]')
    ).not.toBeNull();
  });

  it('renders class descriptions as rich text with image lists', () => {
    const view = render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.sailing_classes}
        dynamicSelectOptions={{
          classCategoryId: [{ label: 'Introduction', value: 'cc-intro' }],
        }}
        formAction={formAction}
        headingKey="edit_heading"
        row={{
          classCategoryId: 'cc-intro',
          description: '<p>Existing class body</p>',
          id: 'class-1',
          imagePaths: ['/images/classes/intro.jpg'],
          isVisible: true,
          level: 'beginner',
          name: 'Intro',
          slug: 'intro',
        }}
      />
    );

    expect(screen.getByLabelText('Block style')).toBeVisible();
    expect(
      view.container.querySelector('input[name="description"]')
    ).toHaveAttribute('type', 'hidden');
    expect(
      view.container.querySelector('textarea[name="description"]')
    ).toBeNull();
    expect(
      view.container.querySelector('input[name="imagePaths"]')
    ).toHaveValue('/images/classes/intro.jpg');
  });

  it('updates cms block preview before saving', async () => {
    const user = userEvent.setup();
    renderCmsBlockForm();

    expect(screen.getByRole('heading', { name: 'Preview' })).toBeVisible();

    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Updated preview title');
    await user.selectOptions(screen.getByLabelText('Block type'), 'callout');
    await user.click(screen.getByRole('checkbox', { name: 'Visible' }));

    expect(
      screen.getByRole('heading', { name: 'Updated preview title' })
    ).toBeVisible();
    expect(screen.getByText('Hidden block')).toBeVisible();
  });

  it('collapses optional cms block groups when empty', () => {
    const view = renderCmsBlockForm();

    expect(screen.getByRole('checkbox', { name: 'Add CTA' })).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Add picture' })
    ).not.toBeChecked();
    expect(screen.queryByLabelText('CTA label')).toBeNull();
    expect(screen.queryByLabelText('Image alt text')).toBeNull();
    expect(view.container.querySelector('input[name="ctaLabel"]')).toHaveValue(
      ''
    );
    expect(view.container.querySelector('input[name="imageSrc"]')).toHaveValue(
      ''
    );
  });

  it('expands optional cms block groups with existing values', () => {
    const view = render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.cms_page_blocks}
        formAction={formAction}
        headingKey="edit_heading"
        row={{
          body: '<p>Existing body</p>',
          ctaLabel: 'Learn more',
          ctaUrl: '/classes/',
          displayOrder: 1,
          id: 'block-1',
          imageAlt: 'Boats on the river',
          imageSrc: '/assets/images/home-hero-charles-sailing.jpg',
          isVisible: true,
          kind: 'hero',
          pageId: 'page-1',
          title: 'Overview',
        }}
      />
    );

    expect(screen.getByRole('checkbox', { name: 'Add CTA' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Add picture' })).toBeChecked();
    expect(screen.getByLabelText('CTA label')).toHaveValue('Learn more');
    expect(screen.getByLabelText('CTA URL')).toHaveValue('/classes/');
    expect(screen.getByLabelText('Image alt text')).toHaveValue(
      'Boats on the river'
    );
    expect(view.container.querySelector('input[name="imageSrc"]')).toHaveValue(
      '/assets/images/home-hero-charles-sailing.jpg'
    );
  });

  it('preserves optional cms block group values when disabled', async () => {
    const user = userEvent.setup();
    const view = render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.cms_page_blocks}
        formAction={formAction}
        headingKey="edit_heading"
        row={{
          body: '<p>Existing body</p>',
          ctaLabel: 'Learn more',
          ctaUrl: '/classes/',
          displayOrder: 1,
          id: 'block-1',
          imageAlt: 'Boats on the river',
          imageSrc: '/assets/images/home-hero-charles-sailing.jpg',
          isVisible: true,
          kind: 'hero',
          pageId: 'page-1',
          title: 'Overview',
        }}
      />
    );

    await user.click(screen.getByRole('checkbox', { name: 'Add CTA' }));
    await user.click(screen.getByRole('checkbox', { name: 'Add picture' }));

    expect(screen.queryByLabelText('CTA label')).toBeNull();
    expect(screen.queryByLabelText('Image alt text')).toBeNull();
    expect(view.container.querySelector('input[name="ctaLabel"]')).toHaveValue(
      'Learn more'
    );
    expect(view.container.querySelector('input[name="ctaUrl"]')).toHaveValue(
      '/classes/'
    );
    expect(view.container.querySelector('input[name="imageSrc"]')).toHaveValue(
      '/assets/images/home-hero-charles-sailing.jpg'
    );
    expect(view.container.querySelector('input[name="imageAlt"]')).toHaveValue(
      'Boats on the river'
    );

    await user.click(screen.getByRole('checkbox', { name: 'Add CTA' }));
    await user.click(screen.getByRole('checkbox', { name: 'Add picture' }));

    expect(screen.getByLabelText('CTA label')).toHaveValue('Learn more');
    expect(screen.getByLabelText('CTA URL')).toHaveValue('/classes/');
    expect(screen.getByLabelText('Image alt text')).toHaveValue(
      'Boats on the river'
    );
  });

  it('renders pricing link fields without block cta or picture groups', () => {
    const view = render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.cms_page_blocks}
        formAction={formAction}
        headingKey="edit_heading"
        row={{
          body: JSON.stringify({
            plans: [
              {
                features: ['Full access'],
                linkLabel: 'Create account',
                linkUrl: '/signup/',
                price: 'Free',
                title: 'Students',
              },
            ],
          }),
          ctaLabel: 'Block CTA',
          ctaUrl: '/block/',
          displayOrder: 1,
          id: 'block-1',
          imageAlt: 'Boats on the river',
          imageSrc: '/assets/images/home-hero-charles-sailing.jpg',
          isVisible: true,
          kind: 'pricing',
          pageId: 'page-1',
          title: 'Membership',
        }}
      />
    );

    expect(screen.queryByRole('checkbox', { name: 'Add CTA' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Add picture' })).toBeNull();
    expect(screen.queryByLabelText('CTA label')).toBeNull();
    expect(screen.queryByLabelText('Image alt text')).toBeNull();
    expect(screen.getByLabelText('Link label')).toHaveValue('Create account');
    expect(screen.getByLabelText('Link URL')).toHaveValue('/signup/');
    expect(view.container.querySelector('input[name="ctaLabel"]')).toBeNull();
    expect(view.container.querySelector('input[name="imageSrc"]')).toBeNull();
    expect(hiddenBodyValue(view.container)).toContain(
      '"linkLabel": "Create account"'
    );
    expect(hiddenBodyValue(view.container)).toContain('"linkUrl": "/signup/"');
  });
});

describe('AdminRichTextEditor media controls', () => {
  it('submits uploaded aligned cms image html', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        originalFilename: 'race.png',
        publicPath: '/cms-media/asset-1/race.png',
        url: '/cms-media/asset-1/race.png',
      })
    );
    const user = userEvent.setup();
    const view = render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.cms_page_blocks}
        formAction={formAction}
        headingKey="edit_heading"
        row={{
          body: '<p>Existing body</p>',
          displayOrder: 1,
          id: 'block-1',
          isVisible: true,
          kind: 'text_section',
          pageId: 'page-1',
          title: 'Overview',
        }}
      />
    );

    const uploadInput = view.container.querySelector('input[type="file"]');
    if (!(uploadInput instanceof HTMLInputElement)) {
      throw new Error('Expected file input');
    }
    await user.upload(
      uploadInput,
      new File(['png'], 'race.png', { type: 'image/png' })
    );
    await user.click(screen.getByRole('button', { name: 'Align image right' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Image size' }),
      '480'
    );

    await waitFor(() => {
      expect(hiddenBodyValue(view.container)).toContain('data-align="right"');
    });
    expect(hiddenBodyValue(view.container)).toContain('width="480"');
    expect(hiddenBodyValue(view.container)).toContain(
      '/cms-media/asset-1/race.png'
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/cms-media',
      expect.objectContaining({ method: 'POST' })
    );
    fetchMock.mockRestore();
  });

  it('centers image alignment and resets image width', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        originalFilename: 'burgee.png',
        publicPath: '/cms-media/asset-3/burgee.png',
        url: '/cms-media/asset-3/burgee.png',
      })
    );
    const user = userEvent.setup();
    const view = renderCmsBlockForm();

    const uploadInput = view.container.querySelector('input[type="file"]');
    if (!(uploadInput instanceof HTMLInputElement)) {
      throw new Error('Expected file input');
    }
    await user.upload(
      uploadInput,
      new File(['png'], 'burgee.png', { type: 'image/png' })
    );
    await user.click(screen.getByRole('button', { name: 'Align image right' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Image size' }),
      '640'
    );

    await waitFor(() => {
      expect(hiddenBodyValue(view.container)).toContain('data-align="right"');
    });
    expect(hiddenBodyValue(view.container)).toContain('width="640"');

    await user.click(
      screen.getByRole('button', { name: 'Align image center' })
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Image size' }),
      'reset'
    );

    await waitFor(() => {
      expect(hiddenBodyValue(view.container)).toContain('data-align="center"');
    });
    expect(hiddenBodyValue(view.container)).not.toContain('width=');
  });

  it('ignores invalid image width selections', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        originalFilename: 'harbor.png',
        publicPath: '/cms-media/asset-4/harbor.png',
        url: '/cms-media/asset-4/harbor.png',
      })
    );
    const user = userEvent.setup();
    const view = renderCmsBlockForm();

    const uploadInput = view.container.querySelector('input[type="file"]');
    if (!(uploadInput instanceof HTMLInputElement)) {
      throw new Error('Expected file input');
    }
    await user.upload(
      uploadInput,
      new File(['png'], 'harbor.png', { type: 'image/png' })
    );
    const sizeSelect = screen.getByRole('combobox', { name: 'Image size' });
    await user.selectOptions(sizeSelect, '320');

    await waitFor(() => {
      expect(hiddenBodyValue(view.container)).toContain('width="320"');
    });

    const invalidOption = document.createElement('option');
    invalidOption.textContent = 'Invalid width';
    invalidOption.value = 'wide';
    sizeSelect.append(invalidOption);
    await user.selectOptions(sizeSelect, 'wide');

    expect(hiddenBodyValue(view.container)).toContain('width="320"');
  });

  it('submits selected aligned cms image html', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        assets: [
          {
            createdAt: '2026-05-09T12:00:00.000Z',
            id: 'asset-2',
            originalFilename: 'dock.jpg',
            publicPath: '/cms-media/asset-2/dock.jpg',
          },
        ],
      })
    );
    const user = userEvent.setup();
    const view = render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.cms_page_blocks}
        formAction={formAction}
        headingKey="edit_heading"
        row={{
          body: '<p>Existing body</p>',
          displayOrder: 1,
          id: 'block-1',
          isVisible: true,
          kind: 'text_section',
          pageId: 'page-1',
          title: 'Overview',
        }}
      />
    );

    await user.click(
      screen.getByRole('button', { name: 'Select existing image' })
    );
    await user.click(screen.getByRole('button', { name: 'dock.jpg' }));
    await user.click(screen.getByRole('button', { name: 'Align image left' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Image size' }),
      '320'
    );

    await waitFor(() => {
      expect(hiddenBodyValue(view.container)).toContain('data-align="left"');
    });
    expect(hiddenBodyValue(view.container)).toContain('width="320"');
    expect(hiddenBodyValue(view.container)).toContain(
      '/cms-media/asset-2/dock.jpg'
    );
    fetchMock.mockRestore();
  });

  it('shows media error when existing images fail to load', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 500 })
    );
    const user = userEvent.setup();
    renderCmsBlockForm();

    await user.click(
      screen.getByRole('button', { name: 'Select existing image' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load CMS images.'
    );
  });

  it('shows media error when image upload fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 500 })
    );
    const user = userEvent.setup();
    const view = renderCmsBlockForm();

    const uploadInput = view.container.querySelector('input[type="file"]');
    if (!(uploadInput instanceof HTMLInputElement)) {
      throw new Error('Expected file input');
    }
    await user.upload(
      uploadInput,
      new File(['png'], 'failed.png', { type: 'image/png' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load CMS images.'
    );
    expect(hiddenBodyValue(view.container)).not.toContain('failed.png');
  });

  it('shows media error when upload response omits a cms path', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        originalFilename: 'external.png',
        publicPath: '/uploads/external.png',
      })
    );
    const user = userEvent.setup();
    const view = renderCmsBlockForm();

    const uploadInput = view.container.querySelector('input[type="file"]');
    if (!(uploadInput instanceof HTMLInputElement)) {
      throw new Error('Expected file input');
    }
    await user.upload(
      uploadInput,
      new File(['png'], 'external.png', { type: 'image/png' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load CMS images.'
    );
    expect(hiddenBodyValue(view.container)).not.toContain('/uploads/');
  });
});

describe('Admin catalog media fields', () => {
  it('uploads a single cms image field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        originalFilename: 'hero.png',
        publicPath: '/cms-media/asset-5/hero.png',
        url: '/cms-media/asset-5/hero.png',
      })
    );
    const user = userEvent.setup();
    const view = renderCmsBlockForm();
    await user.click(screen.getByRole('checkbox', { name: 'Add picture' }));
    const uploadInputs = view.container.querySelectorAll('input[type="file"]');
    const imageFieldUpload = uploadInputs.item(1);
    if (!(imageFieldUpload instanceof HTMLInputElement)) {
      throw new Error('Expected image field upload input');
    }

    await user.upload(
      imageFieldUpload,
      new File(['png'], 'hero.png', { type: 'image/png' })
    );

    await waitFor(() => {
      expect(
        view.container.querySelector('input[name="imageSrc"]')
      ).toHaveValue('/cms-media/asset-5/hero.png');
    });
  });

  it('uploads and serializes image list fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        originalFilename: 'fleet.png',
        publicPath: '/cms-media/asset-6/fleet.png',
        url: '/cms-media/asset-6/fleet.png',
      })
    );
    const user = userEvent.setup();
    const view = render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.fleet}
        dynamicSelectOptions={{
          requiredClassId: [{ label: 'Intro', value: 'class-1' }],
        }}
        formAction={formAction}
        headingKey="edit_heading"
        row={{
          capacity: 2,
          description: '<p>Existing fleet body</p>',
          id: 'boat-1',
          imagePaths: ['/images/boats/tech.jpg'],
          name: 'Tech',
          requiredClassId: 'class-1',
          slug: 'tech',
          type: 'dinghy',
        }}
      />
    );
    const uploadInputs = view.container.querySelectorAll('input[type="file"]');
    const imageListUpload = uploadInputs.item(1);
    if (!(imageListUpload instanceof HTMLInputElement)) {
      throw new Error('Expected image list upload input');
    }

    await user.upload(
      imageListUpload,
      new File(['png'], 'fleet.png', { type: 'image/png' })
    );

    await waitFor(() => {
      expect(
        view.container.querySelector('input[name="imagePaths"]')
      ).toHaveValue('/images/boats/tech.jpg\n/cms-media/asset-6/fleet.png');
    });
  });
});

describe('AdminRichTextEditor link controls', () => {
  it('applies and removes selected links', async () => {
    const user = userEvent.setup();
    const view = renderCmsBlockForm('<p>Open the guide</p>');

    selectEditorText('guide');
    await user.click(screen.getByRole('button', { name: 'Add link' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Link URL' }),
      '/guide/'
    );
    await user.click(screen.getByRole('button', { name: 'Apply link' }));

    await waitFor(() => {
      expect(hiddenBodyValue(view.container)).toContain('href="/guide/"');
    });
    expect(hiddenBodyValue(view.container)).toContain('>guide</a>');

    selectEditorText('guide');
    await user.click(screen.getByRole('button', { name: 'Remove link' }));

    await waitFor(() => {
      expect(hiddenBodyValue(view.container)).not.toContain('<a ');
    });
    expect(hiddenBodyValue(view.container)).toContain('guide');
  });

  it('unsets selected links for unsafe link URLs', async () => {
    const user = userEvent.setup();
    const view = renderCmsBlockForm('<p><a href="/old/">Old link</a></p>');

    selectEditorText('Old link');
    await user.click(screen.getByRole('button', { name: 'Add link' }));
    const urlInput = screen.getByRole('textbox', { name: 'Link URL' });
    expect(urlInput).toHaveValue('/old/');
    await user.clear(urlInput);
    await user.type(urlInput, `${['java', 'script'].join('')}:alert(1)`);
    await user.click(screen.getByRole('button', { name: 'Apply link' }));

    await waitFor(() => {
      expect(hiddenBodyValue(view.container)).not.toContain('<a ');
    });
    expect(hiddenBodyValue(view.container)).toContain('Old link');
  });
});

describe('AdminCmsHistoryPanelView', () => {
  it('renders compact revision metadata with change summary', () => {
    render(
      <AdminCmsHistoryPanelView
        actionLabels={{
          create: 'Created',
          delete: 'Deleted',
          update: 'Updated',
        }}
        compareHrefFor={(revisionId) =>
          `/admin/cms_pages/page-1/revisions/${revisionId}`
        }
        fieldLabels={{
          body: 'Body',
          ctaLabel: 'CTA label',
          ctaUrl: 'CTA URL',
          displayOrder: 'Display order',
          imageAlt: 'Image alt text',
          imageSrc: 'Image source',
          isPublished: 'Published',
          isVisible: 'Published',
          kind: 'Block type',
          metaDescription: 'Meta description',
          metaTitle: 'Meta title',
          path: 'Path',
          slug: 'Slug',
          subtitle: 'Subtitle',
          title: 'Title',
        }}
        locale="en"
        revisions={[
          {
            action: 'update',
            createdAt: '2026-05-09T16:30:00.000Z',
            editorEmail: 'admin@example.com',
            id: 'revision-1',
            preview: {
              blockCount: 2,
              excerpt: 'Intro body',
              pagePath: '/about/',
              pageTitle: 'About',
            },
            summary: {
              changes: [
                {
                  blockTitle: 'Overview',
                  field: 'body',
                  kind: 'block_field',
                },
                { field: 'metaDescription', kind: 'page_field' },
              ],
              kind: 'changes',
              remainingCount: 1,
            },
            version: 3,
          },
        ]}
        text={{
          addedBlock: (blockTitle) => `Added block: ${blockTitle}`,
          changed: (changes) => `Changed: ${changes}`,
          createdSummary: 'Created initial version',
          empty: 'No page history saved yet.',
          heading: 'Page history',
          moreChanges: (count) => `${count} more changes`,
          noChangesSummary: 'No field changes detected',
          removedBlock: (blockTitle) => `Removed block: ${blockTitle}`,
          unknownEditor: 'Unknown editor',
          version: (version) => `Version ${version}`,
          viewChanges: 'View changes',
        }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Page history' })).toBeVisible();
    expect(screen.getByText('Version 3')).toBeVisible();
    expect(screen.getByText('Updated')).toBeVisible();
    expect(screen.getByText('admin@example.com')).toBeVisible();
    expect(
      screen.getByText('Changed: Overview / Body, Meta description')
    ).toBeVisible();
    expect(screen.getByText('1 more changes')).toBeVisible();
    expect(screen.queryByText('About / /about/')).toBeNull();
    expect(screen.queryByText('2 blocks - Intro body')).toBeNull();
    expect(screen.getByRole('link', { name: 'View changes' })).toHaveAttribute(
      'href',
      '/admin/cms_pages/page-1/revisions/revision-1'
    );
  });

  it('renders created and block add/remove summaries', () => {
    render(
      <AdminCmsHistoryPanelView
        actionLabels={{
          create: 'Created',
          delete: 'Deleted',
          update: 'Updated',
        }}
        compareHrefFor={(revisionId) =>
          `/admin/cms_pages/page-1/revisions/${revisionId}`
        }
        fieldLabels={{
          body: 'Body',
          ctaLabel: 'CTA label',
          ctaUrl: 'CTA URL',
          displayOrder: 'Display order',
          imageAlt: 'Image alt text',
          imageSrc: 'Image source',
          isPublished: 'Published',
          isVisible: 'Published',
          kind: 'Block type',
          metaDescription: 'Meta description',
          metaTitle: 'Meta title',
          path: 'Path',
          slug: 'Slug',
          subtitle: 'Subtitle',
          title: 'Title',
        }}
        locale="en"
        revisions={[
          {
            action: 'create',
            createdAt: '2026-05-09T16:30:00.000Z',
            id: 'revision-1',
            preview: { blockCount: 1 },
            summary: { kind: 'created' },
            version: 1,
          },
          {
            action: 'update',
            createdAt: '2026-05-09T17:30:00.000Z',
            id: 'revision-2',
            preview: { blockCount: 2 },
            summary: {
              changes: [
                { blockTitle: 'Pricing', kind: 'block_added' },
                { blockTitle: 'Callout', kind: 'block_removed' },
              ],
              kind: 'changes',
              remainingCount: 0,
            },
            version: 2,
          },
        ]}
        text={{
          addedBlock: (blockTitle) => `Added block: ${blockTitle}`,
          changed: (changes) => `Changed: ${changes}`,
          createdSummary: 'Created initial version',
          empty: 'No page history saved yet.',
          heading: 'Page history',
          moreChanges: (count) => `${count} more changes`,
          noChangesSummary: 'No field changes detected',
          removedBlock: (blockTitle) => `Removed block: ${blockTitle}`,
          unknownEditor: 'Unknown editor',
          version: (version) => `Version ${version}`,
          viewChanges: 'View changes',
        }}
      />
    );

    expect(screen.getByText('Created initial version')).toBeVisible();
    expect(screen.getByText('Added block: Pricing')).toBeVisible();
    expect(screen.getByText('Removed block: Callout')).toBeVisible();
  });
});

describe('AdminCatalogHistoryPanelView', () => {
  it('renders catalog change summaries without snapshot copy', () => {
    render(
      <AdminCatalogHistoryPanelView
        actionLabels={{
          create: 'Created',
          delete: 'Deleted',
          restore: 'Restored',
          update: 'Updated',
        }}
        compareHrefFor={(revisionId) =>
          `/admin/sailing_classes/class-1/revisions/${revisionId}`
        }
        fieldLabels={{
          classCategoryId: 'Category',
          description: 'Description',
          isVisible: 'Visible',
        }}
        locale="en"
        revisions={[
          {
            action: 'update',
            createdAt: '2026-05-09T16:30:00.000Z',
            editorName: 'Admin Sailor',
            id: 'revision-1',
            preview: {
              excerpt: 'Repeated class description',
              subtitle: 'Introduction',
              title: 'Intro Sailing',
            },
            summary: {
              changes: [
                { field: 'description' },
                { field: 'classCategoryId' },
                { field: 'isVisible' },
              ],
              kind: 'changes',
              remainingCount: 0,
            },
            version: 4,
          },
        ]}
        text={{
          changed: (changes) => `Changed: ${changes}`,
          createdSummary: 'Created initial version',
          empty: 'No history saved yet.',
          heading: 'Class history',
          moreChanges: (count) => `${count} more changes`,
          noChangesSummary: 'No field changes detected',
          unknownEditor: 'Unknown editor',
          version: (version) => `Version ${version}`,
          viewChanges: 'View changes',
        }}
      />
    );

    expect(
      screen.getByText('Changed: Description, Category, Visible')
    ).toBeVisible();
    expect(screen.queryByText('Intro Sailing / Introduction')).toBeNull();
    expect(screen.queryByText('Repeated class description')).toBeNull();
    expect(screen.getByRole('link', { name: 'View changes' })).toHaveAttribute(
      'href',
      '/admin/sailing_classes/class-1/revisions/revision-1'
    );
  });
});

describe('AdminCmsRevisionCompareView', () => {
  it('renders previous and selected version values side by side', () => {
    render(
      <AdminCmsRevisionCompareView
        actionLabels={{
          create: 'Created',
          delete: 'Deleted',
          update: 'Updated',
        }}
        compare={{
          action: 'update',
          baseVersion: 2,
          comparison: {
            changes: [
              {
                after: { kind: 'text', value: 'Intro body' },
                before: { kind: 'text', value: 'Old intro body' },
                blockTitle: 'Overview',
                field: 'body',
                kind: 'block_field',
              },
            ],
            remainingCount: 0,
          },
          createdAt: '2026-05-09T16:30:00.000Z',
          editorEmail: 'admin@example.com',
          id: 'revision-1',
          preview: {
            blockCount: 2,
            excerpt: 'Intro body',
            pagePath: '/about/',
            pageTitle: 'About',
          },
          summary: {
            changes: [
              {
                blockTitle: 'Overview',
                field: 'body',
                kind: 'block_field',
              },
            ],
            kind: 'changes',
            remainingCount: 0,
          },
          version: 3,
        }}
        editHref="/admin/cms_pages/page-1/edit"
        fieldLabels={{
          body: 'Body',
          ctaLabel: 'CTA label',
          ctaUrl: 'CTA URL',
          displayOrder: 'Display order',
          imageAlt: 'Image alt text',
          imageSrc: 'Image source',
          isPublished: 'Published',
          isVisible: 'Published',
          kind: 'Block type',
          metaDescription: 'Meta description',
          metaTitle: 'Meta title',
          path: 'Path',
          slug: 'Slug',
          subtitle: 'Subtitle',
          title: 'Title',
        }}
        locale="en"
        restoreAction={async () => {
          await Promise.resolve();
        }}
        text={{
          added: 'Added',
          backToEdit: 'Back to edit page',
          changed: 'Changed',
          compareHeading: 'Compare versions',
          comparingAgainst: 'Comparing against',
          current: 'Current',
          currentlyViewing: 'Currently viewing',
          emptyValue: 'Empty',
          falseValue: 'No',
          moreChanges: (count) => `${count} more changes`,
          noChanges: 'No differences from the comparison version.',
          removed: 'Removed',
          restore: 'Restore this version',
          restoreConfirm:
            'I understand this will replace the current page and blocks with this version.',
          snapshotVersion: (version) => `Version ${version}`,
          trueValue: 'Yes',
          unknownEditor: 'Unknown editor',
        }}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Compare versions' })
    ).toBeVisible();
    expect(screen.getByText('Comparing against')).toBeVisible();
    expect(screen.getAllByText('Version 2')).toHaveLength(2);
    expect(screen.getAllByText('Version 3')).toHaveLength(2);
    expect(screen.getByText('Currently viewing')).toBeVisible();
    expect(
      screen.getByText(
        (_content, element) =>
          element?.textContent === 'Changed - Overview / Body'
      )
    ).toBeVisible();
    expect(screen.getByText('Old intro body')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Restore this version' })
    ).toBeVisible();
  });
});
