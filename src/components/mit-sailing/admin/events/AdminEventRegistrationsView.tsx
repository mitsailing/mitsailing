import {
  ArrowLeft,
  Check,
  Mail,
  MoreHorizontal,
  RotateCcw,
  X,
} from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import * as React from 'react';
import { AdminErrorAlert } from '@/components/mit-sailing/admin/AdminErrorAlert';
import {
  AdminEventBackLink,
  AdminEventEmptyState,
  AdminEventFormSection,
  AdminEventListStatusBadge,
  AdminEventReadOnlyNotice,
  adminEventFormErrorMessage,
} from '@/components/mit-sailing/admin/events/AdminEventShared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { EventRegistrationStatus } from '@/generated/prisma/enums';
import type { AdminStatusSemanticTone } from '@/lib/mit-sailing/tokens';
import { updateAdminEventRegistrationStatusAction } from '@/libs/admin/events/eventAdminActions';
import {
  adminEventShowPath,
  adminEventsIndexPath,
} from '@/libs/admin/events/eventAdminPaths';
import type {
  AdminEventRegistrationCounts,
  AdminEventRegistrationDto,
  AdminEventRegistrationsDto,
} from '@/libs/admin/events/eventAdminQueries';
import type { AdminEventAccessMode } from '@/libs/admin/events/zenstackEventAccess';
import { Link } from '@/libs/I18nNavigation';
import { formatEasternDateTime } from '@/libs/mit-sailing/easternTimeFormat';

type AdminEventRegistrationsTranslations = Awaited<
  ReturnType<typeof getTranslations<'AdminEvents'>>
>;

export type RegistrationFilter = 'all' | 'pending' | 'approved' | 'cancelled';

type RegistrationQuestionColumn = {
  id: string;
  questionText: string;
  displayOrder: number;
};

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

function registrationQuestionColumns(
  event: AdminEventRegistrationsDto
): RegistrationQuestionColumn[] {
  const columns = new Map<string, RegistrationQuestionColumn>();
  for (const question of event.questions) {
    columns.set(question.id, {
      displayOrder: question.displayOrder,
      id: question.id,
      questionText: question.questionText,
    });
  }
  for (const registration of event.registrations) {
    for (const answer of registration.answers) {
      if (!columns.has(answer.question.id)) {
        columns.set(answer.question.id, answer.question);
      }
    }
  }
  return [...columns.values()].toSorted(
    (a, b) =>
      a.displayOrder - b.displayOrder ||
      a.questionText.localeCompare(b.questionText)
  );
}

function answerValueForQuestion(
  registration: AdminEventRegistrationDto,
  questionId: string,
  t: AdminEventRegistrationsTranslations
): string {
  const answer = registration.answers.find(
    (registrationAnswer) => registrationAnswer.question.id === questionId
  );
  if (!answer || answer.value.trim().length === 0) {
    return t('empty_value');
  }
  return answer.value;
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
            ? `${adminEventShowPath(props.event.slug)}#registrations`
            : `${adminEventShowPath(props.event.slug)}?status=${filter}#registrations`;
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
  actionLabel: string;
  confirmActionLabel: string;
  confirmBody: string;
  confirmTitle: string;
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
    <details className="rounded-md border border-transparent open:border-border open:bg-muted/40">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted [&::-webkit-details-marker]:hidden"
        role="menuitem"
      >
        {props.icon}
        {props.actionLabel}
      </summary>
      <div
        aria-label={props.confirmTitle}
        className="m-2 rounded-md border border-border bg-background p-3"
        role="dialog"
      >
        <p className="text-sm text-foreground">{props.confirmBody}</p>
        <form action={action} className="mt-3 flex justify-end">
          <input name="status" type="hidden" value={props.status} />
          <Button size="sm" type="submit" variant={props.variant ?? 'outline'}>
            {props.confirmActionLabel}
          </Button>
        </form>
      </div>
    </details>
  );
}

