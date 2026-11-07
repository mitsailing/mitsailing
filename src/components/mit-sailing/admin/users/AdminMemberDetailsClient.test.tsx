import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SailingAffiliation } from '@/generated/prisma/enums';
import { Role } from '@/libs/auth/roles';
import { AdminMemberDetailsClient } from './AdminMemberDetailsClient';

vi.mock('@/libs/admin/users/adminMemberDetailsActions', () => ({
  updateAdminMemberDetailsAction: vi.fn(),
}));

vi.mock('@/libs/auth/profileIdentityActions', () => ({
  updateProfileDetailsAction: vi.fn(),
}));

describe('AdminMemberDetailsClient', () => {
  it('translates the role badge and affiliation options', () => {
    render(
      <AdminMemberDetailsClient
        description="Update affiliation, contact, and emergency information."
        emailVerifiedLabel="Email verified"
        heading="Member information"
        identitySourceLabel="Manual"
        initialEmergencyContactName="Pat"
        initialEmergencyContactPhone=""
        initialFirstName="Sailor"
        initialLastName="One"
        initialMitClassYear={null}
        initialMitId={null}
        initialMitIdentityLocked={false}
        initialPhone=""
        initialSailingAffiliation={SailingAffiliation.OTHER_NON_STUDENT}
        locale="en"
        roleLabel={Role.DOCK_STAFF}
        userId="user-1"
      />
    );

    expect(screen.getByText('Dock staff')).toBeInTheDocument();
    expect(screen.queryByText('dock_staff')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Affiliation')).toHaveDisplayValue(
      'Other non-student'
    );
  });
});
