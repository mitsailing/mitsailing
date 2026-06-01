import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ClassQueries from '@/libs/mit-sailing/classQueries';
import type { PublicCmsMenuItem } from '@/libs/mit-sailing/cmsQueries';
import type * as FleetQueries from '@/libs/mit-sailing/fleetQueries';

const {
  getTranslations,
  listClassCategoriesForNav,
  listFleetBoatsForNav,
  loadCmsMenu,
} = vi.hoisted(() => ({
  getTranslations: vi.fn(),
  listClassCategoriesForNav: vi.fn(),
  listFleetBoatsForNav: vi.fn(),
  loadCmsMenu: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next-intl/server', () => ({
  getTranslations,
}));

vi.mock('@/libs/mit-sailing/classQueries', async (importOriginal) => {
  const actual = await importOriginal<typeof ClassQueries>();
  return {
    ...actual,
    listClassCategoriesForNav,
  };
});

vi.mock('@/libs/mit-sailing/cmsQueries', () => ({
  loadCmsMenu,
}));

vi.mock('@/libs/mit-sailing/fleetQueries', async (importOriginal) => {
  const actual = await importOriginal<typeof FleetQueries>();
  return {
    ...actual,
    listFleetBoatsForNav,
  };
});

vi.mock('./site/SiteHeader', () => ({
  SiteHeader: () => null,
}));

const cmsMenuItem = (
  item: Omit<PublicCmsMenuItem, 'children' | 'isExternal'> & {
    children?: PublicCmsMenuItem[];
    isExternal?: boolean;
  }
): PublicCmsMenuItem => ({
  children: item.children ?? [],
  href: item.href,
  id: item.id,
  isExternal: item.isExternal ?? false,
  label: item.label,
  systemKey: item.systemKey,
});

describe('SiteShellHeaderNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTranslations.mockResolvedValue((key: string) =>
      key === 'nav_pricing' ? 'Pricing' : key
    );
    listClassCategoriesForNav.mockResolvedValue([
      { displayOrder: 1, id: 'beginner', name: 'Beginner', slug: 'beginner' },
    ]);
    listFleetBoatsForNav.mockResolvedValue([
      { id: 'tech', name: 'Tech dinghy', slug: 'tech-dinghy' },
    ]);
  });

  it('maps CMS menus into site header nav props', async () => {
    const unsafeHref = ['java', 'script:alert(1)'].join('');
    loadCmsMenu.mockImplementation(async (location: string) => {
      await Promise.resolve();
      if (location === 'header') {
        return [
          cmsMenuItem({
            children: [
              cmsMenuItem({
                href: '/classes#intro',
                id: 'classes-child',
                label: 'Intro class',
              }),
              cmsMenuItem({
                href: unsafeHref,
                id: 'unsafe-child',
                label: 'Unsafe child',
              }),
            ],
            href: '/classes',
            id: 'classes',
            label: 'Classes',
            systemKey: 'classes',
          }),
          cmsMenuItem({
            id: 'fleet',
            label: 'Fleet',
            systemKey: 'fleet',
          }),
          cmsMenuItem({
            href: 'https://example.com/donate',
            id: 'donate',
            isExternal: true,
            label: 'Donate',
          }),
          cmsMenuItem({
            id: 'empty',
            label: 'Empty',
          }),
        ];
      }
      if (location === 'mobile_utility') {
        return [
          cmsMenuItem({
            href: '/reserve',
            id: 'reserve',
            label: 'Reserve',
          }),
          cmsMenuItem({
            href: unsafeHref,
            id: 'unsafe-mobile',
            label: 'Unsafe mobile',
          }),
        ];
      }
      return [];
    });

    const { SiteShellHeaderNav } = await import('./SiteShellHeaderNav');
    const element = (await SiteShellHeaderNav({
      initialShowAdminLink: true,
      initialSignedIn: true,
    })) as React.ReactElement<{
      classesDropdownItems: { href: string; label: string }[];
      fleetDropdownItems: { href: string; label: string }[];
      headerMenuItems: {
        href?: string;
        id: string;
        isExternal?: boolean;
        items?: { href: string; label: string }[];
        label: string;
        systemKey?: string;
      }[];
      initialShowAdminLink: boolean;
      initialSignedIn: boolean;
      mobileUtilityItems: {
        href: string;
        id: string;
        isExternal?: boolean;
        label: string;
      }[];
    }>;

    expect(loadCmsMenu).toHaveBeenCalledWith('header');
    expect(loadCmsMenu).toHaveBeenCalledWith('mobile_utility');
    expect(element.props.initialSignedIn).toBe(true);
    expect(element.props.initialShowAdminLink).toBe(true);
    expect(element.props.classesDropdownItems).toEqual([
      { href: '/classes#beginner', label: 'Beginner' },
    ]);
    expect(element.props.fleetDropdownItems).toEqual([
      { href: '/fleet/tech-dinghy', label: 'Tech dinghy' },
    ]);
    expect(element.props.headerMenuItems).toEqual([
      {
        href: '/classes',
        id: 'classes',
        isExternal: false,
        items: [{ href: '/classes#intro', label: 'Intro class' }],
        label: 'Classes',
        systemKey: 'classes',
      },
      {
        href: undefined,
        id: 'fleet',
        isExternal: false,
        items: undefined,
        label: 'Fleet',
        systemKey: 'fleet',
      },
      {
        href: 'https://example.com/donate',
        id: 'donate',
        isExternal: true,
        items: undefined,
        label: 'Donate',
        systemKey: undefined,
      },
      {
        href: '/pricing',
        id: 'site-shell-header-pricing-fallback',
        label: 'Pricing',
        systemKey: 'pricing',
      },
    ]);
    expect(element.props.mobileUtilityItems).toEqual([
      {
        href: '/reserve',
        id: 'reserve',
        isExternal: false,
        label: 'Reserve',
      },
    ]);
  });
});
