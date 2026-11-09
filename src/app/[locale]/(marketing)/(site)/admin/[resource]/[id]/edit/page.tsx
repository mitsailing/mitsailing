import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminCatalogForm } from '@/components/mit-sailing/admin/catalog/AdminCatalogForm';
import { AdminCatalogHistoryPanel } from '@/components/mit-sailing/admin/catalog/AdminCatalogHistoryPanel';
import { SailingClassEditAssociations } from '@/components/mit-sailing/admin/catalog/SailingClassEditAssociations';
import { updateCatalogResourceAction } from '@/libs/admin/catalog/catalogActions';
import {
  isCatalogResourceId,
  tryGetCatalogDefinition,
} from '@/libs/admin/catalog/catalogDefinitions';
import type { CatalogResourceId } from '@/libs/admin/catalog/catalogDefinitions';
import { catalogFieldErrorsFromSearchParam } from '@/libs/admin/catalog/catalogFieldErrors';
import { catalogPermissionForOperation } from '@/libs/admin/catalog/catalogPermissions';
import { getCatalogServerHandlers } from '@/libs/admin/catalog/catalogServerRegistry';
import { fleetRequiredClassSelectOptions } from '@/libs/admin/catalog/fleetCatalogHandlers';
import { sailingClassCategorySelectOptions } from '@/libs/admin/catalog/sailingClassesHandlers';
import { sailingRatingSelectOptions } from '@/libs/admin/catalog/sailingRatingsHandlers';
import type { CatalogRow } from '@/libs/admin/catalog/types';
import { requirePermission } from '@/libs/auth/dal';
import { isCatalogHistoryResourceId } from '@/libs/mit-sailing/catalogHistory';

type PageProps = {
  params: Promise<{ locale: string; resource: string; id: string }>;
  searchParams: Promise<{ error?: string; fieldError?: string | string[] }>;
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
  if (props.resource === 'sailing_rating_rules') {
    return {
      sailingRatingId: await sailingRatingSelectOptions(),
    };
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
  const searchParams = await props.searchParams;
  const { error: errorCode } = searchParams;
  setRequestLocale(locale);

  const def = tryGetCatalogDefinition(resource);
  if (!def || !isCatalogResourceId(resource) || !def.capabilities.update) {
    notFound();
  }
  await requirePermission(
    catalogPermissionForOperation({
      operation: 'update',
      resourceId: resource,
    }),
    locale
  );

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
  const tr = await getTranslations({
    locale,
    namespace: 'AdminCatalogResource',
  });
  const fieldErrors = catalogFieldErrorsFromSearchParam(
    searchParams.fieldError,
    { legacyFieldMessage: tr('form_error_validation_failed') }
  );

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <AdminCatalogForm
        key={`${resource}-${id}`}
        definition={def}
        dynamicSelectOptions={dynamicSelectOptions}
        errorCode={errorCode ?? null}
        fieldErrors={fieldErrors}
        formAction={updateAction}
        headingKey="edit_heading"
        row={row}
      />
      {resource === 'sailing_classes' ? (
        <SailingClassEditAssociations classId={id} locale={locale} />
      ) : null}
      {isCatalogHistoryResourceId(resource) ? (
        <AdminCatalogHistoryPanel
          itemId={id}
          locale={locale}
          resourceId={resource}
        />
      ) : null}
    </div>
  );
}
