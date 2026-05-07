import { isValidMarketingEmail } from '@/utils/emailValidation';

export const contactSubmissionFieldNames = {
  company: 'company',
  email: 'email',
  message: 'message',
  name: 'name',
} as const;

const CONTACT_NAME_MAX_LENGTH = 120;
const CONTACT_EMAIL_MAX_LENGTH = 254;
const CONTACT_MESSAGE_MIN_LENGTH = 10;
const CONTACT_MESSAGE_MAX_LENGTH = 4000;

export type ContactSubmissionField = 'name' | 'email' | 'message';

export type ContactSubmissionFieldError =
  | 'required'
  | 'invalid_email'
  | 'too_long'
  | 'too_short';

export type ContactSubmissionValidationResult =
  | {
      ok: true;
      data: {
        name: string;
        email: string;
        message: string;
      };
      spam: boolean;
    }
  | {
      ok: false;
      fieldErrors: Partial<
        Record<ContactSubmissionField, ContactSubmissionFieldError>
      >;
      spam: boolean;
    };

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Parses and validates the public contact form payload.
 *
 * @param formData - Raw browser form body
 * @returns Normalized data, field-level errors, and honeypot status
 */
export function validateContactSubmissionFormData(
  formData: FormData
): ContactSubmissionValidationResult {
  const name = formString(formData, contactSubmissionFieldNames.name);
  const email = formString(
    formData,
    contactSubmissionFieldNames.email
  ).toLowerCase();
  const message = formString(formData, contactSubmissionFieldNames.message);
  const company = formString(formData, contactSubmissionFieldNames.company);

  const fieldErrors: Partial<
    Record<ContactSubmissionField, ContactSubmissionFieldError>
  > = {};

  if (name.length === 0) {
    fieldErrors.name = 'required';
  } else if (name.length > CONTACT_NAME_MAX_LENGTH) {
    fieldErrors.name = 'too_long';
  }

  if (email.length === 0) {
    fieldErrors.email = 'required';
  } else if (email.length > CONTACT_EMAIL_MAX_LENGTH) {
    fieldErrors.email = 'too_long';
  } else if (!isValidMarketingEmail(email)) {
    fieldErrors.email = 'invalid_email';
  }

  if (message.length === 0) {
    fieldErrors.message = 'required';
  } else if (message.length < CONTACT_MESSAGE_MIN_LENGTH) {
    fieldErrors.message = 'too_short';
  } else if (message.length > CONTACT_MESSAGE_MAX_LENGTH) {
    fieldErrors.message = 'too_long';
  }

  const spam = company.length > 0;
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, spam };
  }

  return {
    ok: true,
    data: {
      name,
      email,
      message,
    },
    spam,
  };
}
