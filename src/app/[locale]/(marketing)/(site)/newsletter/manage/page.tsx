import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { connection } from 'next/server';
import {
  NewsletterOneClickResubscribeForm,
  NewsletterPreferenceForm,
} from '@/components/mit-sailing/newsletter/NewsletterPreferenceForm';
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
  searchParams: Promise<{
    token?: string | string[];
    unsubscribedList?: string | string[];
  }>;
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

function newsletterUnsubscribedList(
  value?: string | string[]
): string | undefined {
  if (Array.isArray(value)) {
    if (value.length > 1) {
      logger.warn(
        'Rejected newsletter manage request with repeated unsubscribed list params',
        {
          listCount: value.length,
        }
      );
      return undefined;
    }
    const [listId] = value;
    return listId && listId.length > 0 ? listId : undefined;
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
  const unsubscribedListId = newsletterUnsubscribedList(
    searchParams.unsubscribedList
  );
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'NewsletterPage' });
  const routes = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  const subscriber = token
    ? await getSubscriberPreferenceStateByToken(token)
    : null;
  const lists = token && subscriber ? await getPublicNewsletterLists() : [];
  const preferenceRows =
    token && subscriber ? newsletterPreferenceRows(lists, subscriber) : [];
  const justUnsubscribedList = preferenceRows.find(
    (list) => list.id === unsubscribedListId && !list.subscribed
  );
  const resubscribeListIds =
    justUnsubscribedList === undefined
      ? []
      : preferenceRows
          .filter(
            (list) => list.subscribed || list.id === justUnsubscribedList.id
          )
          .map((list) => list.id);

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
            <>
              {justUnsubscribedList ? (
                <section
                  aria-labelledby="newsletter-unsubscribed-heading"
                  className="space-y-4 rounded-lg border border-mit-success/30 bg-mit-success/10 p-4"
                >
                  <div>
                    <h2
                      className="text-base font-semibold text-mit-text"
                      id="newsletter-unsubscribed-heading"
                    >
                      {t('manage_unsubscribed_heading')}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-mit-text">
                      {t('manage_unsubscribed_body', {
                        listName: justUnsubscribedList.name,
                      })}
                    </p>
                  </div>
                  <NewsletterOneClickResubscribeForm
                    action={updateTokenNewsletterPreferencesAction.bind(
                      null,
                      token,
                      locale
                    )}
                    errorLabel={t('manage_resubscribe_error')}
                    listIds={resubscribeListIds}
                    submitLabel={t('manage_resubscribe_submit')}
                    successLabel={t('manage_resubscribe_saved', {
                      listName: justUnsubscribedList.name,
                    })}
                  />
                </section>
              ) : null}
              <NewsletterPreferenceForm
                action={updateTokenNewsletterPreferencesAction.bind(
                  null,
                  token,
                  locale
                )}
                errorLabel={t('preferences_error')}
                legendLabel={t('lists_label')}
                lists={preferenceRows}
                successLabel={t('preferences_saved')}
                submitLabel={t('preferences_submit')}
              />
            </>
          ) : null}
        </div>
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
