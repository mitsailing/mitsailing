'use client';

import { CheckCircle2, Printer, Zap } from 'lucide-react';
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
  updateSailingCardNumberAction,
} from '@/libs/admin/cards/adminSailingCardActions';
import type { AdminSailingCardActionState } from '@/libs/admin/cards/adminSailingCardActions';

export type AdminSailingCardPaymentAccess = 'blocked' | 'none' | 'paid';

export type AdminSailingCardHistoryRow = {
  readonly action: 'changed' | 'expired' | 'issued';
  readonly actorName: string | null;
  readonly createdAt: Date;
  readonly fromNumber: number | null;
  readonly fromYear: number | null;
  readonly id: string;
  readonly toNumber: number | null;
  readonly toYear: number | null;
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
  same_card_number: 'error_same_card_number',
} as const satisfies Record<AdminSailingCardFormError, string>;

type AdminSailingCardIssueFormModel = {
  readonly cardNumberError: AdminSailingCardActionState['fieldErrors']['cardNumber'];
  readonly cardNumberErrorId: string | undefined;
  readonly cardNumberInputId: string;
  readonly formAction: (payload: FormData) => void;
  readonly formError: AdminSailingCardActionState['formError'];
  readonly needsPaymentBypassNote: boolean;
  readonly paymentBypassNoteId: string;
};

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

function AdminSailingCardNumberField(props: {
  readonly actionLabel: string;
  readonly defaultValue?: number;
  readonly error: AdminSailingCardActionState['fieldErrors']['cardNumber'];
  readonly errorId: string | undefined;
  readonly inputId: string;
  readonly required?: boolean;
  readonly suggestedCardNumber: number;
}) {
  const t = useTranslations('AdminCards');

  return (
    <>
      <Label htmlFor={props.inputId}>{t('card_number_label')}</Label>
      <div className="flex gap-2">
        <Input
          aria-describedby={props.errorId}
          aria-invalid={props.error ? true : undefined}
          defaultValue={props.defaultValue}
          id={props.inputId}
          inputMode="numeric"
          min={1}
          name="cardNumber"
          placeholder={t('card_number_placeholder', {
            number: props.suggestedCardNumber,
          })}
          required={props.required}
          step={1}
          type="number"
        />
        <Button className="gap-2" size="sm" type="submit">
          <CheckCircle2 aria-hidden className="size-4" />
          {props.actionLabel}
        </Button>
      </div>
    </>
  );
}

function useAdminSailingCardIssueFormModel(
  props: AdminSailingCardIssueFormProps
): AdminSailingCardIssueFormModel {
  const action =
    props.action ??
    issueSailingCardAction.bind(null, props.locale, props.userId);
  const [state, formAction] = useActionState(
    action,
    initialAdminSailingCardActionState
  );
  const cardNumberError = state.fieldErrors.cardNumber;

  return {
    cardNumberError,
    cardNumberErrorId: cardNumberError
      ? `${props.userId}-card-number-error`
      : undefined,
    cardNumberInputId: `${props.userId}-cardNumber`,
    formAction,
    formError: state.formError,
    needsPaymentBypassNote: issueFormNeedsPaymentBypassNote({
      cardType: props.cardType,
      paymentAccess: props.paymentAccess,
    }),
    paymentBypassNoteId: `${props.userId}-paymentBypassNote`,
  };
}

export function AdminSailingCardIssueForm(
  props: AdminSailingCardIssueFormProps
) {
  const t = useTranslations('AdminCards');
  const model = useAdminSailingCardIssueFormModel(props);

  return (
    <form
      action={model.formAction}
      aria-label={t('issue_form_label')}
      className="flex flex-col gap-2 sm:max-w-52"
    >
      <p className="m-0 text-xs text-muted-foreground">
        {t('issue_number_help', { number: props.suggestedCardNumber })}
      </p>
      <AdminSailingCardNumberField
        actionLabel={t('action_issue_number', {
          number: props.suggestedCardNumber,
        })}
        defaultValue={props.suggestedCardNumber}
        error={model.cardNumberError}
        errorId={model.cardNumberErrorId}
        inputId={model.cardNumberInputId}
        suggestedCardNumber={props.suggestedCardNumber}
      />
      <AdminSailingCardNumberError
        error={model.cardNumberError}
        id={model.cardNumberErrorId}
      />
      {/* eslint-disable-next-line no-use-before-define -- Lizard mis-parses this TSX helper when it sits above the form. */}
      <AdminSailingCardPaymentBypassNote
        id={model.paymentBypassNoteId}
        visible={model.needsPaymentBypassNote}
      />
      <AdminSailingCardFormErrorMessage formError={model.formError} />
    </form>
  );
}

