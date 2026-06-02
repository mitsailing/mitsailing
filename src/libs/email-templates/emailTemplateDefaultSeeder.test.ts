import { describe, expect, it, vi } from 'vitest';
import type { EmailTemplateDefaultSeederPrisma } from '@/libs/email-templates/emailTemplateDefaultSeeder';
import { seedEditableEmailTemplateDefaults } from '@/libs/email-templates/emailTemplateDefaultSeeder';
import { defaultEmailTemplateRevisions } from '@/libs/email-templates/emailTemplateSeedDefaults';

function prismaMock(
  existingKeys: readonly string[] = []
): EmailTemplateDefaultSeederPrisma {
  return {
    emailTemplate: {
      create: vi.fn(async () => {
        const template = await Promise.resolve({ id: 'template_1' });
        return template;
      }),
      findMany: vi.fn(async () => {
        const templates = await Promise.resolve(
          existingKeys.map((key) => ({
            key,
          }))
        );
        return templates;
      }),
    },
  };
}

function transactionalDefaultRevision() {
  const revision = defaultEmailTemplateRevisions.find(
    (defaultRevision) => defaultRevision.family === 'event_payment'
  );
  if (!revision) {
    throw new Error('Expected at least one transactional email template.');
  }
  return revision;
}

describe('seedEditableEmailTemplateDefaults', () => {
  it('creates missing editable email template rows with draft revisions', async () => {
    const prisma = prismaMock();
    const transactionalRevision = transactionalDefaultRevision();

    await seedEditableEmailTemplateDefaults(prisma);

    expect(prisma.emailTemplate.findMany).toHaveBeenCalledWith({
      select: { key: true },
      where: {
        key: {
          in: defaultEmailTemplateRevisions.map((revision) => revision.key),
        },
      },
    });
    expect(prisma.emailTemplate.create).toHaveBeenCalledTimes(
      defaultEmailTemplateRevisions.length
    );
    expect(prisma.emailTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: transactionalRevision.key,
          revisions: {
            create: expect.objectContaining({
              renderHash: expect.any(String),
              status: 'draft',
            }),
          },
        }),
      })
    );
  });

  it('does not recreate existing template keys', async () => {
    const prisma = prismaMock(
      defaultEmailTemplateRevisions.map((revision) => revision.key)
    );

    await seedEditableEmailTemplateDefaults(prisma);

    expect(prisma.emailTemplate.create).not.toHaveBeenCalled();
  });
});
