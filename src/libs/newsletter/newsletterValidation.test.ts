import { describe, expect, it } from 'vitest';
import { NEWSLETTER_TEMPLATE_ID } from '@/libs/newsletter/newsletterConstants';
import {
  validateNewsletterBroadcastFormData,
  validateNewsletterSignupFormData,
} from '@/libs/newsletter/newsletterValidation';

function broadcastFormData(params: { scheduledAt?: string } = {}) {
  const formData = new FormData();
  formData.set('subject', 'Spring sailing');
  formData.set('previewText', 'News from the pavilion');
  formData.set('body', 'The pavilion is open for the season.');
  if (params.scheduledAt) {
    formData.set('scheduledAt', params.scheduledAt);
  }
  formData.set('templateId', NEWSLETTER_TEMPLATE_ID);
  formData.append('listId', 'general');
  return formData;
}

function expectedBroadcastData(params: { scheduledAt: Date | null }) {
  return {
    body: 'The pavilion is open for the season.',
    listIds: ['general'],
    name: null,
    previewText: 'News from the pavilion',
    scheduledAt: params.scheduledAt,
    subject: 'Spring sailing',
    templateId: NEWSLETTER_TEMPLATE_ID,
  };
}

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
    const result = validateNewsletterBroadcastFormData(broadcastFormData());

    expect(result).toEqual({
      ok: true,
      data: expectedBroadcastData({ scheduledAt: null }),
    });
  });

  it('parses scheduled broadcasts in New York time', () => {
    const result = validateNewsletterBroadcastFormData(
      broadcastFormData({ scheduledAt: '2026-05-14T09:00' })
    );

    expect(result).toEqual({
      ok: true,
      data: expectedBroadcastData({
        scheduledAt: new Date('2026-05-14T13:00:00.000Z'),
      }),
    });
  });

  it('rejects invalid scheduled broadcast dates', () => {
    const result = validateNewsletterBroadcastFormData(
      broadcastFormData({ scheduledAt: '2026-02-31T09:00' })
    );

    expect(result).toEqual({
      ok: false,
      errors: ['scheduled_at_invalid'],
    });
  });
});
