import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPublishedPayloadPage } from '@/libs/payload/loadPublishedPayloadPage';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  cmsDraftPreviewEnabled: vi.fn(),
  find: vi.fn(),
}));

vi.mock('@/libs/payload/cmsDraftPreview', () => ({
  cmsDraftPreviewEnabled: mocks.cmsDraftPreviewEnabled,
}));

vi.mock('@/libs/payload/getPayloadClient', () => ({
  getPayloadClient: () => ({ find: mocks.find }),
}));

vi.mock('@/libs/mit-sailing/seedLegalPagesContent', () => ({
  ensureLegalPagesContentSeedSafely: vi.fn(),
}));

const body = {
  root: {
    children: [],
    direction: null,
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockResolvedValue({
    docs: [
      {
        body,
        id: 7,
        layout: null,
        slug: 'pavilion',
        title: 'Pavilion',
      },
    ],
  });
});

describe('loadPublishedPayloadPage', () => {
  it('loads published pages when draft mode is off', async () => {
    mocks.cmsDraftPreviewEnabled.mockResolvedValue(false);

    const page = await loadPublishedPayloadPage(['pavilion']);

    expect(page).toMatchObject({ layout: null, title: 'Pavilion' });
    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: false,
        overrideAccess: false,
      })
    );
    const where = mocks.find.mock.calls[0]?.[0].where;
    expect(where.and).toEqual(
      expect.arrayContaining([{ _status: { equals: 'published' } }])
    );
  });

  it('loads drafts without the published filter in draft mode', async () => {
    mocks.cmsDraftPreviewEnabled.mockResolvedValue(true);

    await loadPublishedPayloadPage(['draft-pavilion']);

    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: true,
        overrideAccess: true,
      })
    );
    const where = mocks.find.mock.calls[0]?.[0].where;
    expect(where).not.toHaveProperty('and');
    expect(where.or).toEqual(
      expect.arrayContaining([{ slug: { equals: 'draft-pavilion' } }])
    );
  });
});
