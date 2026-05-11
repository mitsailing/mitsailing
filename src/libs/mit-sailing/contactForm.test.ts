import { describe, expect, it } from 'vitest';
import {
  buildContactEmail,
  calendarYearInContactFormTimeZone,
  contactTopics,
  parseContactSubmission,
  parseContactTopicParam,
  parseContactTopicSearchParam,
  recipientForContactTopic,
} from '@/libs/mit-sailing/contactForm';

function contactFormData(props?: {
  topic?: string;
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  currentYear?: string;
}): FormData {
  const formData = new FormData();
  formData.set('topic', props?.topic ?? 'General questions');
  formData.set('name', props?.name ?? 'Ada Lovelace');
  formData.set('email', props?.email ?? ' ada@mit.edu ');
  formData.set('subject', props?.subject ?? 'Class question');
  formData.set('message', props?.message ?? 'Could you help me pick a class?');
  formData.set('currentYear', props?.currentYear ?? '2026');
  return formData;
}

describe('parseContactSubmission', () => {
  it('normalizes contact fields for a valid submission', () => {
    const parsed = parseContactSubmission(
      contactFormData({ name: ' Ada ', subject: ' Hello ' }),
      new Date('2026-05-09T12:00:00-04:00')
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toMatchObject({
        email: 'ada@mit.edu',
        name: 'Ada',
        subject: 'Hello',
      });
    }
  });

  it('accepts calendar year in America/New_York when UTC calendar year differs', () => {
    const instant = new Date('2026-01-01T00:00:00.000Z');
    expect(instant.getUTCFullYear()).toBe(2026);
    expect(calendarYearInContactFormTimeZone(instant)).toBe(2025);

    const parsed = parseContactSubmission(
      contactFormData({ currentYear: '2025' }),
      instant
    );

    expect(parsed.success).toBe(true);
  });

  it.each([
    ['topic', { topic: 'Regatta organizers' }],
    ['email', { email: 'ada@mit' }],
    ['year', { currentYear: '1900' }],
    ['name', { name: ' ' }],
    ['subject', { subject: ' ' }],
    ['message', { message: ' ' }],
  ])('rejects invalid %s submissions', (_field, override) => {
    const parsed = parseContactSubmission(
      contactFormData(override),
      new Date('2026-05-09T12:00:00-04:00')
    );

    expect(parsed.success).toBe(false);
  });
});

describe('recipientForContactTopic', () => {
  it('routes contact topics to the sailing inbox', () => {
    for (const topic of contactTopics) {
      expect(recipientForContactTopic(topic)).toBe('sailing@mit.edu');
    }
  });
});

describe('buildContactEmail', () => {
  it('formats the routed contact email subject', () => {
    const parsed = parseContactSubmission(
      contactFormData({
        topic: 'Visit the Pavilion',
        subject: 'Sunday hours',
      }),
      new Date('2026-05-09T12:00:00-04:00')
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(buildContactEmail(parsed.data).subject).toBe(
        '[MIT Sailing Contact] Visit the Pavilion: Sunday hours'
      );
    }
  });

  it('uses the submitter email as the reply address', () => {
    const parsed = parseContactSubmission(
      contactFormData({
        email: 'ada@mit.edu',
      }),
      new Date('2026-05-09T12:00:00-04:00')
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(buildContactEmail(parsed.data)).toMatchObject({
        replyTo: 'ada@mit.edu',
      });
    }
  });

  it('removes line breaks from the email subject header', () => {
    const parsed = parseContactSubmission(
      contactFormData({
        subject: 'Hello\r\nBcc: attacker@example.com',
      }),
      new Date('2026-05-09T12:00:00-04:00')
    );

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(buildContactEmail(parsed.data).subject).toBe(
        '[MIT Sailing Contact] General questions: Hello Bcc: attacker@example.com'
      );
    }
  });
});

describe('parseContactTopicParam', () => {
  it('returns topic for exact known labels', () => {
    expect(parseContactTopicParam('Reserve Pavilion')).toBe('Reserve Pavilion');
    expect(parseContactTopicParam('Visit the Pavilion')).toBe(
      'Visit the Pavilion'
    );
  });

  it('returns undefined for unknown labels', () => {
    expect(parseContactTopicParam('Other')).toBeUndefined();
  });
});

describe('parseContactTopicSearchParam', () => {
  it('uses first value when search param is repeated', () => {
    expect(parseContactTopicSearchParam(['Visit the Pavilion', 'Other'])).toBe(
      'Visit the Pavilion'
    );
  });

  it('returns undefined for missing or invalid values', () => {
    expect(parseContactTopicSearchParam()).toBeUndefined();
    expect(parseContactTopicSearchParam('nope')).toBeUndefined();
  });
});
