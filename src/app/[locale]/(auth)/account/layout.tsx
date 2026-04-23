import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ImpersonationBanner } from '@/components/auth/ImpersonationBanner';
import { SignOutForm } from '@/components/auth/SignOutForm';
import { MitSailingMainNavList } from '@/components/mit-sailing/MitSailingMainNavList';
import { MitSailingSiteTemplate } from '@/components/mit-sailing/MitSailingSiteTemplate';
import { verifySession } from '@/libs/auth/dal';
import { Role } from '@/libs/auth/roles';
import { Link } from '@/libs/I18nNavigation';
import { getI18nPath } from '@/utils/Helpers';

const LINK_CLASS = 'text-slate-800 hover:underline';

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
    <MitSailingSiteTemplate
      leftNav={<MitSailingMainNavList locale={locale} />}
      rightNav={
        <>
          <li>
            <Link className={LINK_CLASS} href="/account/">
              {t('account_home_link')}
            </Link>
          </li>
          <li>
            <Link className={LINK_CLASS} href="/account/profile/">
              {t('user_profile_link')}
            </Link>
          </li>
          {isAdmin && !isImpersonating ? (
            <li>
              <Link className={LINK_CLASS} href="/account/admin/">
                {t('admin_link')}
              </Link>
            </li>
          ) : null}
          <li>
            <SignOutForm label={t('sign_out')} locale={locale} />
          </li>
        </>
      }
    >
      <ImpersonationBanner locale={locale} />
      {props.children}
    </MitSailingSiteTemplate>
  );
}
