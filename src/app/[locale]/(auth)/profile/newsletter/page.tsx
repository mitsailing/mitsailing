import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { connection } from 'next/server';
import { NewsletterPreferenceForm } from '@/components/mit-sailing/newsletter/NewsletterPreferenceForm';
import { requireCurrentUser } from '@/libs/auth/dal';
import { updateProfileNewsletterPreferencesAction } from '@/libs/newsletter/newsletterActions';
import { newsletterPreferenceRows } from '@/libs/newsletter/newsletterPreferenceRows';
import {
  getExistingSubscriberPreferenceStateForUser,
  getPublicNewsletterLists,
} from '@/libs/newsletter/newsletterSubscriptions';
import { getI18nPath } from '@/utils/Helpers';

type ProfileNewsletterPageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export async function generateMetadata(
  props: ProfileNewsletterPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'UserProfilePage' });
  return {
    title: t('newsletter_meta_title'),
    description: t('newsletter_meta_description'),
  };
}

/**
 * Authenticated newsletter preferences.
 *
 * @param props - Page params
 * @returns Profile newsletter page
 */
export default async function ProfileNewsletterPage(
  props: ProfileNewsletterPageProps
) {
  await connection();
  const { locale } = await props.params;
  setRequestLocale(locale);
  const href = getI18nPath('/profile/newsletter', locale);
  const user = await requireCurrentUser(locale, href);
  const t = await getTranslations({ locale, namespace: 'UserProfilePage' });
  const [lists, subscriber] = await Promise.all([
    getPublicNewsletterLists(),
    getExistingSubscriberPreferenceStateForUser(user.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-mit-text">
          {t('newsletter_page_heading')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t('newsletter_page_intro')}
        </p>
      </div>
      <NewsletterPreferenceForm
        action={updateProfileNewsletterPreferencesAction.bind(null, locale)}
        errorLabel={t('newsletter_preferences_error')}
        legendLabel={t('newsletter_lists_label')}
        lists={newsletterPreferenceRows(lists, subscriber)}
        successLabel={t('newsletter_preferences_saved')}
        submitLabel={t('newsletter_submit')}
      />
    </div>
  );
}
