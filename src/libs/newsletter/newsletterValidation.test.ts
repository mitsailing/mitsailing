import { describe, expect, it } from 'vitest';
import {
  validateNewsletterBroadcastFormData,
  validateNewsletterSignupFormData,
} from '@/libs/newsletter/newsletterValidation';

describe('newsletter validation', () => {
  it('adds general to public signup lists', () => {
    const formData = new FormData();
    formData.set('email', 'Sailor@Example.com');
    formData.append('list', 'racing');

    const result = validateNewsletterSignupFormData(formData);

    expect(result).toEqual({
      ok: true,
      data: {
        email: 'sailor@example.com',
        listSlugs: ['general', 'racing'],
        name: null,
      },
      spam: false,
    });
  });

  it('rejects invalid public signup email', () => {
    const formData = new FormData();
    formData.set('email', 'not-an-email');

    const result = validateNewsletterSignupFormData(formData);

    expect(result).toEqual({
      ok: false,
      fieldErrors: { email: 'invalid_email' },
      spam: false,
    });
  });

  it('accepts a complete broadcast', () => {
    const formData = new FormData();
    formData.set('subject', 'Spring sailing');
    formData.set('previewText', 'News from the pavilion');
    formData.set('body', 'The pavilion is open for the season.');
    formData.set('templateId', 'standard');
    formData.append('listId', 'general');

    const result = validateNewsletterBroadcastFormData(formData);

    expect(result).toEqual({
      ok: true,
      data: {
        body: 'The pavilion is open for the season.',
        listIds: ['general'],
        name: null,
        previewText: 'News from the pavilion',
        scheduledAt: null,
        subject: 'Spring sailing',
        templateId: 'standard',
      },
    });
  });

  it('parses scheduled broadcasts in New York time', () => {
    const formData = new FormData();
    formData.set('subject', 'Spring sailing');
    formData.set('previewText', 'News from the pavilion');
    formData.set('body', 'The pavilion is open for the season.');
    formData.set('scheduledAt', '2026-05-14T09:00');
    formData.set('templateId', 'standard');
    formData.append('listId', 'general');

    const result = validateNewsletterBroadcastFormData(formData);

    expect(result).toEqual({
      ok: true,
      data: {
        body: 'The pavilion is open for the season.',
        listIds: ['general'],
        name: null,
        previewText: 'News from the pavilion',
        scheduledAt: new Date('2026-05-14T13:00:00.000Z'),
        subject: 'Spring sailing',
        templateId: 'standard',
      },
    });
  });

  it('rejects invalid scheduled broadcast dates', () => {
    const formData = new FormData();
    formData.set('subject', 'Spring sailing');
    formData.set('previewText', 'News from the pavilion');
    formData.set('body', 'The pavilion is open for the season.');
    formData.set('scheduledAt', '2026-02-31T09:00');
    formData.set('templateId', 'standard');
    formData.append('listId', 'general');

    const result = validateNewsletterBroadcastFormData(formData);

    expect(result).toEqual({
      ok: false,
      errors: ['scheduled_at_invalid'],
    });
  });
});
