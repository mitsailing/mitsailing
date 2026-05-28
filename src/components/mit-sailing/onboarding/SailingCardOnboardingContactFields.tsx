import { useTranslations } from 'next-intl';
import type { UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
  SailingCardOnboardingFormState,
  SailingCardOnboardingFormValues,
} from '@/libs/mit-sailing/sailingCardOnboardingActions';
import { FieldError } from './SailingCardOnboardingFieldError';
import { fieldErrorId } from './SailingCardOnboardingFormHelpers';

export function ContactFields(props: {
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const dateOfBirthError = props.state.fieldErrors.dateOfBirth;
  const phoneError = props.state.fieldErrors.phone;
  const dateOfBirthHelpId = 'sailing-card-onboarding-dateOfBirth-help';
  const phoneHelpId = 'sailing-card-onboarding-phone-help';

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <h2 className="text-base font-semibold text-foreground">
        {t('contact_details_heading')}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" htmlFor="dateOfBirth">
            {t('date_of_birth_label')}
          </Label>
          <Input
            aria-describedby={
              dateOfBirthError
                ? `${dateOfBirthHelpId} ${fieldErrorId('dateOfBirth')}`
                : dateOfBirthHelpId
            }
            aria-invalid={dateOfBirthError ? true : undefined}
            autoComplete="bday"
            id="dateOfBirth"
            inputMode="numeric"
            placeholder={t('date_of_birth_placeholder')}
            required
            type="text"
            {...props.register('dateOfBirth', { required: true })}
          />
          <p className="text-xs text-muted-foreground" id={dateOfBirthHelpId}>
            {t('date_of_birth_help')}
          </p>
          <FieldError field="dateOfBirth" state={props.state} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" htmlFor="phone">
            {t('phone_label')}
          </Label>
          <Input
            aria-describedby={
              phoneError
                ? `${phoneHelpId} ${fieldErrorId('phone')}`
                : phoneHelpId
            }
            aria-invalid={phoneError ? true : undefined}
            autoComplete="section-user tel"
            id="phone"
            required
            type="tel"
            {...props.register('phone', { required: true })}
          />
          <p className="text-xs text-muted-foreground" id={phoneHelpId}>
            {t('phone_help')}
          </p>
          <FieldError field="phone" state={props.state} />
        </div>
      </div>
    </section>
  );
}

export function EmergencyContactFields(props: {
  readonly register: UseFormRegister<SailingCardOnboardingFormValues>;
  readonly state: SailingCardOnboardingFormState;
}) {
  const t = useTranslations('OnboardingPage');
  const nameError = props.state.fieldErrors.emergencyContactName;
  const phoneError = props.state.fieldErrors.emergencyContactPhone;

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <h2 className="text-base font-semibold text-foreground">
        {t('emergency_contact_heading')}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" htmlFor="emergencyContactName">
            {t('emergency_contact_name_label')}
          </Label>
          <Input
            aria-describedby={
              nameError ? fieldErrorId('emergencyContactName') : undefined
            }
            aria-invalid={nameError ? true : undefined}
            autoComplete="section-emergency name"
            id="emergencyContactName"
            required
            type="text"
            {...props.register('emergencyContactName', { required: true })}
          />
          <FieldError field="emergencyContactName" state={props.state} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" htmlFor="emergencyContactPhone">
            {t('emergency_contact_phone_label')}
          </Label>
          <Input
            aria-describedby={
              phoneError ? fieldErrorId('emergencyContactPhone') : undefined
            }
            aria-invalid={phoneError ? true : undefined}
            autoComplete="section-emergency tel"
            id="emergencyContactPhone"
            required
            type="tel"
            {...props.register('emergencyContactPhone', { required: true })}
          />
          <FieldError field="emergencyContactPhone" state={props.state} />
        </div>
      </div>
    </section>
  );
}
