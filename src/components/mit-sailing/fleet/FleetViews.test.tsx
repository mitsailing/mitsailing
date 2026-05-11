import { render, screen } from '@testing-library/react';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FleetBoatDetailView } from './FleetBoatDetailView';
import { FleetListView } from './FleetListView';

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => {
    await Promise.resolve();
    return (key: string) =>
      ({
        back_to_fleet: 'Back to Fleet',
        capacity_label: 'Capacity',
        card_cta: 'Details',
        crew_many: 'people',
        crew_one: 'person',
        list_heading: 'Fleet',
        list_intro: 'Fleet intro',
        photo_placeholder: 'Photo placeholder',
        required_class_heading: 'Required class',
        required_class_label: 'Required class:',
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

describe('FleetListView', () => {
  it('renders fleet image alt text from boat name', async () => {
    render(
      await FleetListView({
        boats: [
          {
            capacity: 2,
            description: 'Stable trainer',
            id: 'boat-1',
            imagePath: '/images/boats/tech.jpg',
            name: 'Tech Dinghy',
            requiredClass: { name: 'Intro Sailing 101', slug: 'intro' },
            requiredRatings: [],
            slug: 'tech-dinghy',
            type: 'training dinghy',
          },
        ],
        locale: 'en',
      })
    );

    expect(screen.getByAltText('Tech Dinghy')).toBeVisible();
  });
});

describe('FleetBoatDetailView', () => {
  it('renders only rich text images on boat detail pages', async () => {
    render(
      await FleetBoatDetailView({
        boat: {
          capacity: 2,
          description:
            '<p>Boat page copy</p><img alt="Rigging detail" src="/cms-media/asset-1/rigging.png" />',
          id: 'boat-1',
          imagePath: '/images/boats/tech.jpg',
          name: 'Tech Dinghy',
          requiredClass: {
            id: 'class-1',
            name: 'Intro Sailing 101',
            slug: 'intro-sailing-101',
          },
          advancedRatings: [],
          requiredRatings: [],
          slug: 'tech-dinghy',
          type: 'training dinghy',
        },
        locale: 'en',
      })
    );

    expect(screen.queryByAltText('Tech Dinghy')).toBeNull();
    expect(screen.getByAltText('Rigging detail')).toBeVisible();
  });

  it('shows catalog hero when description img is stripped by sanitizer', async () => {
    render(
      await FleetBoatDetailView({
        boat: {
          capacity: 2,
          description:
            '<p>Boat page copy</p><img alt="Legacy inline" src="/images/boats/legacy.jpg" />',
          id: 'boat-1',
          imagePath: '/images/boats/tech.jpg',
          name: 'Tech Dinghy',
          requiredClass: {
            id: 'class-1',
            name: 'Intro Sailing 101',
            slug: 'intro-sailing-101',
          },
          advancedRatings: [],
          requiredRatings: [],
          slug: 'tech-dinghy',
          type: 'training dinghy',
        },
        locale: 'en',
      })
    );

    expect(screen.getByAltText('Tech Dinghy')).toBeVisible();
    expect(screen.queryByAltText('Legacy inline')).toBeNull();
  });
});
