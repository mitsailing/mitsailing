import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminSecondaryActionLink } from '@/components/mit-sailing/admin/AdminPrimaryActionLink';
import { AdminCatalogForm } from '@/components/mit-sailing/admin/catalog/AdminCatalogForm';
import { createCatalogResourceAction } from '@/libs/admin/catalog/catalogActions';
import {
  isCatalogResourceId,
  tryGetCatalogDefinition,
} from '@/libs/admin/catalog/catalogDefinitions';
import type { CatalogResourceId } from '@/libs/admin/catalog/catalogDefinitions';
import { catalogFieldErrorsFromSearchParam } from '@/libs/admin/catalog/catalogFieldErrors';
import {
  cmsMenuParentSelectOptions,
  cmsMenuSelectOptions,
  cmsPagePublicPathById,
  cmsPageRequiredSelectOptions,
  cmsPageSelectOptions,
} from '@/libs/admin/catalog/cmsCatalogHandlers';
import { fleetRequiredClassSelectOptions } from '@/libs/admin/catalog/fleetCatalogHandlers';
import { sailingClassCategorySelectOptions } from '@/libs/admin/catalog/sailingClassesHandlers';
import { catalogScopedListState } from '@/libs/admin/catalog/scopedCatalogLists';
import type { CatalogScopedListState } from '@/libs/admin/catalog/scopedCatalogLists';
import type { CatalogRow } from '@/libs/admin/catalog/types';
import { isAppRelativeCmsHref, safeCmsHref } from '@/libs/mit-sailing/cmsHref';
import { siteAlertsNewCatalogDefaults } from '@/libs/mit-sailing/siteAlertAdminDefaults';

type PageProps = {
  params: Promise<{ locale: string; resource: string }>;
  searchParams: Promise<{
    error?: string;
    fieldError?: string | string[];
    menu?: string;
    page?: string;
  }>;
};

type DynamicSelectOptions = Readonly<
  Record<string, readonly { value: string; label: string }[]>
>;

async function catalogNewDynamicSelectOptions(props: {
  classCategoryPlaceholder: string;
  requiredClassPlaceholder: string;
  resource: CatalogResourceId;
  scopedList: CatalogScopedListState | undefined;
}): Promise<DynamicSelectOptions | undefined> {
  if (props.resource === 'fleet') {
    return {
      requiredClassId: [
        {
          value: '',
          label: props.requiredClassPlaceholder,
        },
        ...(await fleetRequiredClassSelectOptions()),
      ],
    };
  }
  if (props.resource === 'sailing_classes') {
    return {
      classCategoryId: [
        {
          value: '',
          label: props.classCategoryPlaceholder,
        },
        ...(await sailingClassCategorySelectOptions()),
      ],
    };
  }
  if (props.resource === 'cms_page_blocks') {
    return {
      pageId:
        props.scopedList?.options ?? (await cmsPageRequiredSelectOptions()),
    };
  }
  if (props.resource === 'cms_menu_items') {
    const selectedMenuId = props.scopedList?.selectedValue ?? '';
    return {
      linkedPageId: await cmsPageSelectOptions(),
      menuId: props.scopedList?.options ?? (await cmsMenuSelectOptions()),
      parentId: await cmsMenuParentSelectOptions({ menuId: selectedMenuId }),
    };
  }
  return undefined;
}

function catalogNewRowDefaults(props: {
  resource: CatalogResourceId;
  scopedList: CatalogScopedListState | undefined;
}): CatalogRow | undefined {
  if (props.resource === 'site_alerts') {
    return siteAlertsNewCatalogDefaults();
  }
  if (props.resource === 'cms_page_blocks' && props.scopedList?.selectedValue) {
    return { pageId: props.scopedList.selectedValue };
  }
  if (props.resource === 'cms_menu_items' && props.scopedList?.selectedValue) {
    return { menuId: props.scopedList.selectedValue };
  }
  return undefined;
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
  const searchParams = await props.searchParams;
  const { error: errorCode } = searchParams;
  const fieldErrors = catalogFieldErrorsFromSearchParam(
    searchParams.fieldError
  );
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
  const scopedList = await catalogScopedListState({
    resourceId: resource,
    searchParams,
  });

  const dynamicSelectOptions = await catalogNewDynamicSelectOptions({
    classCategoryPlaceholder: tr('select_class_category_placeholder'),
    requiredClassPlaceholder: tr('select_required_class_placeholder'),
    resource,
    scopedList,
  });
  const rowDefaults = catalogNewRowDefaults({ resource, scopedList });
  const scopedCmsPagePath =
    resource === 'cms_page_blocks' && scopedList?.selectedValue
      ? await cmsPagePublicPathById(scopedList.selectedValue)
      : null;
  const scopedCmsPageHref = safeCmsHref(scopedCmsPagePath);
  const scopedCmsPageViewHref =
    scopedCmsPageHref && isAppRelativeCmsHref(scopedCmsPageHref)
      ? scopedCmsPageHref
      : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {scopedCmsPageViewHref ? (
        <div className="flex justify-end">
          <AdminSecondaryActionLink href={scopedCmsPageViewHref}>
            {tr('action_view_page')}
          </AdminSecondaryActionLink>
        </div>
      ) : null}
      <AdminCatalogForm
        key={`${resource}-new`}
        definition={def}
        dynamicSelectOptions={dynamicSelectOptions}
        errorCode={errorCode ?? null}
        fieldErrors={fieldErrors}
        formAction={createAction}
        headingKey="new_heading"
        row={rowDefaults}
      />
    </div>
  );
}
