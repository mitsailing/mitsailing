'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { createNewsletterBroadcast } from '@/libs/newsletter/newsletterBroadcasts';
import type { CreateNewsletterBroadcastResult } from '@/libs/newsletter/newsletterBroadcasts';
import { sendNewsletterBroadcastTestEmail } from '@/libs/newsletter/newsletterEmail';
import { validateNewsletterBroadcastFormData } from '@/libs/newsletter/newsletterValidation';
import {
  isValidMarketingEmail,
  normalizeMarketingEmail,
} from '@/utils/emailValidation';
import { getI18nPath } from '@/utils/Helpers';

const ADMIN_LISTS_PATH = '/admin/newsletter-lists/';
const ADMIN_BROADCASTS_PATH = '/admin/newsletter-broadcasts/';
const ADMIN_TEMPLATES_PATH = '/admin/newsletter-templates/';

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function adminRedirect(locale: string, path: string, status?: string): never {
  const href = status ? `${path}?status=${encodeURIComponent(status)}` : path;
  redirect(getI18nPath(href, locale));
}

function slugFromName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
    .slice(0, 80);
}

function broadcastErrorCode(result: CreateNewsletterBroadcastResult): string {
  return result.ok ? 'saved' : result.error;
}

function adminBroadcastPath(broadcastId: string): string {
  return `${ADMIN_BROADCASTS_PATH}${broadcastId}/`;
}

/**
 * Creates a newsletter list/topic from the admin area.
 *
 * @param locale - Active locale
 * @param formData - Submitted form
 */
export async function createNewsletterListAction(
  locale: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const name = formString(formData, 'name');
  const slug = slugFromName(formString(formData, 'slug') || name);
  const description = formString(formData, 'description');
  const resendTopicId = formString(formData, 'resendTopicId');
  const defaultSubscription =
    formString(formData, 'defaultSubscription') === 'opt_in'
      ? 'opt_in'
      : 'opt_out';
  const visibility =
    formString(formData, 'visibility') === 'private' ? 'private' : 'public';

  if (name.length === 0 || slug.length === 0) {
    adminRedirect(locale, `${ADMIN_LISTS_PATH}new/`, 'validation_failed');
  }

  const existingList = await prisma.newsletterList.findFirst({
    select: { id: true },
    where: {
      OR: [{ slug }, ...(resendTopicId.length > 0 ? [{ resendTopicId }] : [])],
    },
  });
  if (existingList) {
    adminRedirect(locale, `${ADMIN_LISTS_PATH}new/`, 'duplicate_list');
  }

  await prisma.newsletterList.create({
    data: {
      defaultSubscription,
      description: description.length > 0 ? description : null,
      displayOrder: 100,
      name,
      resendTopicId: resendTopicId.length > 0 ? resendTopicId : null,
      slug,
      visibility,
    },
  });
  revalidatePath(getI18nPath(ADMIN_LISTS_PATH, locale));
  adminRedirect(locale, ADMIN_LISTS_PATH, 'created');
}

/**
 * Creates a reusable newsletter template row.
 *
 * @param locale - Active locale
 * @param formData - Submitted form
 */
export async function createNewsletterTemplateAction(
  locale: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const name = formString(formData, 'name');
  const slug = slugFromName(formString(formData, 'slug') || name);
  const description = formString(formData, 'description');
  if (name.length === 0 || slug.length === 0) {
    adminRedirect(locale, `${ADMIN_TEMPLATES_PATH}new/`, 'validation_failed');
  }

  const existingTemplate = await prisma.newsletterTemplate.findUnique({
    select: { id: true },
    where: { slug },
  });
  if (existingTemplate) {
    adminRedirect(locale, `${ADMIN_TEMPLATES_PATH}new/`, 'duplicate_template');
  }

  await prisma.newsletterTemplate.create({
    data: {
      description: description.length > 0 ? description : null,
      name,
      slug,
    },
  });
  revalidatePath(getI18nPath(ADMIN_TEMPLATES_PATH, locale));
  adminRedirect(locale, ADMIN_TEMPLATES_PATH, 'created');
}

/**
 * Creates a draft or queued newsletter broadcast.
 *
 * @param locale - Active locale
 * @param formData - Submitted composer data
 */
export async function createNewsletterBroadcastAction(
  locale: string,
  formData: FormData
): Promise<void> {
  const session = await requireAdmin(locale);
  const shouldQueue = formString(formData, 'intent') === 'queue';
  if (shouldQueue && !Env.REDIS_URL) {
    adminRedirect(locale, `${ADMIN_BROADCASTS_PATH}new/`, 'redis_unavailable');
  }

  const parsed = validateNewsletterBroadcastFormData(formData);
  if (!parsed.ok) {
    adminRedirect(locale, `${ADMIN_BROADCASTS_PATH}new/`, parsed.errors[0]);
  }

  const result = await createNewsletterBroadcast({
    ...parsed.data,
    createdByUserId: session.user.id,
    queueForSending: shouldQueue,
  });
  if (!result.ok) {
    adminRedirect(
      locale,
      `${ADMIN_BROADCASTS_PATH}new/`,
      broadcastErrorCode(result)
    );
  }

  revalidatePath(getI18nPath(ADMIN_BROADCASTS_PATH, locale));
  adminRedirect(
    locale,
    ADMIN_BROADCASTS_PATH,
    result.queued ? 'queued' : 'created'
  );
}

/**
 * Sends one admin test copy of a saved newsletter broadcast.
 *
 * @param locale - Active locale
 * @param broadcastId - Broadcast id
 * @param formData - Submitted recipient form
 */
export async function sendNewsletterBroadcastTestAction(
  locale: string,
  broadcastId: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const email = normalizeMarketingEmail(formString(formData, 'email'));
  const redirectPath = adminBroadcastPath(broadcastId);
  if (!isValidMarketingEmail(email)) {
    adminRedirect(locale, redirectPath, 'invalid_test_email');
  }

  const broadcast = await prisma.newsletterBroadcast.findUnique({
    include: { primaryList: true },
    where: { id: broadcastId },
  });
  if (!broadcast) {
    adminRedirect(locale, ADMIN_BROADCASTS_PATH, 'not_found');
  }

  try {
    await sendNewsletterBroadcastTestEmail({
      body: broadcast.body,
      email,
      listName: broadcast.primaryList.name,
      previewText: broadcast.previewText,
      subject: broadcast.subject,
    });
  } catch (error) {
    logger.error('Failed to send newsletter test broadcast: {error}', {
      broadcastId,
      error,
    });
    adminRedirect(locale, redirectPath, 'test_failed');
  }

  adminRedirect(locale, redirectPath, 'test_sent');
}
