import { render, screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PublicSailingRating } from '@/libs/mit-sailing/sailingRatingQueries';
import messages from '@/locales/en.json';
import { RatingsListView } from './RatingsListView';

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(
    async (options: { locale: string; namespace: keyof typeof messages }) => {
      await Promise.resolve();
      return createTranslator({
        locale: options.locale,
        messages,
        namespace: options.namespace,
      });
    }
  ),
}));

vi.mock('@/libs/I18nNavigation', () => ({
  Link: (props: React.ComponentProps<'a'>) => {
    const { children, ...anchorProps } = props;
    return <a {...anchorProps}>{children}</a>;
  },
}));

const techRating = {
  category: 'Charles River',
  description: 'Basic Charles River sailing privileges.',
  grantableClasses: [
    {
      id: 'class-intro',
      name: 'Intro Sailing 101',
      slug: 'intro-sailing-101',
    },
  ],
  guideUrl: 'https://sailing.mit.edu/card/ratings.php',
  id: 'rating-tech',
  isDeprecated: false,
  level: '1',
  name: 'Tech Rating',
  shortName: 'Tech',
  slug: 'tech-rating',
  unlockedBoats: [
    {
      id: 'boat-tech',
      name: 'Tech dinghy',
      slug: 'tech-dinghy',
    },
  ],
  windCondition: 'Moderate',
} satisfies PublicSailingRating;

const provisionalRating = {
  category: null,
  description: 'Temporary staff-approved access.',
  grantableClasses: [],
  guideUrl: null,
  id: 'rating-provisional',
  isDeprecated: false,
  level: null,
  name: 'Provisional Rating',
  shortName: null,
  slug: 'provisional-rating',
  unlockedBoats: [],
  windCondition: null,
} satisfies PublicSailingRating;

const legacyRating = {
  category: null,
  description: 'Older rating kept for historical reference.',
  grantableClasses: [],
  guideUrl: null,
  id: 'rating-legacy',
  isDeprecated: true,
  level: null,
  name: 'Legacy Rating',
  shortName: null,
  slug: 'legacy-rating',
  unlockedBoats: [],
  windCondition: null,
} satisfies PublicSailingRating;

describe('RatingsListView', () => {
  it('renders linked active ratings with table semantics', async () => {
    render(await RatingsListView({ locale: 'en', ratings: [techRating] }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Sail ratings' })
    ).toBeVisible();
    const table = screen.getByRole('table');
    expect(
      within(table).getByRole('columnheader', { name: 'Rating' })
    ).toBeVisible();
    expect(
      within(table).getByRole('columnheader', { name: 'Classes/checkoffs' })
    ).toBeVisible();
    expect(
      within(table).getByRole('rowheader', { name: /Tech Rating/u })
    ).toBeVisible();

    expect(
      within(table).getByRole('link', { name: 'Intro Sailing 101' })
    ).toHaveAttribute('href', '/classes/intro-sailing-101');
    expect(
      within(table).getByRole('link', { name: 'Tech dinghy' })
    ).toHaveAttribute('href', '/fleet/tech-dinghy');
    const guideLink = within(table).getByRole('link', { name: 'Guide' });
    expect(guideLink).toHaveAttribute(
      'href',
      'https://sailing.mit.edu/card/ratings.php'
    );
    expect(guideLink).toHaveAttribute('target', '_blank');
    expect(guideLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows n/a cells when an active rating has no linked classes or boats', async () => {
    render(
      await RatingsListView({ locale: 'en', ratings: [provisionalRating] })
    );

    const provisionalRow = within(screen.getByRole('table')).getByRole('row', {
      name: /Provisional Rating/u,
    });
    expect(within(provisionalRow).getAllByText('n/a')).toHaveLength(5);
    expect(
      within(provisionalRow).queryByRole('link', { name: 'Guide' })
    ).toBeNull();
  });

  it('renders the empty catalog state without a table', async () => {
    render(await RatingsListView({ locale: 'en', ratings: [] }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'No ratings are published yet.'
    );
    expect(screen.queryByRole('table')).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'Deprecated ratings' })
    ).toBeNull();
  });

  it('separates deprecated ratings from the active table', async () => {
    render(
      await RatingsListView({
        locale: 'en',
        ratings: [techRating, legacyRating],
      })
    );

    const table = screen.getByRole('table');
    expect(
      within(table).getByRole('rowheader', { name: /Tech Rating/u })
    ).toBeVisible();
    expect(
      within(table).queryByRole('rowheader', { name: /Legacy Rating/u })
    ).toBeNull();
    const deprecatedSection = screen
      .getByRole('heading', { name: 'Deprecated ratings' })
      .closest('section');
    if (!(deprecatedSection instanceof HTMLElement)) {
      throw new TypeError('Expected deprecated ratings section to render.');
    }
    expect(within(deprecatedSection).getByRole('listitem')).toHaveTextContent(
      /Legacy Rating.*Older rating kept for historical reference/u
    );
  });

  it('renders deprecated-only catalogs without an empty active table', async () => {
    render(await RatingsListView({ locale: 'en', ratings: [legacyRating] }));

    expect(screen.queryByRole('table')).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Deprecated ratings' })
    ).toBeVisible();
    expect(screen.getByRole('listitem')).toHaveTextContent(
      /Legacy Rating.*Older rating kept for historical reference/u
    );
  });
});
