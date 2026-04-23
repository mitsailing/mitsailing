import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ImpersonationBanner } from '@/components/auth/ImpersonationBanner';
import { SignOutForm } from '@/components/auth/SignOutForm';
import { verifySession } from '@/libs/auth/dal';
import { Role } from '@/libs/auth/roles';
import { Link } from '@/libs/I18nNavigation';
import { BaseTemplate } from '@/templates/BaseTemplate';
import { getI18nPath } from '@/utils/Helpers';

export default async function DashboardLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const dashboardHref = getI18nPath('/dashboard/', locale);
  const session = await verifySession(locale, dashboardHref);

  const t = await getTranslations({ locale, namespace: 'DashboardLayout' });

  const isAdmin = session.user.role === Role.ADMIN;
  const isImpersonating = Boolean(session.session.impersonatedBy);

  return (
    <BaseTemplate
      leftNav={
        <>
          <li>
            <Link
              className="border-none text-gray-700 hover:text-gray-900"
              href="/dashboard/"
            >
              {t('dashboard_link')}
            </Link>
          </li>
          <li>
            <Link
              className="border-none text-gray-700 hover:text-gray-900"
              href="/dashboard/user-profile/"
            >
              {t('user_profile_link')}
            </Link>
          </li>
          {isAdmin && !isImpersonating ? (
            <li>
              <Link
                className="border-none text-gray-700 hover:text-gray-900"
                href="/dashboard/admin/"
              >
                {t('admin_link')}
              </Link>
            </li>
          ) : null}
        </>
      }
      rightNav={
        <li>
          <SignOutForm label={t('sign_out')} locale={locale} />
        </li>
      }
    >
      <ImpersonationBanner locale={locale} />
      {props.children}
    </BaseTemplate>
  );
}
