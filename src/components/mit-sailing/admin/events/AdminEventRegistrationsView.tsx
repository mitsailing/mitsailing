import { ArrowLeft, Check, Mail, RotateCcw, X } from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import * as React from 'react';
import { AdminErrorAlert } from '@/components/mit-sailing/admin/AdminErrorAlert';
import {
  AdminEventBackLink,
  AdminEventEmptyState,
  AdminEventFormSection,
  AdminEventListStatusBadge,
  adminEventFormErrorMessage,
} from '@/components/mit-sailing/admin/events/AdminEventShared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EventRegistrationStatus } from '@/generated/prisma/enums';
import type { AdminStatusSemanticTone } from '@/lib/mit-sailing/tokens';
import { updateAdminEventRegistrationStatusAction } from '@/libs/admin/events/eventAdminActions';
import {
  adminEventRegistrationsPath,
  adminEventsIndexPath,
} from '@/libs/admin/events/eventAdminPaths';
import type {
  AdminEventRegistrationCounts,
  AdminEventRegistrationDto,
  AdminEventRegistrationsDto,
} from '@/libs/admin/events/eventAdminQueries';
import { Link } from '@/libs/I18nNavigation';
import { formatEasternDateTime } from '@/libs/mit-sailing/easternTimeFormat';

type AdminEventRegistrationsTranslations = Awaited<
  ReturnType<typeof getTranslations<'AdminEvents'>>
>;

type RegistrationFilter = 'all' | 'pending' | 'approved' | 'cancelled';

type AdminEventRegistrationsViewProps = {
  errorCode: string | null;
  event: AdminEventRegistrationsDto;
  filter: RegistrationFilter;
  locale: string;
  t: AdminEventRegistrationsTranslations;
};

const filters: RegistrationFilter[] = [
  'all',
  EventRegistrationStatus.pending,
  EventRegistrationStatus.approved,
  EventRegistrationStatus.cancelled,
];

function countForFilter(
  filter: RegistrationFilter,
  counts: AdminEventRegistrationCounts
): number {
  if (filter === 'all') {
    return counts.pending + counts.approved + counts.cancelled;
  }
  return counts[filter];
}

function registrationVisible(
  registration: AdminEventRegistrationDto,
  filter: RegistrationFilter
): boolean {
  return filter === 'all' || registration.status === filter;
}

function statusLabel(
  status: RegistrationFilter,
  t: AdminEventRegistrationsTranslations
): string {
  if (status === 'all') {
    return t('registration_filter_all');
  }
  if (status === EventRegistrationStatus.pending) {
    return t('registration_status_pending');
  }
  if (status === EventRegistrationStatus.approved) {
    return t('registration_status_approved');
  }
  return t('registration_status_cancelled');
}

function emptyStatusMessage(
  status: Exclude<RegistrationFilter, 'all'>,
  t: AdminEventRegistrationsTranslations
): string {
  if (status === EventRegistrationStatus.approved) {
    return t('registrations_empty_status_approved');
  }
  if (status === EventRegistrationStatus.pending) {
    return t('registrations_empty_status_pending');
  }
  return t('registrations_empty_status_cancelled');
}

function registrationStatusTone(
  status: AdminEventRegistrationDto['status']
): AdminStatusSemanticTone {
  if (status === EventRegistrationStatus.approved) {
    return 'success';
  }
  if (status === EventRegistrationStatus.cancelled) {
    return 'danger';
  }
  return 'neutral';
}

