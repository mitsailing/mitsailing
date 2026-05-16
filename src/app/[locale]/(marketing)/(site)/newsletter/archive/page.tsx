import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { prisma } from '@/libs/DB';

export const revalidate = 300;

type NewsletterArchivePageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export async function generateMetadata(
  props: NewsletterArchivePageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'NewsletterPage' });
  return { title: t('archive_meta_title') };
}

/**
 * Public archive of sent newsletter broadcasts.
 *
 * @param props - Page params
 * @returns Broadcast archive
 */
export default async function NewsletterArchivePage(
  props: NewsletterArchivePageProps
) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'NewsletterPage' });
  const routes = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  const broadcasts = await prisma.newsletterBroadcast.findMany({
    include: { primaryList: true },
    orderBy: { sentAt: 'desc' },
    take: 50,
    where: {
      primaryList: { is: { visibility: 'public' } },
      sentAt: { not: null },
      status: 'sent',
    },
  });

  return (
    <SiteSectionShell
      locale={locale}
      segments={[
        { label: routes('section_newsletter'), href: '/newsletter' },
        { label: t('archive_heading') },
      ]}
    >
      <SiteSectionMain maxWidth="5xl" variant="detail">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold text-mit-text">
              {t('archive_heading')}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-mit-text">
              {t('archive_intro')}
            </p>
          </div>
          {broadcasts.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              {t('archive_empty')}
            </p>
          ) : (
            <ul className="space-y-4">
              {broadcasts.map((broadcast) => (
                <li
                  className="rounded-lg border border-border bg-card p-5"
                  key={broadcast.id}
                >
                  <p className="text-xs font-semibold text-mit-red dark:text-mit-red-ink">
                    {broadcast.primaryList.name}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-mit-text">
                    {broadcast.subject}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {broadcast.previewText}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
