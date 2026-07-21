import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import type { getFormatter } from 'next-intl/server';
import { describe, expect, it, vi } from 'vitest';
import { ProfileRatingsView } from '@/components/auth/profile/ProfileRatingsView';
import type { UserRatingAssignmentRow } from '@/libs/mit-sailing/sailingRatingQueries';
import messages from '@/locales/en.json';

const t = createTranslator({
  locale: 'en',
  messages,
  namespace: 'UserProfilePage',
});

const format = {
  dateTime: vi.fn(() => 'Apr 15, 2026'),
  dateTimeRange: vi.fn(() => 'Apr 15 – Apr 16, 2026'),
  displayName: vi.fn(() => 'English'),
  list: vi.fn(() => 'a, b'),
  number: vi.fn(() => '1'),
  relativeTime: vi.fn(() => '1 day ago'),
} as Awaited<ReturnType<typeof getFormatter>>;

function ratingRow(
  props: Partial<UserRatingAssignmentRow> &
    Pick<UserRatingAssignmentRow, 'id' | 'name' | 'slug'>
): UserRatingAssignmentRow {
  return {
    category: null,
    description: '',
    eligibility: { eligible: true },
    grantableClasses: [],
    guideUrl: null,
    isDeprecated: false,
    issuedAt: null,
    issuedByName: null,
    level: null,
    shortName: null,
    unlockedBoats: [],
    windCondition: null,
    ...props,
    id: props.id,
    name: props.name,
    slug: props.slug,
  };
}

describe('ProfileRatingsView', () => {
  it('lists every rating with earned and not-yet-earned status', () => {
    render(
      <ProfileRatingsView
        format={format}
        rows={[
          ratingRow({
            category: 'Dinghy',
            id: 'rating-tech',
            issuedAt: new Date('2026-04-15T12:00:00Z'),
            issuedByName: 'Instructor',
            name: 'Tech Rating',
            slug: 'tech-rating',
          }),
          ratingRow({
            id: 'rating-laser-basic',
            name: 'Laser: Basic',
            slug: 'laser-basic-rating',
          }),
        ]}
        t={t}
      />
    );

    expect(
      screen.getByText(t('ratings_summary', { granted: 1, total: 2 }))
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Tech Rating' })).toHaveAttribute(
      'href',
      '/ratings#tech-rating'
    );
    expect(screen.getByRole('link', { name: 'Laser: Basic' })).toHaveAttribute(
      'href',
      '/ratings#laser-basic-rating'
    );
    expect(screen.getByText(t('ratings_status_earned'))).toBeVisible();
    expect(screen.getByText(t('ratings_status_not_earned'))).toBeVisible();
  });

  it('shows catalog empty state without a table', () => {
    render(<ProfileRatingsView format={format} rows={[]} t={t} />);

    expect(screen.getByText(t('ratings_empty_state'))).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
