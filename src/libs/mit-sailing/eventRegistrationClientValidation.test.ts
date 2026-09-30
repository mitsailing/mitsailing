import { describe, expect, it } from 'vitest';
import { LearnToSailManagedClassKind } from '@/generated/prisma/enums';
import type { PublicEventDetail } from '@/libs/mit-sailing/eventQueries';
import { collectEventRegistrationClientFieldErrors } from '@/libs/mit-sailing/eventRegistrationClientValidation';

const baseEvent = {
  admins: [],
  attendees: { approved: [], pending: [] },
  approvedRegistrationCount: 0,
  category: { name: 'Classes' },
  dates: [],
  description: 'Learn to sail.',
  detailPageKind: 'standard',
  entryFees: [],
  externalDetailUrl: null,
  id: 'event-1',
  isSpecial: false,
  learnToSailManagedClassKind: LearnToSailManagedClassKind.none,
  maxParticipants: null,
  name: 'Learn to Sail',
  pendingRegistrationCount: 0,
  registrationEnd: null,
  registrationQuestions: [
    {
      answerType: 'select',
      displayOrder: 1,
      id: 'shirt',
      options: ['M', 'L'],
      questionText: 'T-shirt size',
      required: true,
    },
  ],
  registrationStart: null,
  requiresApproval: false,
  requiresPhone: true,
  selectionNote: null,
  shortName: 'LTS',
  slug: 'learn-to-sail',
  teamRegistration: {
    allowRepeatTeamCaptain: false,
    boatsPerTeam: 1,
    personsPerBoat: 1,
    usesTeamRegistration: false,
  },
} satisfies PublicEventDetail;

describe('collectEventRegistrationClientFieldErrors', () => {
  it('flags required question, phone, and swim agreement before submit', () => {
    const formData = new FormData();

    expect(
      collectEventRegistrationClientFieldErrors({
        event: baseEvent,
        formData,
      })
    ).toEqual({
      phone: 'questions_required',
      question_shirt: 'questions_required',
      swimAgreementAccepted: 'swim_agreement_required',
    });
  });

  it('accepts a complete minimal registration payload', () => {
    const formData = new FormData();
    formData.set('question_shirt', 'M');
    formData.set('phone', '6175550100');
    formData.set('swimAgreementAccepted', 'true');

    expect(
      collectEventRegistrationClientFieldErrors({
        event: baseEvent,
        formData,
      })
    ).toEqual({});
  });

  it('flags invalid phone and invalid team email', () => {
    const formData = new FormData();
    formData.set('question_shirt', 'M');
    formData.set('phone', 'not-a-phone');
    formData.set('swimAgreementAccepted', 'true');
    formData.set('teamName', 'Tech');
    formData.set('teamBoatMember_0_name', 'Ada');
    formData.set('teamBoatMember_0_email', 'not-an-email');

    expect(
      collectEventRegistrationClientFieldErrors({
        event: {
          ...baseEvent,
          teamRegistration: {
            allowRepeatTeamCaptain: false,
            boatsPerTeam: 1,
            personsPerBoat: 1,
            usesTeamRegistration: true,
          },
        },
        formData,
      })
    ).toEqual({
      phone: 'answers_invalid',
      teamBoatMember_0_email: 'answers_invalid',
    });
  });
});
