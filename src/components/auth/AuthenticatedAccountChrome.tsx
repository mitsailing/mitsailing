import { getTranslations } from 'next-intl/server';
import { ImpersonationBanner } from '@/components/auth/ImpersonationBanner';
import { MitSailingSiteTemplate } from '@/components/mit-sailing/MitSailingSiteTemplate';
import { verifySession } from '@/libs/auth/dal';
import { Role } from '@/libs/auth/roles';
import { Link } from '@/libs/I18nNavigation';

const LINK_CLASS =
  'text-sm font-medium text-mit-red no-underline hover:underline';

type AuthenticatedAccountChromeProps = {
  locale: string;
  /** App path (locale-prefixed when needed) used as `callbackUrl` after login. */
  loginCallbackUrl: string;
  children: React.ReactNode;
};

/**
 * Shared signed-in shell: site template, impersonation banner, and account
 * nav. Sign-out lives in `SiteHeader`. Used by `/account/*` and `/profile`.
 *
 * @param props - Layout props
 * @param props.locale - Active locale
 * @param props.loginCallbackUrl - Resume URL for unauthenticated redirects
 * @param props.children - Page body
 * @returns Account section with site template and navigation
 */
export async function AuthenticatedAccountChrome(
  props: AuthenticatedAccountChromeProps
) {
  const session = await verifySession(props.locale, props.loginCallbackUrl);
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'AccountLayout',
  });

  const isAdmin = session.user.role === Role.ADMIN;
  const isImpersonating = Boolean(session.session.impersonatedBy);

  return (
    <MitSailingSiteTemplate>
      <div className="mx-auto max-w-7xl px-6 py-6">
        <ImpersonationBanner locale={props.locale} />
        <nav
          aria-label="Account navigation"
          className="mb-6 flex flex-wrap items-center gap-4 border-b border-mit-line pb-4"
        >
          <Link className={LINK_CLASS} href="/account/">
            {t('account_home_link')}
          </Link>
          <Link className={LINK_CLASS} href="/profile/">
            {t('user_profile_link')}
          </Link>
          {isAdmin && !isImpersonating ? (
            <>
              <Link className={LINK_CLASS} href="/account/admin/">
                {t('admin_link')}
              </Link>
              <Link className={LINK_CLASS} href="/admin/class_categories/">
                {t('admin_class_categories_link')}
              </Link>
              <Link className={LINK_CLASS} href="/admin/fleet/">
                {t('admin_fleet_link')}
              </Link>
            </>
          ) : null}
        </nav>
        {props.children}
      </div>
    </MitSailingSiteTemplate>
  );
}
