'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminFacetedFilter } from '@/components/mit-sailing/admin/AdminFacetedFilter';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { buildAdminListHref } from '@/libs/admin/buildAdminListHref';

type AdminUrlFilterParams = Record<string, string | undefined>;

type AdminUrlFilterSearchField = {
  label: string;
  param: string;
  placeholder: string;
  value: string;
};

type AdminUrlFilterSelectOption = {
  label: string;
  value: string;
};

type AdminUrlFilterSelectField = {
  defaultValue: string;
  label: string;
  options: AdminUrlFilterSelectOption[];
  param: string;
  value: string;
};

type AdminUrlFilterDateField = {
  label: string;
  param: string;
  value: string;
};

type AdminUrlFilterToolbarProps = {
  basePath: string;
  className?: string;
  dateFields?: AdminUrlFilterDateField[];
  omitWhenDefault?: Record<string, string>;
  params: AdminUrlFilterParams;
  search?: AdminUrlFilterSearchField;
  selects: AdminUrlFilterSelectField[];
};

function navigateToFilterHref(
  router: ReturnType<typeof useRouter>,
  href: string
) {
  router.push(href);
}

/**
 * URL-synced admin list filter toolbar with faceted popovers and debounced search.
 *
 * @param props - Base path, current params, and filter field descriptors
 * @returns Filter toolbar markup
 */
export function AdminUrlFilterToolbar(props: AdminUrlFilterToolbarProps) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(props.search?.value ?? '');

  useEffect(() => {
    setSearchValue(props.search?.value ?? '');
  }, [props.search?.value]);

  useEffect(() => {
    if (!props.search) {
      return;
    }
    const searchParam = props.search.param;
    const currentQuery = props.search.value.trim();
    const timeoutId = globalThis.setTimeout(() => {
      const trimmed = searchValue.trim();
      if (trimmed === currentQuery) {
        return;
      }
      navigateToFilterHref(
        router,
        buildAdminListHref({
          omitWhenDefault: props.omitWhenDefault,
          params: props.params,
          pathname: props.basePath,
          updates: { [searchParam]: trimmed.length > 0 ? trimmed : null },
        })
      );
    }, 300);
    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [
    props.basePath,
    props.omitWhenDefault,
    props.params,
    props.search,
    router,
    searchValue,
  ]);

  function applySelect(param: string, value: string) {
    navigateToFilterHref(
      router,
      buildAdminListHref({
        omitWhenDefault: props.omitWhenDefault,
        params: props.params,
        pathname: props.basePath,
        updates: { [param]: value },
      })
    );
  }

  function applyDate(param: string, value: string) {
    navigateToFilterHref(
      router,
      buildAdminListHref({
        omitWhenDefault: props.omitWhenDefault,
        params: props.params,
        pathname: props.basePath,
        updates: { [param]: value.length > 0 ? value : null },
      })
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', props.className)}>
      {props.search ? (
        <Input
          aria-label={props.search.label}
          className="h-8 w-[150px] lg:w-[250px]"
          onChange={(event) => {
            setSearchValue(event.currentTarget.value);
          }}
          placeholder={props.search.placeholder}
          type="search"
          value={searchValue}
        />
      ) : null}
      {props.selects.map((select) => (
        <AdminFacetedFilter
          defaultValue={select.defaultValue}
          key={select.param}
          label={select.label}
          onSelect={(value) => {
            applySelect(select.param, value);
          }}
          options={select.options}
          value={select.value}
        />
      ))}
      {props.dateFields?.map((dateField) => (
        <div className="flex items-center gap-2" key={dateField.param}>
          <Label
            className="sr-only"
            htmlFor={`admin-url-filter-${dateField.param}`}
          >
            {dateField.label}
          </Label>
          <Input
            className="h-8 w-36"
            defaultValue={dateField.value}
            id={`admin-url-filter-${dateField.param}`}
            key={dateField.value}
            onChange={(event) => {
              applyDate(dateField.param, event.currentTarget.value);
            }}
            type="date"
          />
        </div>
      ))}
    </div>
  );
}
