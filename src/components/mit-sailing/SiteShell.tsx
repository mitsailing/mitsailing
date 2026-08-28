import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { ImpersonationBanner } from '@/components/auth/ImpersonationBanner';
import { adminHeaderLinkVisibleFromSession } from '@/libs/auth/adminHeaderLink';
import { getSession } from '@/libs/auth/dal';
import { SiteFooter } from './site/SiteFooter';
import { SiteHeader } from './site/SiteHeader';
import { SitePreviewBanner } from './site/SitePreviewBanner';
import {
  WeatherConditionsBar,
  WeatherConditionsBarSkeleton,
} from './site/WeatherConditionsBar';
import { SiteShellAlertsTopBar } from './SiteShellAlertsTopBar';
import { SiteShellHeaderNav } from './SiteShellHeaderNav';

type SiteShellProps = {
  children: React.ReactNode;
};

type SiteShellSession = {
  session?: { impersonatedBy?: string | null } | null;
  user?: {
    appRole?: unknown;
    banned?: unknown;
    emailVerified?: unknown;
    id?: string;
  } | null;
} | null;

export function shouldShowAdminLink(session: SiteShellSession): boolean {
  return adminHeaderLinkVisibleFromSession({
    userId: session?.user?.id,
    userAppRole: session?.user?.appRole,
    userBanned: session?.user?.banned,
    userEmailVerified: session?.user?.emailVerified,
    impersonatedBy: session?.session?.impersonatedBy,
  });
}

/**
 * Global site chrome for every page: impersonation notice, conditions bar,
 * sticky header with class and fleet dropdowns, main content, and the dark
 * footer. Wraps `children` so routes render inside the same shell whether
 * signed in or out.
 *
 * @param props - Shell props
 * @param props.children - Page body
 * @returns Full-page site chrome
 */
export async function SiteShell(props: SiteShellProps) {
  const session = await getSession();
  const locale = await getLocale();
  const initialSignedIn = Boolean(session?.user?.id);
  const initialShowAdminLink = shouldShowAdminLink(session);

  const tMitSite = await getTranslations('MitSailingSite');
  const previewBanner = await SitePreviewBanner();

  return (
    <div className="flex min-h-screen flex-col bg-background font-mit-sans text-mit-text">
      {previewBanner}
      <Suspense fallback={null}>
        <ImpersonationBanner locale={locale} />
      </Suspense>
      <Suspense fallback={<WeatherConditionsBarSkeleton tMitSite={tMitSite} />}>
        <WeatherConditionsBar tMitSite={tMitSite} />
      </Suspense>
      <Suspense fallback={null}>
        <SiteShellAlertsTopBar />
      </Suspense>
      <Suspense
        fallback={
          <SiteHeader
            classesDropdownItems={[]}
            fleetDropdownItems={[]}
            headerMenuItems={[]}
            initialShowAdminLink={initialShowAdminLink}
            initialSignedIn={initialSignedIn}
            mobileUtilityItems={[]}
            onboardingTaskHref={null}
          />
        }
      >
        <SiteShellHeaderNav
          initialShowAdminLink={initialShowAdminLink}
          initialSignedIn={initialSignedIn}
          userId={session?.user?.id}
        />
      </Suspense>
      <div className="flex min-h-0 flex-1 flex-col" id="site-shell-inert-scope">
        <main className="flex-1">{props.children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}
