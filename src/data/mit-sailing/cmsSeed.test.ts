import { describe, expect, it } from 'vitest';
import { parseCmsPricingBody } from '@/libs/mit-sailing/cmsPricing';
import type { CmsSeedMenu } from './cmsSeed';
import {
  CMS_MENU_SEED_ROWS,
  CMS_PAGE_SEED_ROWS,
  orderedCmsSeedMenuItems,
} from './cmsSeed';

describe('orderedCmsSeedMenuItems', () => {
  it('orders parents before children', () => {
    const menu = {
      id: 'menu',
      location: 'footer',
      title: 'Footer',
      items: [
        {
          kind: 'group',
          id: 'child',
          parentId: 'parent',
          label: 'Child',
          isVisible: true,
          displayOrder: 0,
        },
        {
          kind: 'group',
          id: 'parent',
          label: 'Parent',
          isVisible: true,
          displayOrder: 0,
        },
      ],
    } satisfies CmsSeedMenu;

    expect(orderedCmsSeedMenuItems(menu).map((item) => item.id)).toEqual([
      'parent',
      'child',
    ]);
  });

  it('rejects missing parent references', () => {
    const menu = {
      id: 'menu',
      location: 'footer',
      title: 'Footer',
      items: [
        {
          kind: 'group',
          id: 'child',
          parentId: 'missing',
          label: 'Child',
          isVisible: true,
          displayOrder: 0,
        },
      ],
    } satisfies CmsSeedMenu;

    expect(() => orderedCmsSeedMenuItems(menu)).toThrow(
      'CMS menu seed "menu" item "child" references missing parent "missing"'
    );
  });

  it('rejects duplicate item ids', () => {
    const menu = {
      id: 'menu',
      location: 'footer',
      title: 'Footer',
      items: [
        {
          kind: 'group',
          id: 'dup',
          label: 'First',
          isVisible: true,
          displayOrder: 0,
        },
        {
          kind: 'group',
          id: 'dup',
          label: 'Second',
          isVisible: true,
          displayOrder: 1,
        },
      ],
    } satisfies CmsSeedMenu;

    expect(() => orderedCmsSeedMenuItems(menu)).toThrow(
      'CMS menu seed "menu" contains duplicate item "dup"'
    );
  });

  it('rejects parent cycles', () => {
    const menu = {
      id: 'menu',
      location: 'footer',
      title: 'Footer',
      items: [
        {
          kind: 'group',
          id: 'a',
          parentId: 'b',
          label: 'A',
          isVisible: true,
          displayOrder: 0,
        },
        {
          kind: 'group',
          id: 'b',
          parentId: 'a',
          label: 'B',
          isVisible: true,
          displayOrder: 1,
        },
      ],
    } satisfies CmsSeedMenu;

    expect(() => orderedCmsSeedMenuItems(menu)).toThrow(
      'CMS menu seed "menu" contains a parent cycle at item "a"'
    );
  });
});

