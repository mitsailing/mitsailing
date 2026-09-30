'use client';

import { Description, Field, Label as HeadlessLabel } from '@headlessui/react';
import { useTranslations } from 'next-intl';
import type * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { PAVILION_RESERVATION_PERSONAS } from '@/libs/mit-sailing/pavilionReservationPersonas';
import {
  formatPavilionReservationMoney,
  priceForPersona,
} from '@/libs/mit-sailing/pavilionReservationPricing';
import type {
  PavilionReservableItemDto,
  PavilionReservationPersonaValue,
} from '@/libs/mit-sailing/pavilionReservationTypes';
import { ariaInvalidWhenShown } from '@/utils/ariaInvalidWhenShown';
import { isValidEmailAddress } from '@/utils/emailValidation';

export function PavilionReservationIdentityStep(props: {
  emailRef: React.RefObject<HTMLInputElement | null>;
  onContinue: () => void;
  persona: PavilionReservationPersonaValue | null;
  requesterEmail: string;
  setPersona: (persona: PavilionReservationPersonaValue) => void;
  setRequesterEmail: React.Dispatch<React.SetStateAction<string>>;
  showErrors: boolean;
  sampleHourlyCents: number | null;
}) {
  const t = useTranslations('PavilionReservationPage');
  const emailValid = isValidEmailAddress(props.requesterEmail);
  const canContinue = emailValid && props.persona !== null;

  return (
    <section className="rounded-lg border border-mit-line bg-card p-5 md:p-8">
      <h2 className="sr-only">{t('step_identity')}</h2>
      <Field className="flex w-full max-w-md flex-col gap-1.5">
        <HeadlessLabel
          className={cn(
            'text-sm leading-none font-medium',
            ariaInvalidWhenShown({
              shown: props.showErrors,
              invalid: !emailValid,
            })
              ? 'text-mit-red-600'
              : 'text-foreground'
          )}
          htmlFor="requester-email"
        >
          {t('field_email')}
          <span aria-hidden>*</span>
        </HeadlessLabel>
        <Input
          aria-describedby="requester-email-helper"
          aria-invalid={ariaInvalidWhenShown({
            shown: props.showErrors,
            invalid: !emailValid,
          })}
          aria-required
          autoComplete="email"
          id="requester-email"
          placeholder={t('field_email_placeholder')}
          ref={props.emailRef}
          required
          type="email"
          value={props.requesterEmail}
          onChange={(event) => {
            props.setRequesterEmail(event.currentTarget.value);
          }}
        />
        <Description
          className="text-xs text-muted-foreground"
          id="requester-email-helper"
        >
          {t('field_email_helper_save')}
        </Description>
      </Field>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-mit-text">
          {t('persona_title')}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('persona_intro')}
        </p>
        <fieldset
          aria-label={t('persona_title')}
          className="mt-3 grid gap-2 border-0 p-0 sm:grid-cols-2"
        >
          <legend className="sr-only">{t('persona_title')}</legend>
          {PAVILION_RESERVATION_PERSONAS.map((personaOption) => {
            const selected = props.persona === personaOption;
            return (
              <button
                aria-pressed={selected}
                className={cn(
                  'rounded-[10px] border p-3 text-left transition-colors',
                  selected
                    ? 'border-mit-red bg-mit-red-highlight'
                    : 'border-mit-line bg-background hover:border-mit-red/40'
                )}
                key={personaOption}
                type="button"
                onClick={() => {
                  props.setPersona(personaOption);
                }}
              >
                <span className="block font-semibold text-mit-text">
                  {t(`persona_${personaOption}_label`)}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {t(`persona_${personaOption}_desc`)}
                </span>
              </button>
            );
          })}
        </fieldset>
        {props.persona && props.sampleHourlyCents !== null ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t('persona_rate_sample', {
              persona: t(`persona_${props.persona}_label`),
              rate: formatPavilionReservationMoney(props.sampleHourlyCents),
            })}
          </p>
        ) : null}
      </div>

      <div className="mt-6">
        <Button
          disabled={!canContinue}
          type="button"
          variant="mit"
          onClick={props.onContinue}
        >
          {t('action_continue_request')}
        </Button>
      </div>
    </section>
  );
}

export function sampleHourlyFromItems(props: {
  items: PavilionReservableItemDto[];
  persona: PavilionReservationPersonaValue;
}) {
  const dock = props.items.find((item) => item.slug === 'casual_dock');
  const roof = props.items.find((item) => item.slug === 'roof_deck');
  const dockCents = dock ? priceForPersona(dock, props.persona) : null;
  if (dockCents !== null) {
    return dockCents;
  }
  return roof ? priceForPersona(roof, props.persona) : null;
}
