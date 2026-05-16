import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { connection } from 'next/server';
import { NewsletterPreferenceForm } from '@/components/mit-sailing/newsletter/NewsletterPreferenceForm';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { logger } from '@/libs/Logger';
import { updateTokenNewsletterPreferencesAction } from '@/libs/newsletter/newsletterActions';
import { newsletterPreferenceRows } from '@/libs/newsletter/newsletterPreferenceRows';
import {
  getPublicNewsletterLists,
  getSubscriberPreferenceStateByToken,
} from '@/libs/newsletter/newsletterSubscriptions';

type NewsletterManagePageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}>;

function newsletterManageToken(value?: string | string[]): string | undefined {
  if (Array.isArray(value)) {
    if (value.length > 1) {
      logger.warn(
        'Rejected newsletter manage request with repeated token params',
        {
          tokenCount: value.length,
        }
      );
      return undefined;
    }
    const [token] = value;
    return token && token.length > 0 ? token : undefined;
  }
  return value && value.length > 0 ? value : undefined;
}

export async function generateMetadata(
  props: NewsletterManagePageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'NewsletterPage' });
  return { title: t('manage_meta_title') };
}

/**
 * Tokenized public preference management page.
 *
 * @param props - Page params and token search param
 * @returns Manage page
 */
export default async function NewsletterManagePage(
  props: NewsletterManagePageProps
) {
  await connection();
  const { locale } = await props.params;
  const searchParams = await props.searchParams;
  const token = newsletterManageToken(searchParams.token);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'NewsletterPage' });
  const routes = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  const subscriber = token
    ? await getSubscriberPreferenceStateByToken(token)
    : null;
  const lists = await getPublicNewsletterLists();

  return (
    <SiteSectionShell
      locale={locale}
      segments={[
        { label: routes('section_newsletter'), href: '/newsletter' },
        { label: t('manage_heading') },
      ]}
    >
      <SiteSectionMain maxWidth="5xl" variant="detail">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold text-mit-text">
              {t('manage_heading')}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-mit-text">
              {subscriber
                ? t('manage_intro', { email: subscriber.email })
                : t('manage_invalid')}
            </p>
          </div>
          {token && subscriber ? (
            <NewsletterPreferenceForm
              action={updateTokenNewsletterPreferencesAction.bind(
                null,
                token,
                locale
              )}
              errorLabel={t('preferences_error')}
              legendLabel={t('lists_label')}
              lists={newsletterPreferenceRows(lists, subscriber)}
              successLabel={t('preferences_saved')}
              submitLabel={t('preferences_submit')}
            />
          ) : null}
        </div>
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
