'use client';

import { useTranslations } from 'next-intl';
import {
  formatPavilionReservationMoney,
  priceForPersona,
} from '@/libs/mit-sailing/pavilionReservationPricing';
import type {
  PavilionReservableItemDto,
  PavilionReservationPersonaValue,
} from '@/libs/mit-sailing/pavilionReservationTypes';

function PavilionReservationFeesAfterHours(props: {
  academic: boolean;
  after10Cents: number | null;
  after2Cents: number | null;
}) {
  const t = useTranslations('PavilionReservationPage');
  if (props.academic || props.after10Cents === null) {
    return <p>{t('fees_panel_academic_note')}</p>;
  }
  return (
    <ul className="list-disc space-y-1 pl-5">
      <li>{t('fees_panel_before_sunset')}</li>
      <li>
        {t('fees_panel_through_10pm', {
          amount: formatPavilionReservationMoney(props.after10Cents),
        })}
      </li>
      <li>
        {props.after2Cents === null
          ? t('fees_panel_through_2am_on_request')
          : t('fees_panel_through_2am', {
              amount: formatPavilionReservationMoney(props.after2Cents),
            })}
      </li>
    </ul>
  );
}

function PavilionReservationFeesDetails(props: {
  academic: boolean;
  after10Cents: number | null;
  after2Cents: number | null;
  dockRate: number | null;
  roofRate: number | null;
}) {
  const t = useTranslations('PavilionReservationPage');
  return (
    <details className="mt-2">
      <summary className="cursor-pointer font-semibold text-mit-red dark:text-mit-red-ink">
        {t('fees_panel_details_summary')}
      </summary>
      <div className="mt-2 space-y-2 text-sm text-muted-foreground">
        <PavilionReservationFeesAfterHours
          academic={props.academic}
          after10Cents={props.after10Cents}
          after2Cents={props.after2Cents}
        />
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('fees_panel_window')}</li>
          <li>{t('picker_notice')}</li>
          {props.dockRate !== null || props.roofRate !== null ? (
            <li>
              {t('fees_panel_hourly_rates', {
                dock:
                  props.dockRate === null
                    ? t('price_on_request')
                    : formatPavilionReservationMoney(props.dockRate),
                roof:
                  props.roofRate === null
                    ? t('price_on_request')
                    : formatPavilionReservationMoney(props.roofRate),
              })}
            </li>
          ) : null}
          <li>{t('fees_panel_availability')}</li>
        </ul>
      </div>
    </details>
  );
}

export function PavilionReservationFeesPanel(props: {
  afterHoursItems: PavilionReservableItemDto[];
  hourlyVenues: PavilionReservableItemDto[];
  persona: PavilionReservationPersonaValue;
}) {
  const t = useTranslations('PavilionReservationPage');
  const dock = props.hourlyVenues.find((item) => item.slug === 'casual_dock');
  const roof = props.hourlyVenues.find((item) => item.slug === 'roof_deck');
  const after10 = props.afterHoursItems.find(
    (item) => item.slug === 'after_10'
  );
  const after2 = props.afterHoursItems.find(
    (item) => item.slug === 'after_midnight'
  );

  return (
    <div className="text-sm text-mit-text">
      <p className="m-0">
        <strong>{t('fees_panel_title')}</strong> {t('fees_panel_summary')}{' '}
        <a
          className="font-semibold text-mit-red underline-offset-2 hover:underline dark:text-mit-red-ink"
          href="https://sailing.mit.edu/info/faq.php"
          rel="noopener noreferrer"
          target="_blank"
        >
          {t('help_faq_link')}
        </a>
      </p>
      <PavilionReservationFeesDetails
        academic={props.persona === 'mit_academic'}
        after10Cents={after10 ? priceForPersona(after10, props.persona) : null}
        after2Cents={after2 ? priceForPersona(after2, props.persona) : null}
        dockRate={dock ? priceForPersona(dock, props.persona) : null}
        roofRate={roof ? priceForPersona(roof, props.persona) : null}
      />
    </div>
  );
}
