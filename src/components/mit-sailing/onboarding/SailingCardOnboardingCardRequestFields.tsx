'use client';

import { useTranslations } from 'next-intl';
import type * as React from 'react';
import type { UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { SailingCardType } from '@/generated/prisma/enums';
import type { SailingAffiliation } from '@/generated/prisma/enums';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';
import {
  needsFitnessMembershipQuestion,
  sailingCardMembershipPriceCents,
} from '@/libs/mit-sailing/sailingCardMembership';
import type {
  SailingCardOnboardingFormState,
  SailingCardOnboardingFormValues,
} from '@/libs/mit-sailing/sailingCardOnboardingActions';
import { FieldError } from './SailingCardOnboardingFieldError';
import { fieldErrorId } from './SailingCardOnboardingFormHelpers';

const usdFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

const radioCardClassName =
  'flex min-h-16 cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 text-sm transition-colors hover:border-mit-red/40 hover:bg-mit-red-highlight/40 has-checked:border-mit-red has-checked:bg-mit-red-highlight/60 has-aria-invalid:border-destructive has-aria-invalid:bg-destructive/5 has-disabled:cursor-not-allowed has-disabled:opacity-60';

const radioInputClassName = 'mt-0.5 size-4 shrink-0 accent-mit-red';

const fitnessMembershipLinkClassName =
  'font-medium text-mit-red underline underline-offset-2 hover:text-mit-red/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mit-red dark:text-mit-red-ink';

const renderFitnessMembershipLink = (chunks: React.ReactNode) => (
  <Link
    className={fitnessMembershipLinkClassName}
    href="https://www.mitrecsports.com/join/memberships/"
    key="membership"
  >
    {chunks}
  </Link>
);

const fitnessMembershipSignupNoteRichText = {
  membership: renderFitnessMembershipLink,
};

const cardTypeLabelKey = (cardType: SailingCardType) => {
  const keys = {
    [SailingCardType.normal]: 'card_type_normal',
    [SailingCardType.racing]: 'card_type_racing',
    [SailingCardType.team_racing]: 'card_type_team_racing',
  } as const satisfies Record<SailingCardType, string>;

  return keys[cardType];
};

const cardTypeDescriptionKey = (cardType: SailingCardType) => {
  const keys = {
    [SailingCardType.normal]: 'card_type_normal_description',
    [SailingCardType.racing]: 'card_type_racing_description',
    [SailingCardType.team_racing]: 'card_type_team_racing_description',
  } as const satisfies Record<SailingCardType, string>;

  return keys[cardType];
};

const formatMembershipPrice = (value: number | null) =>
  value === null ? null : usdFormatter.format(value / 100);

const membershipPriceLabelKey = (props: {
  readonly priceCents: number | null;
}) => {
  if (props.priceCents === 0) {
    return 'card_type_price_included';
  }
  if (props.priceCents === null) {
    return 'card_type_price_needs_dob';
  }
  return 'card_type_price';
};

const selectedCardTypeValue = (value: string | undefined) =>
  value === '' ? SailingCardType.normal : (value ?? SailingCardType.normal);

function FitnessMembershipOption(props: {
  readonly id: string;
  readonly label: string;
  readonly onBlur: React.FocusEventHandler<HTMLInputElement>;
  readonly onChange: React.ChangeEventHandler<HTMLInputElement>;
  readonly ref: React.Ref<HTMLInputElement>;
  readonly registrationName: string;
  readonly value: string;
}) {
  return (
    <label
      aria-label={props.label}
      className={radioCardClassName}
      htmlFor={props.id}
    >
      <input
        className={radioInputClassName}
        id={props.id}
        name={props.registrationName}
        onBlur={props.onBlur}
        onChange={props.onChange}
        ref={props.ref}
        required
        type="radio"
        value={props.value}
      />
      <span className="flex min-w-0 flex-col gap-1 leading-normal">
        <span className="font-medium text-foreground">{props.label}</span>
      </span>
    </label>
  );
}

function FitnessMembershipQuestion(props: {
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly setValue: UseFormSetValue<SailingCardOnboardingFormValues>;
}) {
  const t = useTranslations('OnboardingPage');
  const helpId = 'sailing-card-onboarding-hasFitnessMembership-help';
  const signupNoteId = 'sailing-card-onboarding-fitness-signup-note';
  const registration = props.register('hasFitnessMembership', {
    required: true,
  });
  const handleFitnessMembershipBlur = registration.onBlur;
  const handleFitnessMembershipChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    await registration.onChange(event);
    props.setValue('cardType', SailingCardType.normal);
  };

  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={`${helpId} ${signupNoteId}`}
    >
      <legend className="font-medium text-foreground">
        {t('fitness_membership_label')}
      </legend>
      <p className="text-xs leading-5 text-muted-foreground" id={helpId}>
        {t('fitness_membership_help')}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <FitnessMembershipOption
          id="hasFitnessMembershipYes"
          label={t('fitness_membership_yes')}
          onBlur={handleFitnessMembershipBlur}
          onChange={handleFitnessMembershipChange}
          ref={registration.ref}
          registrationName={registration.name}
          value="yes"
        />
        <FitnessMembershipOption
          id="hasFitnessMembershipNo"
          label={t('fitness_membership_no')}
          onBlur={handleFitnessMembershipBlur}
          onChange={handleFitnessMembershipChange}
          ref={registration.ref}
          registrationName={registration.name}
          value="no"
        />
      </div>
      <p className="text-xs leading-5 text-muted-foreground" id={signupNoteId}>
        {t.rich(
          'fitness_membership_signup_note',
          fitnessMembershipSignupNoteRichText
        )}
      </p>
    </fieldset>
  );
}

