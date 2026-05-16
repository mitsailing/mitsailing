import { describe, expect, it } from 'vitest';
import {
  PAVILION_RESERVATION_END_MINUTES,
  PAVILION_RESERVATION_START_MINUTES,
} from '@/libs/mit-sailing/pavilionReservationBookingTimeline';
import { pavilionReservationFormSchema } from '@/libs/mit-sailing/pavilionReservationSchemas';

function validInput() {
  return {
    requesterEmail: 'sailor@mit.edu',
    persona: 'mit_academic',
    firstName: 'Sally',
    lastName: 'Sailor',
    phone: '617-555-0100',
    eventName: 'Research group picnic',
    groupName: '',
    groupSize: '12',
    description: 'A small department event.',
    hasTent: false,
    servesAlcohol: false,
    projectTitle: 'Waterfront research',
    advisorName: 'Professor Sail',
    advisorEmail: 'advisor@mit.edu',
    costCenter: '1234567',
    mitId: '123456789',
    mitAccount: '1234567',
    slots: [
      {
        itemId: 'pavilion',
        date: '2026-07-01',
        startMinutes: 9 * 60,
        endMinutes: 11 * 60,
      },
    ],
    services: [],
  };
}

describe('pavilionReservationFormSchema', () => {
  it('reports academic fields alongside unrelated field errors', () => {
    const result = pavilionReservationFormSchema.safeParse({
      ...validInput(),
      advisorEmail: 'not-an-email',
      costCenter: '',
      groupSize: '0',
      projectTitle: '',
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }

    const paths = result.error.issues.map((issue) => issue.path.join('.'));
    expect(paths).toEqual(
      expect.arrayContaining([
        'advisorEmail',
        'costCenter',
        'groupSize',
        'projectTitle',
      ])
    );
  });

  it('normalizes optional nonacademic fields', () => {
    const result = pavilionReservationFormSchema.safeParse({
      ...validInput(),
      persona: 'non_mit',
      projectTitle: '',
      advisorName: '',
      advisorEmail: '',
      costCenter: '',
      mitId: '',
      mitAccount: '',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.projectTitle).toBeNull();
    expect(result.data.mitId).toBeNull();
    expect(result.data.mitAccount).toBeNull();
  });

  it('rejects malformed optional nonacademic advisor email', () => {
    const result = pavilionReservationFormSchema.safeParse({
      ...validInput(),
      persona: 'non_mit',
      projectTitle: '',
      advisorName: '',
      advisorEmail: 'not-an-email',
      costCenter: '',
    });

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.issues.map((issue) => issue.path.join('.'))).toContain(
      'advisorEmail'
    );
  });

  it('rejects slot minutes outside operating hours or grid', () => {
    const result = pavilionReservationFormSchema.safeParse({
      ...validInput(),
      slots: [
        {
          itemId: 'pavilion',
          date: '2026-07-01',
          startMinutes: 1,
          endMinutes: PAVILION_RESERVATION_START_MINUTES + 60,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects slot end before or equal to start after per-slot checks', () => {
    const result = pavilionReservationFormSchema.safeParse({
      ...validInput(),
      slots: [
        {
          itemId: 'pavilion',
          date: '2026-07-01',
          startMinutes: PAVILION_RESERVATION_START_MINUTES + 60,
          endMinutes: PAVILION_RESERVATION_START_MINUTES + 60,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects start time at closing boundary', () => {
    const result = pavilionReservationFormSchema.safeParse({
      ...validInput(),
      slots: [
        {
          itemId: 'pavilion',
          date: '2026-07-01',
          startMinutes: PAVILION_RESERVATION_END_MINUTES,
          endMinutes: PAVILION_RESERVATION_END_MINUTES,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('accepts bookable operating-hours slots', () => {
    const result = pavilionReservationFormSchema.safeParse({
      ...validInput(),
      slots: [
        {
          itemId: 'pavilion',
          date: '2026-07-01',
          startMinutes: PAVILION_RESERVATION_START_MINUTES,
          endMinutes: PAVILION_RESERVATION_END_MINUTES,
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
