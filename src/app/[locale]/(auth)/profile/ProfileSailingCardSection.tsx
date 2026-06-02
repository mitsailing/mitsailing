'use client';

import { useTranslations } from 'next-intl';
import type { SailingCardType } from '@/generated/prisma/enums';
import { EVENTS_TIME_ZONE } from '@/lib/mit-sailing/nyTime';

export type ProfileSailingCardAssignment =
  | 'cancelled'
  | 'issued'
  | 'none'
  | 'pending';

export type ProfileSailingCardStatus =
  | 'active'
  | 'approved'
  | 'cancelled'
  | 'not_requested'
  | 'requested';

export type ProfileSailingCardSummary = {
  readonly assignment: ProfileSailingCardAssignment;
  readonly cardNumber: number | null;
  readonly cardType: SailingCardType | null;
  readonly cardYear: number | null;
  readonly expiresOnIso: string | null;
  readonly requestedAtIso: string | null;
  readonly status: ProfileSailingCardStatus;
  readonly swimAgreementInitialedAtIso: string | null;
  readonly swimAgreementInitials: string | null;
};

type ProfileSailingCardTranslations = ReturnType<
  typeof useTranslations<'UserProfilePage'>
>;

type ProfileSailingCardFactsProps = {
  readonly cardType: string;
  readonly locale: string;
  readonly statusLabel: string;
  readonly summary: ProfileSailingCardSummary;
  readonly t: ProfileSailingCardTranslations;
};

const assignmentMessageKeys = {
  cancelled: 'profile_sailing_card_assignment_cancelled',
  issued: 'profile_sailing_card_assignment_issued',
  none: 'profile_sailing_card_assignment_none',
  pending: 'profile_sailing_card_assignment_pending',
} as const satisfies Record<ProfileSailingCardAssignment, string>;

const cardTypeMessageKeys = {
  normal: 'profile_sailing_card_type_normal',
  racing: 'profile_sailing_card_type_racing',
  team_racing: 'profile_sailing_card_type_team_racing',
} as const satisfies Record<SailingCardType, string>;

const statusHelpMessageKeys = {
  active: 'profile_sailing_card_status_active_help',
  approved: 'profile_sailing_card_status_approved_help',
  cancelled: 'profile_sailing_card_status_cancelled_help',
  not_requested: 'profile_sailing_card_status_not_requested_help',
  requested: 'profile_sailing_card_status_requested_help',
} as const satisfies Record<ProfileSailingCardStatus, string>;

export const sailingCardStatusMessageKeys = {
  active: 'profile_sailing_card_status_active',
  approved: 'profile_sailing_card_status_approved',
  cancelled: 'profile_sailing_card_status_cancelled',
  not_requested: 'profile_sailing_card_status_not_requested',
  requested: 'profile_sailing_card_status_requested',
} as const satisfies Record<ProfileSailingCardStatus, string>;

function ProfileSailingCardFact(props: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {props.label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-foreground">
        {props.value}
      </dd>
    </div>
  );
}

