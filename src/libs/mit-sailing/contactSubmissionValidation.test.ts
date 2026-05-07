import { describe, expect, it } from 'vitest';
import {
  contactSubmissionFieldNames,
  validateContactSubmissionFormData,
} from '@/libs/mit-sailing/contactSubmissionValidation';

function formData(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    form.set(key, value);
  }
  return form;
}

describe('validateContactSubmissionFormData', () => {
  it('normalizes valid contact form data', () => {
    const result = validateContactSubmissionFormData(
      formData({
        [contactSubmissionFieldNames.email]: ' ADA@Example.COM ',
        [contactSubmissionFieldNames.message]:
          ' I have a question about sailing classes. ',
        [contactSubmissionFieldNames.name]: ' Ada Lovelace ',
      })
    );

    expect(result).toEqual({
      ok: true,
      data: {
        email: 'ada@example.com',
        message: 'I have a question about sailing classes.',
        name: 'Ada Lovelace',
      },
      spam: false,
    });
  });

  it('returns field errors for invalid contact form data', () => {
    const result = validateContactSubmissionFormData(
      formData({
        [contactSubmissionFieldNames.email]: 'ada',
        [contactSubmissionFieldNames.message]: 'short',
        [contactSubmissionFieldNames.name]: '',
      })
    );

    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        email: 'invalid_email',
        message: 'too_short',
        name: 'required',
      },
      spam: false,
    });
  });

  it('flags honeypot submissions as spam', () => {
    const result = validateContactSubmissionFormData(
      formData({
        [contactSubmissionFieldNames.company]: 'Bots Incorporated',
        [contactSubmissionFieldNames.email]: 'ada@example.com',
        [contactSubmissionFieldNames.message]:
          'I have a question about accessibility.',
        [contactSubmissionFieldNames.name]: 'Ada Lovelace',
      })
    );

    expect(result).toEqual({
      ok: true,
      data: {
        email: 'ada@example.com',
        message: 'I have a question about accessibility.',
        name: 'Ada Lovelace',
      },
      spam: true,
    });
  });
});
