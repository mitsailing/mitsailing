import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminCatalogForm } from '@/components/mit-sailing/admin/catalog/AdminCatalogForm';
import { SailingClassEditAssociations } from '@/components/mit-sailing/admin/catalog/SailingClassEditAssociations';
import { updateCatalogResourceAction } from '@/libs/admin/catalog/catalogActions';
import {
  isCatalogResourceId,
  tryGetCatalogDefinition,
} from '@/libs/admin/catalog/catalogDefinitions';
import { getCatalogServerHandlers } from '@/libs/admin/catalog/catalogServerRegistry';
import {
  cmsMenuParentSelectOptions,
  cmsMenuSelectOptions,
  cmsPageRequiredSelectOptions,
  cmsPageSelectOptions,
} from '@/libs/admin/catalog/cmsCatalogHandlers';
import { fleetRequiredClassSelectOptions } from '@/libs/admin/catalog/fleetCatalogHandlers';
import { sailingClassCategorySelectOptions } from '@/libs/admin/catalog/sailingClassesHandlers';

type PageProps = {
  params: Promise<{ locale: string; resource: string; id: string }>;
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
  return { title: t('meta_title_admin_catalog_edit') };
}

/**
 * `GET /admin/:resource/:id/edit` — edit row form (Rails scaffold edit).
 *
 * @param props - App Router page props
 * @param props.params - `locale`, `resource`, and row `id`
 * @returns Update form
 */
export default async function AdminCatalogResourceEditPage(props: PageProps) {
  const { locale, resource, id } = await props.params;
  const { error: errorCode } = await props.searchParams;
  setRequestLocale(locale);

  const def = tryGetCatalogDefinition(resource);
  if (!def || !isCatalogResourceId(resource) || !def.capabilities.update) {
    notFound();
  }

  const handlers = getCatalogServerHandlers(resource);
  const row = await handlers.getById(id);
  if (!row) {
    notFound();
  }

  const updateAction = updateCatalogResourceAction.bind(
    null,
    locale,
    resource,
    id
  );

  type DynamicSelectOptions = Readonly<
    Record<string, readonly { value: string; label: string }[]>
  >;
  let dynamicSelectOptions: DynamicSelectOptions | undefined;
  if (resource === 'fleet') {
    dynamicSelectOptions = {
      requiredClassId: await fleetRequiredClassSelectOptions(),
    };
  } else if (resource === 'sailing_classes') {
    dynamicSelectOptions = {
      classCategoryId: await sailingClassCategorySelectOptions(),
    };
  } else if (resource === 'cms_page_blocks') {
    dynamicSelectOptions = {
      pageId: await cmsPageRequiredSelectOptions(),
    };
  } else if (resource === 'cms_menu_items') {
    const currentMenuId = typeof row.menuId === 'string' ? row.menuId : '';
    dynamicSelectOptions = {
      menuId: await cmsMenuSelectOptions(),
      parentId: await cmsMenuParentSelectOptions({
        excludeId: id,
        menuId: currentMenuId,
      }),
      linkedPageId: await cmsPageSelectOptions(),
    };
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <AdminCatalogForm
        key={`${resource}-${id}`}
        definition={def}
        dynamicSelectOptions={dynamicSelectOptions}
        errorCode={errorCode ?? null}
        formAction={updateAction}
        headingKey="edit_heading"
        row={row}
      />
      {resource === 'sailing_classes' ? (
        <SailingClassEditAssociations classId={id} locale={locale} />
      ) : null}
    </div>
  );
}
