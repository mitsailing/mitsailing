import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { adminCatalogResourceIndexPath } from '@/libs/admin/catalog/adminCatalogPaths';
import {
  catalogResourceDefinitions,
  CATALOG_RESOURCE_IDS,
} from '@/libs/admin/catalog/catalogDefinitions';
import { ADMIN_USERS_PATH } from '@/libs/admin/users/adminUserPaths';
import { Link } from '@/libs/I18nNavigation';

type AdminIndexPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: AdminIndexPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AdminIndex' });
  return { title: t('meta_title') };
}

/**
 * Admin dashboard: links to each section’s index (Rails-style discovery).
 *
 * @param props - App Router page props
 * @param props.params - Resolves to `locale`
 * @returns Section index with internal links
 */
export default async function AdminIndexPage(props: AdminIndexPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'AdminIndex' });
  const tCatalog = await getTranslations({
    locale,
    namespace: 'AdminCatalogResource',
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-mit-text">{t('title')}</h1>
        <p className="mt-2 text-sm text-mit-text">{t('intro')}</p>
      </div>

      <section aria-labelledby="admin-site-section">
        <h2
          className="text-lg font-semibold text-mit-text"
          id="admin-site-section"
        >
          {t('section_site')}
        </h2>
        <ul className="mt-3 list-none space-y-2 p-0">
          <li>
            <Link
              className="font-medium text-mit-red no-underline hover:underline"
              href="/admin/events/"
            >
              {t('link_events')}
            </Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="admin-catalog-section">
        <h2
          className="text-lg font-semibold text-mit-text"
          id="admin-catalog-section"
        >
          {t('section_catalog')}
        </h2>
        <ul className="mt-3 list-none space-y-2 p-0">
          <li>
            <Link
              className="font-medium text-mit-red no-underline hover:underline"
              href={ADMIN_USERS_PATH}
            >
              {t('hub_label_users')}
            </Link>
            <p className="mt-0.5 text-sm text-mit-text">
              {t('link_users_blurb')}
            </p>
          </li>
          {CATALOG_RESOURCE_IDS.map((id) => {
            const def = catalogResourceDefinitions[id];
            return (
              <li key={id}>
                <Link
                  className="font-medium text-mit-red no-underline hover:underline"
                  href={adminCatalogResourceIndexPath(id)}
                >
                  {tCatalog(def.hubLabelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
