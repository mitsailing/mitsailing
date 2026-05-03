import { ImpersonationBanner } from '@/components/auth/ImpersonationBanner';
import { ProfileSideNav } from '@/components/auth/profile/ProfileSideNav';
import { SiteShell } from '@/components/mit-sailing/SiteShell';
import { SiteSidebarLayout } from '@/components/mit-sailing/SiteSidebarLayout';
import { verifySession } from '@/libs/auth/dal';

type ProfileSettingsChromeProps = {
  locale: string;
  /** App path (locale-prefixed when needed) used as `callbackUrl` after login. */
  loginCallbackUrl: string;
  children: React.ReactNode;
};

/**
 * Signed-in profile shell: site template, impersonation banner, and sidebar
 * settings nav (no horizontal account nav or admin shortcuts).
 *
 * @param props - Layout props
 * @returns Profile section with sidebar layout
 */
export async function ProfileSettingsChrome(props: ProfileSettingsChromeProps) {
  await verifySession(props.locale, props.loginCallbackUrl);

  return (
    <SiteShell>
      <div className="mx-auto max-w-7xl px-6 py-6">
        <ImpersonationBanner locale={props.locale} />
        <SiteSidebarLayout
          density="comfortable"
          sidebar={<ProfileSideNav />}
          stretch
        >
          <div className="min-w-0">{props.children}</div>
        </SiteSidebarLayout>
      </div>
    </SiteShell>
  );
}
