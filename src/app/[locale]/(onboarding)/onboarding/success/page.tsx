import { Check, CreditCard } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type * as React from 'react';
import {
  PaymentPurpose,
  PaymentStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import {
  getAppRolePermissions,
  hasPermission,
  Permission,
} from '@/libs/auth/appPermissions';
import { safeAuthCallbackUrl } from '@/libs/auth/callbackUrl';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { Link } from '@/libs/I18nNavigation';
import {
  getCurrentSailingCardYear,
  hasCompletedCurrentYearSailingCardRequest,
} from '@/libs/mit-sailing/sailingCardValidity';
import { getStripeClient } from '@/libs/stripe/stripeClient';
import { safeStripeHostedPaymentHref } from '@/libs/stripe/stripeHostedPaymentHref';
import { getI18nPath } from '@/utils/Helpers';

type OnboardingSuccessPageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ callbackUrl?: string; session_id?: string }>;
}>;

type SurfaceAction = {
  readonly external?: boolean;
  readonly href: string;
  readonly label: string;
};

function SurfaceActionLink(props: SurfaceAction) {
  const className =
    'rounded-lg bg-mit-red px-4 py-2 text-sm font-semibold text-primary-foreground no-underline hover:bg-mit-red-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mit-red';

  if (props.external === true) {
    return (
      // nosemgrep: typescript.react.security.audit.react-href-var.react-href-var -- sanitized action href.
      <a className={className} href={props.href} rel="noopener noreferrer">
        {props.label}
      </a>
    );
  }

  return (
    // nosemgrep: typescript.react.security.audit.react-href-var.react-href-var -- server-built app path.
    <Link className={className} href={props.href}>
      {props.label}
    </Link>
  );
}

function SuccessSurface(props: {
  readonly action: SurfaceAction;
  readonly adminLink?: React.ReactNode;
  readonly brandLabel: string;
  readonly description: string;
  readonly icon?: React.ReactNode;
  readonly iconClassName?: string;
  readonly title: string;
}) {
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-5 text-mit-text sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-5xl flex-col">
        <Link
          className="w-fit font-mit-serif text-xl font-semibold tracking-normal text-mit-text no-underline sm:text-2xl"
          href="/"
        >
          {props.brandLabel}
        </Link>
        <section className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="px-5 py-10 text-center sm:px-8 sm:py-12">
              <p
                aria-hidden
                className={
                  props.iconClassName ??
                  'mx-auto mb-5 flex size-11 items-center justify-center rounded-full bg-mit-red-highlight text-mit-red'
                }
              >
                {props.icon ?? <Check className="size-5" />}
              </p>
              <h1 className="text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
                {props.title}
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                {props.description}
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <SurfaceActionLink {...props.action} />
                {props.adminLink}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

const paidCardTypes: ReadonlySet<SailingCardType> = new Set([
  SailingCardType.racing,
  SailingCardType.team_racing,
]);

function isPaidCardType(
  cardType: SailingCardType | null | undefined
): cardType is SailingCardType {
  return (
    cardType !== null && cardType !== undefined && paidCardTypes.has(cardType)
  );
}

async function getMembershipPaymentForRequest(props: {
  readonly cardType: SailingCardType;
  readonly cardYear: number;
  readonly userId: string;
}) {
  const payment = await prisma.payment.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: {
      status: true,
      stripeCheckoutSessionExpiresAt: true,
      stripeCheckoutSessionId: true,
      stripeCheckoutSessionUrl: true,
    },
    where: {
      cardType: props.cardType,
      cardYear: props.cardYear,
      purpose: PaymentPurpose.membership,
      userId: props.userId,
    },
  });
  return payment;
}

type MembershipPaymentForRequest = Awaited<
  ReturnType<typeof getMembershipPaymentForRequest>
>;

async function stripeCheckoutSessionIsPaid(props: {
  readonly payment: MembershipPaymentForRequest;
  readonly sessionId?: string;
}) {
  if (
    props.sessionId === undefined ||
    props.payment?.stripeCheckoutSessionId !== props.sessionId
  ) {
    return false;
  }

  try {
    const session = await getStripeClient().checkout.sessions.retrieve(
      props.sessionId
    );
    return session.status === 'complete' && session.payment_status === 'paid';
  } catch {
    return false;
  }
}

function activeCheckoutUrl(payment: MembershipPaymentForRequest, now: Date) {
  if (
    payment?.status !== PaymentStatus.checkout_created ||
    !payment.stripeCheckoutSessionUrl ||
    !payment.stripeCheckoutSessionExpiresAt ||
    payment.stripeCheckoutSessionExpiresAt <= now
  ) {
    return null;
  }
  return safeStripeHostedPaymentHref(payment.stripeCheckoutSessionUrl);
}

function postSuccessHref(callbackUrl: string | undefined) {
  return safeAuthCallbackUrl(callbackUrl, '/events');
}

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
  const searchParams = props.searchParams ? await props.searchParams : {};
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

  if (
    currentUser === null ||
    !hasCompletedCurrentYearSailingCardRequest(
      currentUser.sailingCardRequests.at(0) ?? null
    )
  ) {
    redirect(getI18nPath('/onboarding', locale));
  }

  const latestRequest = currentUser.sailingCardRequests.at(0) ?? null;
  const adminLink = canViewAdmin ? (
    <Link
      className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-mit-text no-underline hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mit-red"
      href="/admin"
    >
      {t('admin_link')}
    </Link>
  ) : null;
  const actionHref = postSuccessHref(searchParams.callbackUrl);
  const eventsAction = {
    href: actionHref,
    label: t('events_link'),
  };

  if (latestRequest !== null && isPaidCardType(latestRequest.cardType)) {
    const payment = await getMembershipPaymentForRequest({
      cardType: latestRequest.cardType,
      cardYear: latestRequest.cardYear,
      userId: user.id,
    });
    const paidAtStripe = await stripeCheckoutSessionIsPaid({
      payment,
      sessionId: searchParams.session_id,
    });
    if (payment?.status !== PaymentStatus.paid && !paidAtStripe) {
      const checkoutUrl = activeCheckoutUrl(payment, new Date());
      return (
        <SuccessSurface
          action={{
            external: checkoutUrl !== null,
            href: checkoutUrl ?? getI18nPath('/onboarding', locale),
            label: t('finish_payment_link'),
          }}
          brandLabel={t('brand_label')}
          description={t('payment_required_description')}
          icon={<CreditCard className="size-5" />}
          title={t('payment_required_title')}
        />
      );
    }

    return (
      <SuccessSurface
        action={eventsAction}
        adminLink={adminLink}
        brandLabel={t('brand_label')}
        description={t('paid_description')}
        title={t('paid_title')}
      />
    );
  }

  return (
    <SuccessSurface
      action={eventsAction}
      adminLink={adminLink}
      brandLabel={t('brand_label')}
      description={t('description')}
      title={t('title')}
    />
  );
}
