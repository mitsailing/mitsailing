import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireAdminAreaAccess } from '@/libs/admin/adminAreaAccess';
import { adminCatalogResourceIndexPath } from '@/libs/admin/catalog/adminCatalogPaths';
import {
  catalogResourceDefinitions,
  CATALOG_RESOURCE_IDS,
} from '@/libs/admin/catalog/catalogDefinitions';
import { catalogPermissionsForOperation } from '@/libs/admin/catalog/catalogPermissions';
import { adminPavilionReservationIndexPath } from '@/libs/admin/pavilion-reservations/pavilionReservationAdminPaths';
import { ADMIN_USERS_PATH } from '@/libs/admin/users/adminUserPaths';
import {
  hasAnyPermission,
  hasPermission,
  Permission,
} from '@/libs/auth/appPermissions';
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

export default async function AdminIndexPage(props: AdminIndexPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const { permissions } = await requireAdminAreaAccess(locale);
  const canCms = hasPermission(permissions, Permission.CMS_VIEW);
  const canUsers = hasPermission(permissions, Permission.USERS_VIEW);
  const canEvents = hasAnyPermission(permissions, [
    Permission.EVENTS_MANAGE,
    Permission.EVENTS_ASSIGNED_MANAGE,
  ]);
  const canPayments = hasPermission(permissions, Permission.PAYMENTS_VIEW);
  const canPavilionReservations = hasPermission(
    permissions,
    Permission.PAVILION_RESERVATIONS_MANAGE
  );
  const canNewsletters = hasPermission(
    permissions,
    Permission.NEWSLETTER_MANAGE
  );

  const t = await getTranslations({ locale, namespace: 'AdminIndex' });
  const tCatalog = await getTranslations({
    locale,
    namespace: 'AdminCatalogResource',
  });

  return (
    <div className="flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-mit-text">{t('title')}</h1>
      </div>

      <section aria-labelledby="admin-site-section">
        <h2
          className="text-lg font-semibold text-mit-text"
          id="admin-site-section"
        >
          {t('section_site')}
        </h2>
        <ul className="mt-3 grid list-none gap-x-6 gap-y-2 p-0 sm:grid-cols-2">
          {canEvents ? (
            <li>
              <Link
                className="font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
                href="/admin/events"
              >
                {t('link_events')}
              </Link>
            </li>
          ) : null}
          {canPavilionReservations ? (
            <li>
              <Link
                className="font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
                href={adminPavilionReservationIndexPath()}
              >
                {t('link_pavilion_reservations')}
              </Link>
            </li>
          ) : null}
          {canPayments ? (
            <li>
              <Link
                className="font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
                href="/admin/payments"
              >
                {t('link_payments')}
              </Link>
            </li>
          ) : null}
          {canCms ? (
            <li>
              <Link
                className="font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
                href="/admin/site_text"
              >
                {t('link_site_text')}
              </Link>
            </li>
          ) : null}
        </ul>
      </section>

      <section aria-labelledby="admin-catalog-section">
        <h2
          className="text-lg font-semibold text-mit-text"
          id="admin-catalog-section"
        >
          {t('section_catalog')}
        </h2>
        <ul className="mt-3 grid list-none gap-x-6 gap-y-2 p-0 sm:grid-cols-2">
          {canUsers ? (
            <li>
              <Link
                className="font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
                href={ADMIN_USERS_PATH}
              >
                {t('hub_label_users')}
              </Link>
            </li>
          ) : null}
          {canNewsletters ? (
            <>
              <li>
                <Link
                  className="font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
                  href="/admin/newsletter-subscribers"
                  prefetch={false}
                >
                  {t('link_newsletter_subscribers')}
                </Link>
              </li>
              <li>
                <Link
                  className="font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
                  href="/admin/newsletter-lists"
                  prefetch={false}
                >
                  {t('link_newsletter_lists')}
                </Link>
              </li>
              <li>
                <Link
                  className="font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
                  href="/admin/newsletter-broadcasts"
                  prefetch={false}
                >
                  {t('link_newsletter_broadcasts')}
                </Link>
              </li>
              <li>
                <Link
                  className="font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
                  href="/admin/newsletter-templates"
                  prefetch={false}
                >
                  {t('link_newsletter_templates')}
                </Link>
              </li>
              <li>
                <Link
                  className="font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
                  href="/admin/email-templates"
                  prefetch={false}
                >
                  {t('link_email_templates')}
                </Link>
              </li>
            </>
          ) : null}
          {CATALOG_RESOURCE_IDS.map((id) => {
            const def = catalogResourceDefinitions[id];
            const canSeeResource = hasAnyPermission(
              permissions,
              catalogPermissionsForOperation({
                operation: 'view',
                resourceId: id,
              })
            );
            return canSeeResource ? (
              <li key={id}>
                <Link
                  className="font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
                  href={adminCatalogResourceIndexPath(id)}
                >
                  {tCatalog(def.hubLabelKey)}
                </Link>
              </li>
            ) : null;
          })}
        </ul>
      </section>
    </div>
  );
}