export function AdminSailingCardPrintActions(props: {
  readonly userId: string;
}) {
  const t = useTranslations('AdminCards');
  const encodedUserId = encodeURIComponent(props.userId);

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild className="gap-2" size="sm" variant="outline">
        <a
          href={`/admin/users/${encodedUserId}/sailing-card/print`}
          rel="noreferrer"
          target="_blank"
        >
          <Printer aria-hidden className="size-4" />
          {t('action_print_card')}
        </a>
      </Button>
      <Button asChild className="gap-2" size="sm" variant="outline">
        <a
          href={`/admin/users/${encodedUserId}/sailing-card/quick-print`}
          rel="noreferrer"
          target="_blank"
        >
          <Zap aria-hidden className="size-4" />
          {t('action_quick_print')}
        </a>
      </Button>
    </div>
  );
}

export function AdminSailingCardChangeNumberForm(props: {
  readonly action?: (
    previousState: AdminSailingCardActionState,
    formData: FormData
  ) => Promise<AdminSailingCardActionState>;
  readonly currentCardNumber: number;
  readonly locale: string;
  readonly userId: string;
}) {
  const t = useTranslations('AdminCards');
  const action =
    props.action ??
    updateSailingCardNumberAction.bind(null, props.locale, props.userId);
  const [state, formAction] = useActionState(
    action,
    initialAdminSailingCardActionState
  );
  const cardNumberError = state.fieldErrors.cardNumber;
  const cardNumberErrorId = cardNumberError
    ? `${props.userId}-change-card-number-error`
    : undefined;

  return (
    <form
      action={formAction}
      aria-label={t('change_number_form_label')}
      className="flex flex-col gap-2"
    >
      <p className="m-0 text-xs text-muted-foreground">
        {t('change_number_help', { number: props.currentCardNumber })}
      </p>
      <AdminSailingCardNumberField
        actionLabel={t('action_save_correction')}
        defaultValue={props.currentCardNumber}
        error={cardNumberError}
        errorId={cardNumberErrorId}
        inputId={`${props.userId}-changeCardNumber`}
        required
        suggestedCardNumber={props.currentCardNumber}
      />
      <AdminSailingCardNumberError
        error={cardNumberError}
        id={cardNumberErrorId}
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

function changedHistoryRowLabel(props: {
  readonly row: AdminSailingCardHistoryRow;
  readonly t: ReturnType<typeof useTranslations<'AdminCards'>>;
}) {
  if (
    props.row.fromNumber === null ||
    props.row.fromYear === null ||
    props.row.toNumber === null ||
    props.row.toYear === null
  ) {
    return null;
  }
  if (props.row.fromYear === props.row.toYear) {
    return props.t('history_row_changed', {
      fromNumber: props.row.fromNumber,
      toNumber: props.row.toNumber,
      year: props.row.toYear,
    });
  }
  return props.t('history_row_changed_year', {
    fromNumber: props.row.fromNumber,
    fromYear: props.row.fromYear,
    toNumber: props.row.toNumber,
    toYear: props.row.toYear,
  });
}

function expiredHistoryRowLabel(props: {
  readonly row: AdminSailingCardHistoryRow;
  readonly t: ReturnType<typeof useTranslations<'AdminCards'>>;
}) {
  if (props.row.fromNumber !== null && props.row.fromYear !== null) {
    return props.t('history_row_expired', {
      number: props.row.fromNumber,
      year: props.row.fromYear,
    });
  }
  return null;
}

function issuedHistoryRowLabel(props: {
  readonly row: AdminSailingCardHistoryRow;
  readonly t: ReturnType<typeof useTranslations<'AdminCards'>>;
}) {
  if (props.row.toNumber !== null && props.row.toYear !== null) {
    return props.t('history_row_issued', {
      number: props.row.toNumber,
      year: props.row.toYear,
    });
  }
  return null;
}

const historyRowLabelGetters = {
  changed: changedHistoryRowLabel,
  expired: expiredHistoryRowLabel,
  issued: issuedHistoryRowLabel,
} as const satisfies Record<
  AdminSailingCardHistoryRow['action'],
  (props: {
    readonly row: AdminSailingCardHistoryRow;
    readonly t: ReturnType<typeof useTranslations<'AdminCards'>>;
  }) => string | null
>;

function historyRowLabel(props: {
  readonly row: AdminSailingCardHistoryRow;
  readonly t: ReturnType<typeof useTranslations<'AdminCards'>>;
}) {
  return (
    historyRowLabelGetters[props.row.action](props) ??
    props.t('history_row_unknown')
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
              <p className="m-0 font-medium">{historyRowLabel({ row, t })}</p>
              <p className="m-0 text-xs text-muted-foreground">
                {row.actorName
                  ? t('history_row_meta_actor', {
                      actor: row.actorName,
                      date: formatAdminDate(row.createdAt, 'en'),
                    })
                  : t('history_row_meta', {
                      date: formatAdminDate(row.createdAt, 'en'),
                    })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
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
