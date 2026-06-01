import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type * as React from 'react';
import { SailingCardOnboardingForm } from '@/components/mit-sailing/onboarding/SailingCardOnboardingForm';
import {
  PaymentPurpose,
  PaymentStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import { safeAuthCallbackUrl } from '@/libs/auth/callbackUrl';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { Link } from '@/libs/I18nNavigation';
import {
  getCurrentSailingCardYear,
  hasCompletedCurrentYearSailingCardRequest,
} from '@/libs/mit-sailing/sailingCardValidity';
import { getI18nPath } from '@/utils/Helpers';

type OnboardingPageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    callbackUrl?: string;
    checkout?: string;
  }>;
}>;

type OnboardingTaskShellProps = {
  readonly brandLabel: string;
  readonly children: React.ReactNode;
  readonly description: string;
  readonly eyebrow: string;
  readonly helper: {
    readonly body: string;
    readonly steps: readonly string[];
    readonly title: string;
  };
  readonly profileLabel: string;
  readonly title: string;
};

function OnboardingTaskShell(props: OnboardingTaskShellProps) {
  return (
    <main className="min-h-screen bg-muted/30 text-mit-text">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            className="font-mit-serif text-xl font-semibold tracking-normal text-mit-text no-underline sm:text-2xl"
            href="/"
          >
            {props.brandLabel}
          </Link>
          <Link
            className="rounded-lg px-3 py-2 text-sm font-medium text-mit-red no-underline hover:bg-mit-red-highlight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mit-red"
            href="/profile"
          >
            {props.profileLabel}
          </Link>
        </div>

        <section className="flex flex-1 items-start justify-center py-8 sm:py-12">
          <div className="w-full max-w-3xl">
            <nav
              aria-label={props.helper.title}
              className="mb-5 rounded-xl border border-border bg-background px-3 py-2 shadow-xs"
            >
              <ol className="grid grid-cols-3 gap-1 text-xs font-medium sm:text-sm">
                {props.helper.steps.map((step, index) => (
                  <li className="flex items-center justify-center" key={step}>
                    <span className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-muted-foreground">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-card text-[0.7rem] text-foreground">
                        {index + 1}
                      </span>
                      <span className="truncate">{step}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </nav>

            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-5 py-6 text-center sm:px-8 sm:py-7">
                <p className="text-xs font-semibold tracking-normal text-mit-red uppercase">
                  {props.eyebrow}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
                  {props.title}
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                  {props.description}
                </p>
              </div>
              <div className="px-5 py-6 sm:px-8">{props.children}</div>
            </div>

            <p className="mx-auto mt-4 max-w-2xl text-center text-xs leading-5 text-muted-foreground">
              {props.helper.body}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

async function getOnboardingUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      gymMembershipVerifiedAt: true,
      mitId: true,
      mitClassYear: true,
      mitDataWarehouseVerifiedAt: true,
      emergencyContactName: true,
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
          cardType: true,
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

async function getPendingMembershipCheckout(userId: string) {
  const payment = await prisma.payment.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: {
      status: true,
      stripeCheckoutSessionExpiresAt: true,
      stripeCheckoutSessionUrl: true,
    },
    where: {
      purpose: PaymentPurpose.membership,
      userId,
    },
  });

  return payment;
}

type PendingMembershipCheckout = Awaited<
  ReturnType<typeof getPendingMembershipCheckout>
>;

const paidCardTypes: ReadonlySet<SailingCardType> = new Set([
  SailingCardType.racing,
  SailingCardType.team_racing,
]);

function activeMembershipCheckoutUrl(
  payment: PendingMembershipCheckout,
  now: Date
) {
  if (
    payment?.status !== PaymentStatus.checkout_created ||
    !payment.stripeCheckoutSessionUrl ||
    !payment.stripeCheckoutSessionExpiresAt ||
    payment.stripeCheckoutSessionExpiresAt <= now
  ) {
    return null;
  }
  return payment.stripeCheckoutSessionUrl;
}

function currentYearRequestCanUseSuccess(props: {
  readonly payment: PendingMembershipCheckout;
  readonly request: NonNullable<OnboardingUser>['sailingCardRequests'][number];
}) {
  if (paidCardTypes.has(props.request.cardType)) {
    return props.payment?.status === PaymentStatus.paid;
  }
  return true;
}

function initialValuesFromUser(currentUser: OnboardingUser) {
  return {
    affiliation: currentUser?.sailingAffiliation ?? '',
    cardType: 'normal',
    dateOfBirth: '',
    emergencyContactName: currentUser?.emergencyContactName ?? '',
    emergencyContactPhone: currentUser?.emergencyContactPhone ?? '',
    firstName: currentUser?.firstName ?? '',
    hasFitnessMembership: '',
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
  const searchParams = await props.searchParams;
  const callbackUrl = safeAuthCallbackUrl(searchParams.callbackUrl, '');
  const t = await getTranslations({ locale, namespace: 'OnboardingPage' });
  const cardYear = getCurrentSailingCardYear();
  const currentUser = await getOnboardingUser(user.id);
  const currentRequest = currentUser?.sailingCardRequests.at(0) ?? null;
  const membershipPayment = await getPendingMembershipCheckout(user.id);
  const pendingCheckoutUrl = activeMembershipCheckoutUrl(
    membershipPayment,
    new Date()
  );
  const checkoutWasCancelled = searchParams.checkout === 'cancelled';

  if (pendingCheckoutUrl !== null && !checkoutWasCancelled) {
    redirect(pendingCheckoutUrl);
  }

  if (
    currentUser !== null &&
    currentRequest !== null &&
    pendingCheckoutUrl === null &&
    hasCompletedCurrentYearSailingCardRequest(currentRequest) &&
    currentYearRequestCanUseSuccess({
      payment: membershipPayment,
      request: currentRequest,
    })
  ) {
    redirect(getI18nPath('/onboarding/success', locale));
  }

  const initialValues = initialValuesFromUser(currentUser);
  const lockedIdentity = lockedIdentityFromUser(currentUser);

  return (
    <OnboardingTaskShell
      brandLabel={t('brand_label')}
      description={t('description')}
      eyebrow={t('eyebrow')}
      helper={{
        body: t('side_body'),
        steps: [t('step_eligibility'), t('step_contact'), t('step_submit')],
        title: t('side_title'),
      }}
      profileLabel={t('profile_link')}
      title={t('title')}
    >
      <SailingCardOnboardingForm
        callbackUrl={callbackUrl}
        draftKey={`sailing-card-onboarding:${user.id}:${cardYear}:v1`}
        hasVerifiedMitRecreationMembership={
          currentUser?.gymMembershipVerifiedAt !== null &&
          currentUser?.gymMembershipVerifiedAt !== undefined
        }
        initialValues={initialValues}
        initialMembershipCheckoutUrl={
          checkoutWasCancelled ? pendingCheckoutUrl : null
        }
        lockedIdentity={lockedIdentity}
      />
    </OnboardingTaskShell>
  );
}
