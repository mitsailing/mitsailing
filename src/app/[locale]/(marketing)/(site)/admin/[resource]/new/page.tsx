import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminCatalogForm } from '@/components/mit-sailing/admin/catalog/AdminCatalogForm';
import { createCatalogResourceAction } from '@/libs/admin/catalog/catalogActions';
import {
  isCatalogResourceId,
  tryGetCatalogDefinition,
} from '@/libs/admin/catalog/catalogDefinitions';
import type { CatalogResourceId } from '@/libs/admin/catalog/catalogDefinitions';
import { catalogFieldErrorsFromSearchParam } from '@/libs/admin/catalog/catalogFieldErrors';
import { catalogPermissionForOperation } from '@/libs/admin/catalog/catalogPermissions';
import { fleetRequiredClassSelectOptions } from '@/libs/admin/catalog/fleetCatalogHandlers';
import { sailingClassCategorySelectOptions } from '@/libs/admin/catalog/sailingClassesHandlers';
import { sailingRatingSelectOptions } from '@/libs/admin/catalog/sailingRatingsHandlers';
import type { CatalogRow } from '@/libs/admin/catalog/types';
import { requirePermission } from '@/libs/auth/dal';
import { newsNewCatalogDefaults } from '@/libs/mit-sailing/newsAdminDefaults';

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
  ratingPlaceholder: string;
  requiredClassPlaceholder: string;
  resource: CatalogResourceId;
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
  if (props.resource === 'sailing_rating_rules') {
    return {
      sailingRatingId: [
        {
          value: '',
          label: props.ratingPlaceholder,
        },
        ...(await sailingRatingSelectOptions()),
      ],
    };
  }
  return undefined;
}

function catalogNewRowDefaults(props: {
  resource: CatalogResourceId;
}): CatalogRow | undefined {
  if (props.resource === 'news') {
    return newsNewCatalogDefaults();
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
  setRequestLocale(locale);

  const def = tryGetCatalogDefinition(resource);
  if (!def || !isCatalogResourceId(resource) || !def.capabilities.create) {
    notFound();
  }
  await requirePermission(
    catalogPermissionForOperation({
      operation: 'create',
      resourceId: resource,
    }),
    locale
  );

  const createAction = createCatalogResourceAction.bind(null, locale, resource);

  const tr = await getTranslations({
    locale,
    namespace: 'AdminCatalogResource',
  });
  const fieldErrors = catalogFieldErrorsFromSearchParam(
    searchParams.fieldError,
    { legacyFieldMessage: tr('form_error_validation_failed') }
  );
  const dynamicSelectOptions = await catalogNewDynamicSelectOptions({
    classCategoryPlaceholder: tr('select_class_category_placeholder'),
    ratingPlaceholder: tr('select_rating_placeholder'),
    requiredClassPlaceholder: tr('select_required_class_placeholder'),
    resource,
  });
  const rowDefaults = catalogNewRowDefaults({ resource });

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
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
