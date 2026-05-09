import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AdminCatalogForm } from '@/components/mit-sailing/admin/catalog/AdminCatalogForm';
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

async function formAction() {
  await Promise.resolve();
}

function hiddenBodyValue(container: HTMLElement): string {
  const input = container.querySelector('input[name="body"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Expected body input');
  }
  return input.value;
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

    await waitFor(() => {
      expect(hiddenBodyValue(view.container)).toContain('data-align="right"');
    });
    expect(hiddenBodyValue(view.container)).toContain(
      '/cms-media/asset-1/race.png'
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/cms-media',
      expect.objectContaining({ method: 'POST' })
    );
    fetchMock.mockRestore();
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

    await waitFor(() => {
      expect(hiddenBodyValue(view.container)).toContain('data-align="left"');
    });
    expect(hiddenBodyValue(view.container)).toContain(
      '/cms-media/asset-2/dock.jpg'
    );
    fetchMock.mockRestore();
  });
});

describe('AdminCmsHistoryPanelView', () => {
  it('renders compact revision metadata with compare link', () => {
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
            version: 3,
          },
        ]}
        text={{
          compare: 'Compare with current',
          empty: 'No page history saved yet.',
          heading: 'Page history',
          snapshotBlocks: (count) => `${count} blocks`,
          unknownEditor: 'Unknown editor',
          version: (version) => `Version ${version}`,
        }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Page history' })).toBeVisible();
    expect(screen.getByText('Version 3')).toBeVisible();
    expect(screen.getByText('Updated')).toBeVisible();
    expect(screen.getByText('admin@example.com')).toBeVisible();
    expect(screen.getByText('About / /about/')).toBeVisible();
    expect(screen.getByText('2 blocks - Intro body')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Compare with current' })
    ).toHaveAttribute('href', '/admin/cms_pages/page-1/revisions/revision-1');
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
