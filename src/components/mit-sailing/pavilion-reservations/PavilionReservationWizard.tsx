'use client';

import { Check, CheckCircle, Copy, Info, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import type * as React from 'react';
import { useActionState, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';
import {
  estimatedServiceAmountCents,
  estimatedSlotAmountCents,
  formatPavilionReservationMoney,
  priceForPersona,
  priceLabel,
} from '@/libs/mit-sailing/pavilionReservationPricing';
import { formatPavilionReservationTimeLabel } from '@/libs/mit-sailing/pavilionReservationTimeLabel';
import type {
  PavilionReservableItemDto,
  PavilionReservationPersonaValue,
  PavilionReservationSlotInput,
  PavilionReservationSubmitState,
} from '@/libs/mit-sailing/pavilionReservationTypes';

type ClientSlot = PavilionReservationSlotInput & {
  id: string;
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

type WizardStep = 'spaces' | 'contact' | 'review';

type PavilionReservationWizardProps = {
  action: (
    state: PavilionReservationSubmitState,
    formData: FormData
  ) => Promise<PavilionReservationSubmitState>;
  initialState: PavilionReservationSubmitState;
  items: PavilionReservableItemDto[];
};

const personas = [
  'mit_academic',
  'mit_student',
  'mit_community',
  'non_mit',
] as const satisfies readonly PavilionReservationPersonaValue[];

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
    startMinutes: 9 * 60,
    endMinutes: 10 * 60,
  };
}

function slotTimeOptions(props: { includeEnd: boolean }) {
  const options: { labelKey: string; minutes: number }[] = [];
  const last = props.includeEnd ? 26 : 23.5;
  for (let hour = 7; hour <= last; hour += 0.5) {
    const minutes = Math.round(hour * 60);
    if (!props.includeEnd && minutes >= 24 * 60) {
      continue;
    }
    options.push({
      labelKey: String(minutes),
      minutes,
    });
  }
  return options;
}

const startOptions = slotTimeOptions({ includeEnd: false });
const endOptions = slotTimeOptions({ includeEnd: true });

function itemById(items: PavilionReservableItemDto[], id: string) {
  return items.find((item) => item.id === id) ?? null;
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
    { id: 'review', label: t('step_review') },
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

function SlotEditor(props: {
  onDuplicate: () => void;
  onRemove: () => void;
  onUpdate: (slot: ClientSlot) => void;
  showErrors: boolean;
  slot: ClientSlot;
  title: string;
}) {
  const t = useTranslations('PavilionReservationPage');
  const invalid = props.showErrors && !props.slot.date;
  return (
    <div className="rounded-lg border border-mit-line bg-mit-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h5 className="text-sm font-semibold text-mit-text">{props.title}</h5>
        <div className="flex gap-2">
          <Button
            size="sm"
            type="button"
            variant="ghost"
            onClick={props.onDuplicate}
          >
            <Copy aria-hidden className="size-4" />
            {t('action_duplicate_slot')}
          </Button>
          <Button
            size="sm"
            type="button"
            variant="ghost"
            onClick={props.onRemove}
          >
            <Trash2 aria-hidden className="size-4" />
            {t('action_remove')}
          </Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Field id={`${props.slot.id}-date`} label={t('field_date')} required>
          <Input
            aria-invalid={invalid}
            id={`${props.slot.id}-date`}
            min={new Date(Date.now() + 48 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10)}
            type="date"
            value={props.slot.date}
            onChange={(event) => {
              props.onUpdate({
                ...props.slot,
                date: event.currentTarget.value,
              });
            }}
          />
        </Field>
        <Field id={`${props.slot.id}-start`} label={t('field_start')} required>
          <select
            className={adminNativeSelectClassName}
            id={`${props.slot.id}-start`}
            value={props.slot.startMinutes}
            onChange={(event) => {
              const startMinutes = Number(event.currentTarget.value);
              props.onUpdate({
                ...props.slot,
                startMinutes,
                endMinutes: Math.max(props.slot.endMinutes, startMinutes + 30),
              });
            }}
          >
            {startOptions.map((option) => (
              <option key={option.labelKey} value={option.minutes}>
                {formatPavilionReservationTimeLabel(option.minutes)}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${props.slot.id}-end`} label={t('field_end')} required>
          <select
            className={adminNativeSelectClassName}
            id={`${props.slot.id}-end`}
            value={props.slot.endMinutes}
            onChange={(event) => {
              props.onUpdate({
                ...props.slot,
                endMinutes: Number(event.currentTarget.value),
              });
            }}
          >
            {endOptions
              .filter((option) => option.minutes > props.slot.startMinutes)
              .map((option) => (
                <option key={option.labelKey} value={option.minutes}>
                  {formatPavilionReservationTimeLabel(option.minutes)}
                </option>
              ))}
          </select>
        </Field>
      </div>
      {invalid ? (
        <p className="mt-2 text-sm font-medium text-destructive">
          {t('error_slot_date')}
        </p>
      ) : null}
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
        <Link href="/reserve-pavilion">{t('action_start_over')}</Link>
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
    <div className="rounded-lg border border-mit-line bg-card p-6 md:p-8">
      <h1 className="font-mit-serif text-3xl font-semibold text-mit-text">
        {t('title')}
      </h1>
      <p className="mt-2 max-w-3xl text-mit-text">{t('intro')}</p>
      <div className="mt-6">
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

function PavilionReservationSpacesStep(props: {
  persona: PavilionReservationPersonaValue;
  requesterEmail: string;
  selectedSpaceIds: string[];
  setPersona: React.Dispatch<
    React.SetStateAction<PavilionReservationPersonaValue>
  >;
  setRequesterEmail: React.Dispatch<React.SetStateAction<string>>;
  setShowErrors: React.Dispatch<React.SetStateAction<boolean>>;
  setSlots: React.Dispatch<React.SetStateAction<ClientSlot[]>>;
  showErrors: boolean;
  slots: ClientSlot[];
  slotsRef: React.RefObject<HTMLDivElement | null>;
  spaces: PavilionReservableItemDto[];
}) {
  const t = useTranslations('PavilionReservationPage');

  return (
    <>
      <div className="rounded-lg border border-mit-line bg-card p-6 md:p-8">
        <h2 className="text-xl font-semibold text-mit-text">
          {t('basic_title')}
        </h2>
        <div className="mt-6 max-w-md">
          <Field id="requester-email" label={t('field_email')} required>
            <Input
              aria-invalid={
                props.showErrors && !props.requesterEmail.includes('@')
              }
              id="requester-email"
              placeholder={t('field_email_placeholder')}
              type="email"
              value={props.requesterEmail}
              onChange={(event) => {
                props.setRequesterEmail(event.currentTarget.value);
                props.setShowErrors(false);
              }}
            />
          </Field>
        </div>
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-mit-text">
            {t('persona_title')}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('persona_intro')}
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {personas.map((personaOption) => (
              <label
                className={cn(
                  'cursor-pointer rounded-lg border-2 p-4 transition-colors',
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
                <span className="mt-2 block pl-8 text-sm text-muted-foreground">
                  {t(`persona_${personaOption}_desc`)}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <section>
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <div className="flex gap-3">
            <Info aria-hidden className="mt-0.5 size-5 shrink-0" />
            <p>{t('how_it_works')}</p>
          </div>
        </div>
        <h2 className="mb-4 text-xl font-semibold text-mit-text">
          {t('spaces_title')}
        </h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {props.spaces.map((space) => {
            const selected = props.selectedSpaceIds.includes(space.id);
            const price = priceForPersona(space, props.persona);
            return (
              <article
                className={cn(
                  'overflow-hidden rounded-lg border bg-card transition-colors',
                  selected
                    ? 'border-mit-red ring-1 ring-mit-red'
                    : 'border-mit-line'
                )}
                key={space.id}
              >
                {space.imageUrl ? (
                  <div className="relative h-48 bg-mit-surface">
                    <Image
                      alt={space.name}
                      className="object-cover"
                      fill
                      sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                      src={space.imageUrl}
                    />
                  </div>
                ) : null}
                <div className="flex min-h-72 flex-col p-5">
                  <h3 className="font-semibold text-mit-text">{space.name}</h3>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">
                    {space.description}
                  </p>
                  <p className="mt-4 text-lg font-bold text-primary-ink">
                    {priceLabel({
                      amountCents: price,
                      pricingType: space.pricingType,
                      tbdLabel: t('price_tbd'),
                    })}
                  </p>
                  {space.minDurationHours ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('minimum_hours', {
                        count: space.minDurationHours,
                      })}
                    </p>
                  ) : null}
                  <Button
                    className="mt-4 w-full"
                    type="button"
                    variant={selected ? 'secondary' : 'mit'}
                    onClick={() => {
                      props.setShowErrors(false);
                      if (selected) {
                        props.setSlots((current) =>
                          current.filter((slot) => slot.itemId !== space.id)
                        );
                        return;
                      }
                      props.setSlots((current) => [
                        ...current,
                        newSlot(space.id),
                      ]);
                      window.requestAnimationFrame(() => {
                        props.slotsRef.current?.scrollIntoView({
                          block: 'start',
                          behavior: 'smooth',
                        });
                      });
                    }}
                  >
                    {selected ? (
                      <>
                        <Check aria-hidden className="size-4" />
                        {t('action_selected')}
                      </>
                    ) : (
                      t('action_select_space')
                    )}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {props.selectedSpaceIds.length > 0 ? (
        <section className="space-y-5" ref={props.slotsRef}>
          <div>
            <h2 className="text-xl font-semibold text-mit-text">
              {t('selected_slots_title')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('selected_slots_intro')}
            </p>
          </div>
          {props.selectedSpaceIds.map((spaceId) => {
            const space = itemById(props.spaces, spaceId);
            if (!space) {
              return null;
            }
            const spaceSlots = props.slots.filter(
              (slot) => slot.itemId === spaceId
            );
            return (
              <section
                className="rounded-lg border border-mit-line bg-card p-5 md:p-6"
                key={spaceId}
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-mit-line pb-3">
                  <h3 className="font-semibold text-mit-text">{space.name}</h3>
                  <Button
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      props.setSlots((current) =>
                        current.filter((slot) => slot.itemId !== spaceId)
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
                      key={slot.id}
                      showErrors={props.showErrors}
                      slot={slot}
                      title={t('slot_title', { number: index + 1 })}
                      onDuplicate={() => {
                        props.setSlots((current) => [
                          ...current,
                          { ...slot, id: crypto.randomUUID(), date: '' },
                        ]);
                      }}
                      onRemove={() => {
                        props.setSlots((current) =>
                          current.filter(
                            (candidate) => candidate.id !== slot.id
                          )
                        );
                      }}
                      onUpdate={(updated) => {
                        props.setShowErrors(false);
                        props.setSlots((current) =>
                          current.map((candidate) =>
                            candidate.id === updated.id ? updated : candidate
                          )
                        );
                      }}
                    />
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      props.setSlots((current) => [
                        ...current,
                        newSlot(spaceId),
                      ]);
                    }}
                  >
                    <Plus aria-hidden className="size-4" />
                    {t('action_add_slot')}
                  </Button>
                </div>
              </section>
            );
          })}
        </section>
      ) : null}
    </>
  );
}

function PavilionReservationContactStep(props: {
  contact: ContactFields;
  persona: PavilionReservationPersonaValue;
  selectedServiceIds: string[];
  services: PavilionReservableItemDto[];
  setContact: React.Dispatch<React.SetStateAction<ContactFields>>;
  setSelectedServiceIds: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const t = useTranslations('PavilionReservationPage');

  return (
    <section className="rounded-lg border border-mit-line bg-card p-6 md:p-8">
      <h2 className="text-xl font-semibold text-mit-text">
        {t('contact_title')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('contact_intro')}</p>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Field id="firstName" label={t('field_first_name')} required>
          <Input
            id="firstName"
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
            id="lastName"
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
            id="phone"
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
            id="eventName"
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
              id="description"
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
                    props.setContact({ ...props.contact, [option.key]: true });
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
        <section className="mt-6 rounded-lg border border-blue-200 bg-blue-50/70 p-5">
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
                  id="projectTitle"
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
                id="advisorName"
                value={props.contact.advisorName}
                onChange={(event) => {
                  props.setContact({
                    ...props.contact,
                    advisorName: event.currentTarget.value,
                  });
                }}
              />
            </Field>
            <Field id="advisorEmail" label={t('field_advisor_email')} required>
              <Input
                id="advisorEmail"
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
                  id="costCenter"
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

      {props.persona === 'mit_student' || props.persona === 'mit_community' ? (
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

      <section className="mt-8">
        <h3 className="text-lg font-semibold text-mit-text">
          {t('services_title')}
        </h3>
        <div className="mt-4 space-y-3">
          {props.services.map((service) => {
            const price = priceForPersona(service, props.persona);
            const selected = props.selectedServiceIds.includes(service.id);
            return (
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors md:items-center',
                  selected
                    ? 'border-mit-red bg-mit-red-highlight'
                    : 'border-mit-line'
                )}
                key={service.id}
              >
                <input
                  checked={selected}
                  className="mt-1 md:mt-0"
                  disabled={price === null}
                  type="checkbox"
                  onChange={() => {
                    props.setSelectedServiceIds((current) =>
                      selected
                        ? current.filter((id) => id !== service.id)
                        : [...current, service.id]
                    );
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-mit-text">
                    {service.name}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {price === null
                      ? t('service_unavailable')
                      : service.description}
                  </span>
                </span>
                <span className="font-semibold text-primary-ink">
                  {priceLabel({
                    amountCents: price,
                    pricingType: service.pricingType,
                    tbdLabel: t('price_tbd'),
                  })}
                </span>
              </label>
            );
          })}
        </div>
      </section>
    </section>
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
                          {slot.date} -{' '}
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
                        {slot.date}{' '}
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
  pending: boolean;
  selectedSpaceIds: string[];
  setShowErrors: React.Dispatch<React.SetStateAction<boolean>>;
  setStep: React.Dispatch<React.SetStateAction<WizardStep>>;
  slots: ClientSlot[];
  spacesStepValid: boolean;
  step: WizardStep;
}) {
  const t = useTranslations('PavilionReservationPage');

  return (
    <div className="sticky bottom-0 z-40 -mx-6 border-t border-mit-line bg-background/95 px-6 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {t('summary_label')}
          </p>
          <p className="font-semibold text-mit-text">
            {t('summary_spaces', {
              spaces: props.selectedSpaceIds.length,
              slots: props.slots.length,
            })}
          </p>
          <p className="text-primary-ink">
            {formatPavilionReservationMoney(props.estimate.totalCents)}
            {props.estimate.hasTbd ? ` ${t('plus_tbd')}` : ''}
          </p>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          {props.step === 'spaces' ? null : (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                props.setShowErrors(false);
                props.setStep(props.step === 'review' ? 'contact' : 'spaces');
              }}
            >
              {t('action_back')}
            </Button>
          )}
          {props.step === 'spaces' ? (
            <Button
              type="button"
              variant="mit"
              onClick={() => {
                if (!props.spacesStepValid) {
                  props.setShowErrors(true);
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
            <Button
              type="button"
              variant="mit"
              onClick={() => {
                if (!props.contactStepValid) {
                  props.setShowErrors(true);
                  return;
                }
                props.setShowErrors(false);
                props.setStep('review');
              }}
            >
              {t('action_next_review')}
            </Button>
          ) : null}
          {props.step === 'review' ? (
            <Button disabled={props.pending} type="submit" variant="mit">
              {props.pending ? t('pending_submitting') : t('action_submit')}
            </Button>
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
    props.initialState
  );
  const [step, setStep] = useState<WizardStep>('spaces');
  const [persona, setPersona] =
    useState<PavilionReservationPersonaValue>('mit_academic');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [slots, setSlots] = useState<ClientSlot[]>([]);
  const [contact, setContact] = useState<ContactFields>(initialContact);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const slotsRef = useRef<HTMLDivElement>(null);

  const spaces = props.items.filter((item) => item.kind === 'space');
  const services = props.items.filter((item) => item.kind === 'service');
  const selectedSpaceIds = [...new Set(slots.map((slot) => slot.itemId))];
  const estimate = sumEstimatedTotal({
    items: props.items,
    persona,
    selectedServiceIds,
    slots,
  });
  const spacesStepValid =
    requesterEmail.includes('@') &&
    slots.length > 0 &&
    slots.every((slot) => slot.date && slot.endMinutes > slot.startMinutes);
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

  if (actionState.status === 'confirmed' && actionState.referenceCode) {
    return (
      <PavilionReservationConfirmation
        referenceCode={actionState.referenceCode}
      />
    );
  }

  return (
    <form action={formAction} className="space-y-8">
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
          persona={persona}
          requesterEmail={requesterEmail}
          selectedSpaceIds={selectedSpaceIds}
          setPersona={setPersona}
          setRequesterEmail={setRequesterEmail}
          setShowErrors={setShowErrors}
          setSlots={setSlots}
          showErrors={showErrors}
          slots={slots}
          slotsRef={slotsRef}
          spaces={spaces}
        />
      ) : null}
      {step === 'contact' ? (
        <PavilionReservationContactStep
          contact={contact}
          persona={persona}
          selectedServiceIds={selectedServiceIds}
          services={services}
          setContact={setContact}
          setSelectedServiceIds={setSelectedServiceIds}
        />
      ) : null}
      {step === 'review' ? (
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
      ) : null}
      {showErrors ? (
        <p className="text-sm font-medium text-destructive">
          {step === 'spaces' ? t('error_spaces_step') : t('error_contact_step')}
        </p>
      ) : null}
      <PavilionReservationFooter
        contactStepValid={contactStepValid}
        estimate={estimate}
        pending={pending}
        selectedSpaceIds={selectedSpaceIds}
        setShowErrors={setShowErrors}
        setStep={setStep}
        slots={slots}
        spacesStepValid={Boolean(spacesStepValid)}
        step={step}
      />
    </form>
  );
}
