import * as Sentry from '@sentry/nextjs';
import * as React from 'react';
import { render as renderEmail } from 'react-email';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SafeEmailTemplateBodyHtml } from '@/libs/email-templates/emailTemplateBodyHtml';
import {
  EmailTemplateRenderError,
  renderEditableEmailTemplate,
  sanitizeEmailTemplateBodyHtml,
} from '@/libs/email-templates/emailTemplateRendering';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

const revision = {
  editorBodyHtml: '<p>Hello {eventName}</p>',
  id: 'revision-1',
  previewText: 'Preview for {eventName}',
  renderedText: 'Hello {eventName}',
  subject: 'Subject for {eventName}',
  template: {
    key: 'event_payment_request',
  },
} as const;

const eventPaymentValues = {
  amount: '$25.00',
  checkoutUrl: 'https://example.com/pay',
  deadline: 'June 15, 2026',
  eventAddress: '134 Memorial Drive',
  eventAddressUrl: null,
  eventName: 'Moonlight sail',
  recipientName: 'Avery Sailor',
  selectedFeeDescription: 'Guest fee',
} as const;

describe('sanitizeEmailTemplateBodyHtml', () => {
  it('removes script tags from editor body html', () => {
    expect(
      sanitizeEmailTemplateBodyHtml('<p>Hello</p><script>alert(1)</script>')
    ).toBe('<p>Hello</p>');
  });

  it('keeps only formatting that the email renderer preserves', async () => {
    const html = await renderEmail(
      React.createElement(SafeEmailTemplateBodyHtml, {
        html: '<p><strong>Hello</strong> <em>sailors</em></p><ol><li>First</li></ol>',
      })
    );

    expect(
      sanitizeEmailTemplateBodyHtml(
        '<p><strong>Hello</strong> <em>sailors</em></p><ol><li>First</li></ol>'
      )
    ).toBe('<p>Hello sailors</p><li>First</li>');
    expect(html).toContain('Hello sailors');
    expect(html).toContain('• ');
    expect(html).toContain('First');
    expect(html).not.toContain('<strong');
    expect(html).not.toContain('<em');
    expect(html).not.toContain('<ol');
    expect(html).not.toContain('<ul');
  });
});

describe('renderEditableEmailTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('interpolates known tokens before rendering', async () => {
    const rendered = await renderEditableEmailTemplate({
      revision,
      values: eventPaymentValues,
    });

    expect(rendered.subject).toBe('Subject for Moonlight sail');
    expect(rendered.previewText).toBe('Preview for Moonlight sail');
    expect(rendered.text).toContain('Hello Moonlight sail');
    expect(rendered.html).toContain('Moonlight sail');
  });

  it('captures Sentry and throws before send when an unknown token exists', async () => {
    await expect(
      renderEditableEmailTemplate({
        revision: {
          ...revision,
          editorBodyHtml: '<p>Hello {badToken}</p>',
        },
        values: eventPaymentValues,
      })
    ).rejects.toBeInstanceOf(EmailTemplateRenderError);

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(EmailTemplateRenderError),
      expect.objectContaining({
        tags: expect.objectContaining({
          emailTemplateKey: 'event_payment_request',
          emailTemplateRevisionId: 'revision-1',
        }),
      })
    );
  });
});
