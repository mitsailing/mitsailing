'use client';

import { useTranslations } from 'next-intl';
import type * as React from 'react';
import { useState } from 'react';
import { PavilionReservationMitStatus } from '@/components/mit-sailing/pavilion-reservations/PavilionReservationMitStatus';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  pavilionAfterHoursBandForEnd,
  pavilionReservationSunsetMinutes,
} from '@/libs/mit-sailing/pavilionReservationAfterHours';
import { isPavilionWeddingCatalogItem } from '@/libs/mit-sailing/pavilionReservationCatalogRoles';
import {
  formatPavilionReservationMoney,
  isPersonaPriceAvailable,
  personaPriceDisplay,
  priceForPersona,
} from '@/libs/mit-sailing/pavilionReservationPricing';
import { formatPavilionReservationTimeLabel } from '@/libs/mit-sailing/pavilionReservationTimeLabel';
import type {
  PavilionReservableItemDto,
  PavilionReservationPersonaValue,
  PavilionReservationSlotInput,
} from '@/libs/mit-sailing/pavilionReservationTypes';

type RequestLineSlot = PavilionReservationSlotInput & { id: string };

function PavilionReservationHelpBlock() {
  const t = useTranslations('PavilionReservationPage');

  return (
    <div className="mt-3 border-t border-mit-line pt-3 text-sm">
      <h3 className="text-sm font-semibold text-mit-text">{t('faq_title')}</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="font-semibold text-mit-text">
          {t('cancellation_label')}
        </span>{' '}
        {t('cancellation_placeholder')}
      </p>
      <ul className="mt-2 flex list-none flex-wrap gap-x-3 gap-y-1 p-0">
        <li>
          <a
            className="font-semibold text-mit-red underline-offset-2 hover:underline dark:text-mit-red-ink"
            href="https://sailing.mit.edu/info/faq.php"
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('help_faq_link')}
          </a>
        </li>
        <li>
          <a
            className="font-semibold text-mit-red underline-offset-2 hover:underline dark:text-mit-red-ink"
            href="https://sailing.mit.edu/gallery/"
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('help_photos_link')}
          </a>
        </li>
      </ul>
    </div>
  );
}

