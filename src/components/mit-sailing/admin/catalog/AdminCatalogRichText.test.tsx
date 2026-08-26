import * as Sentry from '@sentry/nextjs';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AdminCatalogForm } from '@/components/mit-sailing/admin/catalog/AdminCatalogForm';
import { AdminCatalogHistoryPanelView } from '@/components/mit-sailing/admin/catalog/AdminCatalogHistoryPanelView';
import { AdminCmsHistoryPanelView } from '@/components/mit-sailing/admin/catalog/AdminCmsHistoryPanelView';
import { uploadCmsMediaFile } from '@/components/mit-sailing/admin/catalog/AdminCmsMediaControls';
import { AdminCmsRevisionCompareView } from '@/components/mit-sailing/admin/catalog/AdminCmsRevisionCompareView';
import { catalogResourceDefinitions } from '@/libs/admin/catalog/catalogDefinitions';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

type TusUploadMockProps = {
  session: {
    metadata: {
      assetId: string;
    };
  };
};

const uploadCmsMediaWithTusMock = vi.hoisted(() =>
  vi.fn(async (props: TusUploadMockProps) => {
    await Promise.resolve();
    return {
      assetId: props.session.metadata.assetId,
    };
  })
);

vi.mock('@/components/mit-sailing/admin/catalog/cmsMediaTusUpload', () => ({
  uploadCmsMediaWithTus: uploadCmsMediaWithTusMock,
}));

function emptyBoundingRect(): DOMRect {
  return new DOMRect(0, 0, 0, 0);
}

const emptyClientRectList = document.createElement('div').getClientRects();
const originalElementGetClientRects = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'getClientRects'
);
const originalRangeGetClientRects = Object.getOwnPropertyDescriptor(
  Range.prototype,
  'getClientRects'
);
const originalRangeGetBoundingClientRect = Object.getOwnPropertyDescriptor(
  Range.prototype,
  'getBoundingClientRect'
);
const originalTextGetClientRects = Object.getOwnPropertyDescriptor(
  Text.prototype,
  'getClientRects'
);
const originalTextGetBoundingClientRect = Object.getOwnPropertyDescriptor(
  Text.prototype,
  'getBoundingClientRect'
);

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

