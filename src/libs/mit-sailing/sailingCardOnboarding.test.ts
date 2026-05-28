import { describe, expect, it } from 'vitest';
import {
  MitDataWarehousePersonType,
  SailingAffiliation,
  SailingCardType,
} from '@/generated/prisma/enums';
import {
  SailingCardOnboardingValidationError,
  buildSailingCardOnboardingUpdate,
} from '@/libs/mit-sailing/sailingCardOnboarding';

const studentIdentity = {
  mitId: '123456789',
  firstName: 'Ada',
  lastName: 'Lovelace',
  kerberos: 'ada',
  classYear: '2027',
  personType: MitDataWarehousePersonType.CURRENT_STUDENT,
};

const staffIdentity = {
  ...studentIdentity,
  classYear: null,
  personType: MitDataWarehousePersonType.CURRENT_STAFF,
};

const otherIdentity = {
  ...studentIdentity,
  classYear: null,
  personType: MitDataWarehousePersonType.OTHER,
};

const contactInput = {
  cardType: SailingCardType.normal,
  dateOfBirth: '2000-01-02',
  emergencyContactName: 'Grace Hopper',
  emergencyContactPhone: '+44 20 7946 0958',
  phone: '(617) 555-0100',
  swimAgreementAccepted: true,
};

function expectValidationError(
  runValidation: () => void,
  fieldErrors: Record<string, string>
) {
  try {
    runValidation();
  } catch (error) {
    expect(error).toBeInstanceOf(SailingCardOnboardingValidationError);
    expect(error).toMatchObject({ fieldErrors });
    return;
  }
  throw new Error('Expected validation error.');
}

