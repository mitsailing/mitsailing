import { render, screen } from '@testing-library/react';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getTranslations: vi.fn(),
  listPublicSailingRatings: vi.fn(),
  RatingsListView: vi.fn(() => <div data-testid="ratings-list-view" />),
  setRequestLocale: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('@/components/mit-sailing/ratings/RatingsListView', () => ({
  RatingsListView: mocks.RatingsListView,
}));

vi.mock('@/components/mit-sailing/SiteSectionMain', () => ({
  SiteSectionMain: (props: { children: React.ReactNode }) => (
    <main>{props.children}</main>
  ),
}));

vi.mock('@/components/mit-sailing/SiteSectionShell', () => ({
  SiteSectionShell: (props: {
    children: React.ReactNode;
    locale: string;
    segments: { label: string }[];
  }) => (
    <div
      data-locale={props.locale}
      data-segments={props.segments.map((segment) => segment.label).join(',')}
      data-testid="site-shell"
    >
      {props.children}
    </div>
  ),
}));

vi.mock('@/libs/mit-sailing/sailingRatingQueries', () => ({
  listPublicSailingRatings: mocks.listPublicSailingRatings,
}));

describe('RatingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTranslations.mockImplementation(async () => {
      await Promise.resolve();
      return (key: string) => `MitSailingRoutes.${key}`;
    });
    mocks.listPublicSailingRatings.mockResolvedValue([
      { id: 'rating-tech', name: 'Tech Rating' },
    ]);
  });

  it('loads public ratings into the ratings list view', async () => {
    const { default: RatingsPage } = await import('./page');

    render(await RatingsPage({ params: Promise.resolve({ locale: 'en' }) }));

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.listPublicSailingRatings).toHaveBeenCalledWith();
    expect(screen.getByTestId('site-shell')).toHaveAttribute(
      'data-segments',
      'MitSailingRoutes.section_ratings'
    );
    expect(mocks.RatingsListView).toHaveBeenCalledWith(
      {
        locale: 'en',
        ratings: [{ id: 'rating-tech', name: 'Tech Rating' }],
      },
      undefined
    );
  });

  it('builds translated ratings metadata', async () => {
    const { generateMetadata } = await import('./page');

    await expect(
      generateMetadata({ params: Promise.resolve({ locale: 'en' }) })
    ).resolves.toEqual({ title: 'MitSailingRoutes.meta_title_ratings' });
  });
});