beforeEach(() => {
  uploadCmsMediaWithTusMock.mockImplementation(
    async (props: TusUploadMockProps) => {
      await Promise.resolve();
      return {
        assetId: props.session.metadata.assetId,
      };
    }
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  uploadCmsMediaWithTusMock.mockReset();
});

afterAll(() => {
  if (originalElementGetClientRects) {
    Object.defineProperty(
      Element.prototype,
      'getClientRects',
      originalElementGetClientRects
    );
  }
  if (originalRangeGetClientRects) {
    Object.defineProperty(
      Range.prototype,
      'getClientRects',
      originalRangeGetClientRects
    );
  }
  if (originalRangeGetBoundingClientRect) {
    Object.defineProperty(
      Range.prototype,
      'getBoundingClientRect',
      originalRangeGetBoundingClientRect
    );
  }
  if (originalTextGetClientRects) {
    Object.defineProperty(
      Text.prototype,
      'getClientRects',
      originalTextGetClientRects
    );
  } else {
    Reflect.deleteProperty(Text.prototype, 'getClientRects');
  }
  if (originalTextGetBoundingClientRect) {
    Object.defineProperty(
      Text.prototype,
      'getBoundingClientRect',
      originalTextGetBoundingClientRect
    );
  } else {
    Reflect.deleteProperty(Text.prototype, 'getBoundingClientRect');
  }
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

function renderCmsBlockPictureForm(props: {
  formAction: (formData: FormData) => Promise<void>;
}) {
  return render(
    <AdminCatalogForm
      definition={catalogResourceDefinitions.cms_page_blocks}
      dynamicSelectOptions={{
        pageId: [{ label: 'Home', value: 'page-1' }],
      }}
      formAction={props.formAction}
      headingKey="edit_heading"
      row={{
        body: '<p>Existing body</p>',
        displayOrder: 1,
        id: 'block-1',
        isVisible: true,
        kind: 'hero',
        pageId: 'page-1',
        title: 'Hero',
      }}
    />
  );
}

function renderFleetBoatForm() {
  return render(
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
        imagePath: '/images/boats/tech.jpg',
        name: 'Tech',
        requiredClassId: 'class-1',
        slug: 'tech',
        type: 'dinghy',
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

function repeatedCmsImageAssetResponse(): Response {
  return Response.json({
    assets: [
      {
        createdAt: '2026-05-09T12:00:00.000Z',
        id: 'asset-7',
        originalFilename: 'reused.jpg',
        publicPath: '/cms-media/asset-7/reused.jpg',
      },
    ],
  });
}

type CmsMediaUploadFixture = {
  assetId: string;
  byteSize?: number;
  filetype?: string;
  originalFilename: string;
  publicPath: string;
};

function cmsMediaAssetFixture(props: CmsMediaUploadFixture) {
  return {
    createdAt: '2026-05-17T12:00:00.000Z',
    id: props.assetId,
    originalFilename: props.originalFilename,
    publicPath: props.publicPath,
  };
}

function cmsMediaTusSessionResponse(props: CmsMediaUploadFixture): Response {
  const byteSize = props.byteSize ?? 3;
  const filetype = props.filetype ?? 'image/png';
  return Response.json({
    asset: cmsMediaAssetFixture(props),
    upload: {
      byteSize,
      endpoint: 'https://mitsailing.com/cms-media/uploads/',
      expiresAt: '2026-05-17T12:15:00.000Z',
      headers: { 'x-mitsailing-upload-token': 'header-token' },
      metadata: {
        assetId: props.assetId,
        byteSize: String(byteSize),
        filename: props.originalFilename,
        filetype,
        token: 'metadata-token',
      },
      protocol: 'tus',
      url: `https://mitsailing.com/cms-media/uploads/${props.assetId}`,
    },
  });
}

function finalizedCmsMediaAssetResponse(
  props: CmsMediaUploadFixture
): Response {
  return Response.json({
    asset: cmsMediaAssetFixture(props),
  });
}

function requestInputUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function requestInputMethod(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1]
): string | undefined {
  if (init?.method) {
    return init.method;
  }
  if (typeof input === 'string' || input instanceof URL) {
    return undefined;
  }
  return input.method;
}

function cmsMediaUploadMockResponse(props: {
  fixture: CmsMediaUploadFixture & { finalizeAssetId?: string };
  input: Parameters<typeof fetch>[0];
  init: Parameters<typeof fetch>[1];
}): Response {
  const url = requestInputUrl(props.input);
  const method = requestInputMethod(props.input, props.init);
  const assetPath = `/api/admin/cms-media/uploads/${encodeURIComponent(
    props.fixture.assetId
  )}`;
  const finalizeAssetId =
    props.fixture.finalizeAssetId ?? props.fixture.assetId;
  const finalizePath = `/api/admin/cms-media/uploads/${encodeURIComponent(
    finalizeAssetId
  )}/finalize`;
  if (url === '/api/admin/cms-media/uploads' && method === 'POST') {
    return cmsMediaTusSessionResponse(props.fixture);
  }
  if (url === assetPath && method === 'DELETE') {
    return Response.json({
      asset: {
        ...cmsMediaAssetFixture(props.fixture),
        processingErrorCode: 'upload_cancelled',
        status: 'failed',
      },
    });
  }
  if (url === finalizePath && method === 'POST') {
    return finalizedCmsMediaAssetResponse({
      ...props.fixture,
      assetId: finalizeAssetId,
    });
  }
  return new Response(null, { status: 500 });
}

function mockCmsMediaUploadFetch(
  props: CmsMediaUploadFixture & { finalizeAssetId?: string }
) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => {
      await Promise.resolve();
      return cmsMediaUploadMockResponse({ fixture: props, init, input });
    });
}

function fileInputAt(container: HTMLElement, index: number): HTMLInputElement {
  const uploadInput = container
    .querySelectorAll('input[type="file"]')
    .item(index);
  if (!(uploadInput instanceof HTMLInputElement)) {
    throw new Error('Expected file upload input');
  }
  return uploadInput;
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

  it('announces active rich text formatting controls', async () => {
    const user = userEvent.setup();
    renderCmsBlockForm();

    const boldButton = screen.getByRole('button', { name: 'Bold' });
    expect(boldButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(boldButton);

    expect(boldButton).toHaveAttribute('aria-pressed', 'true');
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

  it('renders redirected field errors on catalog fields', () => {
    render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.sailing_classes}
        dynamicSelectOptions={{
          classCategoryId: [{ label: 'Introduction', value: 'cc-intro' }],
        }}
        fieldErrors={{
          classCategoryId: 'Choose a category.',
          description: 'Add a description.',
          imagePaths: 'Add at least one image.',
          name: 'Add a name.',
        }}
        formAction={formAction}
        headingKey="new_heading"
      />
    );

    expect(screen.getByLabelText('Name')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription(
      'Add a name.'
    );
    expect(screen.getByLabelText('Category')).toHaveAccessibleDescription(
      'Choose a category.'
    );
    expect(screen.getByLabelText('Description')).toHaveAccessibleDescription(
      'Add a description.'
    );
    expect(
      screen.getByRole('button', { name: 'Upload image for Images' })
    ).toHaveAccessibleDescription('Add at least one image.');
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
          ctaUrl: '/classes',
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
    expect(screen.getByLabelText('CTA URL')).toHaveValue('/classes');
    expect(screen.getByLabelText('Image alt text')).toHaveValue(
      'Boats on the river'
    );
    expect(view.container.querySelector('input[name="imageSrc"]')).toHaveValue(
      '/assets/images/home-hero-charles-sailing.jpg'
    );
  });

  it('hides optional cms block group values when disabled and restores them when re-enabled', async () => {
    const user = userEvent.setup();
    const view = render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.cms_page_blocks}
        formAction={formAction}
        headingKey="edit_heading"
        row={{
          body: '<p>Existing body</p>',
          ctaLabel: 'Learn more',
          ctaUrl: '/classes',
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

    expect(screen.getByRole('checkbox', { name: 'Add CTA' })).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Add picture' })
    ).not.toBeChecked();
    expect(screen.queryByLabelText('CTA label')).toBeNull();
    expect(screen.queryByLabelText('Image alt text')).toBeNull();
    expect(
      screen.queryByRole('link', { name: /Learn more/u })
    ).not.toBeInTheDocument();
    expect(screen.queryByAltText('Boats on the river')).not.toBeInTheDocument();
    expect(view.container.querySelector('input[name="ctaLabel"]')).toHaveValue(
      'Learn more'
    );
    expect(view.container.querySelector('input[name="ctaUrl"]')).toHaveValue(
      '/classes'
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
    expect(screen.getByLabelText('CTA URL')).toHaveValue('/classes');
    expect(screen.getByLabelText('Image alt text')).toHaveValue(
      'Boats on the river'
    );
    expect(view.container.querySelector('input[name="imageSrc"]')).toHaveValue(
      '/assets/images/home-hero-charles-sailing.jpg'
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
                linkUrl: '/signup',
                price: 'Free',
                title: 'Students',
              },
            ],
          }),
          ctaLabel: 'Block CTA',
          ctaUrl: '/block',
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
    expect(screen.getByLabelText('Link URL')).toHaveValue('/signup');
    expect(view.container.querySelector('input[name="ctaLabel"]')).toHaveValue(
      ''
    );
    expect(view.container.querySelector('input[name="ctaUrl"]')).toHaveValue(
      ''
    );
    expect(view.container.querySelector('input[name="imageSrc"]')).toHaveValue(
      ''
    );
    expect(view.container.querySelector('input[name="imageAlt"]')).toHaveValue(
      ''
    );
    expect(view.container.querySelector('input[name="showCta"]')).toHaveValue(
      'false'
    );
    expect(view.container.querySelector('input[name="showImage"]')).toHaveValue(
      'false'
    );
    expect(hiddenBodyValue(view.container)).toContain(
      '"linkLabel": "Create account"'
    );
    expect(hiddenBodyValue(view.container)).toContain('"linkUrl": "/signup"');
  });
});

describe('AdminRichTextEditor media controls', () => {
  it('rejects 404 upload session responses without direct fallback', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        await Promise.resolve();
        const url = requestInputUrl(input);
        if (url === '/api/admin/cms-media/uploads') {
          return new Response(null, { status: 404 });
        }
        if (url === '/api/admin/cms-media') {
          return Response.json({
            createdAt: '2026-05-17T12:00:00.000Z',
            id: 'asset-direct',
            originalFilename: 'race.png',
            publicPath: '/cms-media/asset-direct/race.png',
          });
        }
        return new Response(null, { status: 500 });
      });

    await expect(
      uploadCmsMediaFile({
        file: new File(['png'], 'race.png', { type: 'image/png' }),
      })
    ).rejects.toThrow('CMS media upload session failed');
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/admin/cms-media',
      expect.anything()
    );
  });

  it('cancels a newly-created session without finalizing an earlier tus upload', async () => {
    uploadCmsMediaWithTusMock.mockResolvedValue({ assetId: 'asset-resumed' });
    const fetchMock = mockCmsMediaUploadFetch({
      assetId: 'asset-new',
      finalizeAssetId: 'asset-resumed',
      originalFilename: 'race.png',
      publicPath: '/cms-media/asset-resumed/race.png',
    });

    await expect(
      uploadCmsMediaFile({
        file: new File(['png'], 'race.png', { type: 'image/png' }),
      })
    ).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/cms-media/uploads/asset-new',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/admin/cms-media/uploads/asset-resumed/finalize',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('rejects unsafe tus asset ids before finalize fetches', async () => {
    uploadCmsMediaWithTusMock.mockResolvedValue({
      assetId: 'https://example.test/upload',
    });
    const fetchMock = mockCmsMediaUploadFetch({
      assetId: 'asset-1',
      originalFilename: 'race.png',
      publicPath: '/cms-media/asset-1/race.png',
    });

    await expect(
      uploadCmsMediaFile({
        file: new File(['png'], 'race.png', { type: 'image/png' }),
      })
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/admin/cms-media/uploads/https%3A%2F%2Fexample.test%2Fupload/finalize',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('returns null when tus finalize fails for the session asset', async () => {
    uploadCmsMediaWithTusMock.mockResolvedValue({ assetId: 'asset-1' });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      await Promise.resolve();
      const url = requestInputUrl(input);
      if (url === '/api/admin/cms-media/uploads') {
        return cmsMediaTusSessionResponse({
          assetId: 'asset-1',
          originalFilename: 'race.png',
          publicPath: '/cms-media/asset-1/race.png',
        });
      }
      if (url === '/api/admin/cms-media/uploads/asset-1/finalize') {
        return new Response(null, { status: 503 });
      }
      return new Response(null, { status: 500 });
    });

    await expect(
      uploadCmsMediaFile({
        file: new File(['png'], 'race.png', { type: 'image/png' }),
      })
    ).resolves.toBeNull();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'CMS media upload finalize failed',
      expect.objectContaining({
        contexts: {
          cmsMediaUpload: {
            sessionAssetId: 'asset-1',
            uploadAssetId: 'asset-1',
          },
        },
        level: 'warning',
        tags: { cmsMediaAction: 'finalizeUpload' },
      })
    );
  });

  it('submits uploaded aligned cms image html', async () => {
    const uploadDeferred = Promise.withResolvers<{ assetId: string }>();
    uploadCmsMediaWithTusMock.mockReturnValue(uploadDeferred.promise);
    const fetchMock = mockCmsMediaUploadFetch({
      assetId: 'asset-1',
      originalFilename: 'race.png',
      publicPath: '/cms-media/asset-1/race.png',
    });
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
    const file = new File(['png'], 'race.png', { type: 'image/png' });
    await user.upload(uploadInput, file);
    await waitFor(() => {
      expect(uploadCmsMediaWithTusMock).toHaveBeenCalledWith(
        expect.objectContaining({
          file,
          session: expect.objectContaining({
            endpoint: 'https://mitsailing.com/cms-media/uploads/',
            protocol: 'tus',
          }),
        })
      );
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/admin/cms-media/uploads/asset-1/finalize',
      expect.objectContaining({ method: 'POST' })
    );
    uploadDeferred.resolve({ assetId: 'asset-1' });
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
      '/api/admin/cms-media/uploads',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/cms-media/uploads/asset-1/finalize',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      'https://mitsailing.com/cms-media/uploads/asset-1',
      expect.objectContaining({ method: 'PUT' })
    );
    fetchMock.mockRestore();
  });

  it('centers image alignment and resets image width', async () => {
    mockCmsMediaUploadFetch({
      assetId: 'asset-3',
      originalFilename: 'burgee.png',
      publicPath: '/cms-media/asset-3/burgee.png',
    });
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
    mockCmsMediaUploadFetch({
      assetId: 'asset-4',
      originalFilename: 'harbor.png',
      publicPath: '/cms-media/asset-4/harbor.png',
    });
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

  it('updates the most recently inserted repeated cms image', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(repeatedCmsImageAssetResponse())
      .mockResolvedValueOnce(repeatedCmsImageAssetResponse());
    const user = userEvent.setup();
    const view = renderCmsBlockForm();

    await user.click(
      screen.getByRole('button', { name: 'Select existing image' })
    );
    await user.click(await screen.findByRole('button', { name: 'reused.jpg' }));
    await user.click(
      screen.getByRole('button', { name: 'Select existing image' })
    );
    await user.click(await screen.findByRole('button', { name: 'reused.jpg' }));
    await user.click(screen.getByRole('button', { name: 'Align image right' }));

    await waitFor(() => {
      const images =
        hiddenBodyValue(view.container).match(
          /<img[^>]*src="\/cms-media\/asset-7\/reused\.jpg"[^>]*>/g
        ) ?? [];
      expect(images).toHaveLength(2);
      expect(images.at(0)).toContain('data-align="center"');
      expect(images.at(1)).toContain('data-align="right"');
    });
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
    expect(hiddenBodyValue(view.container)).not.toContain('/uploads');
  });
});

