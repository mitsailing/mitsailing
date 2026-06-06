import 'server-only';
import { prisma } from '@/libs/DB';
import { seedEditableEmailTemplateDefaults } from '@/libs/email-templates/emailTemplateDefaultSeeder';
import type { EditableEmailTemplateKey } from '@/libs/email-templates/emailTemplateKeys';
import {
  choosePublishedRevision,
  isEditableEmailTemplateKey,
} from '@/libs/email-templates/emailTemplatePublishing';
import { renderEditableEmailTemplate } from '@/libs/email-templates/emailTemplateRendering';
import {
  sampleEmailTemplateContext,
  sampleEmailTemplateValues,
} from '@/libs/email-templates/emailTemplateSampleData';
import { defaultEmailTemplateRevisions } from '@/libs/email-templates/emailTemplateSeedDefaults';

type EmailTemplateRevisionRow = Readonly<{
  createdAt: Date;
  editorBodyHtml: string;
  editorJson: unknown;
  id: string;
  previewText: string;
  publishedAt: Date | null;
  renderedText: string;
  status: 'archived' | 'draft' | 'published';
  subject: string;
  updatedAt: Date;
  createdBy?: { email: string | null; name: string | null } | null;
  publishedBy?: { email: string | null; name: string | null } | null;
}>;

export type AdminEmailTemplateListRow = Readonly<{
  draftUpdatedAt: Date | null;
  family: string;
  key: EditableEmailTemplateKey;
  name: string;
  publishedAt: Date | null;
  revisionCount: number;
}>;

export type AdminEmailTemplateDetail = Readonly<{
  activeRevision: EmailTemplateRevisionRow | null;
  family: string;
  key: EditableEmailTemplateKey;
  name: string;
  previewError: boolean;
  previewHtml: string | null;
  publishedRevision: EmailTemplateRevisionRow | null;
  revisions: readonly EmailTemplateRevisionRow[];
}>;

function latestDraftRevision(
  revisions: readonly EmailTemplateRevisionRow[]
): EmailTemplateRevisionRow | null {
  return revisions.find((revision) => revision.status === 'draft') ?? null;
}

function editableDefaultByKey(key: EditableEmailTemplateKey) {
  return (
    defaultEmailTemplateRevisions.find((revision) => revision.key === key) ??
    null
  );
}

function revisionForRenderer(
  key: EditableEmailTemplateKey,
  revision: EmailTemplateRevisionRow
) {
  return {
    editorBodyHtml: revision.editorBodyHtml,
    id: revision.id,
    previewText: revision.previewText,
    renderedText: revision.renderedText,
    subject: revision.subject,
    template: { key },
  };
}

/**
 * Creates missing editable email template defaults as draft revisions.
 */
export async function ensureEditableEmailTemplateDefaults(): Promise<void> {
  await seedEditableEmailTemplateDefaults(prisma);
}

export async function getAdminEmailTemplateList(): Promise<
  AdminEmailTemplateListRow[]
> {
  await ensureEditableEmailTemplateDefaults();
  const templates = await prisma.emailTemplate.findMany({
    include: {
      revisions: {
        orderBy: { createdAt: 'desc' },
        select: {
          createdAt: true,
          editorBodyHtml: true,
          editorJson: true,
          id: true,
          previewText: true,
          publishedAt: true,
          renderedText: true,
          status: true,
          subject: true,
          updatedAt: true,
        },
      },
    },
    orderBy: [{ family: 'asc' }, { name: 'asc' }],
  });

  return templates.flatMap((template) => {
    if (!isEditableEmailTemplateKey(template.key)) {
      return [];
    }
    const { key } = template;
    const { revisions } = template;
    const draft = latestDraftRevision(revisions);
    const published = choosePublishedRevision(revisions);
    return [
      {
        draftUpdatedAt: draft?.updatedAt ?? null,
        family: template.family,
        key,
        name: template.name,
        publishedAt: published?.publishedAt ?? null,
        revisionCount: revisions.length,
      },
    ];
  });
}

export async function getAdminEmailTemplateDetail(
  key: string
): Promise<AdminEmailTemplateDetail | null> {
  if (!isEditableEmailTemplateKey(key)) {
    return null;
  }

  await ensureEditableEmailTemplateDefaults();
  const template = await prisma.emailTemplate.findUnique({
    include: {
      revisions: {
        include: {
          createdBy: { select: { email: true, name: true } },
          publishedBy: { select: { email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    where: { key },
  });
  if (!template) {
    const fallback = editableDefaultByKey(key);
    if (!fallback) {
      return null;
    }
    return {
      activeRevision: null,
      family: fallback.family,
      key,
      name: fallback.name,
      previewError: false,
      previewHtml: null,
      publishedRevision: null,
      revisions: [],
    };
  }

  const { revisions } = template;
  const publishedRevision = choosePublishedRevision(revisions);
  const activeRevision =
    latestDraftRevision(revisions) ??
    publishedRevision ??
    revisions.at(0) ??
    null;
  let previewError = false;
  let previewHtml: string | null = null;
  if (activeRevision) {
    try {
      const rendered = await renderEditableEmailTemplate({
        context: sampleEmailTemplateContext(key),
        revision: revisionForRenderer(key, activeRevision),
        values: sampleEmailTemplateValues(key),
      });
      previewHtml = rendered.html;
    } catch {
      previewError = true;
    }
  }

  return {
    activeRevision,
    family: template.family,
    key,
    name: template.name,
    previewError,
    previewHtml,
    publishedRevision,
    revisions,
  };
}
