import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { getMergedSiteTextMessages } from '@/libs/site-text/siteTextMessageLoader';
import { routing } from './I18nRouting';

// Default locale and message files live under `src/locales/` (next-intl).
// Add or edit non-default locale JSON there, or re-enable Crowdin when ready.

export default getRequestConfig(async ({ requestLocale }) => {
  // Typically corresponds to the `[locale]` segment
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: await getMergedSiteTextMessages(locale),
  };
});
