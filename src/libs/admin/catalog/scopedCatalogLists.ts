import 'server-only';
import type { CatalogResourceId } from '@/libs/admin/catalog/catalogDefinitions';
import {
  cmsMenuSelectOptions,
  cmsPageRequiredSelectOptions,
} from '@/libs/admin/catalog/cmsCatalogHandlers';
import type {
  AdminCatalogResourceMessageKey,
  CatalogListOptions,
} from '@/libs/admin/catalog/types';

export type CatalogScopedListOption = {
  value: string;
  label: string;
};

export type CatalogScopedListQueryParamName = 'menu' | 'page';

export type CatalogScopedListDefinition = {
  queryParamName: CatalogScopedListQueryParamName;
  fieldName: 'menuId' | 'pageId';
  labelKey: AdminCatalogResourceMessageKey;
  loadOptions: () => Promise<CatalogScopedListOption[]>;
};

export type CatalogScopedListState = {
  definition: CatalogScopedListDefinition;
  options: CatalogScopedListOption[];
  selectedValue: string;
};

const scopedCatalogLists: Partial<
  Record<CatalogResourceId, CatalogScopedListDefinition>
> = {
  cms_menu_items: {
    queryParamName: 'menu',
    fieldName: 'menuId',
    labelKey: 'field_cms_menu',
    loadOptions: cmsMenuSelectOptions,
  },
  cms_page_blocks: {
    queryParamName: 'page',
    fieldName: 'pageId',
    labelKey: 'field_cms_page',
    loadOptions: cmsPageRequiredSelectOptions,
  },
};

function catalogScopedListDefinition(
  resourceId: CatalogResourceId
): CatalogScopedListDefinition | undefined {
  return scopedCatalogLists[resourceId];
}

export async function catalogScopedListState(props: {
  resourceId: CatalogResourceId;
  searchParams: Partial<Record<CatalogScopedListQueryParamName, string>>;
}): Promise<CatalogScopedListState | undefined> {
  const definition = catalogScopedListDefinition(props.resourceId);
  if (!definition) {
    return undefined;
  }

  const options = await definition.loadOptions();
  const requestedValue = props.searchParams[definition.queryParamName];
  const selectedValue =
    options.find((option) => option.value === requestedValue)?.value ??
    options[0]?.value ??
    '';

  return {
    definition,
    options,
    selectedValue,
  };
}

export function catalogListOptionsForScope(
  state: CatalogScopedListState | undefined
): Pick<CatalogListOptions, 'menuId' | 'pageId'> {
  if (!state || state.selectedValue === '') {
    return {};
  }

  if (state.definition.fieldName === 'menuId') {
    return { menuId: state.selectedValue };
  }
  return { pageId: state.selectedValue };
}

export function catalogScopedCreatePath(props: {
  basePath: string;
  state: CatalogScopedListState | undefined;
}): string {
  if (!props.state || props.state.selectedValue === '') {
    return props.basePath;
  }

  const searchParams = new URLSearchParams({
    [props.state.definition.queryParamName]: props.state.selectedValue,
  });
  return `${props.basePath}?${searchParams.toString()}`;
}
