'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useState } from 'react';
import { ProfileInlineBanner } from '@/components/auth/profile/profileBanner';
import type { ProfileBannerState } from '@/components/auth/profile/profileBanner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { SubmitButton } from '@/components/ui/submit-button';
import type { SailingAffiliation } from '@/generated/prisma/enums';
import { updateProfileDetailsAction } from '@/libs/auth/profileIdentityActions';
import type { UpdateProfileDetailsResult } from '@/libs/auth/profileIdentityActions';
import { reportUnknownAuthClientError } from '@/libs/auth/reportAuthClientError';
import {
  getSailingAffiliationOptions,
  getSailingAffiliationRule,
} from '@/libs/mit-sailing/sailingAffiliations';

type ProfileDetailsErrorMessageKey =
  | 'contact_emergency_incomplete'
  | 'contact_emergency_phone_invalid'
  | 'contact_phone_invalid'
  | 'identity_affiliation_mismatch'
  | 'identity_affiliation_required'
  | 'identity_first_name_required'
  | 'identity_locked_error'
  | 'identity_last_name_required'
  | 'identity_mit_id_duplicate'
  | 'identity_mit_id_invalid'
  | 'identity_mit_id_required'
  | 'profile_details_update_error';

const profileDetailsErrorMessageKeys = {
  affiliation_mismatch: 'identity_affiliation_mismatch',
  affiliation_required: 'identity_affiliation_required',
  first_name_required: 'identity_first_name_required',
  incomplete_emergency_contact: 'contact_emergency_incomplete',
  identity_locked: 'identity_locked_error',
  invalid_emergency_phone: 'contact_emergency_phone_invalid',
  invalid_phone: 'contact_phone_invalid',
  last_name_required: 'identity_last_name_required',
  mit_id_duplicate: 'identity_mit_id_duplicate',
  mit_id_invalid: 'identity_mit_id_invalid',
  mit_id_required: 'identity_mit_id_required',
  unauthorized: 'profile_details_update_error',
} as const satisfies Record<
  Exclude<UpdateProfileDetailsResult, { ok: true }>['error'],
  ProfileDetailsErrorMessageKey
>;

function profileDetailsErrorMessageKey(
  error: Exclude<UpdateProfileDetailsResult, { ok: true }>['error']
): ProfileDetailsErrorMessageKey {
  return profileDetailsErrorMessageKeys[error];
}

export function affiliationLabelKey(affiliation: SailingAffiliation) {
  const keys = {
    MIT_STUDENT: 'affiliation_mit_student',
    MIT_FACULTY: 'affiliation_mit_faculty',
    MIT_STAFF: 'affiliation_mit_staff',
    MIT_ALUM: 'affiliation_mit_alum',
    MIT_FAMILY: 'affiliation_mit_family',
    MIT_AFFILIATE: 'affiliation_mit_affiliate',
    WELLESLEY: 'affiliation_wellesley',
    BRANDEIS: 'affiliation_brandeis',
    NORTHEASTERN: 'affiliation_northeastern',
    WINSOR: 'affiliation_winsor',
    BROOKS: 'affiliation_brooks',
    NROTC: 'affiliation_nrotc',
    OTHER_STUDENT: 'affiliation_other_student',
    OTHER_NON_STUDENT: 'affiliation_other_non_student',
    NON_MIT: 'affiliation_non_mit',
  } as const satisfies Record<SailingAffiliation, string>;

  return keys[affiliation];
}

function profileAffiliationFromValue(value: string): SailingAffiliation | '' {
  for (const option of getSailingAffiliationOptions()) {
    if (option.value === value) {
      return option.value;
    }
  }
  return '';
}

function mitIdHelpKey(props: {
  readonly locked: boolean;
  readonly optional: boolean;
  readonly required: boolean;
}):
  | 'mit_id_help_optional'
  | 'mit_id_help_required'
  | 'mit_id_locked_help'
  | null {
  if (props.locked) {
    return 'mit_id_locked_help';
  }
  if (props.required) {
    return 'mit_id_help_required';
  }
  if (props.optional) {
    return 'mit_id_help_optional';
  }
  return null;
}

