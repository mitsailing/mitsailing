import type { SiteHeaderMenuItem } from '@/components/mit-sailing/site/SiteHeader';
import type { PublicCmsMenuItem } from '@/libs/mit-sailing/cmsQueries';

export function headerMenuItemsWithPricing(props: {
  readonly items: readonly SiteHeaderMenuItem[];
  readonly pricingLabel: string;
}): SiteHeaderMenuItem[] {
  if (props.items.length === 0) {
    return [];
  }

  if (
    props.items.some(
      (item) => item.href === '/pricing' || item.systemKey === 'pricing'
    )
  ) {
    return [...props.items];
  }

  const pricingItem = {
    id: 'site-shell-header-pricing-fallback',
    label: props.pricingLabel,
    href: '/pricing',
    systemKey: 'pricing',
  } satisfies SiteHeaderMenuItem;
  const calendarIndex = props.items.findIndex(
    (item) => item.href === '/events' || item.systemKey === 'calendar'
  );
  if (calendarIndex !== -1) {
    return [
      ...props.items.slice(0, calendarIndex + 1),
      pricingItem,
      ...props.items.slice(calendarIndex + 1),
    ];
  }

  return [...props.items, pricingItem];
}

export function footerMenuWithPricing(props: {
  readonly footerMenu: readonly PublicCmsMenuItem[];
  readonly pricingLabel: string;
}): PublicCmsMenuItem[] {
  if (props.footerMenu.length === 0) {
    return [];
  }

  if (
    props.footerMenu.some((group) =>
      group.children.some((link) => link.href === '/pricing')
    )
  ) {
    return [...props.footerMenu];
  }

  const pricingItem = {
    id: 'site-footer-pricing-fallback',
    label: props.pricingLabel,
    href: '/pricing',
    isExternal: false,
    children: [],
  } satisfies PublicCmsMenuItem;
  const aboutGroupIndex = props.footerMenu.findIndex(
    (group) => group.id === 'cms-menu-footer-about'
  );

  if (aboutGroupIndex !== -1) {
    return props.footerMenu.map((group, index) =>
      index === aboutGroupIndex
        ? { ...group, children: [pricingItem, ...group.children] }
        : group
    );
  }

  return [...props.footerMenu];
}
