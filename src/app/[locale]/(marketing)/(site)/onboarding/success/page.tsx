import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import {
  getAppRolePermissions,
  hasPermission,
  Permission,
} from '@/libs/auth/appPermissions';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { Link } from '@/libs/I18nNavigation';
import {
  getCurrentSailingCardYear,
  hasCompletedCurrentYearSailingCardRequest,
} from '@/libs/mit-sailing/sailingCardValidity';
import { getI18nPath } from '@/utils/Helpers';

type OnboardingSuccessPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export async function generateMetadata(
  props: OnboardingSuccessPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'OnboardingSuccessPage',
  });
  return { title: t('meta_title') };
}

export default async function OnboardingSuccessPage(
  props: OnboardingSuccessPageProps
) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const user = await requireCurrentUser(locale, '/onboarding/success');
  const t = await getTranslations({
    locale,
    namespace: 'OnboardingSuccessPage',
  });
  const canViewAdmin = hasPermission(
    getAppRolePermissions(user.role),
    Permission.ADMIN_VIEW
  );
  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      sailingCardRequests: {
        orderBy: { requestedAt: 'desc' },
        take: 1,
        where: {
          cardYear: getCurrentSailingCardYear(),
        },
        select: {
          cardYear: true,
          legalAgreementAcceptance: {
            select: {
              agreementHash: true,
              agreementVersion: true,
              source: true,
              userId: true,
            },
          },
          status: true,
          userId: true,
          user: {
            select: {
              emergencyContactName: true,
              emergencyContactPhone: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  if (
    currentUser === null ||
    !hasCompletedCurrentYearSailingCardRequest(
      currentUser.sailingCardRequests.at(0) ?? null
    )
  ) {
    redirect(getI18nPath('/onboarding', locale));
  }

  return (
    <SiteSectionShell
      locale={locale}
      segments={[
        { href: '/onboarding', label: t('breadcrumb_onboarding') },
        { label: t('breadcrumb') },
      ]}
    >
      <SiteSectionMain maxWidth="5xl" variant="detail">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-semibold text-mit-text">{t('title')}</h1>
          <p className="mt-3 text-sm leading-6 text-mit-text">
            {t('description')}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="rounded-md bg-mit-red px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-mit-red/90"
              href="/events"
            >
              {t('events_link')}
            </Link>
            {canViewAdmin ? (
              <Link
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-mit-text no-underline hover:bg-muted"
                href="/admin"
              >
                {t('admin_link')}
              </Link>
            ) : null}
          </div>
        </div>
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
