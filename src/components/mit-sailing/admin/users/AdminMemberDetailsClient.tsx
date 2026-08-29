'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ProfileMemberInformationSection } from '@/app/[locale]/(auth)/profile/ProfileMemberInformationSection';
import { Badge } from '@/components/ui/badge';
import type { SailingAffiliation } from '@/generated/prisma/enums';
import { updateAdminMemberDetailsAction } from '@/libs/admin/users/adminMemberDetailsActions';
import { formatPhoneForDisplay } from '@/utils/phoneValidation';

type AdminMemberDetailsClientProps = {
  readonly description: string;
  readonly emailVerifiedLabel: string;
  readonly heading: string;
  readonly identitySourceLabel: string;
  readonly initialEmergencyContactName: string;
  readonly initialEmergencyContactPhone: string;
  readonly initialFirstName: string;
  readonly initialLastName: string;
  readonly initialMitClassYear: string | null;
  readonly initialMitId: string | null;
  readonly initialMitIdentityLocked: boolean;
  readonly initialPhone: string;
  readonly initialSailingAffiliation: SailingAffiliation | null;
  readonly locale: string;
  readonly roleLabel: string;
  readonly userId: string;
};

/**
 * Editable member profile form for the admin account tab.
 *
 * @param props - Initial member values and section copy
 * @returns Member details editor
 */
export function AdminMemberDetailsClient(props: AdminMemberDetailsClientProps) {
  const t = useTranslations('AdminUsers');
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

  return (
    <div className="flex flex-col gap-3">
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
        onSaveDetails={async (locale, input) => {
          const result = await updateAdminMemberDetailsAction(
            locale,
            props.userId,
            input
          );
          return result;
        }}
        onSailingAffiliationChange={setSailingAffiliation}
        phone={phone}
        sailingAffiliation={sailingAffiliation}
        saveButtonKey="member_details_save"
        sectionDescription={props.description}
        sectionHeading={props.heading}
        sectionId="admin-member-details"
        successMessageKey="member_details_saved"
        translationNamespace="AdminUsers"
      />
      <ul
        aria-label={t('member_metadata_aria_label')}
        className="m-0 flex list-none flex-wrap items-center gap-2 px-1"
      >
        <li>
          <Badge className="font-normal" variant="secondary">
            {props.roleLabel}
          </Badge>
        </li>
        <li>
          <Badge className="font-normal" variant="outline">
            {props.identitySourceLabel}
          </Badge>
        </li>
        <li>
          <Badge className="font-normal" variant="outline">
            {props.emailVerifiedLabel}
          </Badge>
        </li>
      </ul>
    </div>
  );
}
