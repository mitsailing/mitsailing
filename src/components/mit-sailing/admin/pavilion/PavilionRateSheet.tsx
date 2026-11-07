'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { SubmitButton } from '@/components/ui/submit-button';
import { adminCatalogResourceEditPath } from '@/libs/admin/catalog/adminCatalogPaths';
import {
  groupPavilionRateDrafts,
  pricesMatchingFirstAudience,
} from '@/libs/admin/pavilion-reservations/pavilionRateSheet';
import type {
  PavilionRateDraft,
  PavilionRateSheetActionState,
  PavilionRateSheetError,
  PavilionRateSheetGroupId,
} from '@/libs/admin/pavilion-reservations/pavilionRateSheet';
import { Link } from '@/libs/I18nNavigation';
import { PAVILION_RESERVATION_PERSONAS } from '@/libs/mit-sailing/pavilionReservationPersonas';
import type { PavilionReservationPersonaValue } from '@/libs/mit-sailing/pavilionReservationPersonas';

const GROUP_LABEL_KEYS = {
  event_options: 'pavilion_rates_group_event_options',
  programs: 'pavilion_rates_group_programs',
  services: 'pavilion_rates_group_services',
  venue: 'pavilion_rates_group_venue',
} as const satisfies Record<
  PavilionRateSheetGroupId,
  | 'pavilion_rates_group_event_options'
  | 'pavilion_rates_group_programs'
  | 'pavilion_rates_group_services'
  | 'pavilion_rates_group_venue'
>;

const AUDIENCE_LABEL_KEYS = {
  mit_academic: 'pavilion_rates_audience_mit_academic',
  mit_community: 'pavilion_rates_audience_mit_community',
  mit_student: 'pavilion_rates_audience_mit_student',
  non_mit: 'pavilion_rates_audience_non_mit',
} as const satisfies Record<
  PavilionReservationPersonaValue,
  | 'pavilion_rates_audience_mit_academic'
  | 'pavilion_rates_audience_mit_community'
  | 'pavilion_rates_audience_mit_student'
  | 'pavilion_rates_audience_non_mit'
>;

type PavilionRateSheetProps = {
  action: (
    state: PavilionRateSheetActionState,
    formData: FormData
  ) => Promise<PavilionRateSheetActionState>;
  rows: PavilionRateDraft[];
};

function errorFor(
  errors: readonly PavilionRateSheetError[],
  id: string,
  field: PavilionRateSheetError['field']
): PavilionRateSheetError | undefined {
  return errors.find((error) => error.id === id && error.field === field);
}

/**
 * Grouped pavilion rate sheet. Each space keeps its name next to every audience price.
 *
 * @param props - Save action and current drafts
 * @returns Rates form
 */