function RegistrationFilters(props: {
  counts: AdminEventRegistrationCounts;
  event: AdminEventRegistrationsDto;
  filter: RegistrationFilter;
  t: AdminEventRegistrationsTranslations;
}) {
  return (
    <div
      aria-label={props.t('registration_filter_aria')}
      className="flex flex-wrap gap-2"
    >
      {filters.map((filter) => {
        const active = filter === props.filter;
        const href =
          filter === 'all'
            ? adminEventRegistrationsPath(props.event.slug)
            : `${adminEventRegistrationsPath(props.event.slug)}?status=${filter}`;
        return (
          <Button
            asChild
            key={filter}
            size="sm"
            variant={active ? 'mit' : 'outline'}
          >
            <Link href={href}>
              {statusLabel(filter, props.t)}
              <span className="font-normal tabular-nums opacity-75">
                {countForFilter(filter, props.counts)}
              </span>
            </Link>
          </Button>
        );
      })}
    </div>
  );
}

function RegistrationStatusAction(props: {
  children: React.ReactNode;
  icon: React.ReactNode;
  locale: string;
  registrationId: string;
  slug: string;
  status: AdminEventRegistrationDto['status'];
  variant?: React.ComponentProps<typeof Button>['variant'];
}) {
  const action = updateAdminEventRegistrationStatusAction.bind(
    null,
    props.locale,
    props.slug,
    props.registrationId
  );
  return (
    <form action={action}>
      <input name="status" type="hidden" value={props.status} />
      <Button size="sm" type="submit" variant={props.variant ?? 'outline'}>
        {props.icon}
        {props.children}
      </Button>
    </form>
  );
}