function formatProfileDate(props: {
  readonly iso: string | null;
  readonly locale: string;
}) {
  if (props.iso === null) {
    return null;
  }
  return new Intl.DateTimeFormat(props.locale, {
    timeZone: EVENTS_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(props.iso));
}

function swimAgreementValue(props: {
  readonly emptyValue: string;
  readonly locale: string;
  readonly summary: ProfileSailingCardSummary;
  readonly t: ProfileSailingCardTranslations;
}) {
  const date = formatProfileDate({
    iso: props.summary.swimAgreementInitialedAtIso,
    locale: props.locale,
  });
  if (date === null || props.summary.swimAgreementInitials === null) {
    return props.emptyValue;
  }
  return props.t('profile_sailing_card_swim_agreement_value', {
    date,
    initials: props.summary.swimAgreementInitials,
  });
}

function ProfileSailingCardHeader(props: {
  readonly status: ProfileSailingCardStatus;
  readonly statusLabel: string;
  readonly t: ProfileSailingCardTranslations;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-medium" id="sailing-card-heading">
          {props.t('profile_sailing_card_heading')}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-mit-text">
          {props.t(statusHelpMessageKeys[props.status])}
        </p>
      </div>
      <span className="w-fit rounded-full border border-mit-line bg-muted px-3 py-1 text-sm font-semibold text-foreground">
        {props.statusLabel}
      </span>
    </div>
  );
}

function profileCardYearValue(props: {
  readonly emptyValue: string;
  readonly summary: ProfileSailingCardSummary;
}) {
  if (props.summary.cardYear === null) {
    return props.emptyValue;
  }
  return String(props.summary.cardYear);
}

function ProfileSailingCardNumberFact(props: {
  readonly summary: ProfileSailingCardSummary;
  readonly t: ProfileSailingCardTranslations;
}) {
  if (props.summary.cardNumber === null) {
    return null;
  }
  return (
    <ProfileSailingCardFact
      label={props.t('profile_sailing_card_number')}
      value={String(props.summary.cardNumber)}
    />
  );
}

function ProfileSailingCardFacts(props: ProfileSailingCardFactsProps) {
  const expiresOn = formatProfileDate({
    iso: props.summary.expiresOnIso,
    locale: props.locale,
  });
  const requestedAt = formatProfileDate({
    iso: props.summary.requestedAtIso,
    locale: props.locale,
  });

  return (
    <dl className="mt-5 grid gap-4 border-t border-mit-line pt-5 sm:grid-cols-2 lg:grid-cols-3">
      <ProfileSailingCardFact
        label={props.t('profile_sailing_card_status')}
        value={props.statusLabel}
      />
      <ProfileSailingCardFact
        label={props.t('profile_sailing_card_assignment')}
        value={props.t(assignmentMessageKeys[props.summary.assignment])}
      />
      <ProfileSailingCardNumberFact summary={props.summary} t={props.t} />
      <ProfileSailingCardFact
        label={props.t('profile_sailing_card_type')}
        value={props.cardType}
      />
      <ProfileSailingCardFact
        label={props.t('profile_sailing_card_year')}
        value={profileCardYearValue({
          emptyValue: props.t('profile_not_set'),
          summary: props.summary,
        })}
      />
      <ProfileSailingCardFact
        label={props.t('profile_sailing_card_expires')}
        value={expiresOn ?? props.t('profile_not_set')}
      />
      <ProfileSailingCardFact
        label={props.t('profile_sailing_card_requested')}
        value={requestedAt ?? props.t('profile_not_set')}
      />
      <ProfileSailingCardFact
        label={props.t('profile_sailing_card_swim_agreement')}
        value={swimAgreementValue({
          emptyValue: props.t('profile_not_set'),
          locale: props.locale,
          summary: props.summary,
          t: props.t,
        })}
      />
    </dl>
  );
}

export function ProfileSailingCardSection(props: {
  readonly locale: string;
  readonly summary: ProfileSailingCardSummary;
}) {
  const t = useTranslations('UserProfilePage');
  const statusLabel = t(sailingCardStatusMessageKeys[props.summary.status]);
  const cardType =
    props.summary.cardType === null
      ? t('profile_not_set')
      : t(cardTypeMessageKeys[props.summary.cardType]);

  return (
    <section
      aria-labelledby="sailing-card-heading"
      className="rounded-lg border border-mit-line bg-card p-6 shadow-sm"
      id="sailing-card-section"
    >
      <ProfileSailingCardHeader
        status={props.summary.status}
        statusLabel={statusLabel}
        t={t}
      />
      <ProfileSailingCardFacts
        cardType={cardType}
        locale={props.locale}
        statusLabel={statusLabel}
        summary={props.summary}
        t={t}
      />
    </section>
  );
}
