import 'server-only';
import { prisma } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import {
  defaultSiteTextMessages,
  mergeSiteTextMessages,
} from '@/libs/site-text/siteTextMessages';
import type { MessageCatalog } from '@/libs/site-text/siteTextMessages';

const mergedMessagesByLocale = new Map<string, MessageCatalog>();

/**
 * Clears the process-local message cache after an admin text edit.
 *
 * @param locale - Locale whose merged messages should be reloaded
 */
export function clearMergedSiteTextMessagesCache(locale: string): void {
  mergedMessagesByLocale.delete(locale);
}

/**
 * Loads file-backed messages overlaid with DB overrides, cached per process.
 *
 * @param locale - Requested locale
 * @returns Merged next-intl messages
 */
export async function getMergedSiteTextMessages(
  locale: string
): Promise<MessageCatalog> {
  const cached = mergedMessagesByLocale.get(locale);
  if (cached) {
    return cached;
  }

  if (locale !== 'en') {
    return defaultSiteTextMessages;
  }

  try {
    const overrides = await prisma.siteTextOverride.findMany({
      where: { locale },
      select: {
        namespace: true,
        key: true,
        value: true,
      },
    });
    const merged = mergeSiteTextMessages(defaultSiteTextMessages, overrides);
    mergedMessagesByLocale.set(locale, merged);
    return merged;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to load site text overrides: ${message}`);
    return defaultSiteTextMessages;
  }
}
