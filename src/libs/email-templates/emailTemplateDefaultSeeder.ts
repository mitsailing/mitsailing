import { createHash } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import type { EditableEmailTemplateKey } from '@/libs/email-templates/emailTemplateKeys';
import { defaultEmailTemplateRevisions } from '@/libs/email-templates/emailTemplateSeedDefaults';

export type EmailTemplateDefaultSeederPrisma = Readonly<{
  emailTemplate: Readonly<{
    create(args: Prisma.EmailTemplateCreateArgs): Promise<unknown>;
    findMany(args: {
      select: { key: true };
      where: { key: { in: EditableEmailTemplateKey[] } };
    }): Promise<readonly { key: string }[]>;
  }>;
}>;

export function emailTemplateRenderHash(params: {
  editorBodyHtml: string;
  previewText: string;
  renderedText: string;
  subject: string;
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        editorBodyHtml: params.editorBodyHtml,
        previewText: params.previewText,
        renderedText: params.renderedText,
        subject: params.subject,
      })
    )
    .digest('hex');
}

export async function seedEditableEmailTemplateDefaults(
  p: EmailTemplateDefaultSeederPrisma
): Promise<void> {
  const keys = defaultEmailTemplateRevisions.map((revision) => revision.key);
  const existing = await p.emailTemplate.findMany({
    select: { key: true },
    where: { key: { in: keys } },
  });
  const existingKeys = new Set(existing.map((template) => template.key));
  const missingDefaults = defaultEmailTemplateRevisions.filter(
    (revision) => !existingKeys.has(revision.key)
  );

  for (const revision of missingDefaults) {
    await p.emailTemplate.create({
      data: {
        family: revision.family,
        key: revision.key,
        name: revision.name,
        revisions: {
          create: {
            editorBodyHtml: revision.editorBodyHtml,
            editorJson: Prisma.DbNull,
            previewText: revision.previewText,
            renderedText: revision.renderedText,
            renderHash: emailTemplateRenderHash(revision),
            status: 'draft',
            subject: revision.subject,
          },
        },
      },
    });
  }
}
