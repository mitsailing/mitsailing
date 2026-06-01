'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ProfileAppearanceSection } from '@/components/auth/profile/ProfileAppearanceSection';
import type { SailingAffiliation } from '@/generated/prisma/enums';
import type { ThemePreferenceValue } from '@/lib/mit-sailing/themePreference';
import { formatPhoneForDisplay } from '@/utils/phoneValidation';
import { ProfileContactSection } from './ProfileContactSection';
import { ProfileEmailSection } from './ProfileEmailSection';
import {
  affiliationLabelKey,
  ProfileMemberInformationSection,
} from './ProfileMemberInformationSection';
import { ProfileOverview } from './ProfileOverview';
import {
  ProfileSailingCardSection,
  sailingCardStatusMessageKeys,
} from './ProfileSailingCardSection';
import type { ProfileSailingCardSummary } from './ProfileSailingCardSection';

type ProfileAccountClientProps = {
  initialEmail: string;
  initialEmailDeliverabilityStatus: 'ok' | 'bounced' | 'suppressed';
  initialEmergencyContactName: string;
  initialEmergencyContactPhone: string;
  initialFirstName: string;
  initialLastName: string;
  initialMitClassYear: string | null;
  initialMitId: string | null;
  initialMitIdentityLocked: boolean;
  initialName: string | null;
  initialPhone: string;
  initialSailingAffiliation: SailingAffiliation | null;
  initialSailingCardSummary: ProfileSailingCardSummary;
  initialThemePreference: ThemePreferenceValue;
  initialUnconfirmedEmail: string | null;
  locale: string;
};

function profileDisplayName(name: string, email: string) {
  const trimmed = name.trim();
  if (trimmed) {
    return trimmed;
  }
  const localPart = email.split('@')[0]?.trim();
  return localPart ?? email;
}

function profileNameFromParts(props: {
  readonly fallbackName: string | null;
  readonly firstName: string;
  readonly lastName: string;
}) {
  const name = `${props.firstName.trim()} ${props.lastName.trim()}`.trim();
  return name || (props.fallbackName?.trim() ?? '');
}

function profileInitials(name: string, email: string) {
  const source = name.trim() || (email.split('@')[0]?.trim() ?? email);
  const parts = source
    .split(/[\s._-]+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  const letters =
    parts.length >= 2
      ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`
      : (parts[0] ?? source).slice(0, 2);
  return letters.toUpperCase();
}

function profileEmailStatus(props: {
  readonly attentionLabel: string;
  readonly currentLabel: string;
  readonly deliverabilityStatus: 'bounced' | 'suppressed' | null;
  readonly pendingEmail: string | null;
  readonly pendingLabel: string;
}) {
  if (props.pendingEmail) {
    return props.pendingLabel;
  }
  if (props.deliverabilityStatus) {
    return props.attentionLabel;
  }
  return props.currentLabel;
}

export function ProfileAccountClient(props: ProfileAccountClientProps) {
  const t = useTranslations('UserProfilePage');
  const tOnboarding = useTranslations('OnboardingPage');
  const [firstName, setFirstName] = useState(props.initialFirstName);
  const [lastName, setLastName] = useState(props.initialLastName);
  const [sailingAffiliation, setSailingAffiliation] = useState<
    SailingAffiliation | ''
  >(props.initialSailingAffiliation ?? '');
  const [mitId, setMitId] = useState(props.initialMitId ?? '');
  const [mitClassYear, setMitClassYear] = useState(props.initialMitClassYear);
  const [mitIdentityLocked, setMitIdentityLocked] = useState(
    props.initialMitIdentityLocked
  );
  const [phone, setPhone] = useState(formatPhoneForDisplay(props.initialPhone));
  const [emergencyContactName, setEmergencyContactName] = useState(
    props.initialEmergencyContactName
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    formatPhoneForDisplay(props.initialEmergencyContactPhone)
  );
  const [currentEmail, setCurrentEmail] = useState(props.initialEmail);
  const [pendingEmail, setPendingEmail] = useState<string | null>(
    props.initialUnconfirmedEmail
  );
  const deliverabilityStatus =
    props.initialEmailDeliverabilityStatus === 'ok'
      ? null
      : props.initialEmailDeliverabilityStatus;
  const displayName = profileNameFromParts({
    fallbackName: props.initialName,
    firstName,
    lastName,
  });
  const emailStatus = profileEmailStatus({
    attentionLabel: t('profile_email_attention'),
    currentLabel: t('profile_email_current'),
    deliverabilityStatus,
    pendingEmail,
    pendingLabel: t('profile_email_pending'),
  });
  const hasEmergencyContact = emergencyContactName.trim() !== '';
  const hasCompleteContact =
    phone.trim() !== '' &&
    emergencyContactName.trim() !== '' &&
    emergencyContactPhone.trim() !== '';
  const currentAffiliationLabel =
    sailingAffiliation === ''
      ? t('profile_not_set')
      : tOnboarding(affiliationLabelKey(sailingAffiliation));
  const sailingCardStatus = t(
    sailingCardStatusMessageKeys[props.initialSailingCardSummary.status]
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 md:px-6">
      <ProfileOverview
        affiliationSummary={currentAffiliationLabel}
        contactLabel={t('profile_section_contact')}
        contactSummary={
          hasCompleteContact
            ? t('profile_contact_ready')
            : t('profile_contact_needs_attention')
        }
        currentEmail={currentEmail}
        emailLabel={t('profile_fact_email')}
        emailStatus={emailStatus}
        emergencyLabel={t('profile_fact_emergency')}
        emergencyMuted={!hasEmergencyContact}
        emergencySummary={emergencyContactName.trim() || t('profile_not_set')}
        initials={profileInitials(displayName, currentEmail)}
        memberLabel={t('profile_section_member')}
        note={t('profile_overview_note')}
        overline={t('profile_overline')}
        phoneLabel={t('profile_fact_phone')}
        phoneSummary={phone.trim() || t('profile_not_set')}
        sailingCardLabel={t('profile_sailing_card_heading')}
        sailingCardSummary={sailingCardStatus}
        sectionsLabel={t('profile_sections_label')}
        title={profileDisplayName(displayName, currentEmail)}
      />

      <ProfileSailingCardSection
        locale={props.locale}
        summary={props.initialSailingCardSummary}
      />

      <ProfileMemberInformationSection
        firstName={firstName}
        lastName={lastName}
        locale={props.locale}
        mitClassYear={mitClassYear}
        mitId={mitId}
        mitIdentityLocked={mitIdentityLocked}
        onFirstNameChange={setFirstName}
        onLastNameChange={setLastName}
        onMitClassYearChange={setMitClassYear}
        onMitIdChange={setMitId}
        onMitIdentityLockedChange={setMitIdentityLocked}
        onSailingAffiliationChange={setSailingAffiliation}
        sailingAffiliation={sailingAffiliation}
      />

      <ProfileContactSection
        emergencyContactName={emergencyContactName}
        emergencyContactPhone={emergencyContactPhone}
        locale={props.locale}
        onEmergencyContactNameChange={setEmergencyContactName}
        onEmergencyContactPhoneChange={setEmergencyContactPhone}
        onPhoneChange={setPhone}
        phone={phone}
      />

      <ProfileEmailSection
        currentEmail={currentEmail}
        deliverabilityStatus={deliverabilityStatus}
        onCurrentEmailChange={setCurrentEmail}
        onPendingEmailChange={setPendingEmail}
        pendingEmail={pendingEmail}
      />

      <ProfileAppearanceSection
        initialPreference={props.initialThemePreference}
      />
    </div>
  );
}
