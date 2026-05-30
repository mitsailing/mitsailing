'use client';

import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SailingCardType } from '@/generated/prisma/enums';
import { formatAdminDate } from '@/libs/admin/adminDateFormatting';
import {
  issueSailingCardAction,
  expireSailingCardAction,
} from '@/libs/admin/cards/adminSailingCardActions';
import type { AdminSailingCardActionState } from '@/libs/admin/cards/adminSailingCardActions';

export type AdminSailingCardPaymentAccess = 'blocked' | 'none' | 'paid';

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
  readonly cardType?: SailingCardType;
  readonly locale: string;
  readonly paymentAccess?: AdminSailingCardPaymentAccess;
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
  mit_recreation_required: 'error_mit_recreation_required',
  no_current_card: 'error_no_current_card',
  not_found: 'error_not_found',
  not_pending_request: 'error_not_pending_request',
  payment_required: 'error_payment_required',
} as const satisfies Record<AdminSailingCardFormError, string>;

function issueFormNeedsPaymentBypassNote(props: {
  readonly cardType: SailingCardType | undefined;
  readonly paymentAccess: AdminSailingCardPaymentAccess | undefined;
}) {
  return (
    props.paymentAccess !== 'paid' &&
    (props.cardType === SailingCardType.racing ||
      props.cardType === SailingCardType.team_racing)
  );
}

function AdminSailingCardNumberError(props: {
  readonly error: AdminSailingCardActionState['fieldErrors']['cardNumber'];
  readonly id: string | undefined;
}) {
  const t = useTranslations('AdminCards');

  if (!props.error) {
    return null;
  }

  return (
    <p className="m-0 text-xs text-destructive" id={props.id} role="alert">
      {props.error === 'duplicate'
        ? t('error_card_number_duplicate')
        : t('error_card_number_invalid')}
    </p>
  );
}

function AdminSailingCardPaymentBypassNote(props: {
  readonly id: string;
  readonly visible: boolean;
}) {
  const t = useTranslations('AdminCards');

  if (!props.visible) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={props.id}>{t('payment_bypass_note_label')}</Label>
      <Textarea
        id={props.id}
        name="paymentBypassNote"
        placeholder={t('payment_bypass_note_placeholder')}
        required
        rows={3}
      />
    </div>
  );
}

function AdminSailingCardFormErrorMessage(props: {
  readonly formError: AdminSailingCardActionState['formError'];
}) {
  const t = useTranslations('AdminCards');

  if (!props.formError) {
    return null;
  }

  return (
    <p className="m-0 text-xs text-destructive" role="alert">
      {t(formErrorMessageKeys[props.formError])}
    </p>
  );
}

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
  const cardNumberErrorId = cardNumberError
    ? `${props.userId}-card-number-error`
    : undefined;
  const paymentBypassNoteId = `${props.userId}-paymentBypassNote`;
  const needsPaymentBypassNote = issueFormNeedsPaymentBypassNote({
    cardType: props.cardType,
    paymentAccess: props.paymentAccess,
  });

  return (
    <form
      action={formAction}
      aria-label={t('issue_form_label')}
      className="flex flex-col gap-2 sm:max-w-52"
    >
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
      <AdminSailingCardNumberError
        error={cardNumberError}
        id={cardNumberErrorId}
      />
      <AdminSailingCardPaymentBypassNote
        id={paymentBypassNoteId}
        visible={needsPaymentBypassNote}
      />
      <AdminSailingCardFormErrorMessage formError={state.formError} />
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
