import { isNewsletterListSlug } from '@/libs/newsletter/newsletterConstants';
import type { NewsletterListSlug } from '@/libs/newsletter/newsletterConstants';
import { isValidMarketingEmail } from '@/utils/emailValidation';

export const newsletterSignupFieldNames = {
  company: 'company',
  email: 'email',
  list: 'list',
  name: 'name',
} as const;

const newsletterBroadcastFieldNames = {
  body: 'body',
  listId: 'listId',
  name: 'name',
  previewText: 'previewText',
  subject: 'subject',
  templateId: 'templateId',
} as const;

export type NewsletterSignupField = 'email';

export type NewsletterSignupFieldError =
  | 'required'
  | 'invalid_email'
  | 'too_long';

export type NewsletterSignupValidationResult =
  | {
      ok: true;
      data: {
        email: string;
        listSlugs: NewsletterListSlug[];
        name: string | null;
      };
      spam: boolean;
    }
  | {
      ok: false;
      fieldErrors: Partial<
        Record<NewsletterSignupField, NewsletterSignupFieldError>
      >;
      spam: boolean;
    };

const NEWSLETTER_NAME_MAX_LENGTH = 120;
const NEWSLETTER_EMAIL_MAX_LENGTH = 254;
const BROADCAST_SHORT_MAX_LENGTH = 200;
const BROADCAST_BODY_MIN_LENGTH = 10;
const BROADCAST_BODY_MAX_LENGTH = 20_000;

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function formStrings(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function uniqueNewsletterSlugs(
  values: readonly string[]
): NewsletterListSlug[] {
  const slugs = new Set<NewsletterListSlug>();
  for (const value of values) {
    if (isNewsletterListSlug(value)) {
      slugs.add(value);
    }
  }
  return [...slugs];
}

/**
 * Normalizes a submitted email for newsletter storage.
 *
 * @param email - Raw email
 * @returns Lowercase email
 */
export function normalizeNewsletterEmail(email: string): string {
  return email.trim().toLocaleLowerCase();
}

/**
 * Parses and validates the public newsletter signup form.
 *
 * @param formData - Raw browser form body
 * @returns Normalized signup data, errors, and honeypot status
 */
export function validateNewsletterSignupFormData(
  formData: FormData
): NewsletterSignupValidationResult {
  const email = normalizeNewsletterEmail(
    formString(formData, newsletterSignupFieldNames.email)
  );
  const nameRaw = formString(formData, newsletterSignupFieldNames.name);
  const company = formString(formData, newsletterSignupFieldNames.company);
  const fieldErrors: Partial<
    Record<NewsletterSignupField, NewsletterSignupFieldError>
  > = {};

  if (email.length === 0) {
    fieldErrors.email = 'required';
  } else if (email.length > NEWSLETTER_EMAIL_MAX_LENGTH) {
    fieldErrors.email = 'too_long';
  } else if (!isValidMarketingEmail(email)) {
    fieldErrors.email = 'invalid_email';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, spam: company.length > 0 };
  }

  const selectedSlugs = uniqueNewsletterSlugs(
    formStrings(formData, newsletterSignupFieldNames.list)
  );
  const listSlugs: NewsletterListSlug[] = selectedSlugs.includes('general')
    ? selectedSlugs
    : ['general', ...selectedSlugs];
  const name =
    nameRaw.length > 0 ? nameRaw.slice(0, NEWSLETTER_NAME_MAX_LENGTH) : null;

  return {
    ok: true,
    data: { email, listSlugs, name },
    spam: company.length > 0,
  };
}

export type NewsletterBroadcastValidationError =
  | 'body_required'
  | 'body_too_long'
  | 'body_too_short'
  | 'lists_required'
  | 'preview_required'
  | 'preview_too_long'
  | 'subject_required'
  | 'subject_too_long'
  | 'template_required';

export type NewsletterBroadcastValidationResult =
  | {
      ok: true;
      data: {
        body: string;
        listIds: string[];
        name: string | null;
        previewText: string;
        subject: string;
        templateId: string;
      };
    }
  | {
      ok: false;
      errors: NewsletterBroadcastValidationError[];
    };

/**
 * Parses and validates the admin broadcast composer.
 *
 * @param formData - Raw browser form body
 * @returns Normalized broadcast data or validation errors
 */
export function validateNewsletterBroadcastFormData(
  formData: FormData
): NewsletterBroadcastValidationResult {
  const subject = formString(formData, newsletterBroadcastFieldNames.subject);
  const previewText = formString(
    formData,
    newsletterBroadcastFieldNames.previewText
  );
  const body = formString(formData, newsletterBroadcastFieldNames.body);
  const name = formString(formData, newsletterBroadcastFieldNames.name);
  const templateId = formString(
    formData,
    newsletterBroadcastFieldNames.templateId
  );
  const listIds = [...new Set(formStrings(formData, 'listId'))];
  const errors: NewsletterBroadcastValidationError[] = [];

  if (subject.length === 0) {
    errors.push('subject_required');
  } else if (subject.length > BROADCAST_SHORT_MAX_LENGTH) {
    errors.push('subject_too_long');
  }

  if (previewText.length === 0) {
    errors.push('preview_required');
  } else if (previewText.length > BROADCAST_SHORT_MAX_LENGTH) {
    errors.push('preview_too_long');
  }

  if (body.length === 0) {
    errors.push('body_required');
  } else if (body.length < BROADCAST_BODY_MIN_LENGTH) {
    errors.push('body_too_short');
  } else if (body.length > BROADCAST_BODY_MAX_LENGTH) {
    errors.push('body_too_long');
  }

  if (templateId.length === 0) {
    errors.push('template_required');
  }

  if (listIds.length === 0) {
    errors.push('lists_required');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      body,
      listIds,
      name: name.length > 0 ? name.slice(0, BROADCAST_SHORT_MAX_LENGTH) : null,
      previewText,
      subject,
      templateId,
    },
  };
}
