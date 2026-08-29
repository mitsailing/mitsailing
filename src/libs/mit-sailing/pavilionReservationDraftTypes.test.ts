import { describe, expect, it } from 'vitest';
import { pavilionReservationDraftWizardStepFromContact } from '@/libs/mit-sailing/pavilionReservationDraftTypes';

const emptyContact = {
  advisorEmail: null,
  advisorName: null,
  costCenter: null,
  description: '',
  eventName: '',
  firstName: '',
  groupName: null,
  lastName: '',
  mitAccount: null,
  mitId: null,
  phone: '',
  projectTitle: null,
};

describe('pavilionReservationDraftWizardStepFromContact', () => {
  it('returns request when contact fields are empty', () => {
    expect(pavilionReservationDraftWizardStepFromContact(emptyContact)).toBe(
      'request'
    );
  });

  it('returns review when any contact field has progress', () => {
    expect(
      pavilionReservationDraftWizardStepFromContact({
        ...emptyContact,
        firstName: 'Alex',
      })
    ).toBe('review');
    expect(
      pavilionReservationDraftWizardStepFromContact({
        ...emptyContact,
        phone: '617-555-0100',
      })
    ).toBe('review');
    expect(
      pavilionReservationDraftWizardStepFromContact({
        ...emptyContact,
        advisorEmail: 'advisor@mit.edu',
      })
    ).toBe('review');
  });
});
