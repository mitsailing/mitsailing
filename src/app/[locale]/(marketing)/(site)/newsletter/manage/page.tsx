import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { connection } from 'next/server';
import { NewsletterPreferenceForm } from '@/components/mit-sailing/newsletter/NewsletterPreferenceForm';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { Button } from '@/components/ui/button';
import { logger } from '@/libs/Logger';
import {
  resubscribeTokenNewsletterListAction,
  unsubscribeTokenNewsletterListAction,
  updateTokenNewsletterPreferencesAction,
} from '@/libs/newsletter/newsletterActions';
import { newsletterPreferenceRows } from '@/libs/newsletter/newsletterPreferenceRows';
import {
  getPublicNewsletterLists,
  getSubscriberPreferenceStateByToken,
} from '@/libs/newsletter/newsletterSubscriptions';

type NewsletterManagePageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    action?: string | string[];
    list?: string | string[];
    resubscribed?: string | string[];
    token?: string | string[];
    unsubscribed?: string | string[];
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
    const trimmed = token?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  }
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function singleSearchParam(value?: string | string[]): string | undefined {
  const rawValue = Array.isArray(value) ? value.at(0) : value;
  const trimmed = rawValue?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
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
  const lists = token && subscriber ? await getPublicNewsletterLists() : [];
  const listId = singleSearchParam(searchParams.list);
  const selectedList = lists.find((list) => list.id === listId);
  const unsubscribeActionList =
    singleSearchParam(searchParams.action) === 'unsubscribe'
      ? selectedList
      : undefined;
  const unsubscribedList =
    singleSearchParam(searchParams.unsubscribed) === '1'
      ? selectedList
      : undefined;
  const resubscribedList =
    singleSearchParam(searchParams.resubscribed) === '1'
      ? selectedList
      : undefined;

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
              {unsubscribeActionList ? (
                <div className="border-mit-gray/30 max-w-2xl space-y-4 rounded border bg-white p-6">
                  <h2 className="text-xl font-semibold text-mit-text">
                    {t('manage_unsubscribe_heading', {
                      listName: unsubscribeActionList.name,
                    })}
                  </h2>
                  <p className="text-sm leading-6 text-mit-text">
                    {t('manage_unsubscribe_body')}
                  </p>
                  <form
                    action={unsubscribeTokenNewsletterListAction.bind(
                      null,
                      token,
                      locale,
                      unsubscribeActionList.id
                    )}
                  >
                    <Button type="submit" variant="mit">
                      {t('manage_unsubscribe_submit')}
                    </Button>
                  </form>
                </div>
              ) : null}
              {unsubscribedList ? (
                <div className="border-mit-gray/30 max-w-2xl space-y-4 rounded border bg-white p-6">
                  <h2 className="text-xl font-semibold text-mit-text">
                    {t('manage_unsubscribed_heading', {
                      listName: unsubscribedList.name,
                    })}
                  </h2>
                  <p className="text-sm leading-6 text-mit-text">
                    {t('manage_unsubscribed_body')}
                  </p>
                  <form
                    action={resubscribeTokenNewsletterListAction.bind(
                      null,
                      token,
                      locale,
                      unsubscribedList.id
                    )}
                  >
                    <Button type="submit" variant="mit">
                      {t('manage_resubscribe_submit')}
                    </Button>
                  </form>
                </div>
              ) : null}
              {!unsubscribeActionList && !unsubscribedList ? (
                <>
                  {resubscribedList ? (
                    <p className="border-mit-gray/30 max-w-2xl rounded border bg-white p-4 text-sm text-mit-text">
                      {t('manage_resubscribed', {
                        listName: resubscribedList.name,
                      })}
                    </p>
                  ) : null}
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
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
