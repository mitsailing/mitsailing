import { describe, expect, it } from 'vitest';
import { EventRegistrationStatus } from '@/generated/prisma/enums';
import type { PublicEventDetail } from '@/libs/mit-sailing/eventQueries';
import { publicEventReservationState } from '@/libs/mit-sailing/eventRegistrationState';

const midJune = new Date('2026-06-15T12:00:00.000Z');

function makeEvent(
  overrides: Partial<PublicEventDetail> = {}
): PublicEventDetail {
  return {
    id: 'evt-1',
    name: 'Test event',
    shortName: 'Test',
    description: '',
    slug: 'test-event',
    isSpecial: false,
    maxParticipants: 10,
    requiresApproval: true,
    registrationStart: new Date('2026-06-01T12:00:00.000Z'),
    registrationEnd: new Date('2026-06-30T12:00:00.000Z'),
    detailPageKind: 'standard',
    externalDetailUrl: null,
    category: { name: 'Racing' },
    dates: [],
    admins: [],
    registrationQuestions: [],
    entryFees: [],
    approvedRegistrationCount: 0,
    pendingRegistrationCount: 0,
    ...overrides,
  };
}

describe('publicEventReservationState', () => {
  it('returns available when pending exceeds spare accepted seats but accepted count is below capacity', () => {
    expect(
      publicEventReservationState({
        currentRegistration: null,
        event: makeEvent({
          approvedRegistrationCount: 9,
          pendingRegistrationCount: 100,
          maxParticipants: 10,
        }),
        now: midJune,
      })
    ).toBe('available');
  });

  it('returns available for approval-required events when accepted registrations reach capacity', () => {
    expect(
      publicEventReservationState({
        currentRegistration: null,
        event: makeEvent({
          approvedRegistrationCount: 10,
          pendingRegistrationCount: 50,
          maxParticipants: 10,
        }),
        now: midJune,
      })
    ).toBe('available');
  });

  it('returns full for auto-approved events when accepted registrations reach capacity', () => {
    expect(
      publicEventReservationState({
        currentRegistration: null,
        event: makeEvent({
          approvedRegistrationCount: 10,
          pendingRegistrationCount: 50,
          maxParticipants: 10,
          requiresApproval: false,
        }),
        now: midJune,
      })
    ).toBe('full');
  });

  it('returns closed when registration ended before evaluating accepted capacity', () => {
    expect(
      publicEventReservationState({
        currentRegistration: null,
        event: makeEvent({
          registrationEnd: new Date('2026-06-01T12:00:00.000Z'),
          approvedRegistrationCount: 0,
          pendingRegistrationCount: 200,
          maxParticipants: 10,
        }),
        now: new Date('2026-06-20T12:00:00.000Z'),
      })
    ).toBe('closed');
  });

  it('returns closed at the registration end instant', () => {
    const registrationEnd = new Date('2026-06-30T12:00:00.000Z');
    expect(
      publicEventReservationState({
        currentRegistration: null,
        event: makeEvent({ registrationEnd }),
        now: registrationEnd,
      })
    ).toBe('closed');
  });

  it('returns available when max participants is unset even with many accepted', () => {
    expect(
      publicEventReservationState({
        currentRegistration: null,
        event: makeEvent({
          maxParticipants: null,
          approvedRegistrationCount: 500,
          pendingRegistrationCount: 0,
        }),
        now: midJune,
      })
    ).toBe('available');
  });

  it('returns approved when viewer has approved registration before capacity branch', () => {
    expect(
      publicEventReservationState({
        currentRegistration: {
          id: 'reg-1',
          status: EventRegistrationStatus.approved,
        },
        event: makeEvent({
          approvedRegistrationCount: 10,
          maxParticipants: 10,
        }),
        now: midJune,
      })
    ).toBe('approved');
  });
});
