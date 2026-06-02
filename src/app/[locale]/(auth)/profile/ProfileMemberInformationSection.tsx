'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useState } from 'react';
import { ProfileInlineBanner } from '@/components/auth/profile/profileBanner';
import type { ProfileBannerState } from '@/components/auth/profile/profileBanner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import type { SailingAffiliation } from '@/generated/prisma/enums';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import { updateProfileIdentityAction } from '@/libs/auth/profileIdentityActions';
import type { UpdateProfileIdentityResult } from '@/libs/auth/profileIdentityActions';
import {
  getSailingAffiliationOptions,
  getSailingAffiliationRule,
} from '@/libs/mit-sailing/sailingAffiliations';

type IdentityErrorMessageKey =
  | 'identity_affiliation_mismatch'
  | 'identity_affiliation_required'
  | 'identity_first_name_required'
  | 'identity_locked_error'
  | 'identity_last_name_required'
  | 'identity_mit_id_duplicate'
  | 'identity_mit_id_invalid'
  | 'identity_mit_id_required'
  | 'identity_update_error';

const identityErrorMessageKeys = {
  affiliation_mismatch: 'identity_affiliation_mismatch',
  affiliation_required: 'identity_affiliation_required',
  first_name_required: 'identity_first_name_required',
  identity_locked: 'identity_locked_error',
  last_name_required: 'identity_last_name_required',
  mit_id_duplicate: 'identity_mit_id_duplicate',
  mit_id_invalid: 'identity_mit_id_invalid',
  mit_id_required: 'identity_mit_id_required',
  unauthorized: 'identity_update_error',
} as const satisfies Record<
  Exclude<UpdateProfileIdentityResult, { ok: true }>['error'],
  IdentityErrorMessageKey
>;

function identityErrorMessageKey(
  error: Exclude<UpdateProfileIdentityResult, { ok: true }>['error']
): IdentityErrorMessageKey {
  return identityErrorMessageKeys[error];
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
  readonly firstName: string;
  readonly lastName: string;
  readonly locale: string;
  readonly mitClassYear: string | null;
  readonly mitId: string;
  readonly mitIdentityLocked: boolean;
  readonly onFirstNameChange: (value: string) => void;
  readonly onLastNameChange: (value: string) => void;
  readonly onMitClassYearChange: (value: string | null) => void;
  readonly onMitIdChange: (value: string) => void;
  readonly onMitIdentityLockedChange: (value: boolean) => void;
  readonly onSailingAffiliationChange: (value: SailingAffiliation | '') => void;
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

  async function onUpdateIdentity(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(null);
    setPending(true);
    try {
      const result = await updateProfileIdentityAction(props.locale, {
        affiliation: props.sailingAffiliation,
        firstName: props.firstName,
        lastName: props.lastName,
        mitId: props.mitId,
      });
      if (!result.ok) {
        setBanner({
          kind: 'error',
          message: t(identityErrorMessageKey(result.error)),
        });
        return;
      }
      props.onFirstNameChange(result.identity.firstName);
      props.onLastNameChange(result.identity.lastName);
      props.onSailingAffiliationChange(result.identity.affiliation);
      props.onMitIdChange(result.identity.mitId ?? '');
      props.onMitClassYearChange(result.identity.mitClassYear);
      props.onMitIdentityLockedChange(result.identity.lockedByMitId);
      setBanner({ kind: 'success', message: t('identity_updated') });
      router.refresh();
    } catch {
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
      aria-labelledby="member-information-heading"
      className="rounded-lg border border-mit-line bg-card p-6 shadow-sm"
      id="member-information-section"
    >
      <h2 className="text-lg font-medium" id="member-information-heading">
        {t('identity_heading')}
      </h2>
      <p className="mt-2 text-sm text-mit-text">
        {props.mitIdentityLocked
          ? t('identity_locked_help')
          : t('identity_description')}
      </p>
      <ProfileInlineBanner banner={banner} />
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(event) => {
          // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the form promise.
          void onUpdateIdentity(event);
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label className="text-foreground" htmlFor="sailingAffiliation">
              {t('affiliation')}
            </Label>
            <select
              className={adminNativeSelectClassName}
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
            </select>
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
        </div>
        <SubmitButton
          className="mt-2 w-fit"
          disabled={props.mitIdentityLocked}
          pending={pending}
          pendingLabel={tCommon('pending_saving')}
          variant="mit"
        >
          {t('identity_save')}
        </SubmitButton>
      </form>
    </section>
  );
}
