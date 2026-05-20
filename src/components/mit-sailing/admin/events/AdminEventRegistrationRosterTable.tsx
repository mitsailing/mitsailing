import { Check, MoreHorizontal, RotateCcw, X } from 'lucide-react';
import type * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EventRegistrationStatus } from '@/generated/prisma/enums';
import { updateAdminEventRegistrationStatusAction } from '@/libs/admin/events/eventAdminActions';
import type { AdminEventRegistrationDto } from '@/libs/admin/events/eventAdminQueries';
import type { AdminEventAccessMode } from '@/libs/admin/events/zenstackEventAccess';
import { formatEasternDateTime } from '@/libs/mit-sailing/easternTimeFormat';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';
import {
  answerValueForQuestion,
  registrationStatusTone,
  statusLabel,
} from './AdminEventRegistrationUtils';
import type {
  AdminEventRegistrationsTranslations,
  RegistrationQuestionColumn,
} from './AdminEventRegistrationUtils';
import { AdminEventListStatusBadge } from './AdminEventShared';

function PhoneValue(props: {
  registration: AdminEventRegistrationDto;
  t: AdminEventRegistrationsTranslations;
}) {
  const phone = props.registration.phone?.trim() ?? '';
  if (phone.length === 0) {
    return props.t('empty_value');
  }
  return (
    <a className="underline-offset-4 hover:underline" href={`tel:${phone}`}>
      {phone}
    </a>
  );
}

function FeeValue(props: {
  locale: string;
  registration: AdminEventRegistrationDto;
  t: AdminEventRegistrationsTranslations;
}) {
  if (!props.registration.entryFee) {
    return props.t('empty_value');
  }
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="text-foreground">
        {props.registration.entryFee.description}
      </span>
      <span>
        {formatUsdMinorUnitsAsCurrency(
          props.registration.entryFee.amountCents,
          props.locale
        )}
      </span>
    </span>
  );
}

function groupedBoatMembers(registration: AdminEventRegistrationDto): {
  boatNumber: number;
  members: AdminEventRegistrationDto['boatMembers'];
}[] {
  const boats = new Map<number, AdminEventRegistrationDto['boatMembers']>();
  for (const member of registration.boatMembers) {
    boats.set(member.boatNumber, [
      ...(boats.get(member.boatNumber) ?? []),
      member,
    ]);
  }
  return [...boats.entries()]
    .map(([boatNumber, members]) => ({ boatNumber, members }))
    .toSorted((a, b) => a.boatNumber - b.boatNumber);
}

function TeamBoatValue(props: {
  registration: AdminEventRegistrationDto;
  t: AdminEventRegistrationsTranslations;
}) {
  const boats = groupedBoatMembers(props.registration);
  if (props.registration.registrationTeam === null && boats.length === 0) {
    return props.t('empty_value');
  }
  return (
    <div className="flex min-w-64 flex-col gap-2">
      {props.registration.registrationTeam ? (
        <p className="font-semibold text-foreground">
          {props.registration.registrationTeam.teamName}
        </p>
      ) : null}
      {boats.map((boat) => (
        <div className="flex flex-col gap-1" key={boat.boatNumber}>
          <p className="text-xs font-semibold text-mit-readable-ink">
            {props.t('registration_boat_number', {
              number: boat.boatNumber,
            })}
          </p>
          {boat.members.map((member) => (
            <div
              className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-2 gap-y-0.5"
              key={member.id}
            >
              <span className="text-xs text-mit-readable-ink">
                {member.positionLabel === 'helm'
                  ? props.t('registration_team_helm_label')
                  : props.t('registration_team_crew_label')}
              </span>
              <span className="min-w-0">
                <span className="block text-foreground">{member.fullName}</span>
                <span className="block text-xs text-mit-readable-ink">
                  {member.email}
                </span>
              </span>
            </div>
          ))}
        </div>
      ))}
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

function RegistrationRosterRow(props: {
  accessMode: AdminEventAccessMode;
  locale: string;
  questionColumns: RegistrationQuestionColumn[];
  registration: AdminEventRegistrationDto;
  showFee: boolean;
  showPhone: boolean;
  showTeamBoat: boolean;
  slug: string;
  t: AdminEventRegistrationsTranslations;
}) {
  return (
    <TableRow>
      <TableCell className="min-w-56 px-4 py-3 align-top">
        <div className="flex items-start gap-2">
          {props.accessMode === 'editable' ? (
            <RegistrationActionsMenu
              locale={props.locale}
              registration={props.registration}
              slug={props.slug}
              t={props.t}
            />
          ) : null}
          <div className="min-w-0">
            <p className="font-semibold text-foreground">
              {props.registration.user.name}
            </p>
            <p className="text-xs text-mit-readable-ink">
              {props.registration.user.email}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="px-4 py-3 align-top">
        <AdminEventListStatusBadge
          tone={registrationStatusTone(props.registration.status)}
        >
          {statusLabel(props.registration.status, props.t)}
        </AdminEventListStatusBadge>
      </TableCell>
      <TableCell className="px-4 py-3 align-top text-sm text-mit-readable-ink">
        {formatEasternDateTime(props.registration.createdAt)}
      </TableCell>
      {props.showPhone ? (
        <TableCell className="px-4 py-3 align-top text-sm text-mit-readable-ink">
          <PhoneValue registration={props.registration} t={props.t} />
        </TableCell>
      ) : null}
      {props.showFee ? (
        <TableCell className="px-4 py-3 align-top text-sm text-mit-readable-ink">
          <FeeValue
            locale={props.locale}
            registration={props.registration}
            t={props.t}
          />
        </TableCell>
      ) : null}
      {props.showTeamBoat ? (
        <TableCell className="px-4 py-3 align-top text-sm text-mit-readable-ink">
          <TeamBoatValue registration={props.registration} t={props.t} />
        </TableCell>
      ) : null}
      <TableCell className="px-4 py-3 align-top text-sm text-mit-readable-ink">
        {formatEasternDateTime(props.registration.swimAgreementAcceptedAt)}
      </TableCell>
      {props.questionColumns.map((question) => (
        <TableCell
          className="max-w-56 px-4 py-3 align-top text-sm whitespace-normal text-foreground"
          key={question.id}
        >
          {answerValueForQuestion({
            questionId: question.id,
            registration: props.registration,
            t: props.t,
          })}
        </TableCell>
      ))}
    </TableRow>
  );
}

export function RegistrationRosterTable(props: {
  accessMode: AdminEventAccessMode;
  locale: string;
  questionColumns: RegistrationQuestionColumn[];
  registrations: AdminEventRegistrationDto[];
  showFee: boolean;
  showPhone: boolean;
  showTeamBoat: boolean;
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
            {props.showPhone ? (
              <TableHead>{props.t('column_phone')}</TableHead>
            ) : null}
            {props.showFee ? (
              <TableHead>{props.t('column_fee')}</TableHead>
            ) : null}
            {props.showTeamBoat ? (
              <TableHead>{props.t('column_team_boat')}</TableHead>
            ) : null}
            <TableHead>{props.t('registration_swim_agreement')}</TableHead>
            {props.questionColumns.map((question) => (
              <TableHead key={question.id}>{question.questionText}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.registrations.map((registration) => (
            <RegistrationRosterRow
              accessMode={props.accessMode}
              key={registration.id}
              locale={props.locale}
              questionColumns={props.questionColumns}
              registration={registration}
              showFee={props.showFee}
              showPhone={props.showPhone}
              showTeamBoat={props.showTeamBoat}
              slug={props.slug}
              t={props.t}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
