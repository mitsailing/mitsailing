import { describe, expect, it } from 'vitest';
import {
  footerMenuWithPricing,
  headerMenuItemsWithPricing,
} from './siteNavigationRequiredLinks';

describe('headerMenuItemsWithPricing', () => {
  it('adds pricing after calendar when CMS header data omits it', () => {
    expect(
      headerMenuItemsWithPricing({
        items: [
          { id: 'classes', label: 'Classes', href: '/classes' },
          { id: 'calendar', label: 'Calendar', href: '/events' },
          { id: 'about', label: 'About', href: '/about' },
        ],
        pricingLabel: 'Pricing',
      })
    ).toEqual([
      { id: 'classes', label: 'Classes', href: '/classes' },
      { id: 'calendar', label: 'Calendar', href: '/events' },
      {
        id: 'site-shell-header-pricing-fallback',
        label: 'Pricing',
        href: '/pricing',
        systemKey: 'pricing',
      },
      { id: 'about', label: 'About', href: '/about' },
    ]);
  });

  it('does not duplicate pricing when CMS header data includes it', () => {
    const menu = [
      { id: 'calendar', label: 'Calendar', href: '/events' },
      { id: 'pricing', label: 'Pricing', href: '/pricing' },
    ];

    expect(
      headerMenuItemsWithPricing({
        items: menu,
        pricingLabel: 'Pricing',
      })
    ).toEqual(menu);
  });
});

describe('footerMenuWithPricing', () => {
  it('adds pricing to the about footer group when CMS footer data omits it', () => {
    expect(
      footerMenuWithPricing({
        footerMenu: [
          {
            id: 'cms-menu-footer-about',
            label: 'About',
            isExternal: false,
            children: [
              {
                id: 'about',
                label: 'About Us',
                href: '/about',
                isExternal: false,
                children: [],
              },
            ],
          },
        ],
        groupLabel: 'About',
        pricingLabel: 'Pricing',
      })
    ).toEqual([
      {
        id: 'cms-menu-footer-about',
        label: 'About',
        isExternal: false,
        children: [
          {
            id: 'site-footer-pricing-fallback',
            label: 'Pricing',
            href: '/pricing',
            isExternal: false,
            children: [],
          },
          {
            id: 'about',
            label: 'About Us',
            href: '/about',
            isExternal: false,
            children: [],
          },
        ],
      },
    ]);
  });

  it('does not duplicate pricing when CMS footer data includes it', () => {
    const menu = [
      {
        id: 'cms-menu-footer-about',
        label: 'About',
        isExternal: false,
        children: [
          {
            id: 'pricing',
            label: 'Pricing',
            href: '/pricing',
            isExternal: false,
            children: [],
          },
        ],
      },
    ];

    expect(
      footerMenuWithPricing({
        footerMenu: menu,
        groupLabel: 'About',
        pricingLabel: 'Pricing',
      })
    ).toEqual(menu);
  });
});