export function ProfileMemberInformationSection(props: {
  readonly emergencyContactName: string;
  readonly emergencyContactPhone: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly locale: string;
  readonly mitClassYear: string | null;
  readonly mitId: string;
  readonly mitIdentityLocked: boolean;
  readonly onEmergencyContactNameChange: (value: string) => void;
  readonly onEmergencyContactPhoneChange: (value: string) => void;
  readonly onFirstNameChange: (value: string) => void;
  readonly onLastNameChange: (value: string) => void;
  readonly onMitClassYearChange: (value: string | null) => void;
  readonly onMitIdChange: (value: string) => void;
  readonly onMitIdentityLockedChange: (value: boolean) => void;
  readonly onPhoneChange: (value: string) => void;
  readonly onSailingAffiliationChange: (value: SailingAffiliation | '') => void;
  readonly phone: string;
  readonly sailingAffiliation: SailingAffiliation | '';
}) {
  const tCommon = useTranslations('Common');
  const t = useTranslations('UserProfilePage');
  const tOnboarding = useTranslations('OnboardingPage');
  const router = useRouter();
  const [banner, setBanner] = useState<ProfileBannerState>(null);
  const [pending, setPending] = useState(false);
  const affiliationRule =
    props.sailingAffiliation === ''
      ? null
      : getSailingAffiliationRule(props.sailingAffiliation);
  const showMitId =
    affiliationRule !== null && affiliationRule.mitIdMode !== 'hidden';
  const mitIdRequired = affiliationRule?.mitIdMode === 'required';
  const mitIdOptional = affiliationRule?.mitIdMode === 'optional';
  const showManualName =
    !props.mitIdentityLocked &&
    (affiliationRule === null ||
      affiliationRule.mitIdMode === 'hidden' ||
      (affiliationRule.mitIdMode === 'optional' && props.mitId.trim() === ''));
  const helpKey = mitIdHelpKey({
    locked: props.mitIdentityLocked,
    optional: mitIdOptional,
    required: mitIdRequired,
  });
  const mitIdHelpId = helpKey ? 'mitId-help' : undefined;

  async function onUpdateProfileDetails(
    event: React.SubmitEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setBanner(null);
    setPending(true);
    try {
      const result = await updateProfileDetailsAction(props.locale, {
        affiliation: props.sailingAffiliation,
        emergencyContactName: props.emergencyContactName,
        emergencyContactPhone: props.emergencyContactPhone,
        firstName: props.firstName,
        lastName: props.lastName,
        mitId: props.mitId,
        phone: props.phone,
      });
      if (!result.ok) {
        setBanner({
          kind: 'error',
          message: t(profileDetailsErrorMessageKey(result.error)),
        });
        return;
      }
      props.onFirstNameChange(result.identity.firstName);
      props.onLastNameChange(result.identity.lastName);
      props.onSailingAffiliationChange(result.identity.affiliation);
      props.onMitIdChange(result.identity.mitId ?? '');
      props.onMitClassYearChange(result.identity.mitClassYear);
      props.onMitIdentityLockedChange(result.identity.lockedByMitId);
      setBanner({ kind: 'success', message: t('profile_details_updated') });
      router.refresh();
    } catch (caughtError) {
      reportUnknownAuthClientError({
        action: 'profile.details-update.thrown',
        code: undefined,
        message:
          caughtError instanceof Error && caughtError.message.trim() !== ''
            ? caughtError.message.trim()
            : undefined,
      });
      setBanner({
        kind: 'error',
        message: t('error_request_failed'),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="profile-details-heading"
      className="rounded-lg border border-mit-line bg-card p-6 shadow-sm"
      id="profile-details-section"
    >
      <h2 className="text-lg font-medium" id="profile-details-heading">
        {t('profile_details_heading')}
      </h2>
      <p className="mt-2 text-sm text-mit-text">
        {props.mitIdentityLocked
          ? t('profile_details_locked_help')
          : t('profile_details_description')}
      </p>
      <ProfileInlineBanner banner={banner} />
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(event) => {
          // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the form promise.
          void onUpdateProfileDetails(event);
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label className="text-foreground" htmlFor="sailingAffiliation">
              {t('affiliation')}
            </Label>
            <NativeSelect
              disabled={props.mitIdentityLocked}
              id="sailingAffiliation"
              name="sailingAffiliation"
              onChange={(event) => {
                const value = profileAffiliationFromValue(
                  event.currentTarget.value
                );
                props.onMitIdChange(
                  value === '' ||
                    getSailingAffiliationRule(value).mitIdMode === 'hidden'
                    ? ''
                    : props.mitId
                );
                props.onSailingAffiliationChange(value);
              }}
              required
              value={props.sailingAffiliation}
            >
              <option value="">{t('affiliation_placeholder')}</option>
              {getSailingAffiliationOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {tOnboarding(affiliationLabelKey(option.value))}
                </option>
              ))}
            </NativeSelect>
          </div>

          {showMitId ? (
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label className="text-foreground" htmlFor="mitId">
                {t('mit_id')}
              </Label>
              <Input
                aria-describedby={mitIdHelpId}
                aria-required={mitIdRequired}
                autoComplete="off"
                disabled={props.mitIdentityLocked}
                id="mitId"
                inputMode="numeric"
                name="mitId"
                onChange={(event) => {
                  props.onMitIdChange(event.currentTarget.value);
                }}
                required={mitIdRequired}
                type="text"
                value={props.mitId}
              />
              {helpKey ? (
                <p
                  className="text-xs leading-5 text-muted-foreground"
                  id={mitIdHelpId}
                >
                  {t(helpKey)}
                </p>
              ) : null}
            </div>
          ) : null}

          {showManualName ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label className="text-foreground" htmlFor="firstName">
                  {t('first_name')}
                </Label>
                <Input
                  autoComplete="given-name"
                  id="firstName"
                  name="firstName"
                  onChange={(event) => {
                    props.onFirstNameChange(event.currentTarget.value);
                  }}
                  required
                  type="text"
                  value={props.firstName}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-foreground" htmlFor="lastName">
                  {t('last_name')}
                </Label>
                <Input
                  autoComplete="family-name"
                  id="lastName"
                  name="lastName"
                  onChange={(event) => {
                    props.onLastNameChange(event.currentTarget.value);
                  }}
                  required
                  type="text"
                  value={props.lastName}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label className="text-foreground" htmlFor="firstName">
                  {t('first_name')}
                </Label>
                <Input
                  disabled
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={props.firstName}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-foreground" htmlFor="lastName">
                  {t('last_name')}
                </Label>
                <Input
                  disabled
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={props.lastName}
                />
              </div>
            </>
          )}

          {props.mitClassYear ? (
            <div className="flex flex-col gap-1.5">
              <Label className="text-foreground" htmlFor="mitClassYear">
                {t('mit_class_year')}
              </Label>
              <Input
                disabled
                id="mitClassYear"
                name="mitClassYear"
                type="text"
                value={props.mitClassYear}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label className="text-foreground" htmlFor="phone">
              {t('phone')}
            </Label>
            <Input
              autoComplete="tel"
              id="phone"
              inputMode="tel"
              name="phone"
              onChange={(event) => {
                props.onPhoneChange(event.currentTarget.value);
              }}
              required
              type="tel"
              value={props.phone}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground" htmlFor="emergencyContactName">
              {t('emergency_contact_name')}
            </Label>
            <Input
              autoComplete="name"
              id="emergencyContactName"
              name="emergencyContactName"
              onChange={(event) => {
                props.onEmergencyContactNameChange(event.currentTarget.value);
              }}
              required
              type="text"
              value={props.emergencyContactName}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground" htmlFor="emergencyContactPhone">
              {t('emergency_contact_phone')}
            </Label>
            <Input
              autoComplete="tel"
              id="emergencyContactPhone"
              inputMode="tel"
              name="emergencyContactPhone"
              onChange={(event) => {
                props.onEmergencyContactPhoneChange(event.currentTarget.value);
              }}
              required
              type="tel"
              value={props.emergencyContactPhone}
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground md:col-span-2">
            {t('emergency_contact_help')}
          </p>
        </div>
        <SubmitButton
          className="mt-2 min-h-11 w-full sm:w-fit"
          pending={pending}
          pendingLabel={tCommon('pending_saving')}
          variant="mit"
        >
          {t('profile_details_save')}
        </SubmitButton>
      </form>
    </section>
  );
}