export function PavilionRateSheet(props: PavilionRateSheetProps) {
  const t = useTranslations('AdminCatalogResource');
  const tCommon = useTranslations('Common');
  const [state, formAction] = useActionState(props.action, {
    errors: [],
    status: 'idle',
  });
  const [rows, setRows] = useState(props.rows);
  const [dirty, setDirty] = useState(false);
  const groups = groupPavilionRateDrafts(rows);
  const formError = errorFor(state.errors, '', 'form');

  function updateRow(
    id: string,
    update: (row: PavilionRateDraft) => PavilionRateDraft
  ) {
    setDirty(true);
    setRows((current) =>
      current.map((row) => (row.id === id ? update(row) : row))
    );
  }

  function errorMessage(
    error: PavilionRateSheetError | undefined
  ): string | null {
    if (!error) {
      return null;
    }
    if (error.code === 'hourly_min_duration') {
      return t('pavilion_rates_error_hourly_min');
    }
    if (error.code === 'whole_dollars') {
      return t('pavilion_rates_error_whole_dollars');
    }
    return t('pavilion_rates_error_save');
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-6"
      onSubmit={() => {
        setDirty(false);
      }}
    >
      <input name="payload" type="hidden" value={JSON.stringify({ rows })} />
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {t('pavilion_rates_intro')}
      </p>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('pavilion_rates_empty')}
        </p>
      ) : (
        groups.map((group) => (
          <section className="flex flex-col gap-3" key={group.group}>
            <h2 className="text-base font-semibold text-foreground">
              {t(GROUP_LABEL_KEYS[group.group])}
            </h2>
            <ul className="flex flex-col gap-3">
              {group.rows.map((row) => {
                const minError = errorMessage(
                  errorFor(state.errors, row.id, 'minDurationHours')
                );
                return (
                  <li
                    className="rounded-lg border border-border bg-card p-4"
                    key={row.id}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold wrap-break-word text-foreground">
                          {row.name}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {row.isVisible ? null : (
                            <span className="text-xs font-medium text-muted-foreground">
                              {t('pavilion_rates_hidden')}
                            </span>
                          )}
                          <Link
                            className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                            href={adminCatalogResourceEditPath(
                              'pavilion_spaces',
                              row.id
                            )}
                          >
                            {t('pavilion_rates_edit_details')}
                          </Link>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="flex w-36 flex-col gap-1.5">
                          <Label htmlFor={`${row.id}-billing`}>
                            {t('pavilion_rates_billing')}
                          </Label>
                          <NativeSelect
                            aria-label={`${row.name} ${t('pavilion_rates_billing')}`}
                            id={`${row.id}-billing`}
                            onChange={(event) => {
                              const pricingType =
                                event.target.value === 'hourly'
                                  ? 'hourly'
                                  : 'flat';
                              updateRow(row.id, (current) => ({
                                ...current,
                                minDurationHours:
                                  pricingType === 'hourly'
                                    ? current.minDurationHours || '1'
                                    : '',
                                pricingType,
                              }));
                            }}
                            value={row.pricingType}
                          >
                            <option value="hourly">
                              {t('option_pricing_type_hourly')}
                            </option>
                            <option value="flat">
                              {t('option_pricing_type_flat')}
                            </option>
                          </NativeSelect>
                        </div>
                        {row.pricingType === 'hourly' ? (
                          <div className="flex w-28 flex-col gap-1.5">
                            <Label htmlFor={`${row.id}-min-hours`}>
                              {t('pavilion_rates_min_hours')}
                            </Label>
                            <Input
                              aria-describedby={
                                minError
                                  ? `${row.id}-min-hours-error`
                                  : undefined
                              }
                              aria-invalid={minError ? true : undefined}
                              aria-label={`${row.name} ${t('pavilion_rates_min_hours')}`}
                              id={`${row.id}-min-hours`}
                              inputMode="numeric"
                              onChange={(event) => {
                                const minDurationHours = event.target.value;
                                updateRow(row.id, (current) => ({
                                  ...current,
                                  minDurationHours,
                                }));
                              }}
                              value={row.minDurationHours}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {minError ? (
                      <p
                        className="mt-2 text-sm text-destructive"
                        id={`${row.id}-min-hours-error`}
                        role="alert"
                      >
                        {minError}
                      </p>
                    ) : null}
                    <p className="mt-4 text-sm text-muted-foreground">
                      {row.pricingType === 'hourly'
                        ? t('pavilion_rates_unit_hourly')
                        : t('pavilion_rates_unit_flat')}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                      {PAVILION_RESERVATION_PERSONAS.map((persona) => {
                        const amountError = errorMessage(
                          errorFor(state.errors, row.id, persona)
                        );
                        const fieldId = `${row.id}-${persona}`;
                        return (
                          <div className="flex flex-col gap-1.5" key={persona}>
                            <Label htmlFor={fieldId}>
                              {t(AUDIENCE_LABEL_KEYS[persona])}
                            </Label>
                            <div className="relative">
                              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                                $
                              </span>
                              <Input
                                aria-describedby={
                                  amountError ? `${fieldId}-error` : undefined
                                }
                                aria-invalid={amountError ? true : undefined}
                                aria-label={`${row.name} ${t(AUDIENCE_LABEL_KEYS[persona])}`}
                                className="pl-6"
                                id={fieldId}
                                inputMode="decimal"
                                onChange={(event) => {
                                  const amount = event.target.value;
                                  updateRow(row.id, (current) => ({
                                    ...current,
                                    amounts: {
                                      ...current.amounts,
                                      [persona]: amount,
                                    },
                                  }));
                                }}
                                placeholder={t('pavilion_rates_on_request')}
                                value={row.amounts[persona]}
                              />
                            </div>
                            {amountError ? (
                              <p
                                className="text-sm text-destructive"
                                id={`${fieldId}-error`}
                                role="alert"
                              >
                                {amountError}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      className="mt-3"
                      onClick={() => {
                        updateRow(row.id, (current) => ({
                          ...current,
                          amounts: pricesMatchingFirstAudience(current.amounts),
                        }));
                      }}
                      type="button"
                      variant="outline"
                      aria-label={`${row.name} ${t('pavilion_rates_same_for_all')}`}
                    >
                      {t('pavilion_rates_same_for_all')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background py-3">
        {formError ? (
          <p className="text-sm text-destructive" role="alert">
            {t('pavilion_rates_error_save')}
          </p>
        ) : null}
        {state.status === 'saved' && !dirty && !formError ? (
          <p className="text-sm text-foreground" role="status">
            {t('pavilion_rates_saved')}
          </p>
        ) : null}
        {formError || (state.status === 'saved' && !dirty) ? null : <span />}
        <SubmitButton pendingLabel={tCommon('pending_saving')} variant="mit">
          {t('pavilion_rates_save')}
        </SubmitButton>
      </div>
    </form>
  );
}
