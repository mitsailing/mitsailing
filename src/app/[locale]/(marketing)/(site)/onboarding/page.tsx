import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { SailingCardOnboardingForm } from '@/components/mit-sailing/onboarding/SailingCardOnboardingForm';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import {
  getCurrentSailingCardYear,
  hasCompletedCurrentYearSailingCardRequest,
} from '@/libs/mit-sailing/sailingCardValidity';
import { getI18nPath } from '@/utils/Helpers';

type OnboardingPageProps = {
  params: Promise<{ locale: string }>;
};

async function getOnboardingUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      mitId: true,
      mitClassYear: true,
      mitDataWarehouseVerifiedAt: true,
      emergencyContactName: true,
      emergencyContactEmail: true,
      emergencyContactPhone: true,
      phone: true,
      sailingAffiliation: true,
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
  return user;
}

type OnboardingUser = Awaited<ReturnType<typeof getOnboardingUser>>;

function initialValuesFromUser(currentUser: OnboardingUser) {
  return {
    affiliation: currentUser?.sailingAffiliation ?? '',
    cardType: 'normal',
    dateOfBirth: '',
    emergencyContactEmail: currentUser?.emergencyContactEmail ?? '',
    emergencyContactName: currentUser?.emergencyContactName ?? '',
    emergencyContactPhone: currentUser?.emergencyContactPhone ?? '',
    firstName: currentUser?.firstName ?? '',
    lastName: currentUser?.lastName ?? '',
    mitId: currentUser?.mitId ?? '',
    phone: currentUser?.phone ?? '',
    swimAgreementAccepted: false,
  };
}

function lockedIdentityFromUser(currentUser: OnboardingUser) {
  if (
    !currentUser?.mitDataWarehouseVerifiedAt ||
    !currentUser.firstName ||
    !currentUser.lastName
  ) {
    return;
  }

  return {
    firstName: currentUser.firstName,
    lastName: currentUser.lastName,
    mitClassYear: currentUser.mitClassYear,
  };
}

export async function generateMetadata(
  props: OnboardingPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'OnboardingPage' });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function OnboardingPage(props: OnboardingPageProps) {
  await connection();
  const { locale } = await props.params;
  setRequestLocale(locale);
  const user = await requireCurrentUser(locale, '/onboarding');
  const t = await getTranslations({ locale, namespace: 'OnboardingPage' });
  const currentUser = await getOnboardingUser(user.id);

  if (
    currentUser !== null &&
    hasCompletedCurrentYearSailingCardRequest(
      currentUser.sailingCardRequests.at(0) ?? null
    )
  ) {
    redirect(getI18nPath('/onboarding/success', locale));
  }

  const initialValues = initialValuesFromUser(currentUser);
  const lockedIdentity = lockedIdentityFromUser(currentUser);

  return (
    <SiteSectionShell locale={locale} segments={[{ label: t('breadcrumb') }]}>
      <SiteSectionMain maxWidth="5xl" variant="detail">
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          <div>
            <h1 className="text-3xl font-semibold text-mit-text">
              {t('title')}
            </h1>
            <p className="mt-3 text-sm leading-6 text-mit-text">
              {t('description')}
            </p>
          </div>

          <SailingCardOnboardingForm
            initialValues={initialValues}
            lockedIdentity={lockedIdentity}
          />
        </div>
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
