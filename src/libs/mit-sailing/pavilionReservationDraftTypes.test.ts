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
  it('returns spaces when contact fields are empty', () => {
    expect(pavilionReservationDraftWizardStepFromContact(emptyContact)).toBe(
      'spaces'
    );
  });

  it('returns contact when any contact field has progress', () => {
    expect(
      pavilionReservationDraftWizardStepFromContact({
        ...emptyContact,
        firstName: 'Alex',
      })
    ).toBe('contact');
    expect(
      pavilionReservationDraftWizardStepFromContact({
        ...emptyContact,
        phone: '617-555-0100',
      })
    ).toBe('contact');
    expect(
      pavilionReservationDraftWizardStepFromContact({
        ...emptyContact,
        advisorEmail: 'advisor@mit.edu',
      })
    ).toBe('contact');
  });
});
