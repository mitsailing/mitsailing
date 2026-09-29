'use client';

import { Description, Field, Label as HeadlessLabel } from '@headlessui/react';
import { CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type * as React from 'react';
import { useActionState, useEffect, useRef, useState } from 'react';
import { PavilionReservationFeesPanel } from '@/components/mit-sailing/pavilion-reservations/PavilionReservationFeesPanel';
import {
  PavilionReservationIdentityStep,
  sampleHourlyFromItems,
} from '@/components/mit-sailing/pavilion-reservations/PavilionReservationIdentityStep';
import { PavilionReservationMitStatus } from '@/components/mit-sailing/pavilion-reservations/PavilionReservationMitStatus';
import {
  PavilionReservationFlatToggle,
  PavilionReservationRequestSummary,
} from '@/components/mit-sailing/pavilion-reservations/PavilionReservationRequestSummary';
import { PavilionReservationVenueCard } from '@/components/mit-sailing/pavilion-reservations/PavilionReservationVenueCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { SubmitButton } from '@/components/ui/submit-button';
import { Textarea } from '@/components/ui/textarea';
import {
  addNyCalendarDays,
  instantForNyWallClock,
  nyYmd,
} from '@/lib/mit-sailing/nyTime';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';
import {
  pavilionAfterHoursBandForEnd,
  pavilionReservationSunsetMinutes,
  syncPavilionAfterHoursSlots,
} from '@/libs/mit-sailing/pavilionReservationAfterHours';
import {
  listPavilionReservationTimeOptions,
  PAVILION_RESERVATION_END_MINUTES,
} from '@/libs/mit-sailing/pavilionReservationBookingTimeline';
import type { PavilionReservationTimeOption } from '@/libs/mit-sailing/pavilionReservationBookingTimeline';
import {
  isPavilionWeddingCatalogItem,
  partitionPavilionCatalogForRequestBuilder,
} from '@/libs/mit-sailing/pavilionReservationCatalogRoles';
import { loadPavilionReservationDraftByResumeTokenAction } from '@/libs/mit-sailing/pavilionReservationDraftActions';
import type {
  PavilionReservationWizardStep,
  UpsertPavilionReservationDraftInput,
  UpsertPavilionReservationDraftResult,
} from '@/libs/mit-sailing/pavilionReservationDraftTypes';
import { normalizePavilionReservationWizardStep } from '@/libs/mit-sailing/pavilionReservationDraftTypes';
import {
  PAVILION_RESERVATION_PERSONAS,
  parsePavilionReservationPersona,
} from '@/libs/mit-sailing/pavilionReservationPersonas';
import {
  estimatedServiceAmountCents,
  estimatedSlotAmountCents,
  formatPavilionReservationMoney,
  isPersonaPriceAvailable,
  personaPriceDisplay,
  priceForPersona,
} from '@/libs/mit-sailing/pavilionReservationPricing';
import {
  clearPavilionReservationResumeTokenFromSession,
  readPavilionReservationResumeTokenFromSession,
  writePavilionReservationResumeTokenToSession,
} from '@/libs/mit-sailing/pavilionReservationResumeTokenSession';
import {
  pavilionAvailableStartBands,
  pavilionStartOptionsForBand,
  pavilionStartTimeBand,
} from '@/libs/mit-sailing/pavilionReservationStartBands';
import type { PavilionStartTimeBand } from '@/libs/mit-sailing/pavilionReservationStartBands';
import { formatPavilionReservationTimeLabel } from '@/libs/mit-sailing/pavilionReservationTimeLabel';
import type {
  PavilionReservableItemDto,
  PavilionReservationPersonaValue,
  PavilionReservationSlotInput,
  PavilionReservationSubmitState,
} from '@/libs/mit-sailing/pavilionReservationTypes';
import { ariaInvalidWhenShown } from '@/utils/ariaInvalidWhenShown';
import { isValidEmailAddress } from '@/utils/emailValidation';

type ClientSlot = PavilionReservationSlotInput & {
  id: string;
};

type PavilionReservationBlockedRange = {
  itemId: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
};

type ContactFields = {
  firstName: string;
  lastName: string;
  phone: string;
  eventName: string;
  groupName: string;
  groupSize: string;
  description: string;
  hasTent: boolean;
  servesAlcohol: boolean;
  projectTitle: string;
  advisorName: string;
  advisorEmail: string;
  costCenter: string;
  mitId: string;
  mitAccount: string;
};

type WizardStep = PavilionReservationWizardStep;

function itemById(items: PavilionReservableItemDto[], id: string) {
  return items.find((item) => item.id === id) ?? null;
}

function createClientSlotId() {
  return crypto.randomUUID();
}

const mitAffiliationPersonas = ['mit_student', 'mit_community'] as const;

function updatePavilionReservationPersonaFromValue(props: {
  setPersona: (persona: PavilionReservationPersonaValue) => void;
  value: string;
}) {
  const nextPersona = parsePavilionReservationPersona(props.value) ?? null;
  if (nextPersona) {
    props.setPersona(nextPersona);
  }
}

type PavilionReservationWizardProps = {
  action: (
    state: PavilionReservationSubmitState,
    formData: FormData
  ) => Promise<PavilionReservationSubmitState>;
  blockedRanges: PavilionReservationBlockedRange[];
  initialState: PavilionReservationSubmitState;
  items: PavilionReservableItemDto[];
  permalink: string;
  serverResume?: {
    draft: {
      contact: ContactFields;
      persona: PavilionReservationPersonaValue;
      requesterEmail: string;
      selectedServiceIds: string[];
      slots: ClientSlot[];
      step: WizardStep | 'contact' | 'spaces';
    };
    requestId: string;
    resumeToken: string;
  } | null;
  upsertDraft: (
    input: UpsertPavilionReservationDraftInput
  ) => Promise<UpsertPavilionReservationDraftResult>;
};

const initialContact: ContactFields = {
  firstName: '',
  lastName: '',
  phone: '',
  eventName: '',
  groupName: '',
  groupSize: '',
  description: '',
  hasTent: false,
  servesAlcohol: false,
  projectTitle: '',
  advisorName: '',
  advisorEmail: '',
  costCenter: '',
  mitId: '',
  mitAccount: '',
};

function newSlot(itemId: string): ClientSlot {
  return {
    id: crypto.randomUUID(),
    itemId,
    date: '',
    startMinutes: 0,
    endMinutes: 0,
  };
}

const pavilionTimeOptions = listPavilionReservationTimeOptions();
const startOptions = pavilionTimeOptions.filter(
  (option) => option.minutes < PAVILION_RESERVATION_END_MINUTES
);
const endOptions = pavilionTimeOptions;

type CalendarMonth = {
  monthIndex: number;
  year: number;
};

type CalendarCell = {
  day: number | null;
  iso: string;
};

type SlotPhase = 'date' | 'end' | 'start';

function isoFromCalendarDate(params: {
  day: number;
  monthIndex: number;
  year: number;
}): string {
  return `${params.year}-${String(params.monthIndex + 1).padStart(2, '0')}-${String(params.day).padStart(2, '0')}`;
}

function calendarMonthFromIso(iso: string): CalendarMonth | null {
  const match = iso.match(/^(\d{4})-(\d{2})-\d{2}$/u);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthIndex) ||
    monthIndex < 0 ||
    monthIndex > 11
  ) {
    return null;
  }
  return { monthIndex, year };
}

function minimumSlotDateIso(): string {
  return addNyCalendarDays(nyYmd(new Date()), 2);
}

function flatToggleSlot(itemId: string): ClientSlot {
  return {
    date: minimumSlotDateIso(),
    endMinutes: 8 * 60,
    id: createClientSlotId(),
    itemId,
    startMinutes: 7 * 60,
  };
}

function initialCalendarMonth(date: string): CalendarMonth {
  const selectedMonth = calendarMonthFromIso(date);
  if (selectedMonth) {
    return selectedMonth;
  }
  const minimumMonth = calendarMonthFromIso(minimumSlotDateIso());
  return minimumMonth ?? { monthIndex: 0, year: new Date().getUTCFullYear() };
}

function shiftedCalendarMonth(
  month: CalendarMonth,
  amount: number
): CalendarMonth {
  const next = new Date(Date.UTC(month.year, month.monthIndex + amount, 1));
  return {
    monthIndex: next.getUTCMonth(),
    year: next.getUTCFullYear(),
  };
}

function buildCalendarCells(month: CalendarMonth): CalendarCell[] {
  const firstWeekday = new Date(
    Date.UTC(month.year, month.monthIndex, 1)
  ).getUTCDay();
  const daysInMonth = new Date(
    Date.UTC(month.year, month.monthIndex + 1, 0)
  ).getUTCDate();
  const cells: CalendarCell[] = Array.from(
    { length: firstWeekday },
    (_, emptyDay) => ({
      day: null,
      iso: `empty-before-${month.year}-${month.monthIndex}-${emptyDay}`,
    })
  );
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      iso: isoFromCalendarDate({
        day,
        monthIndex: month.monthIndex,
        year: month.year,
      }),
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({
      day: null,
      iso: `empty-after-${month.year}-${month.monthIndex}-${cells.length}`,
    });
  }
  return cells;
}

function formatCalendarMonth(month: CalendarMonth, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(Date.UTC(month.year, month.monthIndex, 1)));
}

function formatSlotDateShort(
  iso: string,
  locale: string,
  timeZone = 'UTC'
): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone,
    weekday: 'long',
  }).format(new Date(`${iso}T12:00:00Z`));
}

function parseIsoCalendarDate(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) {
    return null;
  }
  return {
    day: Number(match[3]),
    month: Number(match[2]),
    year: Number(match[1]),
  };
}

function slotSatisfiesNotice(props: {
  date: string;
  minutes: number;
  now: Date;
}) {
  const date =
    props.minutes >= 24 * 60 ? addNyCalendarDays(props.date, 1) : props.date;
  const minutes =
    props.minutes >= 24 * 60 ? props.minutes - 24 * 60 : props.minutes;
  const parts = parseIsoCalendarDate(date);
  if (!parts) {
    return false;
  }
  const instant = instantForNyWallClock(
    parts.year,
    parts.month,
    parts.day,
    Math.floor(minutes / 60),
    minutes % 60
  );
  return instant.getTime() >= props.now.getTime() + 48 * 60 * 60 * 1000;
}

