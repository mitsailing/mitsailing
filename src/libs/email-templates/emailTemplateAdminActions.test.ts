import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/generated/prisma/client';
import { Permission } from '@/libs/auth/permissions';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  emailTemplateFindUnique: vi.fn(),
  ensureEditableEmailTemplateDefaults: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  renderEditableEmailTemplate: vi.fn(),
  renderHash: vi.fn(() => 'hash_123'),
  requirePermission: vi.fn(),
  revalidatePath: vi.fn(),
  revisionCreate: vi.fn(),
  revisionFindFirst: vi.fn(),
  revisionUpdate: vi.fn(),
  revisionUpdateMany: vi.fn(),
  sendTransactionalEmail: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/libs/auth/dal', () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    $transaction: mocks.transaction,
    emailTemplate: {
      findUnique: mocks.emailTemplateFindUnique,
    },
    emailTemplateRevision: {
      create: mocks.revisionCreate,
      findFirst: mocks.revisionFindFirst,
      update: mocks.revisionUpdate,
      updateMany: mocks.revisionUpdateMany,
    },
  },
}));

vi.mock('@/libs/email-templates/emailTemplateAdminQueries', () => ({
  emailTemplateRenderHash: mocks.renderHash,
  ensureEditableEmailTemplateDefaults:
    mocks.ensureEditableEmailTemplateDefaults,
}));

vi.mock('@/libs/email-templates/emailTemplateRendering', () => ({
  renderEditableEmailTemplate: mocks.renderEditableEmailTemplate,
}));

vi.mock('@/libs/email/sendTransactional', () => ({
  sendTransactionalEmail: mocks.sendTransactionalEmail,
}));

vi.mock('@/utils/Helpers', () => ({
  getI18nPath: (path: string) => path,
}));

function templateFormData() {
  const formData = new FormData();
  formData.set('editorBodyHtml', '<p>Hello {eventName}</p>');
  formData.set('editorJson', '{"type":"doc"}');
  formData.set('previewText', 'Preview {eventName}');
  formData.set('renderedText', 'Hello {eventName}');
  formData.set('subject', 'Subject {eventName}');
  return formData;
}

const revision = {
  editorBodyHtml: '<p>Hello {eventName}</p>',
  editorJson: null,
  id: 'revision_1',
  previewText: 'Preview {eventName}',
  renderedText: 'Hello {eventName}',
  subject: 'Subject {eventName}',
  template: { key: 'event_payment_request' },
  templateId: 'template_1',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.emailTemplateFindUnique.mockResolvedValue({ id: 'template_1' });
  mocks.ensureEditableEmailTemplateDefaults.mockImplementation(async () => {
    await Promise.resolve();
  });
  mocks.renderEditableEmailTemplate.mockResolvedValue({
    bodyHtml: '<p>Hello Moonlight sail</p>',
    html: '<html>Hello Moonlight sail</html>',
    previewText: 'Preview Moonlight sail',
    subject: 'Subject Moonlight sail',
    text: 'Hello Moonlight sail',
  });
  mocks.requirePermission.mockResolvedValue({ user: { id: 'admin_1' } });
  mocks.revisionCreate.mockResolvedValue({ id: 'revision_2' });
  mocks.revisionFindFirst.mockResolvedValue(revision);
  mocks.revisionUpdate.mockResolvedValue({ id: 'revision_1' });
  mocks.revisionUpdateMany.mockResolvedValue({ count: 1 });
  mocks.sendTransactionalEmail.mockResolvedValue({
    providerMessageId: 'email_1',
  });
  mocks.transaction.mockResolvedValue([]);
});

describe('saveEmailTemplateDraftAction', () => {
  it('requires email template permission and saves a draft revision', async () => {
    const { saveEmailTemplateDraftAction } =
      await import('@/libs/email-templates/emailTemplateAdminActions');

    await expect(
      saveEmailTemplateDraftAction(
        'en',
        'event_payment_request',
        templateFormData()
      )
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/email-templates/event_payment_request?status=draft_saved'
    );

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.EMAIL_TEMPLATES_MANAGE,
      'en'
    );
    expect(mocks.revisionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        createdByUserId: 'admin_1',
        editorBodyHtml: '<p>Hello {eventName}</p>',
        editorJson: { type: 'doc' },
        renderHash: expect.any(String),
        status: 'draft',
        templateId: 'template_1',
      }),
    });
  });
});

describe('publishEmailTemplateRevisionAction', () => {
  it('renders before publishing the revision', async () => {
    const { publishEmailTemplateRevisionAction } =
      await import('@/libs/email-templates/emailTemplateAdminActions');

    await expect(
      publishEmailTemplateRevisionAction(
        'en',
        'event_payment_request',
        'revision_1'
      )
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/email-templates/event_payment_request?status=published'
    );

    expect(mocks.renderEditableEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: expect.objectContaining({ id: 'revision_1' }),
      })
    );
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.EMAIL_TEMPLATES_MANAGE,
      'en'
    );
    expect(mocks.revisionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'archived' },
        where: expect.objectContaining({ templateId: 'template_1' }),
      })
    );
    expect(mocks.revisionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publishedByUserId: 'admin_1',
          status: 'published',
        }),
        where: { id: 'revision_1' },
      })
    );
  });

  it('redirects render failures without publishing', async () => {
    mocks.renderEditableEmailTemplate.mockRejectedValueOnce(
      new Error('bad render')
    );
    const { publishEmailTemplateRevisionAction } =
      await import('@/libs/email-templates/emailTemplateAdminActions');

    await expect(
      publishEmailTemplateRevisionAction(
        'en',
        'event_payment_request',
        'revision_1'
      )
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/email-templates/event_payment_request?status=render_failed'
    );

    expect(mocks.revisionUpdateMany).not.toHaveBeenCalled();
    expect(mocks.revisionUpdate).not.toHaveBeenCalled();
  });

  it('redirects concurrent publish conflicts from unique constraint failures', async () => {
    mocks.transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        clientVersion: 'test',
        code: 'P2002',
        meta: {
          target: ['email_template_revisions_one_published_per_template_idx'],
        },
      })
    );
    const { publishEmailTemplateRevisionAction } =
      await import('@/libs/email-templates/emailTemplateAdminActions');

    await expect(
      publishEmailTemplateRevisionAction(
        'en',
        'event_payment_request',
        'revision_1'
      )
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/email-templates/event_payment_request?status=publish_conflict'
    );

    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe('sendEmailTemplateTestAction', () => {
  it('renders form content and sends a test email', async () => {
    const formData = templateFormData();
    formData.set('email', 'admin@example.com');
    const { sendEmailTemplateTestAction } =
      await import('@/libs/email-templates/emailTemplateAdminActions');

    await expect(
      sendEmailTemplateTestAction('en', 'event_payment_request', formData)
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/email-templates/event_payment_request?status=test_sent'
    );

    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: '<html>Hello Moonlight sail</html>',
        metadata: {
          emailTemplateKey: 'event_payment_request',
          emailTemplateRevisionId: 'admin-test',
        },
        subject: '[TEST] Subject Moonlight sail',
        text: 'Hello Moonlight sail',
        to: 'admin@example.com',
      })
    );
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.EMAIL_TEMPLATES_MANAGE,
      'en'
    );
  });
});