describe('Admin catalog media fields', () => {
  function validationSummaryAlert(): HTMLElement {
    const title = screen.getByText('Fix the following errors');
    const alert = title.closest('[role="alert"]');
    if (!(alert instanceof HTMLElement)) {
      throw new TypeError('Expected validation summary alert');
    }
    return alert;
  }

  function expectValidationSummaryFocused(): void {
    expect(validationSummaryAlert()).toHaveFocus();
  }

  it('requires alt text for cms block pictures', async () => {
    mockCmsMediaUploadFetch({
      assetId: 'asset-5',
      originalFilename: 'hero.png',
      publicPath: '/cms-media/asset-5/hero.png',
    });
    const saveAction = vi.fn(async (_formData: FormData) => {
      await Promise.resolve();
    });
    const user = userEvent.setup();
    const view = renderCmsBlockPictureForm({ formAction: saveAction });
    await user.click(screen.getByRole('checkbox', { name: 'Add picture' }));
    const form = view.container.querySelector('form');
    const imageAltInput = screen.getByLabelText('Image alt text');
    if (!(form instanceof HTMLFormElement)) {
      throw new Error('Expected form');
    }
    if (!(imageAltInput instanceof HTMLInputElement)) {
      throw new Error('Expected image alt input');
    }

    await user.upload(
      fileInputAt(view.container, 1),
      new File(['png'], 'hero.png', { type: 'image/png' })
    );

    await waitFor(() => {
      expect(
        view.container.querySelector('input[name="imageSrc"]')
      ).toHaveValue('/cms-media/asset-5/hero.png');
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const imageAltError = screen.getByText('Add image alt text before saving.');
    expect(imageAltInput).toBeRequired();
    expect(imageAltInput).toHaveAttribute('aria-invalid', 'true');
    expect(imageAltInput).toHaveAccessibleDescription(
      'Add image alt text before saving.'
    );
    expectValidationSummaryFocused();
    expect(imageAltError.id).toBeTruthy();
    expect(saveAction).not.toHaveBeenCalled();

    await user.type(imageAltInput, 'Sailboats on the Charles');

    expect(
      screen.queryByText('Add image alt text before saving.')
    ).not.toBeInTheDocument();
    expect(form.checkValidity()).toBe(true);
  });

  it('requires an image for cms block picture alt text', async () => {
    const saveAction = vi.fn(async () => {
      await Promise.resolve();
    });
    const user = userEvent.setup();
    render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.cms_page_blocks}
        formAction={saveAction}
        headingKey="edit_heading"
        row={{
          body: '<p>Existing body</p>',
          displayOrder: 1,
          id: 'block-1',
          isVisible: true,
          kind: 'hero',
          pageId: 'page-1',
          title: 'Hero',
        }}
      />
    );
    await user.click(screen.getByRole('checkbox', { name: 'Add picture' }));
    const imageAltInput = screen.getByLabelText('Image alt text');
    const imageUploadButton = screen.getByRole('button', {
      name: 'Upload image for Image source',
    });
    if (!(imageAltInput instanceof HTMLInputElement)) {
      throw new Error('Expected image alt input');
    }

    await user.type(imageAltInput, 'Sailboats on the Charles');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Add an image before saving.')).toBeVisible();
    expect(imageUploadButton).toHaveAttribute('aria-invalid', 'true');
    expect(imageUploadButton).toHaveAccessibleDescription(
      'Add an image before saving.'
    );
    expectValidationSummaryFocused();
    expect(saveAction).not.toHaveBeenCalled();

    await user.clear(imageAltInput);

    expect(
      screen.queryByText('Add an image before saving.')
    ).not.toBeInTheDocument();
  });

  it('requires a CTA URL for cms block CTA labels', async () => {
    const saveAction = vi.fn(async () => {
      await Promise.resolve();
    });
    const user = userEvent.setup();
    render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.cms_page_blocks}
        formAction={saveAction}
        headingKey="edit_heading"
        row={{
          body: '<p>Existing body</p>',
          displayOrder: 1,
          id: 'block-1',
          isVisible: true,
          kind: 'hero',
          pageId: 'page-1',
          title: 'Hero',
        }}
      />
    );
    await user.click(screen.getByRole('checkbox', { name: 'Add CTA' }));
    const ctaLabelInput = screen.getByLabelText('CTA label');
    const ctaUrlInput = screen.getByLabelText('CTA URL');

    await user.type(ctaLabelInput, 'Learn more');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Add a CTA URL before saving.')).toBeVisible();
    expect(ctaUrlInput).toHaveAttribute('aria-invalid', 'true');
    expect(ctaUrlInput).toHaveAccessibleDescription(
      'Add a CTA URL before saving.'
    );
    expectValidationSummaryFocused();
    expect(saveAction).not.toHaveBeenCalled();

    await user.type(ctaUrlInput, '/classes');

    expect(
      screen.queryByText('Add a CTA URL before saving.')
    ).not.toBeInTheDocument();
  });

  it('requires a CTA label for cms block CTA URLs', async () => {
    const saveAction = vi.fn(async () => {
      await Promise.resolve();
    });
    const user = userEvent.setup();
    render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.cms_page_blocks}
        formAction={saveAction}
        headingKey="edit_heading"
        row={{
          body: '<p>Existing body</p>',
          displayOrder: 1,
          id: 'block-1',
          isVisible: true,
          kind: 'hero',
          pageId: 'page-1',
          title: 'Hero',
        }}
      />
    );
    await user.click(screen.getByRole('checkbox', { name: 'Add CTA' }));
    const ctaLabelInput = screen.getByLabelText('CTA label');
    const ctaUrlInput = screen.getByLabelText('CTA URL');

    await user.type(ctaUrlInput, '/classes');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Add a CTA label before saving.')).toBeVisible();
    expect(ctaLabelInput).toHaveAttribute('aria-invalid', 'true');
    expect(ctaLabelInput).toHaveAccessibleDescription(
      'Add a CTA label before saving.'
    );
    expectValidationSummaryFocused();
    expect(saveAction).not.toHaveBeenCalled();

    await user.type(ctaLabelInput, 'Learn more');

    expect(
      screen.queryByText('Add a CTA label before saving.')
    ).not.toBeInTheDocument();
  });

  it('submits disabled optional cms block groups with partial draft values', async () => {
    const saveAction = vi.fn(async (_formData: FormData) => {
      await Promise.resolve();
    });
    const user = userEvent.setup();
    render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.cms_page_blocks}
        formAction={saveAction}
        headingKey="edit_heading"
        row={{
          body: '<p>Existing body</p>',
          displayOrder: 1,
          id: 'block-1',
          isVisible: true,
          kind: 'hero',
          pageId: 'page-1',
          title: 'Hero',
        }}
      />
    );

    await user.click(screen.getByRole('checkbox', { name: 'Add CTA' }));
    await user.type(screen.getByLabelText('CTA label'), 'Learn more');
    await user.click(screen.getByRole('checkbox', { name: 'Add CTA' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(saveAction).toHaveBeenCalled();
    });
    const formData = saveAction.mock.calls[0]?.[0];
    expect(formData).toBeInstanceOf(FormData);
    if (!(formData instanceof FormData)) {
      throw new Error('Expected form data');
    }
    expect(formData.get('showCta')).toBe('false');
    expect(formData.get('ctaLabel')).toBe('Learn more');
  });

  it('renders server-returned cms block pair field errors', () => {
    render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.cms_page_blocks}
        fieldErrors={{
          ctaUrl: 'Add a CTA URL before saving.',
          imageSrc: 'Add an image before saving.',
        }}
        formAction={formAction}
        headingKey="edit_heading"
        row={{
          body: '<p>Existing body</p>',
          ctaLabel: 'Learn more',
          displayOrder: 1,
          id: 'block-1',
          imageAlt: 'Sailboats on the Charles',
          isVisible: true,
          kind: 'hero',
          pageId: 'page-1',
          title: 'Hero',
        }}
      />
    );

    expect(screen.getByLabelText('CTA URL')).toHaveAccessibleDescription(
      'Add a CTA URL before saving.'
    );
    expect(
      screen.getByRole('button', { name: 'Upload image for Image source' })
    ).toHaveAccessibleDescription('Add an image before saving.');
  });

  it('uploads a single cms image field', async () => {
    mockCmsMediaUploadFetch({
      assetId: 'asset-5',
      originalFilename: 'hero.png',
      publicPath: '/cms-media/asset-5/hero.png',
    });
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

  it('renders fleet boat sections and uploads one fleet image', async () => {
    mockCmsMediaUploadFetch({
      assetId: 'asset-6',
      originalFilename: 'fleet.png',
      publicPath: '/cms-media/asset-6/fleet.png',
    });
    const user = userEvent.setup();
    const view = renderFleetBoatForm();

    expect(screen.getByRole('heading', { name: 'Boat basics' })).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Fleet page image' })
    ).toBeVisible();
    expect(
      screen.getByText(
        'This image appears on the fleet page only. Alt text is automatically the boat name.'
      )
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Boat page content' })
    ).toBeVisible();
    expect(
      screen.getByText('Images added here appear on the individual boat page.')
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Access requirement' })
    ).toBeVisible();
    expect(view.container.querySelector('input[name="imagePaths"]')).toBeNull();
    expect(view.container.querySelector('input[name="imagePath"]')).toHaveValue(
      '/images/boats/tech.jpg'
    );

    await user.upload(
      fileInputAt(view.container, 0),
      new File(['png'], 'fleet.png', { type: 'image/png' })
    );

    await waitFor(() => {
      expect(
        view.container.querySelector('input[name="imagePath"]')
      ).toHaveValue('/cms-media/asset-6/fleet.png');
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
      '/guide'
    );
    await user.click(screen.getByRole('button', { name: 'Apply link' }));

    await waitFor(() => {
      expect(hiddenBodyValue(view.container)).toContain('href="/guide"');
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
    const view = renderCmsBlockForm('<p><a href="/old">Old link</a></p>');

    selectEditorText('Old link');
    await user.click(screen.getByRole('button', { name: 'Add link' }));
    const urlInput = screen.getByRole('textbox', { name: 'Link URL' });
    expect(urlInput).toHaveValue('/old');
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
          showCta: 'Add CTA',
          showImage: 'Add picture',
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
              pagePath: '/about',
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
          showCta: 'Add CTA',
          showImage: 'Add picture',
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
                blockId: 'block-overview',
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
            pagePath: '/about',
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
          showCta: 'Add CTA',
          showImage: 'Add picture',
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
          restorePending: 'Restoring...',
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
