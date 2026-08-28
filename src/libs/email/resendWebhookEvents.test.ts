import type { WebhookEventPayload } from 'resend';
import { describe, expect, it } from 'vitest';
import {
  resendEmailProviderEventIdFromParts,
  resendProviderEventIdForWebhook,
} from '@/libs/email/resendWebhookEvents';

function deliveredEvent(params: {
  createdAt?: string;
  emailId?: string;
  id?: string;
}): WebhookEventPayload {
  return {
    created_at: params.createdAt ?? '2026-05-14T14:30:00.000Z',
    data: {
      created_at: '2026-05-14T14:29:59.000Z',
      email_id: params.emailId ?? 'email_123',
      from: 'MIT Sailing <news@mitsailing.test>',
      subject: 'Spring sailing',
      to: ['sailor@example.com'],
    },
    ...(params.id ? { id: params.id } : {}),
    type: 'email.delivered',
  } as WebhookEventPayload;
}

describe('resendProviderEventIdForWebhook', () => {
  it('prefers explicit svix ids', () => {
    const event = deliveredEvent({});

    expect(
      resendProviderEventIdForWebhook({
        event,
        providerEventId: 'svix_123',
      })
    ).toBe('svix_123');
  });

  it('falls back to the verified webhook event id', () => {
    const event = deliveredEvent({ id: 'event_123' });

    expect(
      resendProviderEventIdForWebhook({
        event,
        providerEventId: '   ',
      })
    ).toBe('event_123');
  });

  it('derives the same composite id from the event payload', () => {
    const event = deliveredEvent({});

    expect(resendProviderEventIdForWebhook({ event })).toBe(
      'email_123:email.delivered:2026-05-14T14:30:00.000Z'
    );
  });

  it('derives the same composite id when handlers pass parsed timestamp parts', () => {
    const event = deliveredEvent({ createdAt: 'not-a-date' });
    const occurredAt = new Date('2026-05-14T14:30:00.000Z');

    expect(
      resendProviderEventIdForWebhook({
        event,
        occurredAt,
        providerMessageId: 'email_123',
      })
    ).toBe(
      resendEmailProviderEventIdFromParts({
        occurredAt,
        providerMessageId: 'email_123',
        type: event.type,
      })
    );
  });

  it('matches the email ledger fallback when context omits a provider id', () => {
    const event = deliveredEvent({ createdAt: 'not-a-date' });
    const occurredAt = new Date('2026-05-14T14:30:00.000Z');
    const providerMessageId = 'email_123';

    const fromWebhook = resendProviderEventIdForWebhook({
      event,
      occurredAt,
      providerMessageId,
    });
    const fromParts = resendEmailProviderEventIdFromParts({
      occurredAt,
      providerMessageId,
      type: event.type,
    });

    expect(fromWebhook).toBe(fromParts);
    expect(fromWebhook).toBe(
      'email_123:email.delivered:2026-05-14T14:30:00.000Z'
    );
  });
});
