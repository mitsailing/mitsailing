import { describe, expect, it } from 'vitest';
import { EventAnswerType, EventDetailPageKind } from '@/generated/prisma/enums';
import {
  dollarsToEventAdminCents,
  eventAdminBasicsFormSchema,
  eventDateFormSchema,
  eventQuestionFormSchema,
  parseEasternDateTimeLocal,
  slugifyEventAdmin,
  splitEventAdminCsv,
} from '@/libs/admin/events/eventAdminSchemas';

describe('eventAdminSchemas', () => {
  it('normalizes event slug from name', () => {
    const parsed = eventAdminBasicsFormSchema.parse({
      name: 'Spring Regatta: Day 1',
      shortName: '',
      slug: '',
      eventCategoryId: 'cat-racing',
      description: '',
      isSpecial: false,
      requiresApproval: true,
      maxParticipants: '',
      registrationStart: '',
      registrationEnd: '',
      detailPageKind: EventDetailPageKind.standard,
      externalDetailUrl: '',
      internalNotes: '',
      isPublished: true,
    });

    expect(parsed.slug).toBe('spring-regatta-day-1');
    expect(parsed.shortName).toBe('Spring Regatta: Day 1');
  });

  it('rejects external detail page without URL', () => {
    const parsed = eventAdminBasicsFormSchema.safeParse({
      name: 'External event',
      shortName: '',
      slug: 'external-event',
      eventCategoryId: 'cat-cruising',
      description: '',
      isSpecial: false,
      requiresApproval: false,
      maxParticipants: '',
      registrationStart: '',
      registrationEnd: '',
      detailPageKind: EventDetailPageKind.external,
      externalDetailUrl: '',
      internalNotes: '',
      isPublished: true,
    });

    expect(parsed.success).toBe(false);
  });

  it('parses eastern datetime local values', () => {
    expect(parseEasternDateTimeLocal('2026-05-16T09:30')?.toISOString()).toBe(
      '2026-05-16T13:30:00.000Z'
    );
  });

  it('rejects date rows with inverted range', () => {
    const parsed = eventDateFormSchema.safeParse({
      startDateTime: '2026-05-16T17:00',
      endDateTime: '2026-05-16T09:00',
    });

    expect(parsed.success).toBe(false);
  });

  it('converts dollars to cents', () => {
    expect(dollarsToEventAdminCents('150.50')).toBe(15_050);
  });

  it('splits comma options', () => {
    expect(splitEventAdminCsv('Helm, Navigation, Sail trim')).toEqual([
      'Helm',
      'Navigation',
      'Sail trim',
    ]);
  });

  it('slugifies punctuation', () => {
    expect(slugifyEventAdmin('Intro Sail! 2026')).toBe('intro-sail-2026');
  });

  it('accepts select questions with options', () => {
    const parsed = eventQuestionFormSchema.parse({
      questionText: 'Preferred role',
      answerType: EventAnswerType.select,
      optionsCsv: 'Helm, Trim',
      required: true,
      displayOrder: '1',
    });

    expect(parsed.options).toEqual(['Helm', 'Trim']);
  });
});
