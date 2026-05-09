import {
  listClassCategoriesForNav,
  mapClassCategoriesToNavDropdownItems,
} from '@/libs/mit-sailing/classQueries';
import { loadCmsMenu } from '@/libs/mit-sailing/cmsQueries';
import {
  listFleetBoatsForPublic,
  mapFleetBoatsToNavDropdownItems,
} from '@/libs/mit-sailing/fleetQueries';
import type {
  SiteHeaderMenuItem,
  SiteHeaderMobileUtilityItem,
} from './site/SiteHeader';
import { SiteHeader } from './site/SiteHeader';

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
  const [categories, fleetBoats, headerMenu, mobileUtilityMenu] =
    await Promise.all([
      listClassCategoriesForNav(),
      listFleetBoatsForPublic(),
      loadCmsMenu('header'),
      loadCmsMenu('mobile_utility'),
    ]);

  const headerMenuItems: SiteHeaderMenuItem[] = headerMenu.map((item) => ({
    id: item.id,
    label: item.label,
    href: item.href,
    isExternal: item.isExternal,
    systemKey: item.systemKey,
    items:
      item.children.length > 0
        ? item.children.map((child) => ({
            label: child.label,
            href: child.href ?? '#',
          }))
        : undefined,
  }));
  const mobileUtilityItems: SiteHeaderMobileUtilityItem[] =
    mobileUtilityMenu.flatMap((item) =>
      item.href
        ? [
            {
              id: item.id,
              label: item.label,
              href: item.href,
              isExternal: item.isExternal,
            },
          ]
        : []
    );

  return (
    <SiteHeader
      classesDropdownItems={mapClassCategoriesToNavDropdownItems(categories)}
      fleetDropdownItems={mapFleetBoatsToNavDropdownItems(fleetBoats)}
      headerMenuItems={headerMenuItems}
      initialShowAdminLink={props.initialShowAdminLink}
      initialSignedIn={props.initialSignedIn}
      mobileUtilityItems={mobileUtilityItems}
    />
  );
}
