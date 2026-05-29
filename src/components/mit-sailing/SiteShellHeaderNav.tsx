import { getTranslations } from 'next-intl/server';
import {
  listClassCategoriesForNav,
  mapClassCategoriesToNavDropdownItems,
} from '@/libs/mit-sailing/classQueries';
import { safeCmsHref } from '@/libs/mit-sailing/cmsHref';
import { loadCmsMenu } from '@/libs/mit-sailing/cmsQueries';
import {
  listFleetBoatsForNav,
  mapFleetBoatsToNavDropdownItems,
} from '@/libs/mit-sailing/fleetQueries';
import type {
  SiteHeaderMenuItem,
  SiteHeaderMobileUtilityItem,
} from './site/SiteHeader';
import { SiteHeader } from './site/SiteHeader';
import { headerMenuItemsWithPricing } from './siteNavigationRequiredLinks';

type SiteShellHeaderNavProps = {
  /** Session snapshot from the parent shell (`getSession`). */
  initialSignedIn: boolean;
  /** True when the viewer is an admin and not impersonating. */
  initialShowAdminLink: boolean;
};

/**
 * Resolves Classes and Fleet dropdown data server-side and renders the site header.
 * Intended to render inside `<Suspense>` so the chrome can stream without blocking on nav queries.
 *
 * @param props - Props
 * @returns Sticky header with populated dropdowns when data loads
 */
export async function SiteShellHeaderNav(props: SiteShellHeaderNavProps) {
  const [categories, fleetBoats, headerMenu, mobileUtilityMenu, t] =
    await Promise.all([
      listClassCategoriesForNav(),
      listFleetBoatsForNav(),
      loadCmsMenu('header'),
      loadCmsMenu('mobile_utility'),
      getTranslations('MitSailingSite'),
    ]);

  const headerMenuItems = headerMenu.flatMap<SiteHeaderMenuItem>((item) => {
    const href = safeCmsHref(item.href) ?? undefined;
    const childItems = item.children.flatMap((child) => {
      const childHref = safeCmsHref(child.href);
      return childHref ? [{ label: child.label, href: childHref }] : [];
    });

    if (!href && childItems.length === 0 && !item.systemKey) {
      return [];
    }

    return [
      {
        id: item.id,
        label: item.label,
        href,
        isExternal: item.isExternal,
        systemKey: item.systemKey,
        items: childItems.length > 0 ? childItems : undefined,
      },
    ];
  });

  const mobileUtilityItems =
    mobileUtilityMenu.flatMap<SiteHeaderMobileUtilityItem>((item) => {
      const href = safeCmsHref(item.href);
      return href
        ? [
            {
              id: item.id,
              label: item.label,
              href,
              isExternal: item.isExternal,
            },
          ]
        : [];
    });

  return (
    <SiteHeader
      classesDropdownItems={mapClassCategoriesToNavDropdownItems(categories)}
      fleetDropdownItems={mapFleetBoatsToNavDropdownItems(fleetBoats)}
      headerMenuItems={
        headerMenuItems.length > 0
          ? headerMenuItemsWithPricing({
              items: headerMenuItems,
              pricingLabel: t('nav_pricing'),
            })
          : undefined
      }
      initialShowAdminLink={props.initialShowAdminLink}
      initialSignedIn={props.initialSignedIn}
      mobileUtilityItems={
        mobileUtilityItems.length > 0 ? mobileUtilityItems : undefined
      }
    />
  );
}
