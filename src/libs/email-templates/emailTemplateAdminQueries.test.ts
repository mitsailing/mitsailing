import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultEmailTemplateRevisions } from '@/libs/email-templates/emailTemplateSeedDefaults';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  emailTemplateCreate: vi.fn(),
  emailTemplateFindMany: vi.fn(),
  emailTemplateFindUnique: vi.fn(),
  renderEditableEmailTemplate: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    emailTemplate: {
      create: mocks.emailTemplateCreate,
      findMany: mocks.emailTemplateFindMany,
      findUnique: mocks.emailTemplateFindUnique,
    },
  },
}));

vi.mock('@/libs/email-templates/emailTemplateRendering', () => ({
  renderEditableEmailTemplate: mocks.renderEditableEmailTemplate,
}));

const now = new Date('2026-06-02T12:00:00.000Z');
const older = new Date('2026-06-01T12:00:00.000Z');

function existingDefaultKeys() {
  return defaultEmailTemplateRevisions.map((revision) => ({
    key: revision.key,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.emailTemplateCreate.mockResolvedValue({ id: 'template_1' });
  mocks.emailTemplateFindMany.mockResolvedValue(existingDefaultKeys());
  mocks.emailTemplateFindUnique.mockResolvedValue(null);
  mocks.renderEditableEmailTemplate.mockResolvedValue({
    bodyHtml: '<p>Preview</p>',
    html: '<html>Preview</html>',
    previewText: 'Preview',
    subject: 'Subject',
    text: 'Preview',
  });
});

describe('ensureEditableEmailTemplateDefaults', () => {
  it('creates missing template rows with draft revisions only', async () => {
    mocks.emailTemplateFindMany.mockResolvedValueOnce([]);
    const { ensureEditableEmailTemplateDefaults } =
      await import('@/libs/email-templates/emailTemplateAdminQueries');

    await ensureEditableEmailTemplateDefaults();

    expect(mocks.emailTemplateCreate).toHaveBeenCalledTimes(
      defaultEmailTemplateRevisions.length
    );
    expect(mocks.emailTemplateCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: 'newsletter_broadcast',
          revisions: {
            create: expect.objectContaining({ status: 'draft' }),
          },
        }),
      })
    );
  });
});

describe('getAdminEmailTemplateList', () => {
  it('returns editable template rows with draft and published dates', async () => {
    mocks.emailTemplateFindMany
      .mockResolvedValueOnce(existingDefaultKeys())
      .mockResolvedValueOnce([
        {
          family: 'event_payment',
          key: 'event_payment_request',
          name: 'Event payment request',
          revisions: [
            {
              createdAt: now,
              editorBodyHtml: '<p>Draft</p>',
              editorJson: null,
              id: 'draft_1',
              previewText: 'Draft preview',
              publishedAt: null,
              renderedText: 'Draft',
              status: 'draft',
              subject: 'Draft subject',
              updatedAt: now,
            },
            {
              createdAt: older,
              editorBodyHtml: '<p>Published</p>',
              editorJson: null,
              id: 'published_1',
              previewText: 'Published preview',
              publishedAt: older,
              renderedText: 'Published',
              status: 'published',
              subject: 'Published subject',
              updatedAt: older,
            },
          ],
        },
        {
          family: 'custom',
          key: 'not_editable',
          name: 'Not editable',
          revisions: [],
        },
      ]);
    const { getAdminEmailTemplateList } =
      await import('@/libs/email-templates/emailTemplateAdminQueries');

    await expect(getAdminEmailTemplateList()).resolves.toEqual([
      {
        draftUpdatedAt: now,
        family: 'event_payment',
        key: 'event_payment_request',
        name: 'Event payment request',
        publishedAt: older,
        revisionCount: 2,
      },
    ]);
  });
});

describe('getAdminEmailTemplateDetail', () => {
  it('renders the active revision preview with sample data', async () => {
    mocks.emailTemplateFindUnique.mockResolvedValueOnce({
      family: 'event_payment',
      key: 'event_payment_request',
      name: 'Event payment request',
      revisions: [
        {
          createdAt: now,
          createdBy: { email: 'admin@example.com', name: 'Admin' },
          editorBodyHtml: '<p>Hello {eventName}</p>',
          editorJson: null,
          id: 'draft_1',
          previewText: 'Preview {eventName}',
          publishedAt: null,
          publishedBy: null,
          renderedText: 'Hello {eventName}',
          status: 'draft',
          subject: 'Subject {eventName}',
          updatedAt: now,
        },
      ],
    });
    const { getAdminEmailTemplateDetail } =
      await import('@/libs/email-templates/emailTemplateAdminQueries');

    const detail = await getAdminEmailTemplateDetail('event_payment_request');

    expect(detail?.previewHtml).toBe('<html>Preview</html>');
    expect(detail?.activeRevision?.id).toBe('draft_1');
    expect(mocks.renderEditableEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: expect.objectContaining({
          id: 'draft_1',
          template: { key: 'event_payment_request' },
        }),
      })
    );
  });

  it('returns null for non-editable keys', async () => {
    const { getAdminEmailTemplateDetail } =
      await import('@/libs/email-templates/emailTemplateAdminQueries');

    await expect(getAdminEmailTemplateDetail('account_locked')).resolves.toBe(
      null
    );

    expect(mocks.emailTemplateFindUnique).not.toHaveBeenCalled();
  });
});
