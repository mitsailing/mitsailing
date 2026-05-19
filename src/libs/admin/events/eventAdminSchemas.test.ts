import { describe, expect, it } from 'vitest';
import { EventAnswerType, EventDetailPageKind } from '@/generated/prisma/enums';
import {
  dollarsToEventAdminCents,
  isEventAdminInvalidFeeAmountIssue,
  eventAdminBasicsFormSchema,
  eventAdminIdsFormSchema,
  eventDateFormSchema,
  eventFeeFormSchema,
  eventQuestionFormSchema,
  parseEasternDateTimeLocal,
  rawEventFeeFromFormData,
  slugifyEventAdmin,
  splitEventAdminOptionLines,
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

  it('rejects external detail page with non-http URL', () => {
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
      externalDetailUrl: 'ftp://example.com/info',
      internalNotes: '',
      isPublished: true,
    });

    expect(parsed.success).toBe(false);
  });

  it('parses eastern datetime local values', () => {
    const result = parseEasternDateTimeLocal('2026-05-16T09:30');

    expect(result).not.toBeNull();
    expect(result?.toISOString()).toBe('2026-05-16T13:30:00.000Z');
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

  it('parses fee dollars field into integer cents', () => {
    const parsed = eventFeeFormSchema.parse({
      description: 'Entry fee',
      amountDollars: '150.00',
      isDeposit: false,
    });

    expect(parsed.amountCents).toBe(15_000);
    expect(parsed.description).toBe('Entry fee');
    expect(parsed.isDeposit).toBe(false);
  });

  it('maps fee form data using amountDollars field name', () => {
    const formData = new FormData();
    formData.set('description', 'Deposit');
    formData.set('amountDollars', '25');
    formData.set('isDeposit', 'true');
    const raw = rawEventFeeFromFormData(formData);
    const parsed = eventFeeFormSchema.parse(raw);

    expect(parsed.amountCents).toBe(2500);
  });

  it('rejects fee form with invalid dollar amount', () => {
    const parsed = eventFeeFormSchema.safeParse({
      description: 'Entry fee',
      amountDollars: 'not-a-number',
      isDeposit: false,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      expect(issue?.code).toBe('custom');
      expect(isEventAdminInvalidFeeAmountIssue(issue ?? {})).toBe(true);
      expect(issue?.path.at(-1)).toBe('amountDollars');
    }
  });

  it.each(['0', '0.00', '0.0'])(
    'rejects fee form with zero dollar amount (%s)',
    (amountDollars) => {
      const parsed = eventFeeFormSchema.safeParse({
        description: 'Entry fee',
        amountDollars,
        isDeposit: false,
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const [issue] = parsed.error.issues;
        expect(issue?.code).toBe('too_small');
        expect(isEventAdminInvalidFeeAmountIssue(issue ?? {})).toBe(true);
        expect(issue?.path.at(-1)).toBe('amountDollars');
      }
    }
  );

  it('splits option lines', () => {
    expect(splitEventAdminOptionLines('Helm\nNavigation\nSail trim')).toEqual([
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
      optionsText: 'Helm\nTrim',
      required: true,
      displayOrder: '1',
    });

    expect(parsed.options).toEqual(['Helm', 'Trim']);
  });

  it('preserves commas inside option text', () => {
    const parsed = eventQuestionFormSchema.parse({
      questionText: 'Pickup location',
      answerType: EventAnswerType.select,
      optionsText: 'Boston, MA\nCambridge, MA',
      required: true,
      displayOrder: '1',
    });

    expect(parsed.options).toEqual(['Boston, MA', 'Cambridge, MA']);
  });

  it('maps empty question display order to null for append default', () => {
    const parsed = eventQuestionFormSchema.parse({
      questionText: 'Shirt size',
      answerType: EventAnswerType.text,
      optionsText: '',
      required: false,
      displayOrder: '',
    });

    expect(parsed.displayOrder).toBeNull();
  });

  it('accepts explicit zero question display order', () => {
    const parsed = eventQuestionFormSchema.parse({
      questionText: 'Shirt size',
      answerType: EventAnswerType.text,
      optionsText: '',
      required: false,
      displayOrder: '0',
    });

    expect(parsed.displayOrder).toBe(0);
  });

  it('parses explicit question display order', () => {
    const parsed = eventQuestionFormSchema.parse({
      questionText: 'Dietary',
      answerType: EventAnswerType.text,
      optionsText: '',
      required: false,
      displayOrder: '4',
    });

    expect(parsed.displayOrder).toBe(4);
  });

  it('rejects empty event admin selections', () => {
    const parsed = eventAdminIdsFormSchema.safeParse([]);

    expect(parsed.success).toBe(false);
  });
});
