import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { emailDeliverabilityStatus } from '@/libs/email/emailDeliverabilityStatus';
import { logger } from '@/libs/Logger';
import { hasCurrentSailingCard } from '@/libs/mit-sailing/sailingCardValidity';
import { getI18nPath } from '@/utils/Helpers';
import { ProfileAccountClient } from './ProfileAccountClient';
import type { ProfileSailingCardSummary } from './ProfileSailingCardSection';

type ProfilePageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

type ProfileSailingCardRequest = {
  readonly cardType: ProfileSailingCardSummary['cardType'];
  readonly cardYear: number;
  readonly requestedAt: Date;
  readonly status: 'approved' | 'cancelled' | 'pending';
};

function profileSailingCardSummary(props: {
  readonly latestRequest: ProfileSailingCardRequest | null;
  readonly sailingCardExpiresOn: Date | null;
  readonly sailingCardIssuedAt: Date | null;
  readonly sailingCardNumber: number | null;
  readonly sailingCardSwimAgreementInitialedAt: Date | null;
  readonly sailingCardSwimAgreementInitials: string | null;
  readonly sailingCardYear: number | null;
  readonly userHasCurrentCard: boolean;
}): ProfileSailingCardSummary {
  const common = {
    swimAgreementInitialedAtIso:
      props.sailingCardSwimAgreementInitialedAt?.toISOString() ?? null,
    swimAgreementInitials: props.sailingCardSwimAgreementInitials,
  };
  if (
    props.userHasCurrentCard &&
    props.sailingCardNumber !== null &&
    props.sailingCardYear !== null
  ) {
    return {
      ...common,
      assignment: 'issued',
      cardNumber: props.sailingCardNumber,
      cardType: props.latestRequest?.cardType ?? null,
      cardYear: props.sailingCardYear,
      expiresOnIso: props.sailingCardExpiresOn?.toISOString() ?? null,
      requestedAtIso: props.latestRequest?.requestedAt.toISOString() ?? null,
      status: 'active',
    };
  }
  if (props.latestRequest) {
    const status = {
      approved: 'approved',
      cancelled: 'cancelled',
      pending: 'requested',
    } as const satisfies Record<
      ProfileSailingCardRequest['status'],
      ProfileSailingCardSummary['status']
    >;
    const assignment = {
      approved: 'pending',
      cancelled: 'cancelled',
      pending: 'pending',
    } as const satisfies Record<
      ProfileSailingCardRequest['status'],
      ProfileSailingCardSummary['assignment']
    >;

    return {
      ...common,
      assignment: assignment[props.latestRequest.status],
      cardNumber: null,
      cardType: props.latestRequest.cardType,
      cardYear: props.latestRequest.cardYear,
      expiresOnIso: null,
      requestedAtIso: props.latestRequest.requestedAt.toISOString(),
      status: status[props.latestRequest.status],
    };
  }

  return {
    ...common,
    assignment: 'none',
    cardNumber: null,
    cardType: null,
    cardYear: null,
    expiresOnIso: null,
    requestedAtIso: null,
    status: 'not_requested',
  };
}

export async function generateMetadata(
  props: ProfilePageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'UserProfilePage' });

  return {
    title: t('account_meta_title'),
    description: t('account_meta_description'),
  };
}

export default async function ProfilePage(props: ProfilePageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const profileHref = getI18nPath('/profile', locale);
  const user = await requireCurrentUser(locale, profileHref);

  const dbUser = await prisma.user.findUnique({
    select: {
      emailBouncedAt: true,
      emailSuppressedAt: true,
      emailSuppressionReason: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      firstName: true,
      lastName: true,
      mitClassYear: true,
      mitDataWarehouseVerifiedAt: true,
      mitId: true,
      phone: true,
      sailingAffiliation: true,
      sailingCardExpiresOn: true,
      sailingCardIssuedAt: true,
      sailingCardNumber: true,
      sailingCardRequests: {
        orderBy: { requestedAt: 'desc' },
        select: {
          cardType: true,
          cardYear: true,
          requestedAt: true,
          status: true,
        },
        take: 1,
      },
      sailingCardSwimAgreementInitialedAt: true,
      sailingCardSwimAgreementInitials: true,
      sailingCardYear: true,
      legalAgreementAcceptances: {
        orderBy: { acceptedAt: 'desc' },
        select: {
          acceptedAt: true,
          agreementHash: true,
          agreementVersion: true,
        },
        take: 1,
      },
      themePreference: true,
      unconfirmedEmail: true,
    },
    where: { id: user.id },
  });
  if (!dbUser) {
    logger.warn('Missing database user after profile auth', {
      email: user.email,
      userId: user.id,
    });
    throw new Error('Missing db user after auth');
  }

  return (
    <ProfileAccountClient
      initialEmail={user.email ?? ''}
      initialEmailDeliverabilityStatus={emailDeliverabilityStatus(dbUser)}
      initialEmergencyContactName={dbUser.emergencyContactName ?? ''}
      initialEmergencyContactPhone={dbUser.emergencyContactPhone ?? ''}
      initialFirstName={dbUser.firstName ?? ''}
      initialLastName={dbUser.lastName ?? ''}
      initialMitClassYear={dbUser.mitClassYear}
      initialMitId={dbUser.mitId}
      initialMitIdentityLocked={
        dbUser.mitId !== null && dbUser.mitDataWarehouseVerifiedAt !== null
      }
      initialName={user.name}
      initialPhone={dbUser.phone ?? ''}
      initialSailingAffiliation={dbUser.sailingAffiliation}
      initialSailingCardSummary={profileSailingCardSummary({
        latestRequest: dbUser.sailingCardRequests.at(0) ?? null,
        sailingCardExpiresOn: dbUser.sailingCardExpiresOn,
        sailingCardIssuedAt: dbUser.sailingCardIssuedAt,
        sailingCardNumber: dbUser.sailingCardNumber,
        sailingCardSwimAgreementInitialedAt:
          dbUser.sailingCardSwimAgreementInitialedAt,
        sailingCardSwimAgreementInitials:
          dbUser.sailingCardSwimAgreementInitials,
        sailingCardYear: dbUser.sailingCardYear,
        userHasCurrentCard: hasCurrentSailingCard(dbUser),
      })}
      initialThemePreference={dbUser.themePreference ?? 'SYSTEM'}
      initialUnconfirmedEmail={dbUser.unconfirmedEmail ?? null}
      locale={locale}
    />
  );
}
