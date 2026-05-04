import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { adminHeaderLinkVisibleFromSession } from '@/libs/auth/adminHeaderLink';
import { getSession } from '@/libs/auth/dal';
import { SiteFooter } from './site/SiteFooter';
import { SiteHeader } from './site/SiteHeader';
import {
  WeatherConditionsBar,
  WeatherConditionsBarSkeleton,
} from './site/WeatherConditionsBar';
import { SiteShellHeaderNav } from './SiteShellHeaderNav';

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
  const initialShowAdminLink = adminHeaderLinkVisibleFromSession({
    userId: session?.user?.id,
    userRole: session?.user?.role,
    impersonatedBy: session?.session?.impersonatedBy,
  });

  const tMitSite = await getTranslations('MitSailingSite');

  return (
    <div className="flex min-h-screen flex-col bg-background font-mit-sans text-mit-text">
      <Suspense fallback={<WeatherConditionsBarSkeleton tMitSite={tMitSite} />}>
        <WeatherConditionsBar tMitSite={tMitSite} />
      </Suspense>
      <Suspense
        fallback={
          <SiteHeader
            classesDropdownItems={[]}
            fleetDropdownItems={[]}
            initialShowAdminLink={initialShowAdminLink}
            initialSignedIn={initialSignedIn}
          />
        }
      >
        <SiteShellHeaderNav
          initialShowAdminLink={initialShowAdminLink}
          initialSignedIn={initialSignedIn}
        />
      </Suspense>
      <div className="flex min-h-0 flex-1 flex-col" id="site-shell-inert-scope">
        <main className="flex-1">{props.children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}
