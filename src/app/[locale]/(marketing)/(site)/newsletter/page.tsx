import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { connection } from 'next/server';
import { NewsletterPreferenceForm } from '@/components/mit-sailing/newsletter/NewsletterPreferenceForm';
import { NewsletterSignupForm } from '@/components/mit-sailing/newsletter/NewsletterSignupForm';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { getCurrentUser } from '@/libs/auth/dal';
import { updateProfileNewsletterPreferencesAction } from '@/libs/newsletter/newsletterActions';
import { newsletterPreferenceRows } from '@/libs/newsletter/newsletterPreferenceRows';
import {
  getExistingSubscriberPreferenceStateForUser,
  getPublicNewsletterLists,
} from '@/libs/newsletter/newsletterSubscriptions';

type NewsletterPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export async function generateMetadata(
  props: NewsletterPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'NewsletterPage' });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

/**
 * Public newsletter entry point: signup for guests, preferences for users.
 *
 * @param props - Page params
 * @returns Newsletter page
 */
export default async function NewsletterPage(props: NewsletterPageProps) {
  await connection();
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'NewsletterPage' });
  const routes = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  const [lists, user] = await Promise.all([
    getPublicNewsletterLists(),
    getCurrentUser(),
  ]);
  const subscriber = user
    ? await getExistingSubscriberPreferenceStateForUser(user.id)
    : null;

  return (
    <SiteSectionShell
      locale={locale}
      segments={[{ label: routes('section_newsletter') }]}
    >
      <SiteSectionMain maxWidth="5xl" variant="detail">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold text-mit-text">
              {t('heading')}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-mit-text">
              {user ? t('signed_in_intro') : t('intro')}
            </p>
          </div>
          {user ? (
            <NewsletterPreferenceForm
              action={updateProfileNewsletterPreferencesAction.bind(
                null,
                locale
              )}
              errorLabel={t('preferences_error')}
              legendLabel={t('lists_label')}
              lists={newsletterPreferenceRows(lists, subscriber)}
              successLabel={t('preferences_saved')}
              submitLabel={t('preferences_submit')}
            />
          ) : (
            <NewsletterSignupForm locale={locale} lists={lists} />
          )}
        </div>
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
