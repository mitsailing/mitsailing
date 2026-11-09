import { beforeEach, describe, expect, it, vi } from 'vitest';

const find = vi.fn();
const create = vi.fn();
const update = vi.fn();

vi.mock('@/libs/Logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@/libs/payload/getPayloadClient', () => ({
  getPayloadClient: () => ({ find, create, update }),
}));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function headerMenuItemsFromMockCall(
  call: unknown
): { id: string; url?: string }[] {
  if (!isRecord(call) || !isRecord(call.data)) {
    return [];
  }
  const { items } = call.data;
  if (!Array.isArray(items)) {
    return [];
  }
  return items.flatMap((item) => {
    if (typeof item !== 'object' || item === null || !('id' in item)) {
      return [];
    }
    const { id } = item;
    if (typeof id !== 'string') {
      return [];
    }
    const url =
      'url' in item && typeof item.url === 'string' ? item.url : undefined;
    return [{ id, url }];
  });
}

describe('ensureHeaderMenuSeed', () => {
  beforeEach(() => {
    vi.resetModules();
    find.mockReset();
    create.mockReset();
    update.mockReset();
  });

  it('creates the csv header when no header menu exists', async () => {
    find.mockResolvedValue({ docs: [] });
    create.mockResolvedValue({ id: 1 });
    const { ensureHeaderMenuSeed } = await import('./seedHeaderMenu');

    await ensureHeaderMenuSeed();

    expect(create).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
    const items = headerMenuItemsFromMockCall(create.mock.calls[0]?.[0]);
    expect(items.some((item) => item.id === 'header-pavilion')).toBe(true);
    expect(
      items.find((item) => item.id === 'header-pavilion')?.url
    ).toBeUndefined();
    expect(items.find((item) => item.id === 'header-learn')?.url).toBe(
      '/classes'
    );
  });

  it('replaces a pre-csv header once', async () => {
    find.mockResolvedValue({
      docs: [
        {
          id: 7,
          items: [{ id: 'cms-menu-header-classes', label: 'Classes' }],
        },
      ],
    });
    update.mockResolvedValue({ id: 7 });
    const { ensureHeaderMenuSeed } = await import('./seedHeaderMenu');

    await ensureHeaderMenuSeed();

    expect(update).toHaveBeenCalledOnce();
    expect(create).not.toHaveBeenCalled();
    expect(update.mock.calls[0]?.[0]?.data?.items?.[0]?.id).toBe(
      'header-pavilion'
    );
  });

  it('surgically removes the retired intro child without wiping other items', async () => {
    find.mockResolvedValue({
      docs: [
        {
          id: 9,
          items: [
            { id: 'header-pavilion', label: 'Pavilion' },
            {
              id: 'header-learn',
              label: 'Learn to Sail',
              linkType: 'url',
            },
            {
              id: 'header-learn-intro-xp',
              label: 'Intro for XP Sailor',
              parent: 'header-learn',
              url: '/classes/intro-for-experienced-sailors',
            },
            {
              id: 'cms-custom',
              label: 'Custom CMS Link',
              url: '/donate',
            },
          ],
        },
      ],
    });
    update.mockResolvedValue({ id: 9 });
    const { ensureHeaderMenuSeed } = await import('./seedHeaderMenu');

    await ensureHeaderMenuSeed();

    expect(update).toHaveBeenCalledOnce();
    const nextItems = headerMenuItemsFromMockCall(update.mock.calls[0]?.[0]);
    expect(nextItems.map((item) => item.id)).toEqual([
      'header-pavilion',
      'header-learn',
      'cms-custom',
    ]);
    expect(nextItems.find((item) => item.id === 'header-learn')?.url).toBe(
      '/classes'
    );
  });

  it('leaves an already-migrated csv header alone', async () => {
    find.mockResolvedValue({
      docs: [
        {
          id: 3,
          items: [
            { id: 'header-pavilion', label: 'Pavilion' },
            { id: 'header-learn', label: 'Learn to Sail', url: '/classes' },
          ],
        },
      ],
    });
    const { ensureHeaderMenuSeed } = await import('./seedHeaderMenu');

    await ensureHeaderMenuSeed();

    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