function rangesOverlap(
  a: { endMinutes: number; startMinutes: number },
  b: { endMinutes: number; startMinutes: number }
) {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

function completeSlot(slot: ClientSlot) {
  return Boolean(slot.date && slot.endMinutes > slot.startMinutes);
}

function slotDurationHours(startMinutes: number, endMinutes: number) {
  return Math.max(0, (endMinutes - startMinutes) / 60);
}

function hasSameSpaceSlotOverlap(slots: ClientSlot[]) {
  return slots.some((slot, index) => {
    if (!completeSlot(slot)) {
      return false;
    }
    return slots
      .slice(index + 1)
      .some(
        (candidate) =>
          completeSlot(candidate) &&
          candidate.itemId === slot.itemId &&
          candidate.date === slot.date &&
          rangesOverlap(slot, candidate)
      );
  });
}

function scrollElementIntoView(element: HTMLElement | null) {
  element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function rangeConflicts(
  range: { endMinutes: number; startMinutes: number },
  ranges: { endMinutes: number; startMinutes: number }[]
) {
  return ranges.some((candidate) => rangesOverlap(range, candidate));
}

function blockedRangesForSlot(props: {
  blockedRanges: PavilionReservationBlockedRange[];
  date?: string;
  slot: ClientSlot;
  slots: ClientSlot[];
}) {
  const date = props.date ?? props.slot.date;
  const serverRanges = props.blockedRanges.filter(
    (range) => range.itemId === props.slot.itemId && range.date === date
  );
  const clientRanges = props.slots.filter(
    (candidate) =>
      candidate.id !== props.slot.id &&
      candidate.itemId === props.slot.itemId &&
      candidate.date === date &&
      candidate.endMinutes > candidate.startMinutes
  );
  return [...serverRanges, ...clientRanges];
}

function availableStartOptions(props: {
  blockedRanges: { endMinutes: number; startMinutes: number }[];
  date: string;
  now: Date;
}) {
  if (!props.date) {
    return [];
  }
  return startOptions.filter((startOption) => {
    if (
      !slotSatisfiesNotice({
        date: props.date,
        minutes: startOption.minutes,
        now: props.now,
      })
    ) {
      return false;
    }
    return endOptions.some(
      (endOption) =>
        endOption.minutes > startOption.minutes &&
        !rangeConflicts(
          {
            startMinutes: startOption.minutes,
            endMinutes: endOption.minutes,
          },
          props.blockedRanges
        )
    );
  });
}

function availableEndOptions(props: {
  blockedRanges: { endMinutes: number; startMinutes: number }[];
  startMinutes: number;
}) {
  if (props.startMinutes <= 0) {
    return [];
  }
  return endOptions.filter(
    (endOption) =>
      endOption.minutes > props.startMinutes &&
      !rangeConflicts(
        {
          startMinutes: props.startMinutes,
          endMinutes: endOption.minutes,
        },
        props.blockedRanges
      )
  );
}

function contactFieldsClearedForPersona(
  contact: ContactFields,
  persona: PavilionReservationPersonaValue
): ContactFields {
  if (persona === 'mit_academic') {
    return { ...contact, mitAccount: '', mitId: '' };
  }
  if (persona === 'mit_student' || persona === 'mit_community') {
    return {
      ...contact,
      advisorEmail: '',
      advisorName: '',
      costCenter: '',
      projectTitle: '',
    };
  }
  return {
    ...contact,
    advisorEmail: '',
    advisorName: '',
    costCenter: '',
    mitAccount: '',
    mitId: '',
    projectTitle: '',
  };
}

function sumEstimatedTotal(props: {
  items: PavilionReservableItemDto[];
  persona: PavilionReservationPersonaValue;
  selectedServiceIds: string[];
  slots: ClientSlot[];
}): { hasPriceOnRequest: boolean; totalCents: number } {
  let totalCents = 0;
  let hasPriceOnRequest = false;
  const indexByItemId = new Map<string, number>();

  for (const slot of props.slots) {
    const item = itemById(props.items, slot.itemId);
    if (!item) {
      continue;
    }
    const slotIndexForItem = indexByItemId.get(item.id) ?? 0;
    indexByItemId.set(item.id, slotIndexForItem + 1);
    const amount = estimatedSlotAmountCents({
      item,
      persona: props.persona,
      slot,
      slotIndexForItem,
    });
    if (amount === null) {
      hasPriceOnRequest = true;
    } else {
      totalCents += amount;
    }
  }

  for (const serviceId of props.selectedServiceIds) {
    const item = itemById(props.items, serviceId);
    if (!item) {
      continue;
    }
    const amount = estimatedServiceAmountCents({
      item,
      persona: props.persona,
    });
    if (amount === null) {
      hasPriceOnRequest = true;
    } else {
      totalCents += amount;
    }
  }

  return { hasPriceOnRequest, totalCents };
}

function StepHeader(props: { step: WizardStep }) {
  const t = useTranslations('PavilionReservationPage');
  const steps: { id: WizardStep; label: string }[] = [
    { id: 'identity', label: t('step_identity') },
    { id: 'request', label: t('step_request') },
    { id: 'review', label: t('step_review') },
  ];
  const activeIndex = steps.findIndex((step) => step.id === props.step);
  return (
    <nav aria-label={t('steps_aria')}>
      <ol className="flex flex-wrap items-center gap-2 md:gap-4">
        {steps.map((step, index) => {
          const active = step.id === props.step;
          const past = activeIndex > index;
          let stepClass = 'bg-mit-line text-muted-foreground';
          if (active) {
            stepClass = 'bg-mit-red text-white';
          } else if (past) {
            stepClass = 'bg-mit-success text-white';
          }
          return (
            <li className="flex items-center gap-2" key={step.id}>
              <span
                className={cn(
                  'grid size-[1.4rem] place-items-center rounded-[10px] text-[0.8125rem] font-semibold tabular-nums',
                  stepClass
                )}
              >
                {index + 1}
              </span>
              <span
                className={cn(
                  'hidden text-sm font-medium sm:inline',
                  active || past ? 'text-mit-text' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Pavilion labeled control on Headless UI Field + Label (already in app).
 * Invalid chrome: aria-invalid on the control; destructive text on the label.
 *
 * @param props - Field label, id, validation, and control children
 * @returns Headless UI field wrapper for a labeled control
 */
function LabeledField(props: {
  readonly children: React.ReactNode;
  readonly id: string;
  readonly invalid?: true;
  readonly label: string;
  readonly required?: boolean;
}) {
  return (
    <Field className="flex w-full flex-col gap-1.5">
      <HeadlessLabel
        className={cn(
          'text-sm leading-none font-medium',
          props.invalid ? 'text-mit-red-600' : 'text-foreground'
        )}
        htmlFor={props.id}
      >
        {props.label}
        {props.required ? <span aria-hidden>*</span> : null}
      </HeadlessLabel>
      {props.children}
    </Field>
  );
}

function SlotCalendarPanel(props: {
  calendarMonth: CalendarMonth;
  cells: CalendarCell[];
  minimumDate: string;
  onMonthChange: (month: CalendarMonth) => void;
  onSelectDate: (date: string) => void;
  selectedDate: string;
}) {
  const t = useTranslations('PavilionReservationPage');
  const locale = useLocale();

  return (
    <div className="max-w-[20rem]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          aria-label={t('picker_previous_month')}
          size="icon"
          type="button"
          variant="ghost"
          onClick={() => {
            props.onMonthChange(shiftedCalendarMonth(props.calendarMonth, -1));
          }}
        >
          <ChevronLeft aria-hidden className="size-4" />
        </Button>
        <p className="text-sm font-semibold text-mit-text">
          {formatCalendarMonth(props.calendarMonth, locale)}
        </p>
        <Button
          aria-label={t('picker_next_month')}
          size="icon"
          type="button"
          variant="ghost"
          onClick={() => {
            props.onMonthChange(shiftedCalendarMonth(props.calendarMonth, 1));
          }}
        >
          <ChevronRight aria-hidden className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
        {[
          t('picker_weekday_sun'),
          t('picker_weekday_mon'),
          t('picker_weekday_tue'),
          t('picker_weekday_wed'),
          t('picker_weekday_thu'),
          t('picker_weekday_fri'),
          t('picker_weekday_sat'),
        ].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {props.cells.map((cell) => {
          if (cell.day === null) {
            return <span aria-hidden key={cell.iso} />;
          }
          const selected = props.selectedDate === cell.iso;
          const disabled = cell.iso < props.minimumDate;
          return (
            <button
              aria-pressed={selected}
              className={cn(
                'flex aspect-square items-center justify-center rounded-lg border text-sm tabular-nums transition-colors',
                selected
                  ? 'border-mit-red bg-mit-red/10 font-semibold text-mit-text'
                  : 'border-transparent bg-card text-mit-text hover:bg-mit-red/10',
                disabled
                  ? 'cursor-not-allowed text-muted-foreground/50 line-through hover:border-transparent hover:bg-transparent'
                  : ''
              )}
              disabled={disabled}
              key={cell.iso}
              type="button"
              onClick={() => {
                props.onSelectDate(cell.iso);
              }}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function startBandRangeKey(band: PavilionStartTimeBand) {
  if (band === 'morning') {
    return 'picker_morning_range' as const;
  }
  if (band === 'afternoon') {
    return 'picker_afternoon_range' as const;
  }
  return 'picker_evening_range' as const;
}

function TimeOptionGrid(props: {
  afterHoursLabel?: (minutes: number) => string | null;
  emptyLabel?: string;
  options: PavilionReservationTimeOption[];
  onSelect: (minutes: number) => void;
  selectedMinutes: number;
  startMinutesForDuration?: number;
}) {
  const t = useTranslations('PavilionReservationPage');

  if (props.options.length === 0 && props.emptyLabel) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        {props.emptyLabel}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {props.options.map((option) => {
        const selected = props.selectedMinutes === option.minutes;
        const durationHours =
          props.startMinutesForDuration !== undefined &&
          props.startMinutesForDuration > 0
            ? slotDurationHours(props.startMinutesForDuration, option.minutes)
            : null;
        const feeNote = props.afterHoursLabel?.(option.minutes);
        return (
          <button
            aria-pressed={selected}
            className={cn(
              'rounded-[10px] border px-2.5 py-1.5 text-left text-sm tabular-nums transition-colors',
              selected
                ? 'border-mit-red bg-mit-red/10 font-semibold text-mit-text'
                : 'border-mit-line bg-card text-mit-text hover:border-mit-red/40'
            )}
            key={option.minutes}
            type="button"
            onClick={() => {
              props.onSelect(option.minutes);
            }}
          >
            <span className="block">
              {formatPavilionReservationTimeLabel(option.minutes)}
            </span>
            {durationHours !== null && durationHours > 0 ? (
              <span
                aria-hidden
                className="mt-0.5 block text-xs font-medium text-muted-foreground"
              >
                {t('picker_duration_hours', { hours: durationHours })}
                {feeNote ? ` · ${feeNote}` : ''}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function SlotStartSelection(props: {
  onSelectStart: (minutes: number) => void;
  selectedStartMinutes: number;
  startChoices: PavilionReservationTimeOption[];
  timePanelRef: React.RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations('PavilionReservationPage');
  const availableBands = pavilionAvailableStartBands(props.startChoices);
  const defaultBand: PavilionStartTimeBand = availableBands.includes('evening')
    ? 'evening'
    : (availableBands[0] ?? 'evening');
  const initialBand =
    props.selectedStartMinutes > 0
      ? pavilionStartTimeBand(props.selectedStartMinutes)
      : defaultBand;
  const [band, setBand] = useState<PavilionStartTimeBand>(initialBand);
  const bandOptions = pavilionStartOptionsForBand({
    band,
    options: props.startChoices,
  });

  return (
    <div ref={props.timePanelRef}>
      <p className="mb-3 text-sm text-muted-foreground">
        {t('picker_start_band_prompt')}
      </p>
      <fieldset
        aria-label={t('picker_time_of_day')}
        className="mb-3 flex flex-wrap gap-2 border-0 p-0"
      >
        <legend className="sr-only">{t('picker_time_of_day')}</legend>
        {availableBands.map((option) => (
          <button
            aria-label={t(`picker_${option}`)}
            aria-pressed={band === option}
            className={cn(
              'rounded-[10px] border px-3 py-2 text-left text-sm transition-colors',
              band === option
                ? 'border-mit-red bg-mit-red/10 font-semibold text-mit-text'
                : 'border-mit-line bg-card text-muted-foreground hover:border-mit-red/40'
            )}
            key={option}
            type="button"
            onClick={() => {
              setBand(option);
            }}
          >
            <span className="block">{t(`picker_${option}`)}</span>
            <span className="block font-normal text-muted-foreground">
              {t(startBandRangeKey(option))}
            </span>
          </button>
        ))}
      </fieldset>
      <p className="mb-1.5 text-sm text-muted-foreground">
        {t('picker_band_start_times', { band: t(`picker_${band}`) })}
      </p>
      <TimeOptionGrid
        emptyLabel={t('picker_no_start_times')}
        options={bandOptions}
        selectedMinutes={props.selectedStartMinutes}
        onSelect={props.onSelectStart}
      />
    </div>
  );
}

function PavilionReservationConfirmation(props: { referenceCode: string }) {
  const t = useTranslations('PavilionReservationPage');

  return (
    <div className="mx-auto max-w-2xl rounded-lg border border-mit-line bg-card p-8 text-center md:p-12">
      <div className="mb-6 inline-flex size-16 items-center justify-center rounded-full bg-mit-success/10 text-mit-success-ink">
        <CheckCircle aria-hidden className="size-8" />
      </div>
      <h2 className="font-mit-serif text-2xl font-semibold text-mit-text">
        {t('confirmation_title')}
      </h2>
      <p className="mt-2 text-mit-text">{t('confirmation_body')}</p>
      <div className="mx-auto mt-8 max-w-sm rounded-lg border border-mit-line bg-mit-surface p-6">
        <p className="text-sm text-muted-foreground">
          {t('confirmation_reference')}
        </p>
        <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-mit-text">
          {props.referenceCode}
        </p>
      </div>
      <div className="mx-auto mt-8 max-w-md text-left">
        <h3 className="font-semibold text-mit-text">
          {t('confirmation_next_title')}
        </h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-mit-text">
          <li>{t('confirmation_next_review')}</li>
          <li>{t('confirmation_next_email')}</li>
          <li>{t('confirmation_next_payment')}</li>
        </ul>
      </div>
      <Button asChild className="mt-8" variant="outline">
        <Link href="/reserve">{t('action_start_over')}</Link>
      </Button>
    </div>
  );
}

function PavilionReservationHiddenFields(props: {
  contact: ContactFields;
  draftRequestId: string | null;
  persona: PavilionReservationPersonaValue;
  requesterEmail: string;
  resumeToken: string | null;
  selectedServiceIds: string[];
  slots: ClientSlot[];
}) {
  return (
    <>
      {props.draftRequestId ? (
        <input
          name="draftRequestId"
          type="hidden"
          value={props.draftRequestId}
        />
      ) : null}
      {props.resumeToken ? (
        <input name="resumeToken" type="hidden" value={props.resumeToken} />
      ) : null}
      <input name="requesterEmail" type="hidden" value={props.requesterEmail} />
      <input name="persona" type="hidden" value={props.persona} />
      <input name="firstName" type="hidden" value={props.contact.firstName} />
      <input name="lastName" type="hidden" value={props.contact.lastName} />
      <input name="phone" type="hidden" value={props.contact.phone} />
      <input name="eventName" type="hidden" value={props.contact.eventName} />
      <input name="groupName" type="hidden" value={props.contact.groupName} />
      <input name="groupSize" type="hidden" value={props.contact.groupSize} />
      <input
        name="description"
        type="hidden"
        value={props.contact.description}
      />
      <input
        name="hasTent"
        type="hidden"
        value={String(props.contact.hasTent)}
      />
      <input
        name="servesAlcohol"
        type="hidden"
        value={String(props.contact.servesAlcohol)}
      />
      <input
        name="projectTitle"
        type="hidden"
        value={props.contact.projectTitle}
      />
      <input
        name="advisorName"
        type="hidden"
        value={props.contact.advisorName}
      />
      <input
        name="advisorEmail"
        type="hidden"
        value={props.contact.advisorEmail}
      />
      <input name="costCenter" type="hidden" value={props.contact.costCenter} />
      <input name="mitId" type="hidden" value={props.contact.mitId} />
      <input name="mitAccount" type="hidden" value={props.contact.mitAccount} />
      <input
        name="slots"
        type="hidden"
        value={JSON.stringify(
          props.slots.map((slot) => ({
            itemId: slot.itemId,
            date: slot.date,
            startMinutes: slot.startMinutes,
            endMinutes: slot.endMinutes,
          }))
        )}
      />
      <input
        name="services"
        type="hidden"
        value={JSON.stringify(props.selectedServiceIds)}
      />
    </>
  );
}

function PavilionReservationIntro(props: { step: WizardStep }) {
  const t = useTranslations('PavilionReservationPage');

  return (
    <div className="mb-6">
      <h1 className="font-mit-serif text-[clamp(1.75rem,3vw,2.5rem)] font-semibold tracking-tight text-mit-text">
        {t('title')}
      </h1>
      <p className="mt-2 max-w-[42rem] text-base leading-[1.55] text-muted-foreground">
        {t.rich('intro', {
          faq: (chunks) => (
            <a
              className="font-semibold text-mit-red underline-offset-2 hover:underline dark:text-mit-red-ink"
              href="https://sailing.mit.edu/info/faq.php"
              rel="noopener noreferrer"
              target="_blank"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
      <div className="mt-5 border-b border-mit-line pb-3">
        <StepHeader step={props.step} />
      </div>
    </div>
  );
}

function PavilionReservationActionError(props: {
  actionState: PavilionReservationSubmitState;
}) {
  const t = useTranslations('PavilionReservationPage');

  return props.actionState.status === 'error' ? (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive">
      {props.actionState.errors.map((error) => t(error)).join(' ')}
    </div>
  ) : null;
}

type VenueEditorState = {
  editingSlotId: string | null;
  phase: SlotPhase;
  slot: ClientSlot;
};

function VenueInlineEditor(props: {
  addButtonRef: React.RefObject<HTMLButtonElement | null>;
  afterHoursItems: PavilionReservableItemDto[];
  blockedRanges: PavilionReservationBlockedRange[];
  editor: VenueEditorState;
  locale: string;
  onCancel: () => void;
  onCommit: () => void;
  onUpdate: (next: VenueEditorState) => void;
  persona: PavilionReservationPersonaValue;
  slots: ClientSlot[];
  venueName: string;
}) {
  const t = useTranslations('PavilionReservationPage');
  const timePanelRef = useRef<HTMLDivElement>(null);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    initialCalendarMonth(props.editor.slot.date)
  );
  const now = new Date();
  const { slot } = props.editor;
  const { phase } = props.editor;
  const cells = buildCalendarCells(calendarMonth);
  const minimumDate = minimumSlotDateIso();
  const blockedRanges = blockedRangesForSlot({
    blockedRanges: props.blockedRanges,
    slot,
    slots: props.slots,
  });
  const startChoices = availableStartOptions({
    blockedRanges,
    date: slot.date,
    now,
  });
  const endChoices = availableEndOptions({
    blockedRanges,
    startMinutes: slot.startMinutes,
  });
  const selectedDateLabel = slot.date
    ? formatSlotDateShort(slot.date, props.locale)
    : t('picker_no_date');
  const canCommit = completeSlot(slot);
  const sunsetMinutes = slot.date
    ? pavilionReservationSunsetMinutes(slot.date)
    : 0;
  const academic = props.persona === 'mit_academic';
  const afterHoursLabel = (endMinutes: number) => {
    const band = pavilionAfterHoursBandForEnd({
      afterHoursItems: props.afterHoursItems,
      endMinutes,
      persona: props.persona,
      sunsetMinutes,
    });
    if (!band) {
      return null;
    }
    return t('end_chip_after_hours', {
      amount: formatPavilionReservationMoney(band.amountCents),
    });
  };

  const updateSlot = (next: Partial<ClientSlot>, nextPhase: SlotPhase) => {
    props.onUpdate({
      ...props.editor,
      phase: nextPhase,
      slot: { ...slot, ...next },
    });
  };

  return (
    <section
      aria-label={props.venueName}
      className="flex flex-col gap-3 border-t border-mit-line bg-mit-surface/50 p-4"
    >
      {phase === 'date' || !slot.date ? (
        <>
          <SlotCalendarPanel
            calendarMonth={calendarMonth}
            cells={cells}
            minimumDate={minimumDate}
            selectedDate={slot.date}
            onMonthChange={setCalendarMonth}
            onSelectDate={(date) => {
              updateSlot({ date, endMinutes: 0, startMinutes: 0 }, 'start');
            }}
          />
          <p className="m-0 text-sm text-muted-foreground">
            {t('picker_notice')}
          </p>
        </>
      ) : (
        <>
          <p className="m-0 flex flex-wrap items-baseline gap-2 text-sm text-mit-text">
            <span className="font-semibold">{selectedDateLabel}</span>
            <button
              className="font-semibold text-mit-red underline-offset-2 hover:underline dark:text-mit-red-ink"
              type="button"
              onClick={() => {
                updateSlot({ endMinutes: 0, startMinutes: 0 }, 'date');
              }}
            >
              {t('picker_change_date')}
            </button>
          </p>
          <div
            className="rounded-[10px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
            role="status"
          >
            <strong className="block tabular-nums">
              {t('sunset_banner', {
                time: formatPavilionReservationTimeLabel(sunsetMinutes),
              })}
            </strong>
            <p className="mt-1.5 mb-0">
              {t('sunset_banner_note', { date: selectedDateLabel })}
            </p>
            {academic ? (
              <p className="mt-1.5 mb-0">{t('fees_panel_academic_note')}</p>
            ) : null}
          </div>
        </>
      )}

      {slot.date && (phase === 'start' || slot.startMinutes <= 0) ? (
        <SlotStartSelection
          selectedStartMinutes={slot.startMinutes}
          startChoices={startChoices}
          timePanelRef={timePanelRef}
          onSelectStart={(startMinutes) => {
            updateSlot({ endMinutes: 0, startMinutes }, 'end');
          }}
        />
      ) : null}

      {slot.date && slot.startMinutes > 0 && phase !== 'start' ? (
        <p className="m-0 flex flex-wrap items-baseline gap-2 text-sm text-mit-text">
          <span>
            {t('picker_start_summary', {
              time: formatPavilionReservationTimeLabel(slot.startMinutes),
            })}
          </span>
          <button
            className="font-semibold text-mit-red underline-offset-2 hover:underline dark:text-mit-red-ink"
            type="button"
            onClick={() => {
              updateSlot({ endMinutes: 0 }, 'start');
            }}
          >
            {t('picker_change_start')}
          </button>
        </p>
      ) : null}

      {slot.startMinutes > 0 &&
      phase === 'end' &&
      slot.endMinutes <= slot.startMinutes ? (
        <div ref={timePanelRef}>
          <h6 className="mb-2 text-sm font-semibold text-mit-text">
            {t('picker_end_title')}
          </h6>
          <TimeOptionGrid
            afterHoursLabel={academic ? undefined : afterHoursLabel}
            emptyLabel={t('picker_no_end_times')}
            options={endChoices}
            selectedMinutes={slot.endMinutes}
            startMinutesForDuration={slot.startMinutes}
            onSelect={(endMinutes) => {
              updateSlot({ endMinutes }, 'end');
              globalThis.requestAnimationFrame(() => {
                props.addButtonRef.current?.focus();
              });
            }}
          />
        </div>
      ) : null}

      {slot.startMinutes > 0 && slot.endMinutes > slot.startMinutes ? (
        <>
          <p className="m-0 flex flex-wrap items-baseline gap-2 text-sm text-mit-text">
            <span>
              {t('picker_end_summary', {
                time: formatPavilionReservationTimeLabel(slot.endMinutes),
              })}
            </span>
            <span className="text-muted-foreground">
              (
              {t('picker_duration_hours', {
                hours: slotDurationHours(slot.startMinutes, slot.endMinutes),
              })}
              {afterHoursLabel(slot.endMinutes)
                ? ` · ${afterHoursLabel(slot.endMinutes)}`
                : ''}
              )
            </span>
            <button
              className="font-semibold text-mit-red underline-offset-2 hover:underline dark:text-mit-red-ink"
              type="button"
              onClick={() => {
                updateSlot({ endMinutes: 0 }, 'end');
              }}
            >
              {t('picker_change_end')}
            </button>
          </p>
          <p className="m-0 text-sm text-muted-foreground">
            {t('picker_add_prompt')}
          </p>
        </>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={props.onCancel}>
          {t('picker_cancel_edit')}
        </Button>
        <Button
          disabled={!canCommit}
          ref={props.addButtonRef}
          type="button"
          variant="mit"
          onClick={props.onCommit}
        >
          {props.editor.editingSlotId
            ? t('action_save_changes')
            : t('action_add_to_request')}
        </Button>
      </div>
    </section>
  );
}

function PavilionReservationRequestStep(props: {
  addons: PavilionReservableItemDto[];
  afterHoursItems: PavilionReservableItemDto[];
  blockedRanges: PavilionReservationBlockedRange[];
  canContinue: boolean;
  estimate: { hasPriceOnRequest: boolean; totalCents: number };
  hourlyVenues: PavilionReservableItemDto[];
  onChangeStatus: () => void;
  onContinue: () => void;
  persona: PavilionReservationPersonaValue;
  programs: PavilionReservableItemDto[];
  setSlots: React.Dispatch<React.SetStateAction<ClientSlot[]>>;
  slots: ClientSlot[];
  slotsRef: React.RefObject<HTMLDivElement | null>;
  spacesRef: React.RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations('PavilionReservationPage');
  const locale = useLocale();
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [editor, setEditor] = useState<VenueEditorState | null>(null);
  const [shareMessage, setShareMessage] = useState('');
  const hourlyIds = new Set(props.hourlyVenues.map((item) => item.id));
  const afterHoursIds = new Set(props.afterHoursItems.map((item) => item.id));
  const toggleItems = [...props.addons, ...props.programs];
  const toggleItemIds = new Set(
    props.slots
      .filter(
        (slot) => !hourlyIds.has(slot.itemId) && !afterHoursIds.has(slot.itemId)
      )
      .map((slot) => slot.itemId)
  );
  const hasVenueLine = props.slots.some(
    (slot) => hourlyIds.has(slot.itemId) && completeSlot(slot)
  );
  const visibleAddons = props.addons.filter((item) => {
    if (!isPavilionWeddingCatalogItem(item)) {
      return true;
    }
    if (props.persona === 'mit_academic') {
      return false;
    }
    return (
      hasVenueLine &&
      isPersonaPriceAvailable(priceForPersona(item, props.persona))
    );
  });
  const uniqueLineCount =
    props.slots.filter(
      (slot) => hourlyIds.has(slot.itemId) && completeSlot(slot)
    ).length + toggleItemIds.size;

  const toggleFlat = (itemId: string, selected: boolean) => {
    props.setSlots((current) => {
      const without = current.filter((slot) => slot.itemId !== itemId);
      if (!selected) {
        return without;
      }
      return [...without, flatToggleSlot(itemId)];
    });
  };

  const openEditor = (spaceId: string, existing?: ClientSlot) => {
    if (existing) {
      setEditor({
        editingSlotId: existing.id,
        phase: 'end',
        slot: { ...existing },
      });
      return;
    }
    setEditor({
      editingSlotId: null,
      phase: 'date',
      slot: newSlot(spaceId),
    });
  };

  const commitEditor = () => {
    if (!editor || !completeSlot(editor.slot)) {
      return;
    }
    const committed = editor.slot;
    props.setSlots((current) => {
      if (editor.editingSlotId) {
        return current.map((slot) =>
          slot.id === editor.editingSlotId ? committed : slot
        );
      }
      return [...current, committed];
    });
    setEditor(null);
  };

  const summaryProps = {
    afterHoursItems: props.afterHoursItems,
    canContinue: props.canContinue,
    estimate: props.estimate,
    hourlyVenues: props.hourlyVenues,
    itemById: (id: string) =>
      itemById(
        [...props.hourlyVenues, ...toggleItems, ...props.afterHoursItems],
        id
      ),
    lineCount: uniqueLineCount,
    onChangeStatus: props.onChangeStatus,
    onContinue: props.onContinue,
    onEditSlot: (slotId: string) => {
      const slot = props.slots.find((candidate) => candidate.id === slotId);
      if (!slot) {
        return;
      }
      openEditor(slot.itemId, slot);
    },
    onRemoveItem: (itemId: string) => {
      toggleFlat(itemId, false);
    },
    onRemoveSlot: (slotId: string) => {
      props.setSlots((current) => current.filter((slot) => slot.id !== slotId));
      setEditor((current) =>
        current?.editingSlotId === slotId ? null : current
      );
    },
    persona: props.persona,
    slots: props.slots,
    toggleItemIds,
  };

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/u, '');
    if (!hash.startsWith('venue-')) {
      return;
    }
    document
      .querySelector(`#${CSS.escape(hash)}`)
      ?.scrollIntoView({ block: 'start' });
  }, []);

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {shareMessage}
      </p>
      <PavilionReservationRequestSummary {...summaryProps} variant="mobile" />
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_18.5rem] md:items-start">
        <div className="flex flex-col gap-5" ref={props.spacesRef}>
          <PavilionReservationMitStatus
            persona={props.persona}
            variant="banner"
            onChange={props.onChangeStatus}
          />
          <PavilionReservationFeesPanel
            afterHoursItems={props.afterHoursItems}
            hourlyVenues={props.hourlyVenues}
            persona={props.persona}
          />

          <section className="flex flex-col gap-3" ref={props.slotsRef}>
            <h2 className="text-[1.125rem] font-semibold text-mit-text">
              {t('space_group_venue')}
            </h2>
            <p className="m-0 max-w-3xl text-sm text-muted-foreground">
              {t('space_group_venues_intro')}
            </p>
            <div className="flex flex-col gap-3">
              {props.hourlyVenues.map((space) => {
                const bookedCount = props.slots.filter(
                  (slot) => slot.itemId === space.id && completeSlot(slot)
                ).length;
                const editing = editor?.slot.itemId === space.id;
                return (
                  <PavilionReservationVenueCard
                    afterHoursItems={props.afterHoursItems}
                    bookedCount={bookedCount}
                    editing={Boolean(editing)}
                    key={space.id}
                    persona={props.persona}
                    space={space}
                    onSelect={() => {
                      openEditor(space.id);
                    }}
                    onShareResult={setShareMessage}
                  >
                    {editing && editor ? (
                      <VenueInlineEditor
                        addButtonRef={addButtonRef}
                        afterHoursItems={props.afterHoursItems}
                        blockedRanges={props.blockedRanges}
                        editor={editor}
                        locale={locale}
                        persona={props.persona}
                        slots={props.slots}
                        venueName={space.name}
                        onCancel={() => {
                          setEditor(null);
                        }}
                        onCommit={commitEditor}
                        onUpdate={setEditor}
                      />
                    ) : null}
                  </PavilionReservationVenueCard>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[1.125rem] font-semibold text-mit-text">
              {t('space_group_addons')}
            </h2>
            <p className="m-0 text-sm text-muted-foreground">
              {t('space_group_addons_intro')}
            </p>
            {hasVenueLine &&
            props.persona !== 'mit_academic' &&
            visibleAddons.some((item) => isPavilionWeddingCatalogItem(item)) ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {t('wedding_tip')}
              </p>
            ) : null}
            <div className="flex flex-col gap-3">
              {visibleAddons.map((item) => (
                <PavilionReservationFlatToggle
                  item={item}
                  key={item.id}
                  persona={props.persona}
                  selected={toggleItemIds.has(item.id)}
                  tip={item.slug === 'grill' ? t('grill_addon_tip') : null}
                  onToggle={toggleFlat}
                />
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[1.125rem] font-semibold text-mit-text">
              {t('space_group_programs')}
            </h2>
            <div className="flex flex-col gap-3">
              {props.programs.map((item) => (
                <PavilionReservationFlatToggle
                  item={item}
                  key={item.id}
                  persona={props.persona}
                  selected={toggleItemIds.has(item.id)}
                  onToggle={toggleFlat}
                />
              ))}
            </div>
          </section>
        </div>
        <PavilionReservationRequestSummary
          {...summaryProps}
          variant="desktop"
        />
      </div>
    </>
  );
}

function pavilionServiceOptionClassName(props: {
  available: boolean;
  selected: boolean;
}) {
  return cn(
    'flex items-start gap-4 rounded-lg border p-4 transition-colors md:items-center',
    props.available
      ? 'cursor-pointer'
      : 'cursor-not-allowed border-mit-line bg-mit-surface opacity-75',
    props.selected ? 'border-mit-red bg-mit-red-highlight' : null,
    props.available && !props.selected ? 'border-mit-line' : null
  );
}

function togglePavilionServiceSelection(
  current: string[],
  serviceId: string
): string[] {
  return current.includes(serviceId)
    ? current.filter((id) => id !== serviceId)
    : [...current, serviceId];
}

function PavilionReservationServiceOptionCopy(props: {
  available: boolean;
  description: string;
  name: string;
  priceLabel: string;
  unavailableDescription: string;
  unavailablePrice: string;
}) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block font-medium text-mit-text',
            props.available ? null : 'text-muted-foreground line-through'
          )}
        >
          {props.name}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {props.available ? props.description : props.unavailableDescription}
        </span>
      </span>
      <span className="font-semibold text-primary-ink">
        {props.available ? props.priceLabel : props.unavailablePrice}
      </span>
    </>
  );
}

function PavilionReservationServiceOption(props: {
  persona: PavilionReservationPersonaValue;
  selected: boolean;
  service: PavilionReservableItemDto;
  setSelectedServiceIds: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const t = useTranslations('PavilionReservationPage');
  const priceDisplay = personaPriceDisplay({
    item: props.service,
    persona: props.persona,
    onRequestLabel: t('price_on_request'),
  });

  return (
    <label
      className={pavilionServiceOptionClassName({
        available: priceDisplay.available,
        selected: props.selected,
      })}
    >
      <input
        checked={props.selected}
        className="mt-1 md:mt-0"
        disabled={priceDisplay.priceCents === null}
        type="checkbox"
        onChange={() => {
          props.setSelectedServiceIds((current) =>
            togglePavilionServiceSelection(current, props.service.id)
          );
        }}
      />
      <PavilionReservationServiceOptionCopy
        available={priceDisplay.available}
        description={props.service.description}
        name={props.service.name}
        priceLabel={priceDisplay.label}
        unavailableDescription={t('service_unavailable')}
        unavailablePrice={t('service_unavailable_price')}
      />
    </label>
  );
}

function PavilionReservationContactStep(props: {
  contact: ContactFields;
  contactSectionRef: React.RefObject<HTMLElement | null>;
  persona: PavilionReservationPersonaValue;
  requesterEmail: string;
  selectedServiceIds: string[];
  services: PavilionReservableItemDto[];
  setPersona: (persona: PavilionReservationPersonaValue) => void;
  setContact: React.Dispatch<React.SetStateAction<ContactFields>>;
  setSelectedServiceIds: React.Dispatch<React.SetStateAction<string[]>>;
  showErrors: boolean;
  showStepAlert: boolean;
}) {
  const t = useTranslations('PavilionReservationPage');
  const firstNameInvalid = ariaInvalidWhenShown({
    shown: props.showErrors,
    invalid: !props.contact.firstName.trim(),
  });
  const lastNameInvalid = ariaInvalidWhenShown({
    shown: props.showErrors,
    invalid: !props.contact.lastName.trim(),
  });
  const phoneInvalid = ariaInvalidWhenShown({
    shown: props.showErrors,
    invalid: !props.contact.phone.trim(),
  });
  const eventNameInvalid = ariaInvalidWhenShown({
    shown: props.showErrors,
    invalid: !props.contact.eventName.trim(),
  });
  const descriptionInvalid = ariaInvalidWhenShown({
    shown: props.showErrors,
    invalid: !props.contact.description.trim(),
  });
  const projectTitleInvalid = ariaInvalidWhenShown({
    shown: props.showErrors,
    invalid: !props.contact.projectTitle.trim(),
  });
  const advisorNameInvalid = ariaInvalidWhenShown({
    shown: props.showErrors,
    invalid: !props.contact.advisorName.trim(),
  });
  const advisorEmailInvalid = ariaInvalidWhenShown({
    shown: props.showErrors,
    invalid: !isValidEmailAddress(props.contact.advisorEmail),
  });
  const costCenterInvalid = ariaInvalidWhenShown({
    shown: props.showErrors,
    invalid: !props.contact.costCenter.trim(),
  });

  return (
    <div className="space-y-8">
      <section
        className="rounded-lg border border-mit-line bg-card p-6 md:p-8"
        ref={props.contactSectionRef}
      >
        <h2 className="text-xl font-semibold text-mit-text">
          {t('contact_title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('contact_intro')}
        </p>
        {props.showStepAlert ? (
          <p
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            role="alert"
          >
            {t('error_contact_step')}
          </p>
        ) : null}
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <LabeledField
            id="contact-persona"
            label={t('persona_title')}
            required
          >
            <NativeSelect
              aria-required
              id="contact-persona"
              required
              value={props.persona}
              onChange={(event) => {
                updatePavilionReservationPersonaFromValue({
                  setPersona: props.setPersona,
                  value: event.currentTarget.value,
                });
              }}
            >
              {PAVILION_RESERVATION_PERSONAS.map((personaOption) => (
                <option key={personaOption} value={personaOption}>
                  {t(`persona_${personaOption}_label`)}
                </option>
              ))}
            </NativeSelect>
            <Description className="text-xs text-muted-foreground">
              {t('contact_persona_helper')}
            </Description>
          </LabeledField>
          <LabeledField id="contact-email" label={t('field_email')} required>
            <Input
              aria-describedby="contact-email-helper"
              aria-required
              id="contact-email"
              readOnly
              required
              type="email"
              value={props.requesterEmail}
            />
            <Description
              className="text-xs text-muted-foreground"
              id="contact-email-helper"
            >
              {t('contact_email_helper')}
            </Description>
          </LabeledField>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <LabeledField
            id="firstName"
            invalid={firstNameInvalid}
            label={t('field_first_name')}
            required
          >
            <Input
              aria-invalid={firstNameInvalid}
              aria-required
              id="firstName"
              required
              value={props.contact.firstName}
              onChange={(event) => {
                props.setContact({
                  ...props.contact,
                  firstName: event.currentTarget.value,
                });
              }}
            />
          </LabeledField>
          <LabeledField
            id="lastName"
            invalid={lastNameInvalid}
            label={t('field_last_name')}
            required
          >
            <Input
              aria-invalid={lastNameInvalid}
              aria-required
              id="lastName"
              required
              value={props.contact.lastName}
              onChange={(event) => {
                props.setContact({
                  ...props.contact,
                  lastName: event.currentTarget.value,
                });
              }}
            />
          </LabeledField>
          <LabeledField
            id="phone"
            invalid={phoneInvalid}
            label={t('field_phone')}
            required
          >
            <Input
              aria-invalid={phoneInvalid}
              aria-required
              id="phone"
              required
              type="tel"
              value={props.contact.phone}
              onChange={(event) => {
                props.setContact({
                  ...props.contact,
                  phone: event.currentTarget.value,
                });
              }}
            />
          </LabeledField>
          <LabeledField
            id="eventName"
            invalid={eventNameInvalid}
            label={t('field_event_name')}
            required
          >
            <Input
              aria-invalid={eventNameInvalid}
              aria-required
              id="eventName"
              required
              value={props.contact.eventName}
              onChange={(event) => {
                props.setContact({
                  ...props.contact,
                  eventName: event.currentTarget.value,
                });
              }}
            />
          </LabeledField>
          <LabeledField id="groupName" label={t('field_group_name')}>
            <Input
              id="groupName"
              value={props.contact.groupName}
              onChange={(event) => {
                props.setContact({
                  ...props.contact,
                  groupName: event.currentTarget.value,
                });
              }}
            />
          </LabeledField>
          <LabeledField id="groupSize" label={t('field_group_size')}>
            <Input
              id="groupSize"
              min="1"
              type="number"
              value={props.contact.groupSize}
              onChange={(event) => {
                props.setContact({
                  ...props.contact,
                  groupSize: event.currentTarget.value,
                });
              }}
            />
          </LabeledField>
          <div className="md:col-span-2">
            <LabeledField
              id="description"
              invalid={descriptionInvalid}
              label={t('field_description')}
              required
            >
              <Textarea
                aria-invalid={descriptionInvalid}
                aria-required
                id="description"
                required
                rows={4}
                value={props.contact.description}
                onChange={(event) => {
                  props.setContact({
                    ...props.contact,
                    description: event.currentTarget.value,
                  });
                }}
              />
            </LabeledField>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            {
              key: 'hasTent' as const,
              title: t('field_tent'),
              hint: null,
            },
            {
              key: 'servesAlcohol' as const,
              title: t('field_alcohol'),
              hint: t('field_alcohol_hint'),
            },
          ].map((option) => (
            <fieldset
              className="rounded-lg border border-mit-line bg-background p-4"
              key={option.key}
            >
              <legend className="text-sm font-semibold text-mit-text">
                {option.title}
              </legend>
              {option.hint ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {option.hint}
                </p>
              ) : null}
              <div className="mt-3 flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    checked={props.contact[option.key]}
                    name={option.key}
                    type="radio"
                    onChange={() => {
                      props.setContact({
                        ...props.contact,
                        [option.key]: true,
                      });
                    }}
                  />
                  {t('yes')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    checked={!props.contact[option.key]}
                    name={option.key}
                    type="radio"
                    onChange={() => {
                      props.setContact({
                        ...props.contact,
                        [option.key]: false,
                      });
                    }}
                  />
                  {t('no')}
                </label>
              </div>
            </fieldset>
          ))}
        </div>

        {props.persona === 'mit_academic' ? (
          <section className="mt-6 rounded-lg border border-mit-line bg-background p-5">
            <h3 className="text-sm font-bold tracking-wide text-mit-text uppercase">
              {t('academic_title')}
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <LabeledField
                  id="projectTitle"
                  invalid={projectTitleInvalid}
                  label={t('field_project_title')}
                  required
                >
                  <Input
                    aria-invalid={projectTitleInvalid}
                    aria-required
                    id="projectTitle"
                    required
                    value={props.contact.projectTitle}
                    onChange={(event) => {
                      props.setContact({
                        ...props.contact,
                        projectTitle: event.currentTarget.value,
                      });
                    }}
                  />
                </LabeledField>
              </div>
              <LabeledField
                id="advisorName"
                invalid={advisorNameInvalid}
                label={t('field_advisor_name')}
                required
              >
                <Input
                  aria-invalid={advisorNameInvalid}
                  aria-required
                  id="advisorName"
                  required
                  value={props.contact.advisorName}
                  onChange={(event) => {
                    props.setContact({
                      ...props.contact,
                      advisorName: event.currentTarget.value,
                    });
                  }}
                />
              </LabeledField>
              <LabeledField
                id="advisorEmail"
                invalid={advisorEmailInvalid}
                label={t('field_advisor_email')}
                required
              >
                <Input
                  aria-invalid={advisorEmailInvalid}
                  aria-required
                  id="advisorEmail"
                  required
                  type="email"
                  value={props.contact.advisorEmail}
                  onChange={(event) => {
                    props.setContact({
                      ...props.contact,
                      advisorEmail: event.currentTarget.value,
                    });
                  }}
                />
              </LabeledField>
              <div className="md:col-span-2">
                <LabeledField
                  id="costCenter"
                  invalid={costCenterInvalid}
                  label={t('field_cost_center')}
                  required
                >
                  <Input
                    aria-invalid={costCenterInvalid}
                    aria-required
                    id="costCenter"
                    required
                    value={props.contact.costCenter}
                    onChange={(event) => {
                      props.setContact({
                        ...props.contact,
                        costCenter: event.currentTarget.value,
                      });
                    }}
                  />
                </LabeledField>
              </div>
            </div>
          </section>
        ) : null}

        {props.persona === 'mit_student' ||
        props.persona === 'mit_community' ? (
          <section className="mt-6 rounded-lg border border-mit-line bg-background p-5">
            <h3 className="text-sm font-semibold text-mit-text">
              {t('mit_affiliation_title')}
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <LabeledField
                  id="mitAffiliationType"
                  label={t('field_mit_affiliation_type')}
                  required
                >
                  <NativeSelect
                    aria-required
                    id="mitAffiliationType"
                    required
                    value={props.persona}
                    onChange={(event) => {
                      updatePavilionReservationPersonaFromValue({
                        setPersona: props.setPersona,
                        value: event.currentTarget.value,
                      });
                    }}
                  >
                    {mitAffiliationPersonas.map((personaOption) => (
                      <option key={personaOption} value={personaOption}>
                        {t(`persona_${personaOption}_label`)}
                      </option>
                    ))}
                  </NativeSelect>
                </LabeledField>
              </div>
              <LabeledField id="mitId" label={t('field_mit_id')}>
                <Input
                  id="mitId"
                  inputMode="numeric"
                  pattern="\\d{9}"
                  value={props.contact.mitId}
                  onChange={(event) => {
                    props.setContact({
                      ...props.contact,
                      mitId: event.currentTarget.value,
                    });
                  }}
                />
              </LabeledField>
              <LabeledField id="mitAccount" label={t('field_mit_account')}>
                <Input
                  id="mitAccount"
                  inputMode="numeric"
                  pattern="\\d{7}"
                  value={props.contact.mitAccount}
                  onChange={(event) => {
                    props.setContact({
                      ...props.contact,
                      mitAccount: event.currentTarget.value,
                    });
                  }}
                />
              </LabeledField>
            </div>
          </section>
        ) : null}

        {props.persona === 'non_mit' ? (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {t('non_mit_note')}
          </div>
        ) : null}

        {props.services.length > 0 ? (
          <section className="mt-8">
            <h3 className="text-lg font-semibold text-mit-text">
              {t('services_title')}
            </h3>
            <div className="mt-4 space-y-3">
              {props.services.map((service) => (
                <PavilionReservationServiceOption
                  key={service.id}
                  persona={props.persona}
                  selected={props.selectedServiceIds.includes(service.id)}
                  service={service}
                  setSelectedServiceIds={props.setSelectedServiceIds}
                />
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </div>
  );
}

function PavilionReservationReviewStep(props: {
  contact: ContactFields;
  estimate: { hasPriceOnRequest: boolean; totalCents: number };
  persona: PavilionReservationPersonaValue;
  requesterEmail: string;
  selectedServiceIds: string[];
  services: PavilionReservableItemDto[];
  slots: ClientSlot[];
  spaces: PavilionReservableItemDto[];
}) {
  const t = useTranslations('PavilionReservationPage');
  const locale = useLocale();

  return (
    <section className="rounded-lg border border-mit-line bg-card p-6 md:p-8">
      <h2 className="text-xl font-semibold text-mit-text">
        {t('review_title')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('review_intro')}</p>
      <div className="mt-6 grid gap-5">
        <div className="rounded-lg border border-mit-line bg-background p-5">
          <h3 className="font-semibold text-mit-text">{t('review_contact')}</h3>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            {[
              [
                t('review_name'),
                `${props.contact.firstName} ${props.contact.lastName}`,
              ],
              [t('field_email'), props.requesterEmail],
              [t('field_phone'), props.contact.phone],
              [t('review_persona'), t(`persona_${props.persona}_label`)],
              [t('field_event_name'), props.contact.eventName],
              [t('field_group_name'), props.contact.groupName || t('blank')],
              [t('field_group_size'), props.contact.groupSize || t('blank')],
              [t('field_tent'), props.contact.hasTent ? t('yes') : t('no')],
              [
                t('field_alcohol'),
                props.contact.servesAlcohol ? t('yes') : t('no'),
              ],
            ].map(([label, value]) => (
              <div className="min-w-0" key={label}>
                <dt className="font-medium text-muted-foreground">{label}</dt>
                <dd className="font-semibold text-mit-text">{value}</dd>
              </div>
            ))}
            <div className="md:col-span-2">
              <dt className="font-medium text-muted-foreground">
                {t('field_description')}
              </dt>
              <dd className="whitespace-pre-wrap text-mit-text">
                {props.contact.description}
              </dd>
            </div>
            {props.persona === 'mit_academic' ? (
              <>
                <div className="md:col-span-2">
                  <dt className="font-medium text-muted-foreground">
                    {t('field_project_title')}
                  </dt>
                  <dd className="font-semibold text-mit-text">
                    {props.contact.projectTitle || t('blank')}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">
                    {t('field_advisor_name')}
                  </dt>
                  <dd className="font-semibold text-mit-text">
                    {props.contact.advisorName || t('blank')}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">
                    {t('field_advisor_email')}
                  </dt>
                  <dd className="font-semibold text-mit-text">
                    {props.contact.advisorEmail || t('blank')}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">
                    {t('field_cost_center')}
                  </dt>
                  <dd className="font-semibold text-mit-text">
                    {props.contact.costCenter || t('blank')}
                  </dd>
                </div>
              </>
            ) : null}
            {props.persona === 'mit_student' ||
            props.persona === 'mit_community' ? (
              <>
                <div>
                  <dt className="font-medium text-muted-foreground">
                    {t('field_mit_id')}
                  </dt>
                  <dd className="font-semibold text-mit-text">
                    {props.contact.mitId || t('blank')}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">
                    {t('field_mit_account')}
                  </dt>
                  <dd className="font-semibold text-mit-text">
                    {props.contact.mitAccount || t('blank')}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
        </div>

        <div className="rounded-lg border border-mit-line bg-background p-5">
          <h3 className="font-semibold text-mit-text">{t('review_pricing')}</h3>
          <ul className="mt-4 divide-y divide-mit-line md:hidden">
            {props.slots.map((slot) => {
              const space = itemById(props.spaces, slot.itemId);
              if (!space) {
                return null;
              }
              const slotIndexForItem = props.slots
                .filter((candidate) => candidate.itemId === slot.itemId)
                .findIndex((candidate) => candidate.id === slot.id);
              const amount = estimatedSlotAmountCents({
                item: space,
                persona: props.persona,
                slot,
                slotIndexForItem,
              });
              return (
                <li className="space-y-1 py-3 first:pt-0" key={slot.id}>
                  <p className="font-medium text-mit-text">{space.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatSlotDateShort(slot.date, locale, 'America/New_York')}{' '}
                    {formatPavilionReservationTimeLabel(slot.startMinutes)} -{' '}
                    {formatPavilionReservationTimeLabel(slot.endMinutes)}
                  </p>
                  <p className="text-sm font-semibold text-mit-text">
                    {amount === null
                      ? t('price_on_request')
                      : formatPavilionReservationMoney(amount)}
                  </p>
                </li>
              );
            })}
            {props.selectedServiceIds.map((serviceId) => {
              const service = itemById(props.services, serviceId);
              if (!service) {
                return null;
              }
              const amount = estimatedServiceAmountCents({
                item: service,
                persona: props.persona,
              });
              return (
                <li className="space-y-1 py-3" key={serviceId}>
                  <p className="font-medium text-mit-text">{service.name}</p>
                  <p className="text-sm font-semibold text-mit-text">
                    {amount === null
                      ? t('price_on_request')
                      : formatPavilionReservationMoney(amount)}
                  </p>
                </li>
              );
            })}
            <li className="flex items-baseline justify-between gap-3 pt-4">
              <span className="font-semibold text-mit-text">
                {t('estimated_total')}
              </span>
              <span className="text-lg font-bold text-primary-ink">
                {formatPavilionReservationMoney(props.estimate.totalCents)}
                {props.estimate.hasPriceOnRequest ? (
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    {t('plus_price_on_request')}
                  </span>
                ) : null}
              </span>
            </li>
          </ul>
          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-mit-line text-muted-foreground">
                  <th className="pb-2 font-medium">{t('column_item')}</th>
                  <th className="pb-2 font-medium">{t('column_time')}</th>
                  <th className="pb-2 text-right font-medium">
                    {t('column_cost')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mit-line">
                {props.slots.map((slot) => {
                  const space = itemById(props.spaces, slot.itemId);
                  if (!space) {
                    return null;
                  }
                  const slotIndexForItem = props.slots
                    .filter((candidate) => candidate.itemId === slot.itemId)
                    .findIndex((candidate) => candidate.id === slot.id);
                  const amount = estimatedSlotAmountCents({
                    item: space,
                    persona: props.persona,
                    slot,
                    slotIndexForItem,
                  });
                  return (
                    <tr key={slot.id}>
                      <td className="py-3 pr-4 text-mit-text">{space.name}</td>
                      <td className="py-3 text-muted-foreground">
                        {formatSlotDateShort(
                          slot.date,
                          locale,
                          'America/New_York'
                        )}{' '}
                        {formatPavilionReservationTimeLabel(slot.startMinutes)}{' '}
                        - {formatPavilionReservationTimeLabel(slot.endMinutes)}
                      </td>
                      <td className="py-3 text-right font-medium text-mit-text">
                        {amount === null
                          ? t('price_on_request')
                          : formatPavilionReservationMoney(amount)}
                      </td>
                    </tr>
                  );
                })}
                {props.selectedServiceIds.map((serviceId) => {
                  const service = itemById(props.services, serviceId);
                  if (!service) {
                    return null;
                  }
                  const amount = estimatedServiceAmountCents({
                    item: service,
                    persona: props.persona,
                  });
                  return (
                    <tr key={serviceId}>
                      <td className="py-3 pr-4 text-mit-text">
                        {service.name}
                      </td>
                      <td className="py-3 text-muted-foreground">-</td>
                      <td className="py-3 text-right font-medium text-mit-text">
                        {amount === null
                          ? t('price_on_request')
                          : formatPavilionReservationMoney(amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td
                    className="pt-4 text-right font-semibold text-mit-text"
                    colSpan={2}
                  >
                    {t('estimated_total')}
                  </td>
                  <td className="pt-4 text-right text-lg font-bold text-primary-ink">
                    {formatPavilionReservationMoney(props.estimate.totalCents)}
                    {props.estimate.hasPriceOnRequest ? (
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        {t('plus_price_on_request')}
                      </span>
                    ) : null}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="rounded-r-lg border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-900">
          {t('review_important')}
        </div>
      </div>
    </section>
  );
}

function PavilionReservationFooter(props: {
  contactStepValid: boolean;
  onBack: () => void;
  onContactStepInvalid: () => void;
  pending: boolean;
  step: WizardStep;
}) {
  const t = useTranslations('PavilionReservationPage');

  if (props.step === 'identity' || props.step === 'request') {
    return null;
  }

  return (
    <div className="border-t border-mit-line pt-6">
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        <Button
          className="w-full sm:w-auto"
          type="button"
          variant="outline"
          onClick={props.onBack}
        >
          {t('action_back')}
        </Button>
        <SubmitButton
          className="w-full sm:w-auto"
          disabled={props.pending}
          pending={props.pending}
          pendingLabel={t('pending_submitting')}
          type="submit"
          variant="mit"
          onClick={(event) => {
            if (!props.contactStepValid) {
              event.preventDefault();
              props.onContactStepInvalid();
            }
          }}
        >
          {props.pending ? t('pending_submitting') : t('action_submit')}
        </SubmitButton>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {t('no_payment_due_today')}
      </p>
    </div>
  );
}

function pavilionReservationDraftSeedFromServerResume(
  serverResume: NonNullable<PavilionReservationWizardProps['serverResume']>,
  items: PavilionReservableItemDto[]
) {
  const allowedItemIds = new Set(items.map((item) => item.id));
  const { draft } = serverResume;
  return {
    contact: draft.contact,
    persona: draft.persona,
    requesterEmail: draft.requesterEmail,
    requestId: serverResume.requestId,
    resumeToken: serverResume.resumeToken,
    selectedServiceIds: draft.selectedServiceIds.filter((serviceId) =>
      allowedItemIds.has(serviceId)
    ),
    slots: draft.slots.filter((slot) => allowedItemIds.has(slot.itemId)),
    source: 'server' as const,
    step: normalizePavilionReservationWizardStep(draft.step),
  };
}

function applyPavilionReservationSessionDraft(props: {
  items: PavilionReservableItemDto[];
  seed: NonNullable<
    Awaited<ReturnType<typeof loadPavilionReservationDraftByResumeTokenAction>>
  >;
  setContact: React.Dispatch<React.SetStateAction<ContactFields>>;
  setDraftRequestId: React.Dispatch<React.SetStateAction<string | null>>;
  setPersona: React.Dispatch<
    React.SetStateAction<PavilionReservationPersonaValue>
  >;
  setRequesterEmail: React.Dispatch<React.SetStateAction<string>>;
  setResumeToken: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedServiceIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSessionHydrated: React.Dispatch<React.SetStateAction<boolean>>;
  setSlots: React.Dispatch<React.SetStateAction<ClientSlot[]>>;
  setStep: React.Dispatch<React.SetStateAction<WizardStep>>;
}) {
  const allowedItemIds = new Set(props.items.map((item) => item.id));
  props.setStep(normalizePavilionReservationWizardStep(props.seed.draft.step));
  props.setPersona(props.seed.draft.persona);
  props.setRequesterEmail(props.seed.draft.requesterEmail);
  props.setSlots(
    props.seed.draft.slots.filter((slot) => allowedItemIds.has(slot.itemId))
  );
  props.setContact(props.seed.draft.contact);
  props.setSelectedServiceIds(
    props.seed.draft.selectedServiceIds.filter((serviceId) =>
      allowedItemIds.has(serviceId)
    )
  );
  props.setDraftRequestId(props.seed.requestId);
  props.setResumeToken(props.seed.resumeToken);
  writePavilionReservationResumeTokenToSession(props.seed.resumeToken);
  props.setSessionHydrated(true);
}

/**
 * Keeps pavilion draft resume, autosave, and session token lifecycle in sync.
 *
 * @param params - Draft persistence inputs and state setters
 */
function usePavilionReservationDraftPersistence(params: {
  actionStatus: PavilionReservationSubmitState['status'];
  contact: ContactFields;
  draftRequestIdRef: React.RefObject<string | null>;
  items: PavilionReservableItemDto[];
  persona: PavilionReservationPersonaValue;
  requesterEmail: string;
  resumeTokenRef: React.RefObject<string | null>;
  selectedServiceIds: string[];
  serverResume: PavilionReservationWizardProps['serverResume'];
  sessionHydrated: boolean;
  setContact: React.Dispatch<React.SetStateAction<ContactFields>>;
  setDraftRequestId: React.Dispatch<React.SetStateAction<string | null>>;
  setPersona: React.Dispatch<
    React.SetStateAction<PavilionReservationPersonaValue>
  >;
  setRequesterEmail: React.Dispatch<React.SetStateAction<string>>;
  setResumeToken: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedServiceIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSessionHydrated: React.Dispatch<React.SetStateAction<boolean>>;
  setSlots: React.Dispatch<React.SetStateAction<ClientSlot[]>>;
  setStep: React.Dispatch<React.SetStateAction<WizardStep>>;
  slots: ClientSlot[];
  step: WizardStep;
  upsertDraft: PavilionReservationWizardProps['upsertDraft'];
}) {
  const {
    actionStatus,
    contact,
    draftRequestIdRef,
    items,
    persona,
    requesterEmail,
    resumeTokenRef,
    selectedServiceIds,
    serverResume,
    sessionHydrated,
    setContact,
    setDraftRequestId,
    setPersona,
    setRequesterEmail,
    setResumeToken,
    setSelectedServiceIds,
    setSessionHydrated,
    setSlots,
    setStep,
    slots,
    step,
    upsertDraft,
  } = params;

  useEffect(() => {
    if (serverResume || sessionHydrated) {
      return;
    }
    const storedToken = readPavilionReservationResumeTokenFromSession();
    if (!storedToken) {
      setSessionHydrated(true);
      return;
    }
    let cancelled = false;
    const loadSessionDraft = async () => {
      const seed =
        await loadPavilionReservationDraftByResumeTokenAction(storedToken);
      if (cancelled) {
        return;
      }
      if (!seed) {
        setSessionHydrated(true);
        return;
      }
      applyPavilionReservationSessionDraft({
        items,
        seed,
        setContact,
        setDraftRequestId,
        setPersona,
        setRequesterEmail,
        setResumeToken,
        setSelectedServiceIds,
        setSessionHydrated,
        setSlots,
        setStep,
      });
    };
    // eslint-disable-next-line promise/prefer-await-to-then -- effect cleanup handles cancellation; rejections must not surface
    loadSessionDraft().catch(() => {
      if (!cancelled) {
        setSessionHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    items,
    serverResume,
    sessionHydrated,
    setContact,
    setDraftRequestId,
    setPersona,
    setRequesterEmail,
    setResumeToken,
    setSelectedServiceIds,
    setSessionHydrated,
    setSlots,
    setStep,
  ]);

  useEffect(() => {
    if (serverResume?.resumeToken) {
      writePavilionReservationResumeTokenToSession(serverResume.resumeToken);
    }
  }, [serverResume]);

  useEffect(() => {
    if (!serverResume) {
      return;
    }
    const url = new URL(globalThis.location.href);
    if (!url.searchParams.has('resume')) {
      return;
    }
    url.searchParams.delete('resume');
    const next = `${url.pathname}${url.search}${url.hash}`;
    globalThis.history.replaceState(globalThis.history.state, '', next);
  }, [serverResume]);

  useEffect(() => {
    if (actionStatus === 'confirmed') {
      clearPavilionReservationResumeTokenFromSession();
    }
  }, [actionStatus]);

  useEffect(() => {
    if (actionStatus === 'confirmed') {
      return;
    }
    if (!isValidEmailAddress(requesterEmail)) {
      return;
    }
    const handle = globalThis.setTimeout(() => {
      const saveDraft = async () => {
        const result = await upsertDraft({
          contact,
          persona,
          requestId: draftRequestIdRef.current,
          requesterEmail,
          resumeToken: resumeTokenRef.current,
          selectedServiceIds,
          slots,
          step,
        });
        if (result.ok) {
          setDraftRequestId(result.requestId);
          setResumeToken(result.resumeToken);
          writePavilionReservationResumeTokenToSession(result.resumeToken);
        }
      };
      // eslint-disable-next-line promise/prefer-await-to-then -- autosave is fire-and-forget inside debounced timeout
      saveDraft().catch(() => {
        // Autosave failures stay silent; the guest can still submit manually.
      });
    }, 3000);
    return () => {
      globalThis.clearTimeout(handle);
    };
  }, [
    actionStatus,
    contact,
    draftRequestIdRef,
    persona,
    requesterEmail,
    resumeTokenRef,
    selectedServiceIds,
    slots,
    step,
    upsertDraft,
    setDraftRequestId,
    setResumeToken,
  ]);
}

// eslint-disable-next-line complexity -- multi-step pavilion wizard coordinates catalog, pricing, and validation
export function PavilionReservationWizard(
  props: PavilionReservationWizardProps
) {
  const t = useTranslations('PavilionReservationPage');
  const [actionState, formAction, pending] = useActionState(
    props.action,
    props.initialState,
    props.permalink
  );
  const [draftSeed] = useState(() => {
    if (!props.serverResume) {
      return null;
    }
    return pavilionReservationDraftSeedFromServerResume(
      props.serverResume,
      props.items
    );
  });
  const [step, setStep] = useState<WizardStep>(draftSeed?.step ?? 'identity');
  const [persona, setPersona] = useState<PavilionReservationPersonaValue>(
    draftSeed?.persona ?? 'mit_academic'
  );
  const [requesterEmail, setRequesterEmail] = useState(
    draftSeed?.requesterEmail ?? ''
  );
  const [slots, setSlots] = useState<ClientSlot[]>(draftSeed?.slots ?? []);
  const [contact, setContact] = useState<ContactFields>(
    draftSeed?.contact ?? initialContact
  );
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    draftSeed?.selectedServiceIds ?? []
  );
  const [draftRequestId, setDraftRequestId] = useState<string | null>(
    draftSeed?.requestId ?? null
  );
  const [resumeToken, setResumeToken] = useState<string | null>(
    draftSeed?.resumeToken ?? null
  );
  const [showErrors, setShowErrors] = useState(false);
  const [draftRestored] = useState(() => draftSeed !== null);
  const [sessionHydrated, setSessionHydrated] = useState(
    () => draftSeed !== null
  );
  const emailRef = useRef<HTMLInputElement>(null);
  const spacesRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<HTMLDivElement>(null);
  const contactSectionRef = useRef<HTMLElement>(null);
  const draftRequestIdRef = useRef(draftRequestId);
  draftRequestIdRef.current = draftRequestId;
  const resumeTokenRef = useRef(resumeToken);
  resumeTokenRef.current = resumeToken;

  usePavilionReservationDraftPersistence({
    actionStatus: actionState.status,
    contact,
    draftRequestIdRef,
    items: props.items,
    persona,
    requesterEmail,
    resumeTokenRef,
    selectedServiceIds,
    serverResume: props.serverResume,
    sessionHydrated,
    setContact,
    setDraftRequestId,
    setPersona,
    setRequesterEmail,
    setResumeToken,
    setSelectedServiceIds,
    setSessionHydrated,
    setSlots,
    setStep,
    slots,
    step,
    upsertDraft: props.upsertDraft,
  });

  const catalog = partitionPavilionCatalogForRequestBuilder(props.items);
  const services = props.items.filter((item) => item.kind === 'service');
  const hourlyVenueIds = new Set(catalog.hourlyVenues.map((item) => item.id));
  const afterHoursIds = new Set(catalog.afterHours.map((item) => item.id));
  const updatePersona = (nextPersona: PavilionReservationPersonaValue) => {
    setPersona(nextPersona);
    setContact((current) =>
      contactFieldsClearedForPersona(current, nextPersona)
    );
    setSelectedServiceIds((current) =>
      current.filter((serviceId) => {
        const service = itemById(services, serviceId);
        return (
          service !== null &&
          isPersonaPriceAvailable(priceForPersona(service, nextPersona))
        );
      })
    );
  };

  useEffect(() => {
    const venueIds = new Set(catalog.hourlyVenues.map((item) => item.id));
    setSlots((current) => {
      const next = syncPavilionAfterHoursSlots({
        afterHoursItems: catalog.afterHours,
        createSlotId: createClientSlotId,
        hourlyVenueIds: venueIds,
        persona,
        slots: current,
      });
      const same =
        next.length === current.length &&
        next.every((slot, index) => {
          const prior = current[index];
          return (
            prior !== undefined &&
            prior.itemId === slot.itemId &&
            prior.date === slot.date &&
            prior.startMinutes === slot.startMinutes &&
            prior.endMinutes === slot.endMinutes
          );
        });
      return same ? current : next;
    });
  }, [catalog.afterHours, catalog.hourlyVenues, persona, slots]);

  const estimate = sumEstimatedTotal({
    items: props.items,
    persona,
    selectedServiceIds,
    slots,
  });
  const hourlySlots = slots.filter((slot) => hourlyVenueIds.has(slot.itemId));
  const requestProblem = (() => {
    if (hourlySlots.some((slot) => !completeSlot(slot))) {
      return 'slot' as const;
    }
    if (hourlySlots.length > 0 && hasSameSpaceSlotOverlap(hourlySlots)) {
      return 'overlap' as const;
    }
    const hasLine =
      hourlySlots.some((slot) => completeSlot(slot)) ||
      slots.some(
        (slot) =>
          !hourlyVenueIds.has(slot.itemId) && !afterHoursIds.has(slot.itemId)
      );
    return hasLine ? null : ('space' as const);
  })();
  const requestStepValid = requestProblem === null;
  const contactStepValid = Boolean(
    contact.firstName.trim() &&
    contact.lastName.trim() &&
    contact.phone.trim() &&
    contact.eventName.trim() &&
    contact.description.trim() &&
    (persona !== 'mit_academic' ||
      (contact.projectTitle.trim() &&
        contact.advisorName.trim() &&
        isValidEmailAddress(contact.advisorEmail) &&
        contact.costCenter.trim()))
  );
  const scrollToRequestProblem = () => {
    setShowErrors(true);
    if (requestProblem === 'slot' || requestProblem === 'overlap') {
      scrollElementIntoView(slotsRef.current);
      return;
    }
    scrollElementIntoView(spacesRef.current);
  };
  const scrollToContactStepProblem = () => {
    setShowErrors(true);
    scrollElementIntoView(contactSectionRef.current);
    const firstInvalid = contactSectionRef.current?.querySelector(
      'input:invalid, textarea:invalid, select:invalid'
    );
    if (firstInvalid instanceof HTMLElement) {
      firstInvalid.focus();
      return;
    }
    const firstName = contactSectionRef.current?.querySelector('#firstName');
    if (firstName instanceof HTMLElement) {
      firstName.focus();
    }
  };

  if (actionState.status === 'confirmed' && actionState.referenceCode) {
    return (
      <PavilionReservationConfirmation
        referenceCode={actionState.referenceCode}
      />
    );
  }

  return (
    <form action={formAction} className="mx-auto max-w-[1100px] space-y-8">
      <PavilionReservationHiddenFields
        contact={contact}
        draftRequestId={draftRequestId}
        persona={persona}
        requesterEmail={requesterEmail}
        resumeToken={resumeToken}
        selectedServiceIds={selectedServiceIds}
        slots={slots}
      />
      <PavilionReservationIntro step={step} />
      {draftRestored ? (
        <output className="block rounded-lg border border-mit-line bg-mit-surface px-4 py-3 text-sm text-mit-text">
          {t('draft_restored')}
        </output>
      ) : null}
      <PavilionReservationActionError actionState={actionState} />
      {step === 'identity' ? (
        <PavilionReservationIdentityStep
          emailRef={emailRef}
          persona={persona}
          requesterEmail={requesterEmail}
          sampleHourlyCents={sampleHourlyFromItems({
            items: props.items,
            persona,
          })}
          setPersona={updatePersona}
          setRequesterEmail={setRequesterEmail}
          showErrors={showErrors}
          onContinue={() => {
            if (!isValidEmailAddress(requesterEmail)) {
              setShowErrors(true);
              emailRef.current?.focus();
              return;
            }
            setShowErrors(false);
            setStep('request');
          }}
        />
      ) : null}
      {step === 'request' ? (
        <>
          <PavilionReservationRequestStep
            addons={catalog.addons}
            afterHoursItems={catalog.afterHours}
            blockedRanges={props.blockedRanges}
            canContinue={requestStepValid}
            estimate={estimate}
            hourlyVenues={catalog.hourlyVenues}
            persona={persona}
            programs={catalog.programs}
            setSlots={setSlots}
            slots={slots}
            slotsRef={slotsRef}
            spacesRef={spacesRef}
            onChangeStatus={() => {
              setShowErrors(false);
              setStep('identity');
            }}
            onContinue={() => {
              if (!requestStepValid) {
                scrollToRequestProblem();
                return;
              }
              setShowErrors(false);
              setStep('review');
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowErrors(false);
                setStep('identity');
              }}
            >
              {t('action_back')}
            </Button>
          </div>
        </>
      ) : null}
      {step === 'review' ? (
        <>
          <PavilionReservationMitStatus
            persona={persona}
            variant="review"
            onChange={() => {
              setShowErrors(false);
              setStep('identity');
            }}
          />
          <p className="m-0 text-sm text-muted-foreground">
            {t('review_request_hint')}
          </p>
          <PavilionReservationContactStep
            contact={contact}
            contactSectionRef={contactSectionRef}
            persona={persona}
            requesterEmail={requesterEmail}
            selectedServiceIds={selectedServiceIds}
            services={services}
            setPersona={updatePersona}
            setContact={setContact}
            setSelectedServiceIds={setSelectedServiceIds}
            showErrors={showErrors}
            showStepAlert={showErrors && !contactStepValid}
          />
          <PavilionReservationReviewStep
            contact={contact}
            estimate={estimate}
            persona={persona}
            requesterEmail={requesterEmail}
            selectedServiceIds={selectedServiceIds}
            services={services}
            slots={slots}
            spaces={[
              ...catalog.hourlyVenues,
              ...catalog.addons,
              ...catalog.programs,
              ...catalog.afterHours,
            ]}
          />
          <PavilionReservationFooter
            contactStepValid={contactStepValid}
            pending={pending}
            step={step}
            onBack={() => {
              setShowErrors(false);
              setStep('request');
            }}
            onContactStepInvalid={scrollToContactStepProblem}
          />
        </>
      ) : null}
    </form>
  );
}
