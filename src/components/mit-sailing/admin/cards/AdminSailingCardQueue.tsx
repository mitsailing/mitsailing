'use client';

import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatAdminDate } from '@/libs/admin/adminDateFormatting';
import {
  issueSailingCardAction,
  expireSailingCardAction,
} from '@/libs/admin/cards/adminSailingCardActions';
import type { AdminSailingCardActionState } from '@/libs/admin/cards/adminSailingCardActions';
import { adminUsersShowPath } from '@/libs/admin/users/adminUserPaths';

export type AdminSailingCardQueueRow = {
  readonly agreementAcceptedAt: Date | null;
  readonly agreementVersion: string | null;
  readonly email: string;
  readonly id: string;
  readonly mitId: string | null;
  readonly name: string;
  readonly requestedAt: Date | null;
  readonly sailingAffiliation: string | null;
};

export type AdminSailingCardHistoryRow = {
  readonly createdAt: Date;
  readonly id: string;
  readonly number: number;
  readonly year: number;
};

type AdminSailingCardIssueFormProps = {
  readonly action?: (
    previousState: AdminSailingCardActionState,
    formData: FormData
  ) => Promise<AdminSailingCardActionState>;
  readonly locale: string;
  readonly suggestedCardNumber: number;
  readonly userId: string;
};

const initialAdminSailingCardActionState: AdminSailingCardActionState = {
  fieldErrors: {},
  status: 'idle',
};

type AdminSailingCardFormError = NonNullable<
  AdminSailingCardActionState['formError']
>;

const formErrorMessageKeys = {
  missing_onboarding_agreement: 'error_missing_onboarding_agreement',
  no_current_card: 'error_no_current_card',
  not_found: 'error_not_found',
  not_pending_request: 'error_not_pending_request',
} as const satisfies Record<AdminSailingCardFormError, string>;

export function AdminSailingCardIssueForm(
  props: AdminSailingCardIssueFormProps
) {
  const t = useTranslations('AdminCards');
  const action =
    props.action ??
    issueSailingCardAction.bind(null, props.locale, props.userId);
  const [state, formAction] = useActionState(
    action,
    initialAdminSailingCardActionState
  );
  const cardNumberError = state.fieldErrors.cardNumber;
  const { formError } = state;
  const cardNumberErrorId = cardNumberError
    ? `${props.userId}-card-number-error`
    : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:max-w-52">
      <Label className="sr-only" htmlFor={`${props.userId}-cardNumber`}>
        {t('card_number_label')}
      </Label>
      <div className="flex gap-2">
        <Input
          aria-describedby={cardNumberErrorId}
          aria-invalid={cardNumberError ? true : undefined}
          id={`${props.userId}-cardNumber`}
          inputMode="numeric"
          min={1}
          name="cardNumber"
          placeholder={t('card_number_placeholder', {
            number: props.suggestedCardNumber,
          })}
          type="number"
        />
        <Button className="gap-2" size="sm" type="submit">
          <CheckCircle2 aria-hidden className="size-4" />
          {t('action_issue')}
        </Button>
      </div>
      {cardNumberError ? (
        <p
          className="m-0 text-xs text-destructive"
          id={cardNumberErrorId}
          role="alert"
        >
          {cardNumberError === 'duplicate'
            ? t('error_card_number_duplicate')
            : t('error_card_number_invalid')}
        </p>
      ) : null}
      {formError ? (
        <p className="m-0 text-xs text-destructive" role="alert">
          {t(formErrorMessageKeys[formError])}
        </p>
      ) : null}
    </form>
  );
}

export function AdminSailingCardExpireForm(props: {
  readonly locale: string;
  readonly userId: string;
}) {
  const t = useTranslations('AdminCards');
  const [state, formAction] = useActionState(
    expireSailingCardAction.bind(null, props.locale, props.userId),
    initialAdminSailingCardActionState
  );
  const { formError } = state;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button
        disabled={state.status === 'success'}
        size="sm"
        type="submit"
        variant="outline"
      >
        {t('action_expire')}
      </Button>
      {formError ? (
        <p className="m-0 text-xs text-destructive" role="alert">
          {t(formErrorMessageKeys[formError])}
        </p>
      ) : null}
    </form>
  );
}

export function AdminSailingCardQueue(props: {
  readonly canAssignCards: boolean;
  readonly locale: string;
  readonly rows: readonly AdminSailingCardQueueRow[];
  readonly suggestedCardNumber: number;
}) {
  const t = useTranslations('AdminCards');

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="m-0 text-lg font-semibold text-foreground">
          {t('queue_heading')}
        </h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('column_name')}</TableHead>
            <TableHead>{t('column_email')}</TableHead>
            <TableHead>{t('column_affiliation')}</TableHead>
            <TableHead>{t('column_mit_id')}</TableHead>
            <TableHead>{t('column_agreement_acceptance')}</TableHead>
            <TableHead>{t('column_requested_at')}</TableHead>
            <TableHead>{t('column_suggested_card')}</TableHead>
            <TableHead className="sticky right-0 bg-card">
              {t('column_actions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8}>{t('empty_queue')}</TableCell>
            </TableRow>
          ) : (
            props.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-semibold">
                  <Link
                    className="text-mit-red hover:underline"
                    href={adminUsersShowPath(row.id)}
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell>{row.email}</TableCell>
                <TableCell>
                  {row.sailingAffiliation ?? t('empty_value')}
                </TableCell>
                <TableCell>{row.mitId ?? t('empty_value')}</TableCell>
                <TableCell>
                  {row.agreementAcceptedAt
                    ? `${formatAdminDate(row.agreementAcceptedAt, props.locale)} (${row.agreementVersion ?? t('empty_value')})`
                    : t('empty_value')}
                </TableCell>
                <TableCell>
                  {formatAdminDate(row.requestedAt, props.locale)}
                </TableCell>
                <TableCell>{props.suggestedCardNumber}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {props.canAssignCards ? (
                      <AdminSailingCardIssueForm
                        locale={props.locale}
                        suggestedCardNumber={props.suggestedCardNumber}
                        userId={row.id}
                      />
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}

export function AdminSailingCardHistory(props: {
  readonly rows: readonly AdminSailingCardHistoryRow[];
}) {
  const t = useTranslations('AdminCards');

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="m-0 text-lg font-semibold text-foreground">
        {t('history_heading')}
      </h2>
      {props.rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {t('history_empty')}
        </p>
      ) : (
        <ul className="mt-3 space-y-2 p-0">
          {props.rows.map((row) => (
            <li className="list-none text-sm" key={row.id}>
              <span className="font-medium">
                {t('history_row', {
                  number: row.number,
                  year: row.year,
                })}
              </span>
              <span className="ml-2 text-muted-foreground">
                {formatAdminDate(row.createdAt, 'en')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
