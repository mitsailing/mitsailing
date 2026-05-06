import 'server-only';
import { notFound } from 'next/navigation';
import { restoreCatalogVersionAction } from '@/libs/admin/catalog/catalogActions';
import {
  isCatalogResourceId,
  tryGetCatalogDefinition,
} from '@/libs/admin/catalog/catalogDefinitions';
import { getCatalogChangeVersion } from '@/libs/admin/catalog/catalogEditMetadata';
import { getCatalogServerHandlers } from '@/libs/admin/catalog/catalogServerRegistry';
import type {
  CatalogEditVersion,
  CatalogResourceDefinition,
  CatalogRow,
} from '@/libs/admin/catalog/types';

export type CatalogVersionRouteParams = {
  locale: string;
  resource: string;
  id: string;
  changeId: string;
};

export type CatalogVersionPageData = {
  definition: CatalogResourceDefinition;
  current: CatalogRow;
  restoreAction: (formData: FormData) => Promise<void>;
  version: CatalogEditVersion;
};

/**
 * Loads shared data for catalog version view and compare pages.
 *
 * @param params - Locale, resource, row id, and change id from the route
 * @returns Validated resource definition, current row, version, and restore action
 */
export async function getCatalogVersionPageData(
  params: CatalogVersionRouteParams
): Promise<CatalogVersionPageData> {
  if (!isCatalogResourceId(params.resource)) {
    notFound();
  }
  const definition = tryGetCatalogDefinition(params.resource);
  if (!definition) {
    notFound();
  }
  const handlers = getCatalogServerHandlers(params.resource);
  const current = await handlers.getById(params.id);
  if (!current) {
    notFound();
  }
  const version = await getCatalogChangeVersion({
    resourceId: params.resource,
    rowId: params.id,
    changeId: params.changeId,
    locale: params.locale,
  });
  if (!version) {
    notFound();
  }

  return {
    definition,
    current,
    restoreAction: restoreCatalogVersionAction.bind(
      null,
      params.locale,
      params.resource,
      params.id
    ),
    version,
  };
}