function CardTypePriceBadge(props: {
  readonly price: string | null;
  readonly priceCents: number | null;
}) {
  const t = useTranslations('OnboardingPage');
  const priceLabelKey = membershipPriceLabelKey({
    priceCents: props.priceCents,
  });
  const priceLabel =
    priceLabelKey === 'card_type_price' && props.price !== null
      ? t(priceLabelKey, { price: props.price })
      : t(priceLabelKey);

  return (
    <span
      className={cn(
        'rounded-md px-2 py-0.5 text-xs font-semibold',
        'bg-mit-red-highlight text-mit-red dark:text-mit-red-ink'
      )}
    >
      {priceLabel}
    </span>
  );
}

function CardTypeDescription(props: {
  readonly cardType: SailingCardType;
  readonly price: string | null;
}) {
  const t = useTranslations('OnboardingPage');

  if (props.cardType === SailingCardType.racing) {
    return (
      <span className="text-xs leading-5 text-muted-foreground">
        {props.price === null
          ? t('card_type_racing_description_needs_dob')
          : t('card_type_racing_description', { price: props.price })}
      </span>
    );
  }

  return (
    <span className="text-xs leading-5 text-muted-foreground">
      {t(cardTypeDescriptionKey(props.cardType))}
    </span>
  );
}

function CardTypeRadio(props: {
  readonly affiliation: SailingAffiliation | '';
  readonly cardType: SailingCardType;
  readonly cardTypeValue: string | undefined;
  readonly dateOfBirthValue: string | undefined;
  readonly now: Date;
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
}) {
  const t = useTranslations('OnboardingPage');
  const priceCents = sailingCardMembershipPriceCents({
    affiliation: props.affiliation,
    cardType: props.cardType,
    dateOfBirth: props.dateOfBirthValue,
    now: props.now,
  });
  const price = formatMembershipPrice(priceCents);

  return (
    <label className={radioCardClassName}>
      <input
        {...props.register('cardType', { required: true })}
        className={radioInputClassName}
        defaultChecked={
          selectedCardTypeValue(props.cardTypeValue) === props.cardType
        }
        required
        type="radio"
        value={props.cardType}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="font-medium text-foreground">
            {t(cardTypeLabelKey(props.cardType))}
          </span>
          <CardTypePriceBadge price={price} priceCents={priceCents} />
        </span>
        <CardTypeDescription cardType={props.cardType} price={price} />
      </span>
    </label>
  );
}

function CardTypeSelect(props: {
  readonly affiliation: SailingAffiliation | '';
  readonly cardTypeValue: string | undefined;
  readonly dateOfBirthValue: string | undefined;
  readonly fitnessMembershipReady: boolean;
  readonly now: Date;
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const cardTypeError = props.state.fieldErrors.cardType;
  const cardTypes = [
    SailingCardType.normal,
    SailingCardType.racing,
    SailingCardType.team_racing,
  ];

  return (
    <fieldset
      aria-describedby={cardTypeError ? fieldErrorId('cardType') : undefined}
      aria-invalid={cardTypeError ? true : undefined}
      className="flex flex-col gap-2"
    >
      <legend className="font-medium text-foreground">
        {t('card_type_label')}
      </legend>
      {props.fitnessMembershipReady ? (
        <div className="grid gap-2">
          {cardTypes.map((cardType) => (
            <CardTypeRadio
              affiliation={props.affiliation}
              cardType={cardType}
              cardTypeValue={props.cardTypeValue}
              dateOfBirthValue={props.dateOfBirthValue}
              key={cardType}
              now={props.now}
              register={props.register}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">
          {t('card_type_waiting_for_fitness')}
        </p>
      )}
      <FieldError field="cardType" state={props.state} />
    </fieldset>
  );
}

export function CardRequestSection(props: {
  readonly affiliation: SailingAffiliation | '';
  readonly cardTypeValue: string | undefined;
  readonly dateOfBirthValue: string | undefined;
  readonly fitnessMembershipReady: boolean;
  readonly now: Date;
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly setValue: UseFormSetValue<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <h2 className="text-base font-semibold text-foreground">
        {t('card_request_heading')}
      </h2>
      {needsFitnessMembershipQuestion(props.affiliation) ? (
        <FitnessMembershipQuestion
          register={props.register}
          setValue={props.setValue}
        />
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">
          {t('fitness_membership_auto_mit_student')}
        </p>
      )}
      <CardTypeSelect
        affiliation={props.affiliation}
        cardTypeValue={props.cardTypeValue}
        dateOfBirthValue={props.dateOfBirthValue}
        fitnessMembershipReady={props.fitnessMembershipReady}
        now={props.now}
        register={props.register}
        state={props.state}
      />
    </section>
  );
}
