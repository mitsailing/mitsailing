import { describe, expect, it } from 'vitest';
import {
  resendEmailProviderEventIdFromParts,
  resendProviderEventIdForWebhook,
} from '@/libs/email/resendWebhookEvents';
import {
  RESEND_TEST_EMAIL_ID,
  buildResendDeliveredWebhookPayload,
} from '@/libs/email/resendWebhookTestFixtures';

describe('resendProviderEventIdForWebhook', () => {
  it('prefers explicit svix ids', () => {
    const event = buildResendDeliveredWebhookPayload({});

    expect(
      resendProviderEventIdForWebhook({
        event,
        providerEventId: 'svix_123',
      })
    ).toBe('svix_123');
  });

  it('falls back to the verified webhook event id', () => {
    const event = buildResendDeliveredWebhookPayload({ id: 'event_123' });

    expect(
      resendProviderEventIdForWebhook({
        event,
        providerEventId: '   ',
      })
    ).toBe('event_123');
  });

  it('derives the same composite id from the event payload', () => {
    const event = buildResendDeliveredWebhookPayload({});

    expect(resendProviderEventIdForWebhook({ event })).toBe(
      `${RESEND_TEST_EMAIL_ID}:email.delivered:2026-05-14T14:30:00.000Z`
    );
  });

  it('derives the same composite id when handlers pass parsed timestamp parts', () => {
    const event = buildResendDeliveredWebhookPayload({
      createdAt: 'not-a-date',
    });
    const occurredAt = new Date('2026-05-14T14:30:00.000Z');

    expect(
      resendProviderEventIdForWebhook({
        event,
        occurredAt,
        providerMessageId: RESEND_TEST_EMAIL_ID,
      })
    ).toBe(
      resendEmailProviderEventIdFromParts({
        occurredAt,
        providerMessageId: RESEND_TEST_EMAIL_ID,
        type: event.type,
      })
    );
  });

  it('matches the email ledger fallback when context omits a provider id', () => {
    const event = buildResendDeliveredWebhookPayload({
      createdAt: 'not-a-date',
    });
    const occurredAt = new Date('2026-05-14T14:30:00.000Z');

    const fromWebhook = resendProviderEventIdForWebhook({
      event,
      occurredAt,
      providerMessageId: RESEND_TEST_EMAIL_ID,
    });
    const fromParts = resendEmailProviderEventIdFromParts({
      occurredAt,
      providerMessageId: RESEND_TEST_EMAIL_ID,
      type: event.type,
    });

    expect(fromWebhook).toBe(fromParts);
    expect(fromWebhook).toBe(
      `${RESEND_TEST_EMAIL_ID}:email.delivered:2026-05-14T14:30:00.000Z`
    );
  });
});
