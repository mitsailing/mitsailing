type AdminListHrefParams = Record<string, string | undefined>;

type BuildAdminListHrefOptions = {
  omitWhenDefault?: Record<string, string>;
  params: AdminListHrefParams;
  pathname: string;
  resetPage?: boolean;
  updates?: Record<string, string | null | undefined>;
};

/**
 * Builds a list URL from pathname and query params, omitting empty/default values.
 *
 * @param options - Pathname, current params, updates, and default omissions
 * @returns Pathname with optional query string
 */
export function buildAdminListHref(options: BuildAdminListHrefOptions) {
  const merged: AdminListHrefParams = { ...options.params };
  if (options.updates) {
    for (const [key, value] of Object.entries(options.updates)) {
      if (value === null || value === undefined) {
        Reflect.deleteProperty(merged, key);
      } else {
        merged[key] = value;
      }
    }
  }
  const searchParams = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(merged)) {
    const value = rawValue?.trim() ?? '';
    if (value.length === 0) {
      continue;
    }
    if (options.omitWhenDefault?.[key] === value) {
      continue;
    }
    searchParams.set(key, value);
  }

  if (options.resetPage !== false && !('page' in (options.updates ?? {}))) {
    searchParams.delete('page');
  }

  const query = searchParams.toString();
  return query.length > 0 ? `${options.pathname}?${query}` : options.pathname;
}

/**
 * Removes one filter param while preserving the rest.
 *
 * @param options - Pathname, params, param to remove, and default omissions
 * @returns Pathname with optional query string
 */
export function buildAdminListHrefWithoutParam(options: {
  omitWhenDefault?: Record<string, string>;
  param: string;
  params: AdminListHrefParams;
  pathname: string;
}) {
  return buildAdminListHref({
    omitWhenDefault: options.omitWhenDefault,
    params: options.params,
    pathname: options.pathname,
    updates: { [options.param]: null },
  });
}
