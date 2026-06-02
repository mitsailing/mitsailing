'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@/generated/prisma/client';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import { prisma } from '@/libs/DB';
import {
  emailTemplateRenderHash,
  ensureEditableEmailTemplateDefaults,
} from '@/libs/email-templates/emailTemplateAdminQueries';
import type { EditableEmailTemplateKey } from '@/libs/email-templates/emailTemplateKeys';
import { isEditableEmailTemplateKey } from '@/libs/email-templates/emailTemplatePublishing';
import { renderEditableEmailTemplate } from '@/libs/email-templates/emailTemplateRendering';
import {
  sampleEmailTemplateContext,
  sampleEmailTemplateValues,
} from '@/libs/email-templates/emailTemplateSampleData';
import { sendTransactionalEmail } from '@/libs/email/sendTransactional';
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from '@/utils/emailValidation';
import { getI18nPath } from '@/utils/Helpers';

const ADMIN_EMAIL_TEMPLATES_PATH = '/admin/email-templates';

type EmailTemplateContentPayload = Readonly<{
  editorBodyHtml: string;
  previewText: string;
  renderedText: string;
  subject: string;
}>;

type EmailTemplateFormPayload = EmailTemplateContentPayload &
  Readonly<{
    editorJson: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
  }>;

type SafeJsonValue =
  | boolean
  | number
  | string
  | readonly (SafeJsonValue | null)[]
  | { readonly [key: string]: SafeJsonValue | null };

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function adminTemplatePath(key: EditableEmailTemplateKey) {
  return `${ADMIN_EMAIL_TEMPLATES_PATH}/${key}`;
}

function adminRedirect(locale: string, path: string, status?: string): never {
  const href = status ? `${path}?status=${encodeURIComponent(status)}` : path;
  redirect(getI18nPath(href, locale));
}

function inputJsonValue(value: unknown): SafeJsonValue | null {
  if (value === null) {
    return null;
  }
  if (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => inputJsonValue(item));
  }
  if (typeof value === 'object') {
    const jsonObject: Record<string, SafeJsonValue | null> = {};
    for (const [key, item] of Object.entries(value)) {
      jsonObject[key] = inputJsonValue(item);
    }
    return jsonObject;
  }
  return null;
}

function safeEditorJson(
  value: string
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (!value) {
    return Prisma.DbNull;
  }
  try {
    return inputJsonValue(JSON.parse(value)) ?? Prisma.DbNull;
  } catch {
    return Prisma.DbNull;
  }
}

function isUniqueConstraintError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function formPayload(formData: FormData): EmailTemplateFormPayload | null {
  const editorBodyHtml = formString(formData, 'editorBodyHtml');
  const previewText = formString(formData, 'previewText');
  const renderedText = formString(formData, 'renderedText');
  const subject = formString(formData, 'subject');
  if (!editorBodyHtml || !previewText || !renderedText || !subject) {
    return null;
  }
  return {
    editorBodyHtml,
    editorJson: safeEditorJson(formString(formData, 'editorJson')),
    previewText,
    renderedText,
    subject,
  };
}

async function editableTemplateId(
  locale: string,
  key: EditableEmailTemplateKey
): Promise<string> {
  await ensureEditableEmailTemplateDefaults();
  const template = await prisma.emailTemplate.findUnique({
    select: { id: true },
    where: { key },
  });
  if (!template) {
    adminRedirect(locale, ADMIN_EMAIL_TEMPLATES_PATH, 'not_found');
  }
  return template.id;
}

async function renderPayloadForValidation(params: {
  key: EditableEmailTemplateKey;
  payload: EmailTemplateContentPayload;
  revisionId: string;
}) {
  const rendered = await renderEditableEmailTemplate({
    context: sampleEmailTemplateContext(params.key),
    revision: {
      editorBodyHtml: params.payload.editorBodyHtml,
      id: params.revisionId,
      previewText: params.payload.previewText,
      renderedText: params.payload.renderedText,
      subject: params.payload.subject,
      template: { key: params.key },
    },
    values: sampleEmailTemplateValues(params.key),
  });
  return rendered;
}

