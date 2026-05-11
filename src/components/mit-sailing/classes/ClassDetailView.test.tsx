import { render, screen } from '@testing-library/react';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { SailingClassCatalogDetail } from '@/libs/mit-sailing/classQueries';
import { ClassDetailView } from './ClassDetailView';

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => {
    await Promise.resolve();
    return (key: string) =>
      ({
        additional_image_alt: 'More photos of {name}',
        back_to_classes: 'Back to classes',
        level_label: 'Level:',
        related_event_unlisted: 'Unlisted',
        related_events_calendar: 'calendar',
        related_events_empty: 'No dates',
        section_fleet_access: 'Fleet access',
        section_grantable_ratings: 'Earned ratings',
        section_prerequisites: 'Prerequisites',
        section_required_ratings: 'Required ratings',
        section_related_events: 'Related events',
      })[key] ?? key;
  }),
}));

vi.mock('@/components/mit-sailing/admin/PublicAdminEditLink', () => ({
  PublicAdminEditLink: () => null,
}));

vi.mock('@/libs/I18nNavigation', () => ({
  Link: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{props.children}</a>
  ),
}));

function baseSailingClass(
  overrides: Partial<SailingClassCatalogDetail> = {}
): SailingClassCatalogDetail {
  return {
    classCategory: { name: 'Dinghies', slug: 'dinghies' },
    description: '<p>Class copy</p>',
    id: 'class-1',
    imagePaths: ['/images/classes/hero.jpg'],
    level: 'Beginner',
    name: 'Intro Sailing',
    grantableRatings: [],
    requiredRatings: [],
    prerequisiteIds: [],
    prerequisites: [],
    relatedEventIds: [],
    relatedEvents: [],
    slug: 'intro-sailing',
    unlockedBoatIds: [],
    unlockedBoats: [],
    ...overrides,
  };
}

describe('ClassDetailView', () => {
  it('renders only rich text images when description includes an allowed inline image', async () => {
    render(
      await ClassDetailView({
        locale: 'en',
        occurrenceBlocks: [],
        sailingClass: baseSailingClass({
          description:
            '<p>Class page copy</p><img alt="Sail trim" src="/cms-media/asset-1/trim.png" />',
        }),
      })
    );

    expect(screen.queryByAltText('Intro Sailing')).toBeNull();
    expect(screen.getByAltText('Sail trim')).toBeVisible();
  });

  it('shows catalog hero when description img is stripped by sanitizer', async () => {
    render(
      await ClassDetailView({
        locale: 'en',
        occurrenceBlocks: [],
        sailingClass: baseSailingClass({
          description:
            '<p>Class page copy</p><img alt="Legacy inline" src="/images/classes/legacy.jpg" />',
        }),
      })
    );

    expect(screen.getByAltText('Intro Sailing')).toBeVisible();
    expect(screen.queryByAltText('Legacy inline')).toBeNull();
  });

  it('renders unlocked boat fleet access copy as sanitized rich text', async () => {
    render(
      await ClassDetailView({
        locale: 'en',
        occurrenceBlocks: [],
        sailingClass: baseSailingClass({
          unlockedBoatIds: ['boat-1'],
          unlockedBoats: [
            {
              capacity: 2,
              description:
                '<p>Boat blurb</p><img alt="Hull" src="/cms-media/asset-1/hull.png" />',
              id: 'boat-1',
              imagePath: null,
              name: 'Tech Dinghy',
              slug: 'tech-dinghy',
              type: 'dinghy',
            },
          ],
        }),
      })
    );

    expect(screen.getByRole('heading', { name: 'Fleet access' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Tech Dinghy' })).toHaveAttribute(
      'href',
      '/fleet/tech-dinghy'
    );
    expect(screen.getByText('Boat blurb')).toBeVisible();
    expect(screen.getByAltText('Hull')).toBeVisible();
  });
});
