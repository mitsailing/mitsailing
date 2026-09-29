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
  requiredRatings: [],
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
  requiredRatings: [
    {
      id: 'rating-tech',
      name: 'Tech Rating',
      slug: 'tech-rating',
    },
  ],
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
  requiredRatings: [],
  shortName: null,
  slug: 'legacy-rating',
  unlockedBoats: [],
  windCondition: null,
} satisfies PublicSailingRating;

describe('RatingsListView', () => {
  it('renders linked active ratings grouped by sailor path', async () => {
    render(await RatingsListView({ locale: 'en', ratings: [techRating] }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Ratings' })
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Charles River' })
    ).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
    const article = screen.getByRole('article', { name: 'Tech Rating' });
    expect(
      within(article).getByRole('heading', { level: 2, name: 'Tech Rating' })
    ).toBeVisible();
    expect(within(article).getByText('Level 1')).toBeVisible();
    expect(within(article).getByText('How you get it')).toBeVisible();
    expect(within(article).getByText('Unlocks')).toBeVisible();

    expect(
      within(article).getByRole('link', { name: 'Intro Sailing 101' })
    ).toHaveAttribute('href', '/classes/intro-sailing-101');
    expect(
      within(article).getByRole('link', { name: 'Tech dinghy' })
    ).toHaveAttribute('href', '/fleet/tech-dinghy');
    const guideLink = within(article).getByRole('link', {
      name: 'Open Tech Rating guide',
    });
    expect(guideLink).toHaveAttribute(
      'href',
      'https://sailing.mit.edu/card/ratings.php'
    );
    expect(guideLink).toHaveAttribute('target', '_blank');
    expect(guideLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('shows n/a facts and required ratings when linked data is sparse', async () => {
    render(
      await RatingsListView({ locale: 'en', ratings: [provisionalRating] })
    );

    const article = screen.getByRole('article', { name: 'Provisional Rating' });
    expect(within(article).getAllByText('n/a')).toHaveLength(4);
    expect(
      within(article).getByRole('link', { name: 'Tech Rating' })
    ).toHaveAttribute('href', '/ratings#tech-rating');
    expect(within(article).queryByRole('link', { name: /guide/u })).toBeNull();
  });

  it('renders the empty catalog state without ratings', async () => {
    render(await RatingsListView({ locale: 'en', ratings: [] }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'No ratings are published yet.'
    );
    expect(screen.queryByRole('article')).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'No longer issued' })
    ).toBeNull();
  });

  it('separates deprecated ratings from the active catalog', async () => {
    render(
      await RatingsListView({
        locale: 'en',
        ratings: [techRating, legacyRating],
      })
    );

    expect(screen.getByRole('article', { name: 'Tech Rating' })).toBeVisible();
    expect(screen.queryByRole('article', { name: 'Legacy Rating' })).toBeNull();
    const deprecatedSection = screen
      .getByRole('heading', { name: 'No longer issued' })
      .closest('section');
    if (!(deprecatedSection instanceof HTMLElement)) {
      throw new TypeError('Expected deprecated ratings section to render.');
    }
    expect(within(deprecatedSection).getByRole('listitem')).toHaveTextContent(
      /Legacy Rating\. Older rating kept for historical reference/u
    );
  });

  it('renders deprecated-only catalogs without an empty active list', async () => {
    render(await RatingsListView({ locale: 'en', ratings: [legacyRating] }));

    expect(screen.queryByRole('article')).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'No longer issued' })
    ).toBeVisible();
    expect(screen.getByRole('listitem')).toHaveTextContent(
      /Legacy Rating\. Older rating kept for historical reference/u
    );
  });
});
