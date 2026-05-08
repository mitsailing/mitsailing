import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NewsletterPreferenceForm } from '@/components/mit-sailing/newsletter/NewsletterPreferenceForm';
import { requireCurrentUser } from '@/libs/auth/dal';
import { updateProfileNewsletterPreferencesAction } from '@/libs/newsletter/newsletterActions';
import {
  getPublicNewsletterLists,
  getSubscriberPreferenceStateForUser,
} from '@/libs/newsletter/newsletterSubscriptions';
import { getI18nPath } from '@/utils/Helpers';

type ProfileNewsletterPageProps = {
  params: Promise<{ locale: string }>;
};

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

function preferenceRows(
  lists: Awaited<ReturnType<typeof getPublicNewsletterLists>>,
  subscriber: NonNullable<
    Awaited<ReturnType<typeof getSubscriberPreferenceStateForUser>>
  >
) {
  const subscriptions = new Map(
    subscriber.subscriptions.map((subscription) => [
      subscription.listId,
      subscription.status,
    ])
  );
  return lists.map((list) => ({
    description: list.description,
    id: list.id,
    name: list.name,
    subscribed: subscriptions.get(list.id) === 'subscribed',
  }));
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
  const { locale } = await props.params;
  setRequestLocale(locale);
  const href = getI18nPath('/profile/newsletter/', locale);
  const user = await requireCurrentUser(locale, href);
  const t = await getTranslations({ locale, namespace: 'UserProfilePage' });
  const lists = await getPublicNewsletterLists();
  const subscriber = await getSubscriberPreferenceStateForUser(user.id);

  if (!subscriber) {
    return null;
  }

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
        lists={preferenceRows(lists, subscriber)}
        successLabel={t('newsletter_preferences_saved')}
        submitLabel={t('newsletter_submit')}
      />
    </div>
  );
}
