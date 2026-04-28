import { getSession } from '@/libs/auth/dal';
import { listClassCategoriesForNav } from '@/libs/mit-sailing/classQueries';
import { listFleetBoatsForPublic } from '@/libs/mit-sailing/fleetQueries';
import type { NavigationDropdownItem } from './site/NavigationDropdown';
import { SiteConditionsBar } from './site/SiteConditionsBar';
import { SiteFooter } from './site/SiteFooter';
import { SiteHeader } from './site/SiteHeader';

type SiteShellProps = {
  children: React.ReactNode;
};

/**
 * Global site chrome for every page: conditions bar, sticky header with class
 * and fleet dropdowns, main content, and the dark footer. Wraps `children` so
 * routes render inside the same shell whether signed in or out.
 *
 * @param props - Shell props
 * @param props.children - Page body
 * @returns Full-page site chrome
 */
export async function SiteShell(props: SiteShellProps) {
  const session = await getSession();
  const initialSignedIn = Boolean(session?.user?.id);

  const [categories, fleetBoats] = await Promise.all([
    listClassCategoriesForNav(),
    listFleetBoatsForPublic(),
  ]);

  const classesDropdownItems: NavigationDropdownItem[] = categories.map(
    (c) => ({
      label: c.name,
      href: `/classes/#${c.slug}`,
    })
  );

  const fleetDropdownItems: NavigationDropdownItem[] = fleetBoats.map(
    (boat) => ({
      label: boat.name,
      href: `/fleet/${boat.slug}/`,
      description: boat.type,
    })
  );

  return (
    <div className="flex min-h-screen flex-col bg-white font-mit-sans text-mit-text">
      <SiteConditionsBar />
      <SiteHeader
        classesDropdownItems={classesDropdownItems}
        fleetDropdownItems={fleetDropdownItems}
        initialSignedIn={initialSignedIn}
      />
      <main className="flex-1">{props.children}</main>
      <SiteFooter />
    </div>
  );
}
