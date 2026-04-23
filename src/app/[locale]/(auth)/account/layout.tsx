import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ImpersonationBanner } from '@/components/auth/ImpersonationBanner';
import { SignOutForm } from '@/components/auth/SignOutForm';
import { MitSailingSiteTemplate } from '@/components/mit-sailing/MitSailingSiteTemplate';
import { verifySession } from '@/libs/auth/dal';
import { Role } from '@/libs/auth/roles';
import { Link } from '@/libs/I18nNavigation';
import { getI18nPath } from '@/utils/Helpers';

const LINK_CLASS =
  'text-[#A31F34] font-medium text-sm hover:underline no-underline';

export default async function AccountLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const accountHref = getI18nPath('/account/', locale);
  const session = await verifySession(locale, accountHref);
  const t = await getTranslations({ locale, namespace: 'AccountLayout' });

  const isAdmin = session.user.role === Role.ADMIN;
  const isImpersonating = Boolean(session.session.impersonatedBy);

  return (
    <MitSailingSiteTemplate>
      <div className="mx-auto max-w-7xl px-6 py-6">
        <ImpersonationBanner locale={locale} />
        <nav
          aria-label="Account navigation"
          className="mb-6 flex flex-wrap items-center gap-4 border-b border-slate-200 pb-4"
        >
          <Link className={LINK_CLASS} href="/account/">
            {t('account_home_link')}
          </Link>
          <Link className={LINK_CLASS} href="/account/profile/">
            {t('user_profile_link')}
          </Link>
          {isAdmin && !isImpersonating ? (
            <Link className={LINK_CLASS} href="/account/admin/">
              {t('admin_link')}
            </Link>
          ) : null}
          <SignOutForm label={t('sign_out')} locale={locale} />
        </nav>
        {props.children}
      </div>
    </MitSailingSiteTemplate>
  );
}