function RegistrationCard(props: {
  locale: string;
  registration: AdminEventRegistrationDto;
  slug: string;
  t: AdminEventRegistrationsTranslations;
}) {
  const showApprove =
    props.registration.status !== EventRegistrationStatus.approved;
  const showCancel =
    props.registration.status !== EventRegistrationStatus.cancelled;
  return (
    <li>
      <Card className="rounded-lg" size="sm">
        <CardHeader className="gap-3 md:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <CardTitle>{props.registration.user.name}</CardTitle>
            <p className="truncate text-sm text-mit-readable-ink">
              {props.registration.user.email}
            </p>
          </div>
          <AdminEventListStatusBadge
            tone={registrationStatusTone(props.registration.status)}
          >
            {statusLabel(props.registration.status, props.t)}
          </AdminEventListStatusBadge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold text-mit-readable-ink uppercase">
                {props.t('registration_created_at')}
              </dt>
              <dd className="mt-1">
                {formatEasternDateTime(props.registration.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-mit-readable-ink uppercase">
                {props.t('registration_swim_agreement')}
              </dt>
              <dd className="mt-1">
                {formatEasternDateTime(
                  props.registration.swimAgreementAcceptedAt
                )}
              </dd>
            </div>
          </dl>

          {props.registration.answers.length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <h3 className="text-sm font-semibold text-foreground">
                {props.t('registration_answers_heading')}
              </h3>
              <dl className="mt-2 flex flex-col gap-2">
                {props.registration.answers.map((answer) => (
                  <div key={answer.id}>
                    <dt className="text-xs font-medium text-mit-readable-ink">
                      {answer.question.questionText}
                    </dt>
                    <dd className="text-sm text-foreground">{answer.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            {showApprove ? (
              <RegistrationStatusAction
                icon={<Check aria-hidden className="size-4" />}
                locale={props.locale}
                registrationId={props.registration.id}
                slug={props.slug}
                status={EventRegistrationStatus.approved}
                variant="mit"
              >
                {props.t('action_approve')}
              </RegistrationStatusAction>
            ) : null}
            {showCancel ? (
              <RegistrationStatusAction
                icon={<X aria-hidden className="size-4" />}
                locale={props.locale}
                registrationId={props.registration.id}
                slug={props.slug}
                status={EventRegistrationStatus.cancelled}
                variant="destructive"
              >
                {props.t('action_cancel_registration')}
              </RegistrationStatusAction>
            ) : null}
            {props.registration.status === EventRegistrationStatus.cancelled ? (
              <RegistrationStatusAction
                icon={<RotateCcw aria-hidden className="size-4" />}
                locale={props.locale}
                registrationId={props.registration.id}
                slug={props.slug}
                status={EventRegistrationStatus.pending}
              >
                {props.t('action_reopen')}
              </RegistrationStatusAction>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

function BulkEmailPlaceholder(props: {
  counts: AdminEventRegistrationCounts;
  t: AdminEventRegistrationsTranslations;
}) {
  const recipientCount = props.counts.pending + props.counts.approved;
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>
          <h2 className="inline-flex items-center gap-2">
            <Mail aria-hidden className="size-4" />
            {props.t('bulk_email_heading')}
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-mit-readable-ink">
          {props.t('bulk_email_placeholder')}
        </p>
        <Input
          aria-label={props.t('bulk_email_subject')}
          disabled
          placeholder={props.t('bulk_email_subject')}
        />
        <Textarea
          aria-label={props.t('bulk_email_message')}
          className="min-h-28"
          disabled
          placeholder={props.t('bulk_email_message')}
        />
        <p className="text-xs text-mit-readable-ink">
          {props.t('bulk_email_recipients', { count: recipientCount })}
        </p>
        <Button disabled type="button" variant="mit">
          {props.t('bulk_email_send')}
        </Button>
      </CardContent>
    </Card>
  );
}

function AdminEventRegistrationErrorAlert(props: {
  code: string | null;
  t: AdminEventRegistrationsTranslations;
}) {
  const message = adminEventFormErrorMessage(props.code, props.t);
  if (!message) {
    return null;
  }
  return <AdminErrorAlert>{message}</AdminErrorAlert>;
}

export function AdminEventRegistrationsView(
  props: AdminEventRegistrationsViewProps
) {
  const visibleRegistrations = props.event.registrations.filter(
    (registration) => registrationVisible(registration, props.filter)
  );
  return (
    <div className="flex w-full flex-col gap-6">
      <AdminEventBackLink href={adminEventsIndexPath()}>
        <ArrowLeft aria-hidden className="size-4" />
        {props.t('back_to_events')}
      </AdminEventBackLink>

      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-widest text-mit-red uppercase dark:text-mit-red-ink">
          {props.t('registrations_eyebrow')}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {props.event.name}
        </h1>
      </header>

      <AdminEventRegistrationErrorAlert code={props.errorCode} t={props.t} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <section className="flex min-w-0 flex-col gap-4">
          <RegistrationFilters
            counts={props.event.registrationCounts}
            event={props.event}
            filter={props.filter}
            t={props.t}
          />
          {visibleRegistrations.length === 0 ? (
            <AdminEventEmptyState>
              {props.filter === 'all'
                ? props.t('registrations_empty_all')
                : emptyStatusMessage(props.filter, props.t)}
            </AdminEventEmptyState>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {visibleRegistrations.map((registration) => (
                <RegistrationCard
                  key={registration.id}
                  locale={props.locale}
                  registration={registration}
                  slug={props.event.slug}
                  t={props.t}
                />
              ))}
            </ol>
          )}
        </section>
        <aside className="flex flex-col gap-4">
          <AdminEventFormSection
            id="registration-summary"
            title={props.t('registration_summary_heading')}
          >
            <dl className="grid gap-3 text-sm">
              <div className="flex items-center justify-between">
                <dt>{props.t('registration_status_pending')}</dt>
                <dd className="font-semibold tabular-nums">
                  {props.event.registrationCounts.pending}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>{props.t('registration_status_approved')}</dt>
                <dd className="font-semibold tabular-nums">
                  {props.event.registrationCounts.approved}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>{props.t('registration_status_cancelled')}</dt>
                <dd className="font-semibold tabular-nums">
                  {props.event.registrationCounts.cancelled}
                </dd>
              </div>
            </dl>
          </AdminEventFormSection>
          <BulkEmailPlaceholder
            counts={props.event.registrationCounts}
            t={props.t}
          />
        </aside>
      </div>
    </div>
  );
}
