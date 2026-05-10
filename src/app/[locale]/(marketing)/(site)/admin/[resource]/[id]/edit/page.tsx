import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminSecondaryActionLink } from '@/components/mit-sailing/admin/AdminPrimaryActionLink';
import { AdminCatalogForm } from '@/components/mit-sailing/admin/catalog/AdminCatalogForm';
import { AdminCmsHistoryPanel } from '@/components/mit-sailing/admin/catalog/AdminCmsHistoryPanel';
import { SailingClassEditAssociations } from '@/components/mit-sailing/admin/catalog/SailingClassEditAssociations';
import { updateCatalogResourceAction } from '@/libs/admin/catalog/catalogActions';
import {
  isCatalogResourceId,
  tryGetCatalogDefinition,
} from '@/libs/admin/catalog/catalogDefinitions';
import type { CatalogResourceId } from '@/libs/admin/catalog/catalogDefinitions';
import { getCatalogServerHandlers } from '@/libs/admin/catalog/catalogServerRegistry';
import {
  cmsMenuParentSelectOptions,
  cmsMenuSelectOptions,
  cmsPagePublicPathById,
  cmsPageRequiredSelectOptions,
  cmsPageSelectOptions,
} from '@/libs/admin/catalog/cmsCatalogHandlers';
import { fleetRequiredClassSelectOptions } from '@/libs/admin/catalog/fleetCatalogHandlers';
import { sailingClassCategorySelectOptions } from '@/libs/admin/catalog/sailingClassesHandlers';
import type { CatalogRow } from '@/libs/admin/catalog/types';
import { isAppRelativeCmsHref, safeCmsHref } from '@/libs/mit-sailing/cmsHref';

type PageProps = {
  params: Promise<{ locale: string; resource: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
};

type DynamicSelectOptions = Readonly<
  Record<string, readonly { value: string; label: string }[]>
>;

async function catalogEditDynamicSelectOptions(props: {
  id: string;
  resource: CatalogResourceId;
  row: CatalogRow;
}): Promise<DynamicSelectOptions | undefined> {
  if (props.resource === 'fleet') {
    return {
      requiredClassId: await fleetRequiredClassSelectOptions(),
    };
  }
  if (props.resource === 'sailing_classes') {
    return {
      classCategoryId: await sailingClassCategorySelectOptions(),
    };
  }
  if (props.resource === 'cms_page_blocks') {
    return {
      pageId: await cmsPageRequiredSelectOptions(),
    };
  }
  if (props.resource !== 'cms_menu_items') {
    return undefined;
  }

  const currentMenuId =
    typeof props.row.menuId === 'string' ? props.row.menuId : '';
  return {
    menuId: await cmsMenuSelectOptions(),
    parentId: await cmsMenuParentSelectOptions({
      excludeId: props.id,
      menuId: currentMenuId,
    }),
    linkedPageId: await cmsPageSelectOptions(),
  };
}

function cmsHistoryPageIdForCatalogRow(props: {
  id: string;
  resource: CatalogResourceId;
  row: CatalogRow;
}): string | undefined {
  if (props.resource === 'cms_pages') {
    return props.id;
  }
  if (
    props.resource === 'cms_page_blocks' &&
    typeof props.row.pageId === 'string'
  ) {
    return props.row.pageId;
  }
  return undefined;
}

async function cmsPageViewHrefForCatalogEdit(props: {
  historyPageId: string | undefined;
  resource: CatalogResourceId;
  row: CatalogRow;
}): Promise<string | null> {
  let path: string | null = null;
  const { path: rowPath } = props.row;
  if (props.resource === 'cms_pages' && typeof rowPath === 'string') {
    path = rowPath;
  } else if (props.historyPageId) {
    path = await cmsPagePublicPathById(props.historyPageId);
  }

  const href = safeCmsHref(path);
  return href && isAppRelativeCmsHref(href) ? href : null;
}

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

  const dynamicSelectOptions = await catalogEditDynamicSelectOptions({
    id,
    resource,
    row,
  });
  const historyPageId = cmsHistoryPageIdForCatalogRow({ id, resource, row });
  const cmsPageViewHref = await cmsPageViewHrefForCatalogEdit({
    historyPageId,
    resource,
    row,
  });
  const tr = await getTranslations({
    locale,
    namespace: 'AdminCatalogResource',
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {cmsPageViewHref ? (
        <div className="flex justify-end">
          <AdminSecondaryActionLink href={cmsPageViewHref}>
            {tr('action_view_page')}
          </AdminSecondaryActionLink>
        </div>
      ) : null}
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
      {historyPageId ? (
        <AdminCmsHistoryPanel locale={locale} pageId={historyPageId} />
      ) : null}
    </div>
  );
}
