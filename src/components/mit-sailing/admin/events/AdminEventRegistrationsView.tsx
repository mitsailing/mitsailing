import { ArrowLeft, Mail } from 'lucide-react';
import { AdminErrorAlert } from '@/components/mit-sailing/admin/AdminErrorAlert';
import { RegistrationRosterTable } from '@/components/mit-sailing/admin/events/AdminEventRegistrationRosterTable';
import {
  countForFilter,
  emptyStatusMessage,
  hasFeeColumn,
  hasPhoneColumn,
  hasTeamBoatColumn,
  registrationFilters,
  registrationQuestionColumns,
  registrationVisible,
  statusLabel,
} from '@/components/mit-sailing/admin/events/AdminEventRegistrationUtils';
import type {
  AdminEventRegistrationsTranslations,
  RegistrationFilter,
} from '@/components/mit-sailing/admin/events/AdminEventRegistrationUtils';
import {
  AdminEventBackLink,
  AdminEventEmptyState,
  AdminEventFormSection,
  AdminEventReadOnlyNotice,
  adminEventFormErrorMessage,
} from '@/components/mit-sailing/admin/events/AdminEventShared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { resendAllAdminEventPaymentRequestsAction } from '@/libs/admin/events/eventAdminActions';
import {
  adminEventShowPath,
  adminEventsIndexPath,
} from '@/libs/admin/events/eventAdminPaths';
import type { AdminEventRegistrationsDto } from '@/libs/admin/events/eventAdminQueries';
import type { AdminEventAccessMode } from '@/libs/admin/events/zenstackEventAccess';
import { Link } from '@/libs/I18nNavigation';

export type { RegistrationFilter } from '@/components/mit-sailing/admin/events/AdminEventRegistrationUtils';

type AdminEventRegistrationsViewProps = {
  accessMode: AdminEventAccessMode;
  chrome?: 'page' | 'embedded';
  errorCode: string | null;
  event: AdminEventRegistrationsDto;
  filter: RegistrationFilter;
  id?: string;
  locale: string;
  showReadOnlyNotice?: boolean;
  t: AdminEventRegistrationsTranslations;
};

function registrationFilterHref(options: {
  event: AdminEventRegistrationsDto;
  filter: RegistrationFilter;
}): string {
  if (options.filter === 'all') {
    return `${adminEventShowPath(options.event.slug)}#registrations`;
  }
  return `${adminEventShowPath(options.event.slug)}?status=${options.filter}#registrations`;
}

function BulkEmailPlaceholder(props: {
  counts: AdminEventRegistrationsDto['registrationCounts'];
  t: AdminEventRegistrationsTranslations;
}) {
  const recipientCount = props.counts.pending + props.counts.approved;
  return (
    <Card
      aria-label={props.t('bulk_email_heading')}
      className="rounded-lg"
      role="region"
    >
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
          placeholder={props.t('bulk_email_subject')}
        />
        <Textarea
          aria-label={props.t('bulk_email_message')}
          className="min-h-28"
          placeholder={props.t('bulk_email_message')}
        />
        <p className="text-xs text-mit-readable-ink">
          {props.t('bulk_email_recipients', { count: recipientCount })}
        </p>
        <Button type="button" variant="mit">
          {props.t('bulk_email_send')}
        </Button>
      </CardContent>
    </Card>
  );
}

function PaymentRequestSummary(props: {
  locale: string;
  slug: string;
  t: AdminEventRegistrationsTranslations;
}) {
  const action = resendAllAdminEventPaymentRequestsAction.bind(
    null,
    props.locale,
    props.slug
  );
  return (
    <AdminEventFormSection
      id="registration-payment-requests"
      title={props.t('payment_requests_heading')}
    >
      <p className="text-sm text-mit-readable-ink">
        {props.t('payment_requests_body')}
      </p>
      <form action={action}>
        <Button type="submit" variant="outline">
          <Mail aria-hidden className="size-4" />
          {props.t('payment_resend_all')}
        </Button>
      </form>
    </AdminEventFormSection>
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

function RegistrationFilterButton(props: {
  counts: AdminEventRegistrationsDto['registrationCounts'];
  event: AdminEventRegistrationsDto;
  filter: RegistrationFilter;
  isActive: boolean;
  t: AdminEventRegistrationsTranslations;
}) {
  return (
    <Button asChild size="sm" variant={props.isActive ? 'mit' : 'outline'}>
      <Link
        href={registrationFilterHref({
          event: props.event,
          filter: props.filter,
        })}
      >
        {statusLabel(props.filter, props.t)}
        <span className="font-normal tabular-nums opacity-75">
          {countForFilter(props.filter, props.counts)}
        </span>
      </Link>
    </Button>
  );
}

function RegistrationFilters(props: {
  counts: AdminEventRegistrationsDto['registrationCounts'];
  event: AdminEventRegistrationsDto;
  filter: RegistrationFilter;
  t: AdminEventRegistrationsTranslations;
}) {
  const filterButtons = registrationFilters.map((filter) => (
    <RegistrationFilterButton
      counts={props.counts}
      event={props.event}
      filter={filter}
      isActive={filter === props.filter}
      key={filter}
      t={props.t}
    />
  ));

  return (
    <div
      aria-label={props.t('registration_filter_aria')}
      className="flex flex-wrap gap-2"
    >
      {filterButtons}
    </div>
  );
}

export function AdminEventRegistrationsView(
  props: AdminEventRegistrationsViewProps
) {
  const visibleRegistrations = props.event.registrations.filter(
    (registration) => registrationVisible(registration, props.filter)
  );
  const questionColumns = registrationQuestionColumns(props.event);
  const showFee = hasFeeColumn(props.event);
  const showPhone = hasPhoneColumn(props.event);
  const showTeamBoat = hasTeamBoatColumn(props.event);
  const chrome = props.chrome ?? 'page';
  const showReadOnlyNotice = props.showReadOnlyNotice ?? true;
  return (
    <div className="flex w-full flex-col gap-6" id={props.id}>
      {chrome === 'page' ? (
        <>
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
        </>
      ) : null}

      <AdminEventRegistrationErrorAlert code={props.errorCode} t={props.t} />
      {props.accessMode === 'readOnly' && showReadOnlyNotice ? (
        <AdminEventReadOnlyNotice t={props.t} />
      ) : null}

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
            <RegistrationRosterTable
              accessMode={props.accessMode}
              locale={props.locale}
              questionColumns={questionColumns}
              registrations={visibleRegistrations}
              showFee={showFee}
              showPhone={showPhone}
              showTeamBoat={showTeamBoat}
              slug={props.event.slug}
              t={props.t}
            />
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
          {props.accessMode === 'editable' ? (
            <>
              <PaymentRequestSummary
                locale={props.locale}
                slug={props.event.slug}
                t={props.t}
              />
              <BulkEmailPlaceholder
                counts={props.event.registrationCounts}
                t={props.t}
              />
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
