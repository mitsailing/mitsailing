import * as z from 'zod';

/** IANA zone used for the contact form “current year” honeypot (matches the public contact page). */
const CONTACT_FORM_CALENDAR_TIME_ZONE = 'America/New_York';

const sailingContactEmail = 'sailing@mit.edu';

/**
 * Gregorian calendar year for an instant in `America/New_York` (contact honeypot zone).
 *
 * @param now - Instant to evaluate (typically `new Date()`)
 * @returns Calendar year in the contact form timezone.
 */
export function calendarYearInContactFormTimeZone(now: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: CONTACT_FORM_CALENDAR_TIME_ZONE,
      year: 'numeric',
    }).format(now)
  );
}

export const contactTopics = [
  'General questions',
  'Visit the Pavilion',
  'Reserve Pavilion',
] as const;

export type ContactTopic = (typeof contactTopics)[number];

const contactTopicRoutes: Record<ContactTopic, string> = {
  'General questions': sailingContactEmail,
  'Visit the Pavilion': sailingContactEmail,
  'Reserve Pavilion': sailingContactEmail,
};

export type ContactSubmission = {
  topic: ContactTopic;
  name: string;
  email: string;
  subject: string;
  message: string;
  currentYear: string;
};

export type ContactEmailPayload = {
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
};

type ContactSubmissionResult =
  | { success: true; data: ContactSubmission }
  | { success: false };

function contactFormSchema(now: Date) {
  const currentYear = String(calendarYearInContactFormTimeZone(now));
  return z.object({
    topic: z.enum(contactTopics),
    name: z.string().trim().min(1),
    email: z.string().trim().pipe(z.email()),
    subject: z.string().trim().min(1),
    message: z.string().trim().min(1),
    currentYear: z
      .string()
      .trim()
      .refine((value) => value === currentYear),
  });
}

function formDataString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sanitizeEmailHeader(value: string): string {
  return value
    .replaceAll(/[\r\n]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function htmlParagraph(label: string, value: string): string {
  return `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

/**
 * Parses the public contact form into normalized fields.
 *
 * @param formData - Submitted contact form data
 * @param now - Server clock used for the anti-spam year check (same calendar zone as the contact page)
 * @returns Success with normalized values or failure
 */
export function parseContactSubmission(
  formData: FormData,
  now: Date
): ContactSubmissionResult {
  const parsed = contactFormSchema(now).safeParse({
    topic: formDataString(formData, 'topic'),
    name: formDataString(formData, 'name'),
    email: formDataString(formData, 'email'),
    subject: formDataString(formData, 'subject'),
    message: formDataString(formData, 'message'),
    currentYear: formDataString(formData, 'currentYear'),
  });
  if (!parsed.success) {
    return { success: false };
  }
  return { success: true, data: parsed.data };
}

/**
 * Resolves a validated contact topic to the current destination mailbox.
 *
 * @param topic - Validated contact topic label
 * @returns Recipient email address
 */
export function recipientForContactTopic(topic: ContactTopic): string {
  return contactTopicRoutes[topic];
}

/**
 * Builds the transactional email payload for a validated contact submission.
 *
 * @param submission - Validated contact form fields
 * @returns Email payload for the transactional email gateway
 */
export function buildContactEmail(
  submission: ContactSubmission
): ContactEmailPayload {
  const subjectText = sanitizeEmailHeader(submission.subject);
  const subject = `[MIT Sailing Contact] ${submission.topic}: ${subjectText}`;
  const text = [
    `Topic: ${submission.topic}`,
    `Name: ${submission.name}`,
    `Email: ${submission.email}`,
    `Subject: ${submission.subject}`,
    '',
    submission.message,
  ].join('\n');
  const html = [
    htmlParagraph('Topic', submission.topic),
    htmlParagraph('Name', submission.name),
    htmlParagraph('Email', submission.email),
    htmlParagraph('Subject', submission.subject),
    `<p>${escapeHtml(submission.message).replaceAll('\n', '<br>')}</p>`,
  ].join('\n');

  return {
    to: recipientForContactTopic(submission.topic),
    replyTo: sanitizeEmailHeader(submission.email),
    subject,
    html,
    text,
  };
}
