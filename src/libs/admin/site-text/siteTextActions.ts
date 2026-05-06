'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { clearMergedSiteTextMessagesCache } from '@/libs/site-text/siteTextMessageLoader';
import {
  getDefaultSiteTextValue,
  validateSiteTextOverrideValue,
} from '@/libs/site-text/siteTextMessages';
import { getI18nPath } from '@/utils/Helpers';

const SITE_TEXT_PATH = '/admin/site_text/';

function siteTextRedirect(locale: string, status: string): never {
  redirect(`${getI18nPath(SITE_TEXT_PATH, locale)}?status=${status}`);
}

function refreshSiteText(locale: string): void {
  clearMergedSiteTextMessagesCache(locale);
  revalidatePath(getI18nPath('/', locale), 'layout');
  revalidatePath(getI18nPath(SITE_TEXT_PATH, locale));
}

/**
 * Saves a live DB override for one site text key.
 *
 * @param locale - Active locale
 * @param namespace - Locale namespace
 * @param key - Locale key
 * @param formData - Submitted override value
 */
export async function saveSiteTextOverrideAction(
  locale: string,
  namespace: string,
  key: string,
  formData: FormData
): Promise<void> {
  const session = await requireAdmin(locale);
  const defaultValue = getDefaultSiteTextValue(namespace, key);
  if (defaultValue === null) {
    siteTextRedirect(locale, 'unknown_key');
  }

  const value = formData.get('value');
  if (typeof value !== 'string') {
    siteTextRedirect(locale, 'validation_failed');
  }
  if (value.trim().length === 0) {
    siteTextRedirect(locale, 'validation_failed');
  }

  const validation = validateSiteTextOverrideValue(defaultValue, value);
  if (!validation.ok) {
    siteTextRedirect(locale, validation.code);
  }

  await (value === defaultValue
    ? prisma.siteTextOverride.deleteMany({
        where: { locale, namespace, key },
      })
    : prisma.siteTextOverride.upsert({
        where: {
          locale_namespace_key: {
            locale,
            namespace,
            key,
          },
        },
        create: {
          locale,
          namespace,
          key,
          value,
          updatedByUserId: session.user.id,
        },
        update: {
          value,
          updatedByUserId: session.user.id,
        },
      }));

  refreshSiteText(locale);
  siteTextRedirect(locale, 'saved');
}

/**
 * Removes the DB override so the file default becomes live again.
 *
 * @param locale - Active locale
 * @param namespace - Locale namespace
 * @param key - Locale key
 */
export async function resetSiteTextOverrideAction(
  locale: string,
  namespace: string,
  key: string
): Promise<void> {
  await requireAdmin(locale);
  const defaultValue = getDefaultSiteTextValue(namespace, key);
  if (defaultValue === null) {
    siteTextRedirect(locale, 'unknown_key');
  }

  await prisma.siteTextOverride.deleteMany({
    where: { locale, namespace, key },
  });

  refreshSiteText(locale);
  siteTextRedirect(locale, 'reset');
}
