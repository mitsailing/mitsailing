'use client';

import { useState } from 'react';
import { ProfileAppearanceSection } from '@/components/auth/profile/ProfileAppearanceSection';
import type { SailingAffiliation } from '@/generated/prisma/enums';
import type { ThemePreferenceValue } from '@/lib/mit-sailing/themePreference';
import { formatPhoneForDisplay } from '@/utils/phoneValidation';
import { ProfileEmailSection } from './ProfileEmailSection';
import { ProfileMemberInformationSection } from './ProfileMemberInformationSection';
import { ProfileSailingCardSection } from './ProfileSailingCardSection';
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
  initialPhone: string;
  initialSailingAffiliation: SailingAffiliation | null;
  initialSailingCardSummary: ProfileSailingCardSummary;
  initialThemePreference: ThemePreferenceValue;
  initialUnconfirmedEmail: string | null;
  locale: string;
};

export function ProfileAccountClient(props: ProfileAccountClientProps) {
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

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 md:px-6">
      <ProfileMemberInformationSection
        emergencyContactName={emergencyContactName}
        emergencyContactPhone={emergencyContactPhone}
        firstName={firstName}
        lastName={lastName}
        locale={props.locale}
        mitClassYear={mitClassYear}
        mitId={mitId}
        mitIdentityLocked={mitIdentityLocked}
        onEmergencyContactNameChange={setEmergencyContactName}
        onEmergencyContactPhoneChange={setEmergencyContactPhone}
        onFirstNameChange={setFirstName}
        onLastNameChange={setLastName}
        onMitClassYearChange={setMitClassYear}
        onMitIdChange={setMitId}
        onMitIdentityLockedChange={setMitIdentityLocked}
        onPhoneChange={setPhone}
        onSailingAffiliationChange={setSailingAffiliation}
        phone={phone}
        sailingAffiliation={sailingAffiliation}
      />

      <ProfileSailingCardSection
        locale={props.locale}
        summary={props.initialSailingCardSummary}
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
