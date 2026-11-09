import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PublicAdminEditLink } from '@/components/mit-sailing/admin/PublicAdminEditLink';
import { MitnaMarketingPageShell } from '@/components/mit-sailing/MitnaMarketingPageShell';
import { Link } from '@/libs/I18nNavigation';
import {
  externalCmsLinkProps,
  isAppRelativeCmsHref,
  safeCmsHref,
} from '@/libs/mit-sailing/cmsHref';
import { loadMitnaMeetingsByYear } from '@/libs/mit-sailing/loadMitnaMeetings';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_mitna_meetings') };
}

function MeetingTitle(props: { link?: string; title: string }) {
  const href = safeCmsHref(props.link);
  if (!href) {
    return <span className="font-medium text-mit-text">{props.title}</span>;
  }
  if (isAppRelativeCmsHref(href)) {
    return (
      <Link
        className="font-medium text-mit-red no-underline hover:underline"
        href={href}
      >
        {props.title}
      </Link>
    );
  }
  return (
    <a
      className="font-medium text-mit-red no-underline hover:underline"
      href={href}
      {...externalCmsLinkProps(href)}
    >
      {props.title}
    </a>
  );
}

export default async function MitnaMeetingsPage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const [t, groups] = await Promise.all([
    getTranslations({ locale, namespace: 'MitSailingRoutes' }),
    loadMitnaMeetingsByYear(),
  ]);

  return (
    <MitnaMarketingPageShell locale={locale} page="meetings">
      <PublicAdminEditLink
        className="mb-4"
        href="/cms/collections/mitna-meetings"
      />
      <h1 className="mb-6 font-mit-serif text-2xl font-semibold tracking-tight text-mit-text">
        {t('title_mitna_meetings')}
      </h1>
      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.year}>
            <h2 className="mb-3 font-mit-serif text-lg font-semibold text-mit-text">
              {group.year}
            </h2>
            <ul className="space-y-2">
              {group.items.map((item) => (
                <li
                  className="flex flex-col gap-0.5 border-b border-mit-line py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                  key={item.id}
                >
                  <MeetingTitle link={item.link} title={item.title} />
                  <time
                    className="shrink-0 text-sm text-mit-text/80"
                    dateTime={item.dateYmd}
                  >
                    {item.dateLabel}
                  </time>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </MitnaMarketingPageShell>
  );
}
