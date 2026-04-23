import { FLEET_BOATS } from '@/data/mit-sailing/classesFleetSeed';
import { getSession } from '@/libs/auth/dal';
import type { NavigationDropdownItem } from './site/NavigationDropdown';
import { SiteConditionsBar } from './site/SiteConditionsBar';
import { SiteFooter } from './site/SiteFooter';
import { SiteHeader } from './site/SiteHeader';

type MitSailingSiteTemplateProps = {
  children: React.ReactNode;
};

/**
 * Public + signed-in site chrome (mit-redesign parity).
 *
 * Renders the conditions bar, sticky header, main content, and dark footer
 * around `children` so every page gets the same shell.
 *
 * @param props - Template props
 * @param props.children - Main page content
 * @returns Full-page shell
 */
export async function MitSailingSiteTemplate(
  props: MitSailingSiteTemplateProps
) {
  const session = await getSession();
  const initialSignedIn = Boolean(session?.user?.id);

  const fleetDropdownItems: NavigationDropdownItem[] = FLEET_BOATS.map(
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
        fleetDropdownItems={fleetDropdownItems}
        initialSignedIn={initialSignedIn}
      />
      <main className="flex-1">{props.children}</main>
      <SiteFooter />
    </div>
  );
}