export async function saveEmailTemplateDraftAction(
  locale: string,
  key: string,
  formData: FormData
): Promise<void> {
  const session = await requirePermission(Permission.NEWSLETTER_MANAGE, locale);
  if (!isEditableEmailTemplateKey(key)) {
    adminRedirect(locale, ADMIN_EMAIL_TEMPLATES_PATH, 'not_found');
  }
  const payload = formPayload(formData);
  const detailPath = adminTemplatePath(key);
  if (!payload) {
    adminRedirect(locale, detailPath, 'validation_failed');
  }

  const templateId = await editableTemplateId(locale, key);
  await prisma.emailTemplateRevision.create({
    data: {
      createdByUserId: session.user.id,
      editorBodyHtml: payload.editorBodyHtml,
      editorJson: payload.editorJson,
      previewText: payload.previewText,
      renderedText: payload.renderedText,
      renderHash: emailTemplateRenderHash(payload),
      status: 'draft',
      subject: payload.subject,
      templateId,
    },
  });

  revalidatePath(getI18nPath(ADMIN_EMAIL_TEMPLATES_PATH, locale));
  revalidatePath(getI18nPath(detailPath, locale));
  adminRedirect(locale, detailPath, 'draft_saved');
}

export async function publishEmailTemplateRevisionAction(
  locale: string,
  key: string,
  revisionId: string
): Promise<void> {
  const session = await requirePermission(Permission.NEWSLETTER_MANAGE, locale);
  if (!isEditableEmailTemplateKey(key)) {
    adminRedirect(locale, ADMIN_EMAIL_TEMPLATES_PATH, 'not_found');
  }
  const detailPath = adminTemplatePath(key);
  const revision = await prisma.emailTemplateRevision.findFirst({
    include: { template: { select: { key: true } } },
    where: { id: revisionId, template: { key } },
  });
  if (!revision) {
    adminRedirect(locale, detailPath, 'not_found');
  }

  const payload = {
    editorBodyHtml: revision.editorBodyHtml,
    editorJson: revision.editorJson,
    previewText: revision.previewText,
    renderedText: revision.renderedText,
    subject: revision.subject,
  };
  try {
    await renderPayloadForValidation({ key, payload, revisionId: revision.id });
  } catch {
    adminRedirect(locale, detailPath, 'render_failed');
  }

  try {
    await prisma.$transaction([
      prisma.emailTemplateRevision.updateMany({
        data: { status: 'archived' },
        where: {
          id: { not: revision.id },
          status: 'published',
          templateId: revision.templateId,
        },
      }),
      prisma.emailTemplateRevision.update({
        data: {
          publishedAt: new Date(),
          publishedByUserId: session.user.id,
          renderHash: emailTemplateRenderHash(payload),
          status: 'published',
        },
        where: { id: revision.id },
      }),
    ]);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      adminRedirect(locale, detailPath, 'publish_conflict');
    }
    throw error;
  }

  revalidatePath(getI18nPath(ADMIN_EMAIL_TEMPLATES_PATH, locale));
  revalidatePath(getI18nPath(detailPath, locale));
  adminRedirect(locale, detailPath, 'published');
}

export async function sendEmailTemplateTestAction(
  locale: string,
  key: string,
  formData: FormData
): Promise<void> {
  await requirePermission(Permission.NEWSLETTER_MANAGE, locale);
  if (!isEditableEmailTemplateKey(key)) {
    adminRedirect(locale, ADMIN_EMAIL_TEMPLATES_PATH, 'not_found');
  }
  const detailPath = adminTemplatePath(key);
  const email = normalizeEmailAddress(formString(formData, 'email'));
  if (!isValidEmailAddress(email)) {
    adminRedirect(locale, detailPath, 'invalid_test_email');
  }
  const payload = formPayload(formData);
  if (!payload) {
    adminRedirect(locale, detailPath, 'validation_failed');
  }

  let rendered: Awaited<ReturnType<typeof renderPayloadForValidation>>;
  try {
    rendered = await renderPayloadForValidation({
      key,
      payload,
      revisionId: 'admin-test',
    });
  } catch {
    adminRedirect(locale, detailPath, 'render_failed');
  }

  try {
    await sendTransactionalEmail({
      html: rendered.html,
      metadata: {
        emailTemplateKey: key,
        emailTemplateRevisionId: 'admin-test',
      },
      subject: `[TEST] ${rendered.subject}`,
      text: rendered.text,
      to: email,
    });
  } catch {
    adminRedirect(locale, detailPath, 'test_failed');
  }

  adminRedirect(locale, detailPath, 'test_sent');
}
