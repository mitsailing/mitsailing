'use client';

import {
  CalendarDays,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import type * as React from 'react';
import { useActionState, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  listPavilionReservationTimeOptions,
  PAVILION_RESERVATION_END_MINUTES,
} from '@/libs/mit-sailing/pavilionReservationBookingTimeline';
import type { PavilionReservationTimeOption } from '@/libs/mit-sailing/pavilionReservationBookingTimeline';
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
import { formatPavilionReservationTimeLabel } from '@/libs/mit-sailing/pavilionReservationTimeLabel';
import type {
  PavilionReservableItemDto,
  PavilionReservationPersonaValue,
  PavilionReservationSlotInput,
  PavilionReservationSubmitState,
} from '@/libs/mit-sailing/pavilionReservationTypes';
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

type WizardStep = 'spaces' | 'contact';

type SpacesStepProblem = 'email' | 'overlap' | 'slot' | 'space';

type SpacesStepProblemReasonKey =
  | 'footer_fix_email'
  | 'footer_fix_overlap'
  | 'footer_fix_slot'
  | 'footer_fix_space';

type SpaceOptionGroup = {
  id: 'event_options' | 'programs' | 'ungrouped' | 'venue';
  labelKey:
    | 'space_group_event_options'
    | 'space_group_programs'
    | 'space_group_venue';
  slugs: string[];
};

type PavilionReservationWizardProps = {
  action: (
    state: PavilionReservationSubmitState,
    formData: FormData
  ) => Promise<PavilionReservationSubmitState>;
  blockedRanges: PavilionReservationBlockedRange[];
  initialState: PavilionReservationSubmitState;
  items: PavilionReservableItemDto[];
  permalink: string;
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

function addSpaceSlot(props: { itemId: string; slots: ClientSlot[] }) {
  return props.slots.some((slot) => slot.itemId === props.itemId)
    ? props.slots
    : [...props.slots, newSlot(props.itemId)];
}

function removeSpaceSlots(props: { itemId: string; slots: ClientSlot[] }) {
  return props.slots.filter((slot) => slot.itemId !== props.itemId);
}

function removeSlotFromSpace(props: {
  slotCount: number;
  slotId: string;
  slots: ClientSlot[];
  spaceId: string;
}) {
  if (props.slotCount === 1) {
    return props.slots.map((candidate) =>
      candidate.id === props.slotId ? newSlot(props.spaceId) : candidate
    );
  }
  return props.slots.filter((candidate) => candidate.id !== props.slotId);
}

function updateSlotInSlots(props: {
  slots: ClientSlot[];
  updated: ClientSlot;
}) {
  return props.slots.map((candidate) =>
    candidate.id === props.updated.id ? props.updated : candidate
  );
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

type SlotPhase = 'all' | 'date' | 'end' | 'start';

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

function initialSlotPhase(slot: ClientSlot): SlotPhase {
  if (!slot.date) {
    return 'date';
  }
  return slot.endMinutes > slot.startMinutes || slot.startMinutes > 0
    ? 'end'
    : 'start';
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

function slotEditorInvalid(props: { showErrors: boolean; slot: ClientSlot }) {
  return props.showErrors && !completeSlot(props.slot);
}

function canFinishSlotEditing(props: { phase: SlotPhase; slot: ClientSlot }) {
  return props.phase === 'all' && completeSlot(props.slot);
}

function endMinutesForStartChange(props: {
  currentEndMinutes: number;
  nextEndChoices: PavilionReservationTimeOption[];
}) {
  return props.nextEndChoices.some(
    (option) => option.minutes === props.currentEndMinutes
  )
    ? props.currentEndMinutes
    : 0;
}

function pickerPromptKey(phase: SlotPhase) {
  if (phase === 'start') {
    return 'picker_start_title';
  }
  if (phase === 'end') {
    return 'picker_end_title';
  }
  if (phase === 'all') {
    return 'picker_edit_title';
  }
  return 'picker_date_prompt';
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

function spacesStepProblem(props: {
  requesterEmail: string;
  slots: ClientSlot[];
}): SpacesStepProblem | null {
  if (!isValidEmailAddress(props.requesterEmail)) {
    return 'email';
  }
  if (
    props.slots.length > 0 &&
    props.slots.some((slot) => !completeSlot(slot))
  ) {
    return 'slot';
  }
  if (props.slots.length > 0 && hasSameSpaceSlotOverlap(props.slots)) {
    return 'overlap';
  }
  if (props.slots.length === 0) {
    return 'space';
  }
  return null;
}

function spacesStepProblemReasonKey(
  problem: SpacesStepProblem
): SpacesStepProblemReasonKey {
  if (problem === 'email') {
    return 'footer_fix_email';
  }
  if (problem === 'slot') {
    return 'footer_fix_slot';
  }
  if (problem === 'overlap') {
    return 'footer_fix_overlap';
  }
  return 'footer_fix_space';
}

function scrollElementIntoView(element: HTMLElement | null) {
  element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function scrollElementIntoViewOnNextFrame(
  ref: React.RefObject<HTMLElement | null>
) {
  globalThis.requestAnimationFrame(() => {
    scrollElementIntoView(ref.current);
  });
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

function slotWithDatePreservingValidTimes(props: {
  blockedRanges: PavilionReservationBlockedRange[];
  date: string;
  now: Date;
  slot: ClientSlot;
  slots: ClientSlot[];
}): ClientSlot {
  const blockedRanges = blockedRangesForSlot({
    blockedRanges: props.blockedRanges,
    date: props.date,
    slot: props.slot,
    slots: props.slots,
  });
  const startChoices = availableStartOptions({
    blockedRanges,
    date: props.date,
    now: props.now,
  });
  const startStillValid = startChoices.some(
    (option) => option.minutes === props.slot.startMinutes
  );
  if (!startStillValid) {
    return {
      ...props.slot,
      date: props.date,
      startMinutes: 0,
      endMinutes: 0,
    };
  }
  const endChoices = availableEndOptions({
    blockedRanges,
    startMinutes: props.slot.startMinutes,
  });
  const endStillValid = endChoices.some(
    (option) => option.minutes === props.slot.endMinutes
  );
  return {
    ...props.slot,
    date: props.date,
    endMinutes: endStillValid ? props.slot.endMinutes : 0,
  };
}

const spaceOptionGroups = [
  {
    id: 'venue',
    labelKey: 'space_group_venue',
    slugs: ['casual_dock', 'roof_deck', 'party_boat'],
  },
  {
    id: 'event_options',
    labelKey: 'space_group_event_options',
    slugs: ['grill', 'wedding_space', 'after_10', 'after_midnight'],
  },
  {
    id: 'programs',
    labelKey: 'space_group_programs',
    slugs: ['lab_access', 'group_sailing'],
  },
] as const satisfies readonly SpaceOptionGroup[];

function itemById(items: PavilionReservableItemDto[], id: string) {
  return items.find((item) => item.id === id) ?? null;
}

function groupedSpaceOptions(spaces: PavilionReservableItemDto[]) {
  const groupedIds = new Set<string>();
  const groups = spaceOptionGroups.map((group) => {
    const options = group.slugs
      .map((slug) => spaces.find((space) => space.slug === slug) ?? null)
      .filter((space) => space !== null);
    for (const option of options) {
      groupedIds.add(option.id);
    }
    return {
      id: group.id,
      labelKey: group.labelKey,
      options,
    };
  });
  const ungrouped = spaces.filter((space) => !groupedIds.has(space.id));
  if (ungrouped.length === 0) {
    return groups;
  }
  return [
    ...groups,
    {
      id: 'ungrouped' as const,
      labelKey: 'space_group_event_options' as const,
      options: ungrouped,
    },
  ];
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
}): { hasTbd: boolean; totalCents: number } {
  let totalCents = 0;
  let hasTbd = false;
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
      hasTbd = true;
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
      hasTbd = true;
    } else {
      totalCents += amount;
    }
  }

  return { hasTbd, totalCents };
}

function StepHeader(props: { step: WizardStep }) {
  const t = useTranslations('PavilionReservationPage');
  const steps: { id: WizardStep; label: string }[] = [
    { id: 'spaces', label: t('step_spaces') },
    { id: 'contact', label: t('step_contact') },
  ];
  const activeIndex = steps.findIndex((step) => step.id === props.step);
  return (
    <nav aria-label={t('steps_aria')}>
      <ol className="flex flex-wrap items-center gap-2 md:gap-4">
        {steps.map((step, index) => {
          const active = step.id === props.step;
          const past = activeIndex > index;
          return (
            <li className="flex items-center gap-2" key={step.id}>
              <span
                className={cn(
                  'flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold',
                  active || past
                    ? 'border-mit-red bg-mit-red text-white'
                    : 'border-mit-line text-muted-foreground'
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

function Field(props: {
  children: React.ReactNode;
  id: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.id}>
        {props.label}
        {props.required ? <span aria-hidden>*</span> : null}
      </Label>
      {props.children}
    </div>
  );
}

function SlotRemoveButton(props: { onRemove: () => void }) {
  const t = useTranslations('PavilionReservationPage');

  return (
    <Button size="sm" type="button" variant="ghost" onClick={props.onRemove}>
      <Trash2 aria-hidden className="size-4" />
      {t('action_remove')}
    </Button>
  );
}

function CompletedSlotSummary(props: {
  invalid: boolean;
  onEdit: () => void;
  onRemove: () => void;
  selectedDateLabel: string;
  slot: ClientSlot;
  title: string;
}) {
  const t = useTranslations('PavilionReservationPage');

  return (
    <div
      className={cn(
        'rounded-lg border bg-background p-4',
        props.invalid ? 'border-destructive' : 'border-mit-line'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h5 className="text-sm font-semibold text-mit-text">{props.title}</h5>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{props.selectedDateLabel}</span>
            <span aria-hidden>-</span>
            <span className="inline-flex items-center gap-1 font-medium text-mit-text">
              <Clock aria-hidden className="size-4 text-primary-ink" />
              {formatPavilionReservationTimeLabel(props.slot.startMinutes)} -{' '}
              {formatPavilionReservationTimeLabel(props.slot.endMinutes)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SlotRemoveButton onRemove={props.onRemove} />
          <Button
            size="sm"
            type="button"
            variant="ghost"
            onClick={props.onEdit}
          >
            <Pencil aria-hidden className="size-4" />
            {t('action_edit_slot')}
          </Button>
        </div>
      </div>
      {props.invalid ? (
        <p className="mt-2 text-sm font-medium text-destructive">
          {t('error_slot_datetime')}
        </p>
      ) : null}
    </div>
  );
}

function SlotCalendarPanel(props: {
  calendarMonth: CalendarMonth;
  cells: CalendarCell[];
  minimumDate: string;
  onMonthChange: (month: CalendarMonth) => void;
  onSelectDate: (date: string) => void;
  phase: SlotPhase;
  selectedDate: string;
}) {
  const t = useTranslations('PavilionReservationPage');
  const locale = useLocale();

  return (
    <div
      className={cn(
        'border-b border-mit-line p-4 md:border-r md:border-b-0',
        props.phase === 'date' || props.phase === 'all'
          ? ''
          : 'hidden md:block md:opacity-70'
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h6 className="font-semibold text-mit-text">
            {t('picker_date_title')}
          </h6>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('picker_notice')}
          </p>
        </div>
        <CalendarDays aria-hidden className="mt-0.5 size-5 text-primary-ink" />
      </div>
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
          const suggested =
            !props.selectedDate && cell.iso === props.minimumDate;
          return (
            <button
              aria-pressed={selected}
              className={cn(
                'flex aspect-square items-center justify-center rounded-md border text-sm font-medium transition-colors',
                selected
                  ? 'border-mit-red bg-mit-red text-white'
                  : 'border-transparent text-mit-text hover:border-mit-red/40 hover:bg-mit-red-highlight',
                suggested
                  ? 'border-mit-red/50 bg-mit-red-highlight text-primary-ink'
                  : '',
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

function TimeOptionGrid(props: {
  emptyLabel?: string;
  options: PavilionReservationTimeOption[];
  onSelect: (minutes: number) => void;
  selectedMinutes: number;
}) {
  if (props.options.length === 0 && props.emptyLabel) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        {props.emptyLabel}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {props.options.map((option) => {
        const selected = props.selectedMinutes === option.minutes;
        return (
          <button
            aria-pressed={selected}
            className={cn(
              'rounded-md border px-3 py-2 text-sm font-semibold transition-colors',
              selected
                ? 'border-mit-red bg-mit-red text-white'
                : 'border-mit-line bg-background text-primary-ink hover:border-mit-red hover:bg-mit-red-highlight'
            )}
            key={option.minutes}
            type="button"
            onClick={() => {
              props.onSelect(option.minutes);
            }}
          >
            {formatPavilionReservationTimeLabel(option.minutes)}
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
}) {
  const t = useTranslations('PavilionReservationPage');

  return (
    <div className="flex-1 scrollbar-gutter-stable overflow-y-auto p-4">
      <TimeOptionGrid
        emptyLabel={t('picker_no_start_times')}
        options={props.startChoices}
        selectedMinutes={props.selectedStartMinutes}
        onSelect={props.onSelectStart}
      />
    </div>
  );
}

function SlotEndSelection(props: {
  endChoices: PavilionReservationTimeOption[];
  onChangeStart: () => void;
  onSelectEnd: (minutes: number) => void;
  selectedEndMinutes: number;
  startMinutes: number;
}) {
  const t = useTranslations('PavilionReservationPage');

  return (
    <div className="flex-1 scrollbar-gutter-stable overflow-y-auto p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-mit-text">
          <Clock aria-hidden className="size-4 text-primary-ink" />
          {props.startMinutes > 0
            ? formatPavilionReservationTimeLabel(props.startMinutes)
            : t('picker_no_start')}
        </div>
        <Button
          size="sm"
          type="button"
          variant="ghost"
          onClick={props.onChangeStart}
        >
          {t('picker_change_start')}
        </Button>
      </div>
      <TimeOptionGrid
        emptyLabel={t('picker_no_end_times')}
        options={props.endChoices}
        selectedMinutes={props.selectedEndMinutes}
        onSelect={props.onSelectEnd}
      />
    </div>
  );
}

function SlotAllSelection(props: {
  endChoices: PavilionReservationTimeOption[];
  onSelectEnd: (minutes: number) => void;
  onSelectStart: (minutes: number) => void;
  selectedEndMinutes: number;
  selectedStartMinutes: number;
  startChoices: PavilionReservationTimeOption[];
}) {
  const t = useTranslations('PavilionReservationPage');

  return (
    <div className="flex-1 scrollbar-gutter-stable space-y-5 overflow-y-auto p-4">
      <section>
        <h6 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t('field_start')}
        </h6>
        <TimeOptionGrid
          emptyLabel={t('picker_no_start_times')}
          options={props.startChoices}
          selectedMinutes={props.selectedStartMinutes}
          onSelect={props.onSelectStart}
        />
      </section>
      <section>
        <h6 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t('field_end')}
        </h6>
        {props.selectedStartMinutes > 0 ? (
          <TimeOptionGrid
            emptyLabel={t('picker_no_end_times')}
            options={props.endChoices}
            selectedMinutes={props.selectedEndMinutes}
            onSelect={props.onSelectEnd}
          />
        ) : (
          <p className="rounded-md border border-mit-line bg-mit-surface p-3 text-sm text-muted-foreground">
            {t('picker_no_start')}
          </p>
        )}
      </section>
    </div>
  );
}

function SlotTimePanelActions(props: {
  canFinishEditing: boolean;
  phase: SlotPhase;
  selectedDate: string;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setPhase: React.Dispatch<React.SetStateAction<SlotPhase>>;
}) {
  const t = useTranslations('PavilionReservationPage');

  if (!props.selectedDate) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {props.phase === 'end' ? (
        <Button
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => {
            props.setPhase('start');
          }}
        >
          {t('picker_change_start')}
        </Button>
      ) : null}
      <Button
        size="sm"
        type="button"
        variant="ghost"
        onClick={() => {
          props.setPhase('date');
        }}
      >
        {t('picker_change_date')}
      </Button>
      {props.canFinishEditing ? (
        <Button
          size="sm"
          type="button"
          variant="mit"
          onClick={() => {
            props.setIsEditing(false);
          }}
        >
          <Check aria-hidden className="size-4" />
          {t('picker_done_editing')}
        </Button>
      ) : null}
    </div>
  );
}

function SlotTimePanelHeader(props: {
  canFinishEditing: boolean;
  phase: SlotPhase;
  selectedDate: string;
  selectedDateLabel: string;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setPhase: React.Dispatch<React.SetStateAction<SlotPhase>>;
}) {
  const t = useTranslations('PavilionReservationPage');

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mit-line bg-mit-surface p-4">
      <div>
        <p className="text-sm font-semibold text-mit-text">
          {props.selectedDateLabel}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t(pickerPromptKey(props.phase))}
        </p>
      </div>
      <SlotTimePanelActions
        canFinishEditing={props.canFinishEditing}
        phase={props.phase}
        selectedDate={props.selectedDate}
        setIsEditing={props.setIsEditing}
        setPhase={props.setPhase}
      />
    </div>
  );
}

function SlotTimePanelBody(props: {
  blockedRanges: PavilionReservationBlockedRange[];
  endChoices: PavilionReservationTimeOption[];
  onUpdate: (slot: ClientSlot) => void;
  phase: SlotPhase;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setPhase: React.Dispatch<React.SetStateAction<SlotPhase>>;
  slot: ClientSlot;
  startChoices: PavilionReservationTimeOption[];
}) {
  const t = useTranslations('PavilionReservationPage');

  if (!props.slot.date) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {t('picker_select_date_first')}
      </div>
    );
  }

  if (props.phase === 'start') {
    return (
      <SlotStartSelection
        selectedStartMinutes={props.slot.startMinutes}
        startChoices={props.startChoices}
        onSelectStart={(startMinutes) => {
          props.onUpdate({
            ...props.slot,
            startMinutes,
            endMinutes: 0,
          });
          props.setPhase('end');
        }}
      />
    );
  }

  if (props.phase === 'all') {
    return (
      <SlotAllSelection
        endChoices={props.endChoices}
        selectedEndMinutes={props.slot.endMinutes}
        selectedStartMinutes={props.slot.startMinutes}
        startChoices={props.startChoices}
        onSelectStart={(startMinutes) => {
          const nextEndChoices = availableEndOptions({
            blockedRanges: props.blockedRanges,
            startMinutes,
          });
          props.onUpdate({
            ...props.slot,
            startMinutes,
            endMinutes: endMinutesForStartChange({
              currentEndMinutes: props.slot.endMinutes,
              nextEndChoices,
            }),
          });
        }}
        onSelectEnd={(endMinutes) => {
          props.onUpdate({
            ...props.slot,
            endMinutes,
          });
          props.setIsEditing(false);
        }}
      />
    );
  }

  if (props.phase === 'end') {
    return (
      <SlotEndSelection
        endChoices={props.endChoices}
        selectedEndMinutes={props.slot.endMinutes}
        startMinutes={props.slot.startMinutes}
        onChangeStart={() => {
          props.setPhase('start');
        }}
        onSelectEnd={(endMinutes) => {
          props.onUpdate({
            ...props.slot,
            endMinutes,
          });
          props.setIsEditing(false);
        }}
      />
    );
  }

  return null;
}

function SlotTimePanel(props: {
  blockedRanges: PavilionReservationBlockedRange[];
  canFinishEditing: boolean;
  endChoices: PavilionReservationTimeOption[];
  onUpdate: (slot: ClientSlot) => void;
  phase: SlotPhase;
  selectedDateLabel: string;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setPhase: React.Dispatch<React.SetStateAction<SlotPhase>>;
  slot: ClientSlot;
  startChoices: PavilionReservationTimeOption[];
}) {
  return (
    <div className="flex flex-col md:min-h-96">
      <SlotTimePanelHeader
        canFinishEditing={props.canFinishEditing}
        phase={props.phase}
        selectedDate={props.slot.date}
        selectedDateLabel={props.selectedDateLabel}
        setIsEditing={props.setIsEditing}
        setPhase={props.setPhase}
      />
      <SlotTimePanelBody
        blockedRanges={props.blockedRanges}
        endChoices={props.endChoices}
        phase={props.phase}
        setIsEditing={props.setIsEditing}
        setPhase={props.setPhase}
        slot={props.slot}
        startChoices={props.startChoices}
        onUpdate={props.onUpdate}
      />
    </div>
  );
}

function SlotEditorForm(props: {
  allBlockedRanges: PavilionReservationBlockedRange[];
  blockedRanges: PavilionReservationBlockedRange[];
  calendarMonth: CalendarMonth;
  canFinishEditing: boolean;
  cells: CalendarCell[];
  endChoices: PavilionReservationTimeOption[];
  handleCalendarMonthChange: React.Dispatch<
    React.SetStateAction<CalendarMonth>
  >;
  invalid: boolean;
  minimumDate: string;
  now: Date;
  phase: SlotPhase;
  selectedDateLabel: string;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  setPhase: React.Dispatch<React.SetStateAction<SlotPhase>>;
  slot: ClientSlot;
  slots: ClientSlot[];
  startChoices: PavilionReservationTimeOption[];
  title: string;
  onRemove: () => void;
  onUpdate: (slot: ClientSlot) => void;
}) {
  const t = useTranslations('PavilionReservationPage');

  return (
    <div className="rounded-lg border border-mit-line bg-mit-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h5 className="text-sm font-semibold text-mit-text">{props.title}</h5>
        <div className="flex gap-2">
          <SlotRemoveButton onRemove={props.onRemove} />
        </div>
      </div>
      <div
        className={cn(
          'overflow-hidden rounded-lg border bg-background',
          props.invalid ? 'border-destructive' : 'border-mit-line'
        )}
      >
        <div className="grid md:grid-cols-[minmax(18rem,22rem)_1fr]">
          <SlotCalendarPanel
            calendarMonth={props.calendarMonth}
            cells={props.cells}
            minimumDate={props.minimumDate}
            phase={props.phase}
            selectedDate={props.slot.date}
            onMonthChange={props.handleCalendarMonthChange}
            onSelectDate={(date) => {
              const nextSlot = slotWithDatePreservingValidTimes({
                blockedRanges: props.allBlockedRanges,
                date,
                now: props.now,
                slot: props.slot,
                slots: props.slots,
              });
              props.onUpdate(nextSlot);
              props.setPhase(nextSlot.startMinutes > 0 ? 'all' : 'start');
            }}
          />
          <SlotTimePanel
            blockedRanges={props.blockedRanges}
            canFinishEditing={props.canFinishEditing}
            endChoices={props.endChoices}
            phase={props.phase}
            selectedDateLabel={props.selectedDateLabel}
            setIsEditing={props.setIsEditing}
            setPhase={props.setPhase}
            slot={props.slot}
            startChoices={props.startChoices}
            onUpdate={props.onUpdate}
          />
        </div>
      </div>
      {props.invalid ? (
        <p className="mt-2 text-sm font-medium text-destructive">
          {t('error_slot_datetime')}
        </p>
      ) : null}
    </div>
  );
}

function SlotEditor(props: {
  blockedRanges: PavilionReservationBlockedRange[];
  onRemove: () => void;
  onUpdate: (slot: ClientSlot) => void;
  showErrors: boolean;
  slot: ClientSlot;
  slots: ClientSlot[];
  title: string;
}) {
  const t = useTranslations('PavilionReservationPage');
  const locale = useLocale();
  const [calendarMonth, setCalendarMonth] = useState(
    initialCalendarMonth(props.slot.date)
  );
  const [phase, setPhase] = useState<SlotPhase>(initialSlotPhase(props.slot));
  const [isEditing, setIsEditing] = useState(
    !props.slot.date || props.slot.endMinutes <= props.slot.startMinutes
  );
  const handleCalendarMonthChange = setCalendarMonth;
  const now = new Date();
  const invalid = slotEditorInvalid({
    showErrors: props.showErrors,
    slot: props.slot,
  });
  const cells = buildCalendarCells(calendarMonth);
  const minimumDate = minimumSlotDateIso();
  const blockedRanges = blockedRangesForSlot({
    blockedRanges: props.blockedRanges,
    slot: props.slot,
    slots: props.slots,
  });
  const startChoices = availableStartOptions({
    blockedRanges,
    date: props.slot.date,
    now,
  });
  const endChoices = availableEndOptions({
    blockedRanges,
    startMinutes: props.slot.startMinutes,
  });
  const selectedDateLabel = props.slot.date
    ? formatSlotDateShort(props.slot.date, locale)
    : t('picker_no_date');
  const isComplete = completeSlot(props.slot);
  const canFinishEditing = canFinishSlotEditing({ phase, slot: props.slot });

  if (isComplete && !isEditing) {
    return (
      <CompletedSlotSummary
        invalid={invalid}
        selectedDateLabel={selectedDateLabel}
        slot={props.slot}
        title={props.title}
        onEdit={() => {
          setIsEditing(true);
          setPhase('all');
        }}
        onRemove={props.onRemove}
      />
    );
  }

  return (
    <SlotEditorForm
      allBlockedRanges={props.blockedRanges}
      blockedRanges={blockedRanges}
      calendarMonth={calendarMonth}
      canFinishEditing={canFinishEditing}
      cells={cells}
      endChoices={endChoices}
      handleCalendarMonthChange={handleCalendarMonthChange}
      invalid={invalid}
      minimumDate={minimumDate}
      now={now}
      phase={phase}
      selectedDateLabel={selectedDateLabel}
      setIsEditing={setIsEditing}
      setPhase={setPhase}
      slot={props.slot}
      slots={props.slots}
      startChoices={startChoices}
      title={props.title}
      onRemove={props.onRemove}
      onUpdate={props.onUpdate}
    />
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
  persona: PavilionReservationPersonaValue;
  requesterEmail: string;
  selectedServiceIds: string[];
  slots: ClientSlot[];
}) {
  return (
    <>
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
    <div className="rounded-lg border border-mit-line bg-card p-5 md:p-8">
      <h1 className="font-mit-serif text-2xl font-semibold text-mit-text md:text-3xl">
        {t('title')}
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-mit-text md:text-base">
        {t('intro')}
      </p>
      <div className="mt-4 md:mt-6">
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

function SelectedSpaceSlotSection(props: {
  blockedRanges: PavilionReservationBlockedRange[];
  setShowErrors: React.Dispatch<React.SetStateAction<boolean>>;
  setSlots: React.Dispatch<React.SetStateAction<ClientSlot[]>>;
  showErrors: boolean;
  slots: ClientSlot[];
  spaceId: string;
  spaces: PavilionReservableItemDto[];
}) {
  const t = useTranslations('PavilionReservationPage');
  const space = itemById(props.spaces, props.spaceId);

  if (!space) {
    return null;
  }

  const spaceSlots = props.slots.filter(
    (slot) => slot.itemId === props.spaceId
  );

  return (
    <section className="rounded-lg border border-mit-line bg-card p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-mit-line pb-3">
        <h3 className="font-semibold text-mit-text">{space.name}</h3>
        <Button
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => {
            props.setSlots((current) =>
              removeSpaceSlots({ itemId: props.spaceId, slots: current })
            );
          }}
        >
          <Trash2 aria-hidden className="size-4" />
          {t('action_remove_space')}
        </Button>
      </div>
      <div className="space-y-4">
        {spaceSlots.map((slot, index) => (
          <SlotEditor
            blockedRanges={props.blockedRanges}
            key={slot.id}
            showErrors={props.showErrors}
            slot={slot}
            slots={props.slots}
            title={t('slot_title', { number: index + 1 })}
            onRemove={() => {
              props.setSlots((current) =>
                removeSlotFromSpace({
                  slotCount: spaceSlots.length,
                  slotId: slot.id,
                  slots: current,
                  spaceId: props.spaceId,
                })
              );
            }}
            onUpdate={(updated) => {
              props.setShowErrors(false);
              props.setSlots((current) =>
                updateSlotInSlots({ slots: current, updated })
              );
            }}
          />
        ))}
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            props.setSlots((current) => [...current, newSlot(props.spaceId)]);
          }}
        >
          <Plus aria-hidden className="size-4" />
          {t('action_add_slot')}
        </Button>
      </div>
    </section>
  );
}

function SelectedSlotEditors(props: {
  blockedRanges: PavilionReservationBlockedRange[];
  selectedSpaceIds: string[];
  setShowErrors: React.Dispatch<React.SetStateAction<boolean>>;
  setSlots: React.Dispatch<React.SetStateAction<ClientSlot[]>>;
  showErrors: boolean;
  slots: ClientSlot[];
  slotsRef: React.RefObject<HTMLDivElement | null>;
  spaces: PavilionReservableItemDto[];
}) {
  const t = useTranslations('PavilionReservationPage');

  return props.selectedSpaceIds.length > 0 ? (
    <section className="space-y-3" ref={props.slotsRef}>
      <div>
        <h2 className="text-lg font-semibold text-mit-text md:text-xl">
          {t('selected_slots_title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('selected_slots_intro')}
        </p>
      </div>
      {props.selectedSpaceIds.map((spaceId) => (
        <SelectedSpaceSlotSection
          blockedRanges={props.blockedRanges}
          key={spaceId}
          setShowErrors={props.setShowErrors}
          setSlots={props.setSlots}
          showErrors={props.showErrors}
          slots={props.slots}
          spaceId={spaceId}
          spaces={props.spaces}
        />
      ))}
    </section>
  ) : null;
}

function PavilionReservationSpaceCardActions(props: {
  selected: boolean;
  setShowErrors: React.Dispatch<React.SetStateAction<boolean>>;
  setSlots: React.Dispatch<React.SetStateAction<ClientSlot[]>>;
  slotsRef: React.RefObject<HTMLDivElement | null>;
  spaceId: string;
}) {
  const t = useTranslations('PavilionReservationPage');

  if (props.selected) {
    return (
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            scrollElementIntoView(props.slotsRef.current);
          }}
        >
          <Pencil aria-hidden className="size-4" />
          {t('action_edit_time')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            props.setShowErrors(false);
            props.setSlots((current) =>
              removeSpaceSlots({
                itemId: props.spaceId,
                slots: current,
              })
            );
          }}
        >
          <Trash2 aria-hidden className="size-4" />
          {t('action_remove_space')}
        </Button>
      </div>
    );
  }

  return (
    <Button
      className="mt-4 w-full"
      type="button"
      variant="mit"
      onClick={() => {
        props.setShowErrors(false);
        props.setSlots((current) =>
          addSpaceSlot({
            itemId: props.spaceId,
            slots: current,
          })
        );
        scrollElementIntoViewOnNextFrame(props.slotsRef);
      }}
    >
      {t('action_select_space')}
    </Button>
  );
}

function PavilionReservationSpaceCard(props: {
  persona: PavilionReservationPersonaValue;
  selected: boolean;
  setShowErrors: React.Dispatch<React.SetStateAction<boolean>>;
  setSlots: React.Dispatch<React.SetStateAction<ClientSlot[]>>;
  slotsRef: React.RefObject<HTMLDivElement | null>;
  space: PavilionReservableItemDto;
}) {
  const t = useTranslations('PavilionReservationPage');
  const priceDisplay = personaPriceDisplay({
    item: props.space,
    persona: props.persona,
    tbdLabel: t('price_tbd'),
  });

  return (
    <article
      className={cn(
        'overflow-hidden rounded-lg border bg-card transition-colors',
        props.selected
          ? 'border-mit-red ring-1 ring-mit-red'
          : 'border-mit-line'
      )}
    >
      {props.space.imageUrl && !props.selected ? (
        <div className="relative h-36 bg-mit-surface md:h-48">
          <Image
            alt={props.space.name}
            className="object-cover"
            fill
            sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
            src={props.space.imageUrl}
          />
        </div>
      ) : null}
      <div
        className={cn(
          'flex flex-col p-4 md:p-5',
          props.selected ? 'min-h-0' : 'min-h-0 md:min-h-64'
        )}
      >
        <h4 className="font-semibold text-mit-text">{props.space.name}</h4>
        <p
          className={cn(
            'mt-2 text-sm text-muted-foreground',
            props.selected ? 'line-clamp-2' : 'flex-1'
          )}
        >
          {props.space.description}
        </p>
        <p className="mt-4 text-lg font-bold text-primary-ink">
          {priceDisplay.label}
        </p>
        {priceDisplay.available ? null : (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('price_tbd_note')}
          </p>
        )}
        {props.space.minDurationHours ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('minimum_hours', {
              count: props.space.minDurationHours,
            })}
          </p>
        ) : null}
        <PavilionReservationSpaceCardActions
          selected={props.selected}
          setShowErrors={props.setShowErrors}
          setSlots={props.setSlots}
          slotsRef={props.slotsRef}
          spaceId={props.space.id}
        />
      </div>
    </article>
  );
}

function PavilionReservationSpaceGroup(props: {
  group: ReturnType<typeof groupedSpaceOptions>[number];
  persona: PavilionReservationPersonaValue;
  selectedSpaceIds: string[];
  setShowErrors: React.Dispatch<React.SetStateAction<boolean>>;
  setSlots: React.Dispatch<React.SetStateAction<ClientSlot[]>>;
  slotsRef: React.RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations('PavilionReservationPage');

  if (props.group.options.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="mb-3 text-sm font-bold tracking-wide text-mit-text uppercase">
        {t(props.group.labelKey)}
      </h3>
      <div className="grid gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
        {props.group.options.map((space) => (
          <PavilionReservationSpaceCard
            key={space.id}
            persona={props.persona}
            selected={props.selectedSpaceIds.includes(space.id)}
            setShowErrors={props.setShowErrors}
            setSlots={props.setSlots}
            slotsRef={props.slotsRef}
            space={space}
          />
        ))}
      </div>
    </section>
  );
}

function PavilionReservationSpacesStep(props: {
  blockedRanges: PavilionReservationBlockedRange[];
  emailRef: React.RefObject<HTMLInputElement | null>;
  persona: PavilionReservationPersonaValue;
  requesterEmail: string;
  selectedSpaceIds: string[];
  setPersona: (persona: PavilionReservationPersonaValue) => void;
  setRequesterEmail: React.Dispatch<React.SetStateAction<string>>;
  setShowErrors: React.Dispatch<React.SetStateAction<boolean>>;
  setSlots: React.Dispatch<React.SetStateAction<ClientSlot[]>>;
  showErrors: boolean;
  slots: ClientSlot[];
  slotsRef: React.RefObject<HTMLDivElement | null>;
  spacesRef: React.RefObject<HTMLDivElement | null>;
  spaces: PavilionReservableItemDto[];
}) {
  const t = useTranslations('PavilionReservationPage');
  const groups = groupedSpaceOptions(props.spaces);

  return (
    <>
      <div className="rounded-lg border border-mit-line bg-card p-4 md:p-8">
        <h2 className="text-lg font-semibold text-mit-text md:text-xl">
          {t('basic_title')}
        </h2>
        <div className="mt-4 max-w-md md:mt-6">
          <Field id="requester-email" label={t('field_email')} required>
            <Input
              aria-invalid={
                props.showErrors && !isValidEmailAddress(props.requesterEmail)
              }
              aria-required
              id="requester-email"
              placeholder={t('field_email_placeholder')}
              ref={props.emailRef}
              required
              type="email"
              value={props.requesterEmail}
              onChange={(event) => {
                props.setRequesterEmail(event.currentTarget.value);
                props.setShowErrors(false);
              }}
            />
          </Field>
        </div>
        <div className="mt-5 md:mt-6">
          <h3 className="text-sm font-semibold text-mit-text">
            {t('persona_title')}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('persona_intro')}
          </p>
          <div className="mt-3 grid gap-2 md:mt-4 md:grid-cols-2 md:gap-4">
            {PAVILION_RESERVATION_PERSONAS.map((personaOption) => (
              <label
                className={cn(
                  'cursor-pointer rounded-lg border-2 p-3 transition-colors md:p-4',
                  props.persona === personaOption
                    ? 'border-mit-red bg-mit-red-highlight'
                    : 'border-mit-line bg-background hover:border-mit-red/40'
                )}
                key={personaOption}
              >
                <input
                  checked={props.persona === personaOption}
                  className="sr-only"
                  name="personaChoice"
                  type="radio"
                  value={personaOption}
                  onChange={() => {
                    props.setPersona(personaOption);
                  }}
                />
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full border',
                      props.persona === personaOption
                        ? 'border-mit-red'
                        : 'border-mit-line'
                    )}
                  >
                    {props.persona === personaOption ? (
                      <span className="size-2.5 rounded-full bg-mit-red" />
                    ) : null}
                  </span>
                  <span className="font-semibold text-mit-text">
                    {t(`persona_${personaOption}_label`)}
                  </span>
                </span>
                <span className="mt-2 hidden pl-8 text-sm text-muted-foreground sm:block">
                  {t(`persona_${personaOption}_desc`)}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <SelectedSlotEditors
        blockedRanges={props.blockedRanges}
        selectedSpaceIds={props.selectedSpaceIds}
        setShowErrors={props.setShowErrors}
        setSlots={props.setSlots}
        showErrors={props.showErrors}
        slots={props.slots}
        slotsRef={props.slotsRef}
        spaces={props.spaces}
      />

      <section ref={props.spacesRef}>
        <h2 className="mb-4 text-xl font-semibold text-mit-text">
          {t('spaces_title')}
        </h2>
        <div className="space-y-5 md:space-y-8">
          {groups.map((group) => (
            <PavilionReservationSpaceGroup
              group={group}
              key={group.id}
              persona={props.persona}
              selectedSpaceIds={props.selectedSpaceIds}
              setShowErrors={props.setShowErrors}
              setSlots={props.setSlots}
              slotsRef={props.slotsRef}
            />
          ))}
        </div>
      </section>
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
    tbdLabel: t('price_tbd'),
  });

  return (
    <label
      className={cn(
        'flex items-start gap-4 rounded-lg border p-4 transition-colors md:items-center',
        priceDisplay.available
          ? 'cursor-pointer'
          : 'cursor-not-allowed border-mit-line bg-mit-surface opacity-75',
        props.selected ? 'border-mit-red bg-mit-red-highlight' : null,
        priceDisplay.available && !props.selected ? 'border-mit-line' : null
      )}
    >
      <input
        checked={props.selected}
        className="mt-1 md:mt-0"
        disabled={priceDisplay.priceCents === null}
        type="checkbox"
        onChange={() => {
          props.setSelectedServiceIds((current) =>
            current.includes(props.service.id)
              ? current.filter((id) => id !== props.service.id)
              : [...current, props.service.id]
          );
        }}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block font-medium text-mit-text',
            priceDisplay.available ? null : 'text-muted-foreground line-through'
          )}
        >
          {props.service.name}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {priceDisplay.available
            ? props.service.description
            : t('service_unavailable')}
        </span>
      </span>
      <span className="font-semibold text-primary-ink">
        {priceDisplay.available
          ? priceDisplay.label
          : t('service_unavailable_price')}
      </span>
    </label>
  );
}

function PavilionReservationContactStep(props: {
  contact: ContactFields;
  persona: PavilionReservationPersonaValue;
  requesterEmail: string;
  selectedServiceIds: string[];
  services: PavilionReservableItemDto[];
  setPersona: (persona: PavilionReservationPersonaValue) => void;
  setContact: React.Dispatch<React.SetStateAction<ContactFields>>;
  setSelectedServiceIds: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const t = useTranslations('PavilionReservationPage');

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-mit-line bg-card p-6 md:p-8">
        <h2 className="text-xl font-semibold text-mit-text">
          {t('contact_title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('contact_intro')}
        </p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field id="contact-persona" label={t('persona_title')} required>
            <select
              aria-required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              id="contact-persona"
              required
              value={props.persona}
              onChange={(event) => {
                const nextPersona =
                  parsePavilionReservationPersona(event.currentTarget.value) ??
                  null;
                if (nextPersona) {
                  props.setPersona(nextPersona);
                }
              }}
            >
              {PAVILION_RESERVATION_PERSONAS.map((personaOption) => (
                <option key={personaOption} value={personaOption}>
                  {t(`persona_${personaOption}_label`)}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t('contact_persona_helper')}
            </p>
          </Field>
          <Field id="contact-email" label={t('field_email')} required>
            <Input
              aria-describedby="contact-email-helper"
              aria-required
              id="contact-email"
              readOnly
              required
              type="email"
              value={props.requesterEmail}
            />
            <p
              className="mt-1.5 text-xs text-muted-foreground"
              id="contact-email-helper"
            >
              {t('contact_email_helper')}
            </p>
          </Field>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field id="firstName" label={t('field_first_name')} required>
            <Input
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
          </Field>
          <Field id="lastName" label={t('field_last_name')} required>
            <Input
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
          </Field>
          <Field id="phone" label={t('field_phone')} required>
            <Input
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
          </Field>
          <Field id="eventName" label={t('field_event_name')} required>
            <Input
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
          </Field>
          <Field id="groupName" label={t('field_group_name')}>
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
          </Field>
          <Field id="groupSize" label={t('field_group_size')}>
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
          </Field>
          <div className="md:col-span-2">
            <Field id="description" label={t('field_description')} required>
              <Textarea
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
            </Field>
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
              className="rounded-lg border border-mit-line bg-mit-surface p-4"
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
          <section className="mt-6 rounded-lg border border-mit-line bg-mit-surface p-5">
            <h3 className="text-sm font-bold tracking-wide text-mit-text uppercase">
              {t('academic_title')}
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field
                  id="projectTitle"
                  label={t('field_project_title')}
                  required
                >
                  <Input
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
                </Field>
              </div>
              <Field id="advisorName" label={t('field_advisor_name')} required>
                <Input
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
              </Field>
              <Field
                id="advisorEmail"
                label={t('field_advisor_email')}
                required
              >
                <Input
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
              </Field>
              <div className="md:col-span-2">
                <Field id="costCenter" label={t('field_cost_center')} required>
                  <Input
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
                </Field>
              </div>
            </div>
          </section>
        ) : null}

        {props.persona === 'mit_student' ||
        props.persona === 'mit_community' ? (
          <section className="mt-6 rounded-lg border border-mit-line bg-mit-surface p-5">
            <h3 className="text-sm font-semibold text-mit-text">
              {t('mit_affiliation_title')}
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field id="mitId" label={t('field_mit_id')}>
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
              </Field>
              <Field id="mitAccount" label={t('field_mit_account')}>
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
              </Field>
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
  estimate: { hasTbd: boolean; totalCents: number };
  persona: PavilionReservationPersonaValue;
  requesterEmail: string;
  selectedServiceIds: string[];
  selectedSpaceIds: string[];
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
        <div className="rounded-lg border border-mit-line bg-mit-surface p-5">
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

        <div className="rounded-lg border border-mit-line bg-mit-surface p-5">
          <h3 className="font-semibold text-mit-text">
            {t('review_reservation')}
          </h3>
          <div className="mt-4 space-y-4">
            {props.selectedSpaceIds.map((spaceId) => {
              const space = itemById(props.spaces, spaceId);
              if (!space) {
                return null;
              }
              return (
                <div
                  className="border-b border-mit-line pb-4 last:border-b-0 last:pb-0"
                  key={spaceId}
                >
                  <h4 className="font-medium text-primary-ink">{space.name}</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-mit-text">
                    {props.slots
                      .filter((slot) => slot.itemId === spaceId)
                      .map((slot) => (
                        <li key={slot.id}>
                          {formatSlotDateShort(
                            slot.date,
                            locale,
                            'America/New_York'
                          )}{' '}
                          -{' '}
                          {formatPavilionReservationTimeLabel(
                            slot.startMinutes
                          )}{' '}
                          -{' '}
                          {formatPavilionReservationTimeLabel(slot.endMinutes)}
                        </li>
                      ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-mit-line bg-mit-surface p-5">
          <h3 className="font-semibold text-mit-text">{t('review_pricing')}</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
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
                          ? t('price_tbd')
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
                          ? t('price_tbd')
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
                    {props.estimate.hasTbd ? (
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        {t('plus_tbd')}
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
  estimate: { hasTbd: boolean; totalCents: number };
  onSpacesStepInvalid: () => void;
  pending: boolean;
  selectedSpaceIds: string[];
  setShowErrors: React.Dispatch<React.SetStateAction<boolean>>;
  setStep: React.Dispatch<React.SetStateAction<WizardStep>>;
  spacesStepProblem: SpacesStepProblem | null;
  slots: ClientSlot[];
  spacesStepValid: boolean;
  step: WizardStep;
  showErrors: boolean;
}) {
  const t = useTranslations('PavilionReservationPage');
  const fixedToViewport = props.step === 'spaces';

  return (
    <div
      className={cn(
        'z-40 border-t border-mit-line bg-background/95 backdrop-blur',
        fixedToViewport
          ? 'fixed inset-x-0 bottom-0 px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] sm:px-6 sm:pt-3 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]'
          : 'sticky bottom-0 -mx-6 px-6 py-4'
      )}
    >
      {fixedToViewport && props.spacesStepProblem ? (
        <div className="mx-auto mb-2 flex max-w-5xl items-center justify-between gap-2 rounded-md border border-mit-line bg-mit-surface px-2.5 py-1.5 text-xs sm:mb-3 sm:px-3 sm:py-2 sm:text-sm">
          <p className="min-w-0 flex-1 truncate font-medium text-mit-text">
            {t(spacesStepProblemReasonKey(props.spacesStepProblem))}
          </p>
          <Button
            size="sm"
            className="shrink-0"
            type="button"
            variant="ghost"
            onClick={props.onSpacesStepInvalid}
          >
            {t('action_fix_first_step')}
          </Button>
        </div>
      ) : null}
      <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="hidden text-sm font-medium text-muted-foreground sm:block">
            {t('summary_label')}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-mit-text">
            <span>
              {t('summary_spaces', {
                spaces: props.selectedSpaceIds.length,
                slots: props.slots.length,
              })}
            </span>
            <span className="font-medium text-primary-ink">
              {formatPavilionReservationMoney(props.estimate.totalCents)}
              {props.estimate.hasTbd ? ` ${t('plus_tbd')}` : ''}
            </span>
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          {props.step === 'spaces' ? null : (
            <Button
              className="w-full sm:w-auto"
              type="button"
              variant="outline"
              onClick={() => {
                props.setShowErrors(false);
                props.setStep('spaces');
              }}
            >
              {t('action_back')}
            </Button>
          )}
          {props.step === 'spaces' ? (
            <Button
              className="w-full sm:w-auto"
              disabled={!props.spacesStepValid}
              type="button"
              variant="mit"
              onClick={() => {
                if (!props.spacesStepValid) {
                  props.onSpacesStepInvalid();
                  return;
                }
                props.setShowErrors(false);
                props.setStep('contact');
              }}
            >
              {t('action_next_contact')}
            </Button>
          ) : null}
          {props.step === 'contact' ? (
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
                  props.setShowErrors(true);
                  return;
                }
                props.setShowErrors(false);
              }}
            >
              {props.pending ? t('pending_submitting') : t('action_submit')}
            </SubmitButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PavilionReservationWizard(
  props: PavilionReservationWizardProps
) {
  const t = useTranslations('PavilionReservationPage');
  const [actionState, formAction, pending] = useActionState(
    props.action,
    props.initialState,
    props.permalink
  );
  const [step, setStep] = useState<WizardStep>('spaces');
  const [persona, setPersona] =
    useState<PavilionReservationPersonaValue>('mit_academic');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [slots, setSlots] = useState<ClientSlot[]>([]);
  const [contact, setContact] = useState<ContactFields>(initialContact);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const spacesRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<HTMLDivElement>(null);

  const spaces = props.items.filter((item) => item.kind === 'space');
  const services = props.items.filter((item) => item.kind === 'service');
  const selectedSpaceIds = [...new Set(slots.map((slot) => slot.itemId))];
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
  const estimate = sumEstimatedTotal({
    items: props.items,
    persona,
    selectedServiceIds,
    slots,
  });
  const firstSpacesStepProblem = spacesStepProblem({ requesterEmail, slots });
  const spacesStepValid = firstSpacesStepProblem === null;
  const contactStepValid = Boolean(
    contact.firstName.trim() &&
    contact.lastName.trim() &&
    contact.phone.trim() &&
    contact.eventName.trim() &&
    contact.description.trim() &&
    (persona !== 'mit_academic' ||
      (contact.projectTitle.trim() &&
        contact.advisorName.trim() &&
        contact.advisorEmail.includes('@') &&
        contact.costCenter.trim()))
  );
  const scrollToSpacesStepProblem = () => {
    setShowErrors(true);
    if (firstSpacesStepProblem === 'email') {
      scrollElementIntoView(emailRef.current);
      emailRef.current?.focus();
      return;
    }
    if (
      firstSpacesStepProblem === 'slot' ||
      firstSpacesStepProblem === 'overlap'
    ) {
      scrollElementIntoView(slotsRef.current);
      return;
    }
    scrollElementIntoView(spacesRef.current);
  };

  if (actionState.status === 'confirmed' && actionState.referenceCode) {
    return (
      <PavilionReservationConfirmation
        referenceCode={actionState.referenceCode}
      />
    );
  }

  return (
    <form
      action={formAction}
      className={cn('space-y-8', step === 'spaces' ? 'pb-44 sm:pb-32' : '')}
    >
      <PavilionReservationHiddenFields
        contact={contact}
        persona={persona}
        requesterEmail={requesterEmail}
        selectedServiceIds={selectedServiceIds}
        slots={slots}
      />
      <PavilionReservationIntro step={step} />
      <PavilionReservationActionError actionState={actionState} />
      {step === 'spaces' ? (
        <PavilionReservationSpacesStep
          blockedRanges={props.blockedRanges}
          emailRef={emailRef}
          persona={persona}
          requesterEmail={requesterEmail}
          selectedSpaceIds={selectedSpaceIds}
          setPersona={updatePersona}
          setRequesterEmail={setRequesterEmail}
          setShowErrors={setShowErrors}
          setSlots={setSlots}
          showErrors={showErrors}
          slots={slots}
          slotsRef={slotsRef}
          spacesRef={spacesRef}
          spaces={spaces}
        />
      ) : null}
      {step === 'contact' ? (
        <>
          <PavilionReservationContactStep
            contact={contact}
            persona={persona}
            requesterEmail={requesterEmail}
            selectedServiceIds={selectedServiceIds}
            services={services}
            setPersona={updatePersona}
            setContact={setContact}
            setSelectedServiceIds={setSelectedServiceIds}
          />
          <PavilionReservationReviewStep
            contact={contact}
            estimate={estimate}
            persona={persona}
            requesterEmail={requesterEmail}
            selectedServiceIds={selectedServiceIds}
            selectedSpaceIds={selectedSpaceIds}
            services={services}
            slots={slots}
            spaces={spaces}
          />
        </>
      ) : null}
      {showErrors && step !== 'spaces' ? (
        <p className="text-sm font-medium text-destructive">
          {t('error_contact_step')}
        </p>
      ) : null}
      <PavilionReservationFooter
        contactStepValid={contactStepValid}
        estimate={estimate}
        onSpacesStepInvalid={scrollToSpacesStepProblem}
        pending={pending}
        selectedSpaceIds={selectedSpaceIds}
        setShowErrors={setShowErrors}
        setStep={setStep}
        spacesStepProblem={firstSpacesStepProblem}
        slots={slots}
        spacesStepValid={spacesStepValid}
        step={step}
        showErrors={showErrors}
      />
    </form>
  );
}
