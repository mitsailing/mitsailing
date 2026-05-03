import {
  listClassCategoriesForNav,
  mapClassCategoriesToNavDropdownItems,
} from '@/libs/mit-sailing/classQueries';
import {
  listFleetBoatsForPublic,
  mapFleetBoatsToNavDropdownItems,
} from '@/libs/mit-sailing/fleetQueries';
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
  const [categories, fleetBoats] = await Promise.all([
    listClassCategoriesForNav(),
    listFleetBoatsForPublic(),
  ]);

  return (
    <SiteHeader
      classesDropdownItems={mapClassCategoriesToNavDropdownItems(categories)}
      fleetDropdownItems={mapFleetBoatsToNavDropdownItems(fleetBoats)}
      initialShowAdminLink={props.initialShowAdminLink}
      initialSignedIn={props.initialSignedIn}
    />
  );
}