function RegistrationActionsMenu(props: {
  locale: string;
  registration: AdminEventRegistrationDto;
  slug: string;
  t: AdminEventRegistrationsTranslations;
}) {
  const showApprove =
    props.registration.status !== EventRegistrationStatus.approved;
  const showCancel =
    props.registration.status !== EventRegistrationStatus.cancelled;
  const attendeeName = props.registration.user.name;
  return (
    <details className="relative inline-block text-left">
      <summary
        aria-label={props.t('registration_actions_for', {
          name: attendeeName,
        })}
        className="inline-flex size-8 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal aria-hidden className="size-4" />
      </summary>
      <div
        className="absolute left-0 z-20 mt-2 w-72 rounded-lg border border-border bg-background p-2 shadow-lg"
        role="menu"
      >
        {showApprove ? (
          <RegistrationStatusAction
            actionLabel={props.t('action_approve')}
            confirmActionLabel={props.t('registration_confirm_approve_action')}
            confirmBody={props.t('registration_confirm_approve_body', {
              name: attendeeName,
            })}
            confirmTitle={props.t('registration_confirm_approve_title', {
              name: attendeeName,
            })}
            icon={<Check aria-hidden className="size-4" />}
            locale={props.locale}
            registrationId={props.registration.id}
            slug={props.slug}
            status={EventRegistrationStatus.approved}
            variant="mit"
          />
        ) : null}
        {showCancel ? (
          <RegistrationStatusAction
            actionLabel={props.t('action_cancel_registration')}
            confirmActionLabel={props.t('registration_confirm_cancel_action')}
            confirmBody={props.t('registration_confirm_cancel_body', {
              name: attendeeName,
            })}
            confirmTitle={props.t('registration_confirm_cancel_title', {
              name: attendeeName,
            })}
            icon={<X aria-hidden className="size-4" />}
            locale={props.locale}
            registrationId={props.registration.id}
            slug={props.slug}
            status={EventRegistrationStatus.cancelled}
            variant="destructive"
          />
        ) : null}
        {props.registration.status === EventRegistrationStatus.cancelled ? (
          <RegistrationStatusAction
            actionLabel={props.t('action_reopen')}
            confirmActionLabel={props.t('registration_confirm_reopen_action')}
            confirmBody={props.t('registration_confirm_reopen_body', {
              name: attendeeName,
            })}
            confirmTitle={props.t('registration_confirm_reopen_title', {
              name: attendeeName,
            })}
            icon={<RotateCcw aria-hidden className="size-4" />}
            locale={props.locale}
            registrationId={props.registration.id}
            slug={props.slug}
            status={EventRegistrationStatus.pending}
          />
        ) : null}
        <div className="mt-2 border-t border-border pt-2">
          <p className="px-2 py-1 text-xs text-mit-readable-ink">
            {props.t('registration_history_unavailable')}
          </p>
          <p className="px-2 py-1 text-xs text-mit-readable-ink">
            {props.t('registration_edit_unavailable')}
          </p>
        </div>
      </div>
    </details>
  );
}

function RegistrationRosterTable(props: {
  accessMode: AdminEventAccessMode;
  locale: string;
  questionColumns: RegistrationQuestionColumn[];
  registrations: AdminEventRegistrationDto[];
  slug: string;
  t: AdminEventRegistrationsTranslations;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background">
      <Table aria-label={props.t('registration_table_label')}>
        <TableHeader>
          <TableRow>
            <TableHead>{props.t('column_attendee')}</TableHead>
            <TableHead>{props.t('column_status')}</TableHead>
            <TableHead>{props.t('registration_created_at')}</TableHead>
            <TableHead>{props.t('registration_swim_agreement')}</TableHead>
            {props.questionColumns.map((question) => (
              <TableHead key={question.id}>{question.questionText}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.registrations.map((registration) => (
            <TableRow key={registration.id}>
              <TableCell className="min-w-56 px-4 py-3 align-top">
                <div className="flex items-start gap-2">
                  {props.accessMode === 'editable' ? (
                    <RegistrationActionsMenu
                      locale={props.locale}
                      registration={registration}
                      slug={props.slug}
                      t={props.t}
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {registration.user.name}
                    </p>
                    <p className="text-xs text-mit-readable-ink">
                      {registration.user.email}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="px-4 py-3 align-top">
                <AdminEventListStatusBadge
                  tone={registrationStatusTone(registration.status)}
                >
                  {statusLabel(registration.status, props.t)}
                </AdminEventListStatusBadge>
              </TableCell>
              <TableCell className="px-4 py-3 align-top text-sm text-mit-readable-ink">
                {formatEasternDateTime(registration.createdAt)}
              </TableCell>
              <TableCell className="px-4 py-3 align-top text-sm text-mit-readable-ink">
                {formatEasternDateTime(registration.swimAgreementAcceptedAt)}
              </TableCell>
              {props.questionColumns.map((question) => (
                <TableCell
                  className="max-w-56 px-4 py-3 align-top text-sm whitespace-normal text-foreground"
                  key={question.id}
                >
                  {answerValueForQuestion(registration, question.id, props.t)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
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
  const questionColumns = registrationQuestionColumns(props.event);
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
            <BulkEmailPlaceholder
              counts={props.event.registrationCounts}
              t={props.t}
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
