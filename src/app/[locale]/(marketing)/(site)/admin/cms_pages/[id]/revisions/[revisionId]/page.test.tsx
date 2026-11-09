import { describe, expect, it, vi } from 'vitest';

const redirect = vi.hoisted(() =>
  vi.fn((_path: string): never => {
    throw new Error('NEXT_REDIRECT');
  })
);

vi.mock('next/navigation', () => ({
  redirect,
}));

describe('AdminCmsPageRevisionComparePage', () => {
  it('redirects to Payload page collection', async () => {
    const pageModule = await import('./page');
    const AdminCmsPageRevisionComparePage = pageModule.default;

    expect(() => {
      AdminCmsPageRevisionComparePage();
    }).toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/cms/collections/pages');
  });
});