describe('cms seed membership pricing', () => {
  it('keeps the home getting-started step from hiding paid racing paths', () => {
    const homePage = CMS_PAGE_SEED_ROWS.find((page) => page.path === '/');
    const overviewBlock = homePage?.blocks.find(
      (block) => block.id === 'cms-block-home-overview'
    );
    const overview: unknown = JSON.parse(overviewBlock?.body ?? '{}');
    const steps =
      typeof overview === 'object' && overview !== null
        ? Object.getOwnPropertyDescriptor(overview, 'steps')?.value
        : undefined;
    const firstStep = Array.isArray(steps) ? steps.at(0) : undefined;
    const description =
      typeof firstStep === 'object' && firstStep !== null
        ? Object.getOwnPropertyDescriptor(firstStep, 'description')?.value
        : undefined;

    expect(description).toBe(
      'MIT students and MIT Recreation members get Normal included, including Charles River racing. Others can compare paid racing cards before requesting a card.'
    );
  });

  it('compares sailing card types on the home page', () => {
    const homePage = CMS_PAGE_SEED_ROWS.find((page) => page.path === '/');
    const pricingBlock = homePage?.blocks.find(
      (block) => block.id === 'cms-block-home-membership-pricing'
    );
    const pricing = parseCmsPricingBody(pricingBlock?.body);

    expect(pricingBlock?.title).toBe('Pricing');
    expect(pricingBlock?.subtitle).toBe(
      'Choose the card that matches what you want to sail.'
    );
    expect(pricing).toMatchObject({
      footnoteLinkLabel: 'See MIT Recreation rates',
      footnoteLinkUrl: '/pricing',
    });
    expect(pricing?.footnote).toBeUndefined();
    expect(pricing?.plans.map((plan) => plan.title)).toEqual([
      'Normal',
      'Spring racing card',
      'Full-year racing card',
      'Thursday team racing',
    ]);
    expect(pricing?.plans[0]).toMatchObject({
      linkLabel: 'Sign up',
      linkUrl: '/signup?callbackUrl=%2Fonboarding',
      price: 'Free',
      priceRows: [
        { label: 'MIT student', value: 'Free' },
        { label: 'MIT Recreation member', value: 'Free' },
      ],
    });
    expect(pricing?.plans[0]?.description).toBe(
      'Pavilion, classes, ratings, racing, Mashnee.'
    );
    expect(pricing?.plans[0]?.features).toContain(
      'Normal access to Pavilion sailing, classes, ratings, racing, and Mashnee.'
    );
    expect(pricing?.plans[0]?.features).toContain(
      'MIT Recreation members qualify with an active membership.'
    );
    expect(pricing?.plans[1]).toMatchObject({
      linkLabel: 'Sign up',
      linkUrl: '/signup?callbackUrl=%2Fonboarding',
      price: '$25',
      priceRows: [
        { label: 'Non-MIT student', value: '$25' },
        { label: 'Under 30', value: '$70' },
        { label: '30+', value: '$100' },
      ],
    });
    expect(pricing?.plans[2]).toMatchObject({
      linkLabel: 'Sign up',
      linkUrl: '/signup?callbackUrl=%2Fonboarding',
      price: '$40',
      priceRows: [
        { label: 'Non-MIT student', value: '$40' },
        { label: 'Under 30', value: '$125' },
        { label: '30+', value: '$175' },
      ],
    });
    expect(pricing?.plans[3]).toMatchObject({
      description: 'For Thursday team racing on the Charles River.',
      linkLabel: 'Sign up',
      linkUrl: '/signup?callbackUrl=%2Fonboarding',
      price: '$25',
      priceRows: [
        { label: 'Non-MIT student', value: '$25' },
        { label: 'Under 30', value: '$70' },
        { label: '30+', value: '$100' },
      ],
    });
    expect(pricing?.plans[3]?.features).toContain(
      'Thursday team racing on the Charles River.'
    );
    expect(pricingBlock?.body).not.toContain('Not MIT Sailing Team');
  });

  it('links the seeded header and footer to pricing', () => {
    const headerMenu = CMS_MENU_SEED_ROWS.find(
      (menu) => menu.id === 'cms-menu-header'
    );
    const headerPricingItem = headerMenu?.items.find(
      (item) => item.id === 'cms-menu-header-pricing'
    );
    const footerMenu = CMS_MENU_SEED_ROWS.find(
      (menu) => menu.id === 'cms-menu-footer'
    );
    const membershipItem = footerMenu?.items.find(
      (item) => item.id === 'cms-menu-footer-membership'
    );

    expect(headerPricingItem).toMatchObject({
      kind: 'url_link',
      label: 'Pricing',
      url: '/pricing',
      isVisible: true,
    });
    expect(membershipItem).toMatchObject({
      kind: 'url_link',
      label: 'Pricing',
      url: '/pricing',
      isVisible: true,
    });
  });
});
