import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminCatalogForm } from '@/components/mit-sailing/admin/catalog/AdminCatalogForm';
import { createCatalogResourceAction } from '@/libs/admin/catalog/catalogActions';
import {
  isCatalogResourceId,
  tryGetCatalogDefinition,
} from '@/libs/admin/catalog/catalogDefinitions';
import { fleetRequiredClassSelectOptions } from '@/libs/admin/catalog/fleetCatalogHandlers';

type PageProps = {
  params: Promise<{ locale: string; resource: string }>;
  searchParams: Promise<{ error?: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale, resource } = await props.params;
  const def = tryGetCatalogDefinition(resource);
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  if (!def) {
    return { title: t('meta_title_admin') };
  }
  return { title: t('meta_title_admin_catalog_new') };
}

/**
 * `GET /admin/:resource/new` — new row form (Rails scaffold new).
 *
 * @param props - App Router page props
 * @param props.params - `locale` and `resource`
 * @returns Create form
 */
export default async function AdminCatalogResourceNewPage(props: PageProps) {
  const { locale, resource } = await props.params;
  const { error: errorCode } = await props.searchParams;
  setRequestLocale(locale);

  const def = tryGetCatalogDefinition(resource);
  if (!def || !isCatalogResourceId(resource) || !def.capabilities.create) {
    notFound();
  }

  const createAction = createCatalogResourceAction.bind(null, locale, resource);

  const tr = await getTranslations({
    locale,
    namespace: 'AdminCatalogResource',
  });

  const dynamicSelectOptions =
    resource === 'fleet'
      ? {
          requiredClassId: [
            {
              value: '',
              label: tr('select_required_class_placeholder'),
            },
            ...(await fleetRequiredClassSelectOptions()),
          ],
        }
      : undefined;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <AdminCatalogForm
        key={`${resource}-new`}
        definition={def}
        dynamicSelectOptions={dynamicSelectOptions}
        errorCode={errorCode ?? null}
        formAction={createAction}
        headingKey="new_heading"
      />
    </div>
  );
}
