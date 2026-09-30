'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { PavilionReservationPersonaValue } from '@/libs/mit-sailing/pavilionReservationTypes';

const statusLinkClassName =
  'font-semibold text-mit-red underline-offset-2 hover:underline dark:text-mit-red-ink';

/**
 * Always-visible MIT status / rate-table context for the request builder.
 *
 * @param props - Persona, change handler, and layout variant
 * @returns Status banner, rail block, or compact mobile line
 */
export function PavilionReservationMitStatus(props: {
  onChange: () => void;
  persona: PavilionReservationPersonaValue;
  variant: 'banner' | 'mobile' | 'rail' | 'review';
}) {
  const t = useTranslations('PavilionReservationPage');
  const label = t(`persona_${props.persona}_label`);
  const detail = t(`persona_${props.persona}_status_detail`);

  if (props.variant === 'mobile') {
    return (
      <p className="text-xs text-muted-foreground">
        {t('persona_rates_phrase', { persona: label })}
      </p>
    );
  }

  if (props.variant === 'rail') {
    return (
      <div className="mb-3 border-b border-mit-line pb-3">
        <p className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
          {t('mit_status_label')}
        </p>
        <p className="text-sm font-semibold text-mit-text">{label}</p>
        <p className="text-xs text-muted-foreground">
          {t('mit_status_totals_use_rates', { detail })}
        </p>
        <button
          className={cn('mt-1 text-sm', statusLinkClassName)}
          type="button"
          onClick={props.onChange}
        >
          {t('mit_status_change_status')}
        </button>
      </div>
    );
  }

  if (props.variant === 'review') {
    return (
      <div className="flex flex-col gap-2 rounded-[10px] border border-mit-red/25 bg-mit-red/10 p-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
            {t('mit_status_label')}
          </span>
          <strong className="text-base font-semibold text-mit-text">
            {label}
          </strong>
          <button
            className={cn('text-sm', statusLinkClassName)}
            type="button"
            onClick={props.onChange}
          >
            {t('mit_status_change_status')}
          </button>
        </div>
        <p className="m-0 text-xs text-muted-foreground">
          {t('mit_status_totals_use_rates', { detail })}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[10px] border border-mit-red/25 bg-mit-red/10 px-4 py-3 text-sm text-mit-text">
      <span className="text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {t('mit_status_label')}
      </span>
      <strong className="text-base font-semibold">{label}</strong>
      <span className="min-w-48 flex-1 text-muted-foreground">{detail}</span>
      <button
        className={statusLinkClassName}
        type="button"
        onClick={props.onChange}
      >
        {t('mit_status_change')}
      </button>
    </div>
  );
}
