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
import { uploadCmsMediaFile } from '@/components/mit-sailing/admin/catalog/AdminCmsMediaControls';
import { catalogResourceDefinitions } from '@/libs/admin/catalog/catalogDefinitions';

const cmsMediaClientErrorMocks = vi.hoisted(() => ({
  report: vi.fn(),
}));

vi.mock('@/libs/cms/reportCmsMediaClientError', () => ({
  reportCmsMediaClientError: cmsMediaClientErrorMocks.report,
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

function renderFleetBoatForm(description = '<p>Existing fleet body</p>') {
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
        description,
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

function hiddenRichTextValue(container: HTMLElement): string {
  const input = container.querySelector('input[name="description"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Expected description input');
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
  const editor = screen.getByLabelText('Description');
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
  it('announces active rich text formatting controls', async () => {
    const user = userEvent.setup();
    renderFleetBoatForm();

    const boldButton = screen.getByRole('button', { name: 'Bold' });
    expect(boldButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(boldButton);

    expect(boldButton).toHaveAttribute('aria-pressed', 'true');
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
    expect(cmsMediaClientErrorMocks.report).toHaveBeenCalledWith({
      action: 'finalizeUpload',
      message: 'CMS media upload finalize failed',
      sessionAssetId: 'asset-1',
      uploadAssetId: 'asset-1',
    });
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
    const view = renderFleetBoatForm();

    const file = new File(['png'], 'race.png', { type: 'image/png' });
    await user.upload(fileInputAt(view.container, 1), file);
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
      expect(hiddenRichTextValue(view.container)).toContain(
        'data-align="right"'
      );
    });
    expect(hiddenRichTextValue(view.container)).toContain('width="480"');
    expect(hiddenRichTextValue(view.container)).toContain(
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
    const view = renderFleetBoatForm();

    await user.upload(
      fileInputAt(view.container, 1),
      new File(['png'], 'burgee.png', { type: 'image/png' })
    );
    await user.click(screen.getByRole('button', { name: 'Align image right' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Image size' }),
      '640'
    );

    await waitFor(() => {
      expect(hiddenRichTextValue(view.container)).toContain(
        'data-align="right"'
      );
    });
    expect(hiddenRichTextValue(view.container)).toContain('width="640"');

    await user.click(
      screen.getByRole('button', { name: 'Align image center' })
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Image size' }),
      'reset'
    );

    await waitFor(() => {
      expect(hiddenRichTextValue(view.container)).toContain(
        'data-align="center"'
      );
    });
    expect(hiddenRichTextValue(view.container)).not.toContain('width=');
  });

  it('ignores invalid image width selections', async () => {
    mockCmsMediaUploadFetch({
      assetId: 'asset-4',
      originalFilename: 'harbor.png',
      publicPath: '/cms-media/asset-4/harbor.png',
    });
    const user = userEvent.setup();
    const view = renderFleetBoatForm();

    await user.upload(
      fileInputAt(view.container, 1),
      new File(['png'], 'harbor.png', { type: 'image/png' })
    );
    const sizeSelect = screen.getByRole('combobox', { name: 'Image size' });
    await user.selectOptions(sizeSelect, '320');

    await waitFor(() => {
      expect(hiddenRichTextValue(view.container)).toContain('width="320"');
    });

    const invalidOption = document.createElement('option');
    invalidOption.textContent = 'Invalid width';
    invalidOption.value = 'wide';
    sizeSelect.append(invalidOption);
    await user.selectOptions(sizeSelect, 'wide');

    expect(hiddenRichTextValue(view.container)).toContain('width="320"');
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
    const view = renderFleetBoatForm();

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
      expect(hiddenRichTextValue(view.container)).toContain(
        'data-align="left"'
      );
    });
    expect(hiddenRichTextValue(view.container)).toContain('width="320"');
    expect(hiddenRichTextValue(view.container)).toContain(
      '/cms-media/asset-2/dock.jpg'
    );
    fetchMock.mockRestore();
  });

  it('updates the most recently inserted repeated cms image', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(repeatedCmsImageAssetResponse())
      .mockResolvedValueOnce(repeatedCmsImageAssetResponse());
    const user = userEvent.setup();
    const view = renderFleetBoatForm();

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
        hiddenRichTextValue(view.container).match(
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
    renderFleetBoatForm();

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
    const view = renderFleetBoatForm();

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
    expect(hiddenRichTextValue(view.container)).not.toContain('failed.png');
  });

  it('shows media error when upload response omits a cms path', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        originalFilename: 'external.png',
        publicPath: '/uploads/external.png',
      })
    );
    const user = userEvent.setup();
    const view = renderFleetBoatForm();

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
    expect(hiddenRichTextValue(view.container)).not.toContain('/uploads');
  });
});

describe('Admin catalog media fields', () => {
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
    const view = renderFleetBoatForm('<p>Open the guide</p>');

    selectEditorText('guide');
    await user.click(screen.getByRole('button', { name: 'Add link' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Link URL' }),
      '/guide'
    );
    await user.click(screen.getByRole('button', { name: 'Apply link' }));

    await waitFor(() => {
      expect(hiddenRichTextValue(view.container)).toContain('href="/guide"');
    });
    expect(hiddenRichTextValue(view.container)).toContain('>guide</a>');

    selectEditorText('guide');
    await user.click(screen.getByRole('button', { name: 'Remove link' }));

    await waitFor(() => {
      expect(hiddenRichTextValue(view.container)).not.toContain('<a ');
    });
    expect(hiddenRichTextValue(view.container)).toContain('guide');
  });

  it('unsets selected links for unsafe link URLs', async () => {
    const user = userEvent.setup();
    const view = renderFleetBoatForm('<p><a href="/old">Old link</a></p>');

    selectEditorText('Old link');
    await user.click(screen.getByRole('button', { name: 'Add link' }));
    const urlInput = screen.getByRole('textbox', { name: 'Link URL' });
    expect(urlInput).toHaveValue('/old');
    await user.clear(urlInput);
    await user.type(urlInput, `${['java', 'script'].join('')}:alert(1)`);
    await user.click(screen.getByRole('button', { name: 'Apply link' }));

    await waitFor(() => {
      expect(hiddenRichTextValue(view.container)).not.toContain('<a ');
    });
    expect(hiddenRichTextValue(view.container)).toContain('Old link');
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