function RequestSummaryLines(props: {
  afterHoursItems: PavilionReservableItemDto[];
  editable: boolean;
  hourlyVenues: PavilionReservableItemDto[];
  itemById: (id: string) => PavilionReservableItemDto | null;
  onEditSlot?: (slotId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onRemoveSlot?: (slotId: string) => void;
  persona: PavilionReservationPersonaValue;
  slots: RequestLineSlot[];
  toggleItemIds: ReadonlySet<string>;
}) {
  const t = useTranslations('PavilionReservationPage');
  const hourlyIds = new Set(props.hourlyVenues.map((item) => item.id));
  const afterHoursIds = new Set(props.afterHoursItems.map((item) => item.id));

  const lines: React.ReactNode[] = [];

  for (const slot of props.slots) {
    if (afterHoursIds.has(slot.itemId)) {
      continue;
    }
    const item = props.itemById(slot.itemId);
    if (!item) {
      continue;
    }
    if (hourlyIds.has(slot.itemId)) {
      if (!(slot.endMinutes > slot.startMinutes) || !slot.date) {
        continue;
      }
      const hours = (slot.endMinutes - slot.startMinutes) / 60;
      const unit = priceForPersona(item, props.persona);
      const spaceCents = unit === null ? null : Math.round(unit * hours);
      const band = pavilionAfterHoursBandForEnd({
        afterHoursItems: props.afterHoursItems,
        endMinutes: slot.endMinutes,
        persona: props.persona,
        sunsetMinutes: pavilionReservationSunsetMinutes(slot.date),
      });
      lines.push(
        <li
          className="border-t border-mit-line py-2 first:border-t-0"
          key={slot.id}
        >
          <p className="text-sm font-semibold text-mit-text">{item.name}</p>
          <p className="text-xs text-muted-foreground">
            {slot.date} ·{' '}
            {formatPavilionReservationTimeLabel(slot.startMinutes)}–
            {formatPavilionReservationTimeLabel(slot.endMinutes)}
          </p>
          {spaceCents === null ? null : (
            <p className="text-xs text-muted-foreground">
              {t('summary_hourly_line', {
                hours,
                amount: formatPavilionReservationMoney(spaceCents),
              })}
            </p>
          )}
          {band ? (
            <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-950">
              <span className="font-semibold">{t(band.labelKey)}</span>
              {' · '}
              {formatPavilionReservationMoney(band.amountCents)}
            </p>
          ) : null}
          {props.editable ? (
            <div className="mt-1 flex flex-wrap gap-2">
              {props.onEditSlot ? (
                <button
                  className="text-sm font-semibold text-mit-red underline-offset-2 hover:underline dark:text-mit-red-ink"
                  type="button"
                  onClick={() => {
                    props.onEditSlot?.(slot.id);
                  }}
                >
                  {t('action_edit')}
                </button>
              ) : null}
              {props.onRemoveSlot ? (
                <button
                  className="text-sm font-semibold text-mit-red underline-offset-2 hover:underline dark:text-mit-red-ink"
                  type="button"
                  onClick={() => {
                    props.onRemoveSlot?.(slot.id);
                  }}
                >
                  {t('action_remove')}
                </button>
              ) : null}
            </div>
          ) : null}
        </li>
      );
      continue;
    }

    if (!props.toggleItemIds.has(slot.itemId)) {
      continue;
    }
    // Flat toggle lines render once per item below.
  }

  for (const itemId of props.toggleItemIds) {
    const item = props.itemById(itemId);
    if (!item) {
      continue;
    }
    const amount = priceForPersona(item, props.persona);
    lines.push(
      <li
        className="border-t border-mit-line py-2 first:border-t-0"
        key={`flat-${itemId}`}
      >
        <p className="text-sm font-semibold text-mit-text">
          {item.name}
          {amount === null
            ? ` · ${t('price_on_request')}`
            : ` · ${formatPavilionReservationMoney(amount)}`}
        </p>
        <p className="text-xs text-muted-foreground">{t('summary_flat_tag')}</p>
        {props.editable ? (
          <button
            className="mt-1 text-sm font-semibold text-mit-red underline-offset-2 hover:underline dark:text-mit-red-ink"
            type="button"
            onClick={() => {
              props.onRemoveItem(itemId);
            }}
          >
            {t('action_remove')}
          </button>
        ) : null}
      </li>
    );
  }

  return <ul className="m-0 list-none p-0">{lines}</ul>;
}

export function PavilionReservationRequestSummary(props: {
  afterHoursItems: PavilionReservableItemDto[];
  canContinue: boolean;
  estimate: { hasPriceOnRequest: boolean; totalCents: number };
  hourlyVenues: PavilionReservableItemDto[];
  itemById: (id: string) => PavilionReservableItemDto | null;
  lineCount: number;
  onChangeStatus: () => void;
  onContinue: () => void;
  onEditSlot?: (slotId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onRemoveSlot?: (slotId: string) => void;
  persona: PavilionReservationPersonaValue;
  slots: RequestLineSlot[];
  toggleItemIds: ReadonlySet<string>;
  variant: 'desktop' | 'mobile';
}) {
  const t = useTranslations('PavilionReservationPage');
  const [expanded, setExpanded] = useState(false);
  const empty = props.lineCount === 0;
  const totalLabel = formatPavilionReservationMoney(props.estimate.totalCents);
  const ratesPhrase = t('persona_rates_phrase', {
    persona: t(`persona_${props.persona}_label`),
  });
  const totalWithRates = t('estimated_total_with_rates', {
    amount: totalLabel,
    rates: ratesPhrase,
  });

  if (props.variant === 'mobile') {
    return (
      <div className="sticky top-0 z-20 mb-3 rounded-[10px] border border-mit-line bg-card/95 p-3 backdrop-blur md:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-mit-text">
              {t('request_summary_title')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('request_summary_count', {
                count: props.lineCount,
                total: totalLabel,
              })}
            </p>
            <PavilionReservationMitStatus
              persona={props.persona}
              variant="mobile"
              onChange={props.onChangeStatus}
            />
          </div>
          <button
            aria-expanded={expanded}
            className="text-sm font-semibold text-mit-red underline-offset-2 hover:underline dark:text-mit-red-ink"
            type="button"
            onClick={() => {
              setExpanded((current) => !current);
            }}
          >
            {t('request_summary_details')}
          </button>
          <Button
            disabled={!props.canContinue}
            size="sm"
            title={
              props.canContinue ? undefined : t('request_continue_empty_hint')
            }
            type="button"
            variant="mit"
            onClick={props.onContinue}
          >
            {t('action_continue_short')}
          </Button>
        </div>
        {expanded ? (
          <div className="mt-3 border-t border-mit-line pt-3">
            {empty ? (
              <p className="text-sm text-muted-foreground">
                {t('request_continue_empty_hint')}
              </p>
            ) : (
              <RequestSummaryLines
                afterHoursItems={props.afterHoursItems}
                editable
                hourlyVenues={props.hourlyVenues}
                itemById={props.itemById}
                onEditSlot={props.onEditSlot}
                onRemoveItem={props.onRemoveItem}
                onRemoveSlot={props.onRemoveSlot}
                persona={props.persona}
                slots={props.slots}
                toggleItemIds={props.toggleItemIds}
              />
            )}
            <p className="mt-2 text-sm font-semibold text-mit-text">
              {totalWithRates}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('no_payment_due_today')}
            </p>
            <PavilionReservationHelpBlock />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <aside
      aria-label={t('request_summary_title')}
      className={cn(
        'sticky top-3 hidden flex-col gap-3 rounded-[10px] border p-4 md:flex',
        empty ? 'border-mit-line bg-card' : 'border-mit-red/30 bg-mit-red/10'
      )}
    >
      <PavilionReservationMitStatus
        persona={props.persona}
        variant="rail"
        onChange={props.onChangeStatus}
      />
      <h2 className="m-0 text-base font-semibold text-mit-text">
        {t('request_summary_title')}
      </h2>
      {empty ? (
        <p className="m-0 text-sm text-muted-foreground">
          {t('request_continue_empty_hint')}
        </p>
      ) : (
        <RequestSummaryLines
          afterHoursItems={props.afterHoursItems}
          editable
          hourlyVenues={props.hourlyVenues}
          itemById={props.itemById}
          onEditSlot={props.onEditSlot}
          onRemoveItem={props.onRemoveItem}
          onRemoveSlot={props.onRemoveSlot}
          persona={props.persona}
          slots={props.slots}
          toggleItemIds={props.toggleItemIds}
        />
      )}
      <p className="m-0 text-xs text-muted-foreground">
        {t('review_availability_suggest')}
      </p>
      <p className="m-0 text-sm font-semibold text-mit-text">
        {totalWithRates}
        {props.estimate.hasPriceOnRequest
          ? ` ${t('plus_price_on_request')}`
          : ''}
      </p>
      <div className="flex flex-col gap-2">
        <Button
          className="w-full"
          disabled={!props.canContinue}
          title={
            props.canContinue ? undefined : t('request_continue_empty_hint')
          }
          type="button"
          variant="mit"
          onClick={props.onContinue}
        >
          {t('action_continue_review')}
        </Button>
        <p className="m-0 text-center text-xs text-muted-foreground">
          {t('no_payment_due_today')}
        </p>
      </div>
      <PavilionReservationHelpBlock />
    </aside>
  );
}

export function PavilionReservationFlatToggle(props: {
  item: PavilionReservableItemDto;
  onToggle: (itemId: string, selected: boolean) => void;
  persona: PavilionReservationPersonaValue;
  selected: boolean;
  tip?: string | null;
}) {
  const t = useTranslations('PavilionReservationPage');
  const priceDisplay = personaPriceDisplay({
    item: props.item,
    persona: props.persona,
    onRequestLabel: t('price_on_request'),
  });
  const disabled = !isPersonaPriceAvailable(priceDisplay.priceCents);

  return (
    <label
      className={cn(
        'flex items-start gap-3 rounded-[10px] border p-4 transition-colors',
        disabled
          ? 'cursor-not-allowed border-mit-line bg-mit-surface opacity-75'
          : 'cursor-pointer',
        props.selected
          ? 'border-mit-red bg-mit-red-highlight'
          : 'border-mit-line'
      )}
    >
      <input
        checked={props.selected}
        className="mt-1"
        disabled={disabled}
        type="checkbox"
        onChange={(event) => {
          props.onToggle(props.item.id, event.currentTarget.checked);
        }}
      />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-mit-text">
          {props.item.name}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {disabled ? t('service_unavailable') : props.item.description}
        </span>
        {props.tip ? (
          <span className="mt-1 block text-xs text-muted-foreground">
            {props.tip}
          </span>
        ) : null}
        {isPavilionWeddingCatalogItem(props.item) ? (
          <span className="mt-1 block text-xs text-muted-foreground">
            {t('wedding_requires_venue_hint')}
          </span>
        ) : null}
      </span>
      <span className="font-semibold text-primary-ink">
        {disabled ? t('service_unavailable_price') : priceDisplay.label}
      </span>
    </label>
  );
}

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
        {t('fees_panel_through_2am', {
          amount: formatPavilionReservationMoney(
            props.after2Cents ?? props.after10Cents
          ),
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
