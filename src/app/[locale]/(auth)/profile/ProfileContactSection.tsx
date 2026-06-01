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
import { updateProfileContactAction } from '@/libs/auth/profileContactActions';
import type { UpdateProfileContactResult } from '@/libs/auth/profileContactActions';

type ContactErrorMessageKey =
  | 'contact_emergency_incomplete'
  | 'contact_emergency_phone_invalid'
  | 'contact_phone_invalid'
  | 'contact_update_error';

function contactErrorMessageKey(
  error: Exclude<UpdateProfileContactResult, { ok: true }>['error']
): ContactErrorMessageKey {
  if (error === 'invalid_phone') {
    return 'contact_phone_invalid';
  }
  if (error === 'invalid_emergency_phone') {
    return 'contact_emergency_phone_invalid';
  }
  if (error === 'incomplete_emergency_contact') {
    return 'contact_emergency_incomplete';
  }
  return 'contact_update_error';
}

export function ProfileContactSection(props: {
  readonly emergencyContactName: string;
  readonly emergencyContactPhone: string;
  readonly locale: string;
  readonly onEmergencyContactNameChange: (value: string) => void;
  readonly onEmergencyContactPhoneChange: (value: string) => void;
  readonly onPhoneChange: (value: string) => void;
  readonly phone: string;
}) {
  const tCommon = useTranslations('Common');
  const t = useTranslations('UserProfilePage');
  const router = useRouter();
  const [banner, setBanner] = useState<ProfileBannerState>(null);
  const [pending, setPending] = useState(false);

  async function onUpdateContact(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(null);
    setPending(true);
    try {
      const result = await updateProfileContactAction(props.locale, {
        emergencyContactName: props.emergencyContactName,
        emergencyContactPhone: props.emergencyContactPhone,
        phone: props.phone,
      });
      if (!result.ok) {
        setBanner({
          kind: 'error',
          message: t(contactErrorMessageKey(result.error)),
        });
        return;
      }
      setBanner({ kind: 'success', message: t('contact_updated') });
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
      aria-labelledby="contact-heading"
      className="rounded-lg border border-mit-line bg-card p-6 shadow-sm"
      id="contact-section"
    >
      <h2 className="text-lg font-medium" id="contact-heading">
        {t('contact_heading')}
      </h2>
      <p className="mt-2 text-sm text-mit-text">{t('contact_description')}</p>
      <ProfileInlineBanner banner={banner} />
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(event) => {
          // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the form promise.
          void onUpdateContact(event);
        }}
      >
        <div className="flex flex-col gap-1.5">
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
            type="tel"
            value={props.emergencyContactPhone}
          />
        </div>
        <SubmitButton
          className="mt-2 w-fit"
          pending={pending}
          pendingLabel={tCommon('pending_saving')}
          variant="mit"
        >
          {t('contact_save')}
        </SubmitButton>
      </form>
    </section>
  );
}
