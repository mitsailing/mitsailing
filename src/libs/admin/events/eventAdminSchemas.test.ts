import { describe, expect, it } from 'vitest';
import {
  EventAddressPreset,
  EventAnswerType,
  EventDetailPageKind,
  EventSailingCardRequirement,
} from '@/generated/prisma/enums';
import {
  dollarsToEventAdminCents,
  isEventAdminInvalidFeeAmountIssue,
  eventAdminBasicsFormSchema,
  eventAdminIdsFormSchema,
  eventDateFormSchema,
  eventFeeFormSchema,
  eventLocationFormSchema,
  eventPaymentManualHandledFormSchema,
  eventPaymentSettingsFormSchema,
  eventQuestionFormSchema,
  generateEventAdminSlug,
  parseEasternDateTimeLocal,
  rawEventFeeFromFormData,
  rawEventLocationFromFormData,
  rawEventPaymentManualHandledFromFormData,
  rawEventPaymentSettingsFromFormData,
  slugifyEventAdmin,
  splitEventAdminOptionLines,
} from '@/libs/admin/events/eventAdminSchemas';

function validEventBasicsInput() {
  return {
    name: 'Spring Regatta',
    shortName: '',
    slug: '',
    eventCategoryId: 'cat-racing',
    description: '',
    isSpecial: false,
    requiresApproval: true,
    requiresPhone: false,
    maxParticipants: '',
    registrationStart: '',
    registrationEnd: '',
    detailPageKind: EventDetailPageKind.standard,
    externalDetailUrl: '',
    isPublished: true,
  };
}

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
      requiresPhone: false,
      maxParticipants: '',
      registrationStart: '',
      registrationEnd: '',
      detailPageKind: EventDetailPageKind.standard,
      externalDetailUrl: '',
      isPublished: true,
    });

    expect(parsed.slug).toBe('spring-regatta-day-1');
    expect(parsed.shortName).toBe('Spring Regatta: Day 1');
  });

  it('drops removed internal notes input from event basics', () => {
    const parsed = eventAdminBasicsFormSchema.parse({
      ...validEventBasicsInput(),
      internalNotes: 'Private staffing note',
    });

    expect(parsed).not.toHaveProperty('internalNotes');
  });

  it('parses event phone requirement from basics', () => {
    const parsed = eventAdminBasicsFormSchema.parse({
      ...validEventBasicsInput(),
      requiresPhone: true,
    });

    expect(parsed.requiresPhone).toBe(true);
  });

  it('defaults missing sailing card requirement to none', () => {
    const parsed = eventAdminBasicsFormSchema.parse(validEventBasicsInput());

    expect(parsed.sailingCardRequirement).toBe(
      EventSailingCardRequirement.NONE
    );
  });

  it.each([
    EventSailingCardRequirement.NONE,
    EventSailingCardRequirement.CURRENT_CARD,
  ])('parses %s sailing card requirement', (sailingCardRequirement) => {
    const parsed = eventAdminBasicsFormSchema.parse({
      ...validEventBasicsInput(),
      sailingCardRequirement,
    });

    expect(parsed.sailingCardRequirement).toBe(sailingCardRequirement);
  });

  it('rejects unknown sailing card requirement', () => {
    const parsed = eventAdminBasicsFormSchema.safeParse({
      ...validEventBasicsInput(),
      sailingCardRequirement: 'VIRTUAL_CARD',
    });

    expect(parsed.success).toBe(false);
  });

  it('parses enabled team configuration from basics', () => {
    const parsed = eventAdminBasicsFormSchema.parse({
      ...validEventBasicsInput(),
      allowRepeatTeamCaptain: true,
      boatsPerTeam: '2',
      personsPerBoat: '1',
      usesTeamRegistration: true,
    });

    expect(parsed.usesTeamRegistration).toBe(true);
    expect(parsed.boatsPerTeam).toBe(2);
    expect(parsed.personsPerBoat).toBe(1);
    expect(parsed.allowRepeatTeamCaptain).toBe(true);
  });

  it('normalizes disabled team configuration from basics', () => {
    const parsed = eventAdminBasicsFormSchema.parse({
      ...validEventBasicsInput(),
      allowRepeatTeamCaptain: true,
      boatsPerTeam: '4',
      personsPerBoat: '3',
      usesTeamRegistration: false,
    });

    expect(parsed.usesTeamRegistration).toBe(false);
    expect(parsed.boatsPerTeam).toBe(1);
    expect(parsed.personsPerBoat).toBe(1);
    expect(parsed.allowRepeatTeamCaptain).toBe(false);
  });

  it('rejects enabled team configuration with one boat and one person', () => {
    const parsed = eventAdminBasicsFormSchema.safeParse({
      ...validEventBasicsInput(),
      allowRepeatTeamCaptain: false,
      boatsPerTeam: '1',
      personsPerBoat: '1',
      usesTeamRegistration: true,
    });

    expect(parsed.success).toBe(false);
  });

  it('sanitizes public content sections while keeping visibility separate', () => {
    const parsed = eventAdminBasicsFormSchema.parse({
      name: 'Spring Regatta',
      shortName: '',
      slug: '',
      eventCategoryId: 'cat-racing',
      description: '',
      isSpecial: false,
      requiresApproval: true,
      requiresPhone: false,
      maxParticipants: '',
      registrationStart: '',
      registrationEnd: '',
      detailPageKind: EventDetailPageKind.standard,
      externalDetailUrl: '',
      isPublished: true,
      faqVisible: true,
      faqContent: '  <h1>FAQ</h1><script>alert("x")</script>  ',
      noticeOfRaceVisible: false,
      noticeOfRaceContent: '  Draft notice text  ',
      sailingInstructionsVisible: true,
      sailingInstructionsContent: '<p>Read before launch.</p>',
      resultsVisible: false,
      resultsContent: '',
    });

    expect(parsed.faqVisible).toBe(true);
    expect(parsed.faqContent).toBe('<h2>FAQ</h2>');
    expect(parsed.noticeOfRaceVisible).toBe(false);
    expect(parsed.noticeOfRaceContent).toBe('<p>Draft notice text</p>');
    expect(parsed.sailingInstructionsVisible).toBe(true);
    expect(parsed.sailingInstructionsContent).toBe(
      '<p>Read before launch.</p>'
    );
    expect(parsed.resultsVisible).toBe(false);
    expect(parsed.resultsContent).toBe('');
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
      requiresPhone: false,
      maxParticipants: '',
      registrationStart: '',
      registrationEnd: '',
      detailPageKind: EventDetailPageKind.external,
      externalDetailUrl: '',
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
      requiresPhone: false,
      maxParticipants: '',
      registrationStart: '',
      registrationEnd: '',
      detailPageKind: EventDetailPageKind.external,
      externalDetailUrl: 'ftp://example.com/info',
      isPublished: true,
    });

    expect(parsed.success).toBe(false);
  });

  it.each(['none', 'standard'])(
    'accepts %s registration mode without external URLs',
    (registrationMode) => {
      const parsed = eventAdminBasicsFormSchema.parse({
        ...validEventBasicsInput(),
        externalEntriesUrl: '',
        externalRegistrationUrl: '',
        registrationMode,
      });

      expect(parsed.registrationMode).toBe(registrationMode);
      expect(parsed.externalRegistrationUrl).toBe('');
      expect(parsed.externalEntriesUrl).toBe('');
    }
  );

  it('accepts external registration mode with registration and entries URLs', () => {
    const parsed = eventAdminBasicsFormSchema.parse({
      ...validEventBasicsInput(),
      externalEntriesUrl: 'https://example.com/entries',
      externalRegistrationUrl: 'https://example.com/register',
      registrationMode: 'external',
    });

    expect(parsed.registrationMode).toBe('external');
    expect(parsed.externalRegistrationUrl).toBe('https://example.com/register');
    expect(parsed.externalEntriesUrl).toBe('https://example.com/entries');
  });

  it('rejects external registration mode without registration URL', () => {
    const parsed = eventAdminBasicsFormSchema.safeParse({
      ...validEventBasicsInput(),
      externalEntriesUrl: 'https://example.com/entries',
      externalRegistrationUrl: '',
      registrationMode: 'external',
    });

    expect(parsed.success).toBe(false);
  });

  it('rejects external registration mode with non-http entries URL', () => {
    const parsed = eventAdminBasicsFormSchema.safeParse({
      ...validEventBasicsInput(),
      externalEntriesUrl: 'mailto:entries@example.com',
      externalRegistrationUrl: 'https://example.com/register',
      registrationMode: 'external',
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts external registration mode with blank entries URL', () => {
    const parsed = eventAdminBasicsFormSchema.parse({
      ...validEventBasicsInput(),
      externalEntriesUrl: '',
      externalRegistrationUrl: 'https://example.com/register',
      registrationMode: 'external',
    });

    expect(parsed.externalEntriesUrl).toBe('');
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

  it('parses payment settings from form data', () => {
    const formData = new FormData();
    formData.set('paymentsEnabled', 'true');
    formData.set('paymentDeadlineAt', '2026-06-01T17:30');

    const parsed = eventPaymentSettingsFormSchema.parse(
      rawEventPaymentSettingsFromFormData(formData)
    );

    expect(parsed).toEqual({
      paymentsEnabled: true,
      paymentDeadlineAt: new Date('2026-06-01T21:30:00.000Z'),
    });
  });

  it('parses custom address fields from form data', () => {
    const formData = new FormData();
    formData.set('addressPreset', EventAddressPreset.custom);
    formData.set('addressName', 'Sailing center');
    formData.set('addressLine1', '1 Memorial Drive');
    formData.set('addressLine2', 'Suite 2');
    formData.set('addressCity', 'Cambridge');
    formData.set('addressState', 'MA');
    formData.set('addressPostalCode', '02139');
    formData.set('addressCountry', 'US');

    const parsed = eventLocationFormSchema.parse(
      rawEventLocationFromFormData(formData)
    );

    expect(parsed).toEqual({
      addressPreset: EventAddressPreset.custom,
      addressName: 'Sailing center',
      addressLine1: '1 Memorial Drive',
      addressLine2: 'Suite 2',
      addressCity: 'Cambridge',
      addressState: 'MA',
      addressPostalCode: '02139',
      addressCountry: 'US',
    });
  });

  it('materializes Pavilion preset address fields even when form fields are blank', () => {
    const parsed = eventLocationFormSchema.parse({
      addressPreset: EventAddressPreset.pavilion,
      addressName: '',
      addressLine1: '',
      addressLine2: '',
      addressCity: '',
      addressState: '',
      addressPostalCode: '',
      addressCountry: '',
    });

    expect(parsed).toMatchObject({
      addressName: 'MIT Sailing Pavilion',
      addressLine1: '134 Memorial Drive',
      addressCity: 'Cambridge',
      addressState: 'MA',
      addressPostalCode: '02139',
      addressCountry: 'US',
    });
  });

  it('materializes Bluewater preset address fields even when form fields are blank', () => {
    const parsed = eventLocationFormSchema.parse({
      addressPreset: EventAddressPreset.bluewater,
      addressName: '',
      addressLine1: '',
      addressLine2: '',
      addressCity: '',
      addressState: '',
      addressPostalCode: '',
      addressCountry: '',
    });

    expect(parsed).toMatchObject({
      addressName: 'Boston Waterboat Marina',
      addressLine1: '66 Long Wharf',
      addressCity: 'Boston',
      addressState: 'MA',
      addressPostalCode: '02110',
      addressCountry: 'US',
    });
  });

  it('rejects enabled payments without a deadline', () => {
    const parsed = eventPaymentSettingsFormSchema.safeParse({
      paymentsEnabled: true,
      paymentDeadlineAt: '',
    });

    expect(parsed.success).toBe(false);
  });

  it('requires a manual handled note', () => {
    const formData = new FormData();
    formData.set('note', '  ');

    const parsed = eventPaymentManualHandledFormSchema.safeParse(
      rawEventPaymentManualHandledFromFormData(formData)
    );

    expect(parsed.success).toBe(false);
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

  it('generates event slugs from one eastern event day and name', () => {
    expect(
      generateEventAdminSlug({
        dates: [new Date('2026-08-10T13:00:00Z')],
        name: 'Intro Sail!',
      })
    ).toBe('2026-08-10-intro-sail');
  });

  it('generates compact event slugs for multiple same-month eastern event days', () => {
    expect(
      generateEventAdminSlug({
        dates: [
          new Date('2026-08-10T13:00:00Z'),
          new Date('2026-08-11T13:00:00Z'),
          new Date('2026-08-12T13:00:00Z'),
        ],
        name: 'Junior Clinic',
      })
    ).toBe('2026-08-10-11-12-junior-clinic');
  });

  it('generates event slugs from name only without event dates', () => {
    expect(generateEventAdminSlug({ dates: [], name: 'Open House' })).toBe(
      'open-house'
    );
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