describe('sailingCardOnboarding', () => {
  it('requires mit id and matching dw identity for current mit people', () => {
    expect(
      buildSailingCardOnboardingUpdate({
        input: {
          ...contactInput,
          affiliation: SailingAffiliation.MIT_STUDENT,
          mitId: '123456789',
          firstName: '',
          lastName: '',
        },
        dataWarehouseIdentity: studentIdentity,
        now: new Date('2026-05-21T12:00:00-04:00'),
      })
    ).toEqual({
      cardType: SailingCardType.normal,
      dateOfBirth: new Date('2000-01-02T00:00:00.000Z'),
      firstName: 'Ada',
      lastName: 'Lovelace',
      name: 'Ada Lovelace',
      phone: '+16175550100',
      emergencyContactName: 'Grace Hopper',
      emergencyContactPhone: '+442079460958',
      sailingAffiliation: SailingAffiliation.MIT_STUDENT,
      mitId: '123456789',
      mitClassYear: '2027',
      mitDataWarehouseVerifiedAt: new Date('2026-05-21T16:00:00.000Z'),
      sailingCardRequestedAt: new Date('2026-05-21T16:00:00.000Z'),
    });
  });

  it('rejects current mit people without dw identity', () => {
    expectValidationError(
      () => {
        buildSailingCardOnboardingUpdate({
          input: {
            ...contactInput,
            affiliation: SailingAffiliation.MIT_STUDENT,
            mitId: '123456789',
            firstName: '',
            lastName: '',
          },
          dataWarehouseIdentity: null,
          now: new Date('2026-05-21T12:00:00-04:00'),
        });
      },
      { mitId: 'required_dw_identity' }
    );
  });

  it('rejects mit student when dw identity is not a current student', () => {
    expectValidationError(
      () => {
        buildSailingCardOnboardingUpdate({
          input: {
            ...contactInput,
            affiliation: SailingAffiliation.MIT_STUDENT,
            mitId: '123456789',
            firstName: '',
            lastName: '',
          },
          dataWarehouseIdentity: otherIdentity,
          now: new Date('2026-05-21T12:00:00-04:00'),
        });
      },
      { mitId: 'affiliation_mismatch' }
    );
  });

  it('accepts current staff identity for mit staff and faculty', () => {
    expect(
      buildSailingCardOnboardingUpdate({
        input: {
          ...contactInput,
          affiliation: SailingAffiliation.MIT_FACULTY,
          mitId: '123456789',
          firstName: '',
          lastName: '',
        },
        dataWarehouseIdentity: staffIdentity,
        now: new Date('2026-05-21T12:00:00-04:00'),
      })
    ).toMatchObject({
      mitClassYear: null,
      mitId: '123456789',
      sailingAffiliation: SailingAffiliation.MIT_FACULTY,
    });
  });

  it('rejects mismatched dw identity mit id', () => {
    expectValidationError(
      () => {
        buildSailingCardOnboardingUpdate({
          input: {
            ...contactInput,
            affiliation: SailingAffiliation.MIT_STUDENT,
            mitId: '123456789',
            firstName: '',
            lastName: '',
          },
          dataWarehouseIdentity: {
            ...studentIdentity,
            mitId: '987654321',
          },
          now: new Date('2026-05-21T12:00:00-04:00'),
        });
      },
      { mitId: 'invalid_dw_identity' }
    );
  });

  it('lets optional mit affiliations use matching dw identity', () => {
    expect(
      buildSailingCardOnboardingUpdate({
        input: {
          ...contactInput,
          affiliation: SailingAffiliation.MIT_ALUM,
          mitId: '123456789',
          firstName: '',
          lastName: '',
        },
        dataWarehouseIdentity: studentIdentity,
        now: new Date('2026-05-21T12:00:00-04:00'),
      })
    ).toMatchObject({
      firstName: 'Ada',
      lastName: 'Lovelace',
      mitId: '123456789',
      sailingAffiliation: SailingAffiliation.MIT_ALUM,
    });
  });

  it('lets optional mit affiliations submit manual name without mit id', () => {
    expect(
      buildSailingCardOnboardingUpdate({
        input: {
          ...contactInput,
          affiliation: SailingAffiliation.MIT_ALUM,
          mitId: '',
          firstName: ' Grace ',
          lastName: ' Hopper ',
        },
        dataWarehouseIdentity: null,
        now: new Date('2026-05-21T12:00:00-04:00'),
      })
    ).toMatchObject({
      firstName: 'Grace',
      lastName: 'Hopper',
      name: 'Grace Hopper',
      mitId: null,
      mitClassYear: null,
      mitDataWarehouseVerifiedAt: null,
    });
  });

  it('rejects optional mit id when no dw identity matches', () => {
    expectValidationError(
      () => {
        buildSailingCardOnboardingUpdate({
          input: {
            ...contactInput,
            affiliation: SailingAffiliation.MIT_ALUM,
            mitId: '123456789',
            firstName: 'Grace',
            lastName: 'Hopper',
          },
          dataWarehouseIdentity: null,
          now: new Date('2026-05-21T12:00:00-04:00'),
        });
      },
      { mitId: 'invalid_dw_identity' }
    );
  });

  it('ignores submitted mit identity for non mit school affiliations', () => {
    expect(
      buildSailingCardOnboardingUpdate({
        input: {
          ...contactInput,
          affiliation: SailingAffiliation.WELLESLEY,
          mitId: '123456789',
          firstName: ' Robin ',
          lastName: ' Lee ',
        },
        dataWarehouseIdentity: studentIdentity,
        now: new Date('2026-05-21T12:00:00-04:00'),
      })
    ).toMatchObject({
      firstName: 'Robin',
      lastName: 'Lee',
      mitId: null,
      mitClassYear: null,
      mitDataWarehouseVerifiedAt: null,
      sailingAffiliation: SailingAffiliation.WELLESLEY,
    });
  });

  it('requires manual name for other non-students', () => {
    expectValidationError(
      () => {
        buildSailingCardOnboardingUpdate({
          input: {
            ...contactInput,
            affiliation: SailingAffiliation.OTHER_NON_STUDENT,
            mitId: '',
            firstName: '',
            lastName: '',
          },
          dataWarehouseIdentity: null,
          now: new Date('2026-05-21T12:00:00-04:00'),
        });
      },
      {
        firstName: 'required',
        lastName: 'required',
      }
    );
  });

  it('rejects missing affiliation', () => {
    expectValidationError(
      () => {
        buildSailingCardOnboardingUpdate({
          input: {
            ...contactInput,
            affiliation: null,
            mitId: '',
            firstName: 'Robin',
            lastName: 'Lee',
          },
          dataWarehouseIdentity: null,
          now: new Date('2026-05-21T12:00:00-04:00'),
        });
      },
      { affiliation: 'required' }
    );
  });

  it('reports contact and required detail errors together', () => {
    expectValidationError(
      () => {
        buildSailingCardOnboardingUpdate({
          input: {
            ...contactInput,
            affiliation: null,
            cardType: null,
            dateOfBirth: '',
            emergencyContactName: '',
            emergencyContactPhone: '',
            firstName: 'Robin',
            lastName: 'Lee',
            mitId: '',
            phone: 'not a phone',
            swimAgreementAccepted: false,
          },
          dataWarehouseIdentity: null,
          now: new Date('2026-05-21T12:00:00-04:00'),
        });
      },
      {
        affiliation: 'required',
        cardType: 'required',
        dateOfBirth: 'required',
        emergencyContactName: 'required',
        emergencyContactPhone: 'required',
        phone: 'invalid',
        swimAgreementAccepted: 'required',
      }
    );
  });

  it('requires swim agreement acceptance', () => {
    expectValidationError(
      () => {
        buildSailingCardOnboardingUpdate({
          input: {
            ...contactInput,
            affiliation: SailingAffiliation.OTHER_STUDENT,
            mitId: '',
            firstName: 'Robin',
            lastName: 'Lee',
            swimAgreementAccepted: false,
          },
          dataWarehouseIdentity: null,
          now: new Date('2026-05-21T12:00:00-04:00'),
        });
      },
      { swimAgreementAccepted: 'required' }
    );
  });

  it('rejects impossible dates of birth', () => {
    expectValidationError(
      () => {
        buildSailingCardOnboardingUpdate({
          input: {
            ...contactInput,
            affiliation: SailingAffiliation.OTHER_STUDENT,
            dateOfBirth: '2026-99-99',
            mitId: '',
            firstName: 'Robin',
            lastName: 'Lee',
          },
          dataWarehouseIdentity: null,
          now: new Date('2026-05-21T12:00:00-04:00'),
        });
      },
      { dateOfBirth: 'required' }
    );
  });

  it('accepts typed us dates of birth', () => {
    expect(
      buildSailingCardOnboardingUpdate({
        input: {
          ...contactInput,
          affiliation: SailingAffiliation.OTHER_STUDENT,
          dateOfBirth: '01/02/2000',
          firstName: 'Robin',
          lastName: 'Lee',
          mitId: '',
        },
        dataWarehouseIdentity: null,
        now: new Date('2026-05-21T12:00:00-04:00'),
      })
    ).toMatchObject({
      dateOfBirth: new Date('2000-01-02T00:00:00.000Z'),
    });
  });

  it('accepts typed numeric dates of birth', () => {
    expect(
      buildSailingCardOnboardingUpdate({
        input: {
          ...contactInput,
          affiliation: SailingAffiliation.OTHER_STUDENT,
          dateOfBirth: '01022000',
          firstName: 'Robin',
          lastName: 'Lee',
          mitId: '',
        },
        dataWarehouseIdentity: null,
        now: new Date('2026-05-21T12:00:00-04:00'),
      })
    ).toMatchObject({
      dateOfBirth: new Date('2000-01-02T00:00:00.000Z'),
    });
  });

  it('parses checked swim agreement as accepted without initials output', () => {
    expect(
      buildSailingCardOnboardingUpdate({
        input: {
          ...contactInput,
          affiliation: SailingAffiliation.OTHER_STUDENT,
          mitId: '',
          firstName: 'Robin',
          lastName: 'Lee',
        },
        dataWarehouseIdentity: null,
        now: new Date('2026-05-21T12:00:00-04:00'),
      })
    ).not.toHaveProperty('sailingCardSwimAgreementInitials');
  });

  it('requires emergency contact name and phone for yearly onboarding', () => {
    expectValidationError(
      () => {
        buildSailingCardOnboardingUpdate({
          input: {
            ...contactInput,
            affiliation: SailingAffiliation.NON_MIT,
            emergencyContactName: '',
            firstName: 'Robin',
            lastName: 'Lee',
            mitId: '',
          },
          dataWarehouseIdentity: null,
          now: new Date('2026-05-21T12:00:00-04:00'),
        });
      },
      { emergencyContactName: 'required' }
    );
  });

  it('rejects invalid primary and emergency phone numbers', () => {
    expectValidationError(
      () => {
        buildSailingCardOnboardingUpdate({
          input: {
            ...contactInput,
            affiliation: SailingAffiliation.NON_MIT,
            emergencyContactPhone: 'not a phone',
            firstName: 'Robin',
            lastName: 'Lee',
            mitId: '',
            phone: '+44 20 7946 0958',
          },
          dataWarehouseIdentity: null,
          now: new Date('2026-05-21T12:00:00-04:00'),
        });
      },
      {
        emergencyContactPhone: 'invalid',
        phone: 'invalid',
      }
    );
  });
});
