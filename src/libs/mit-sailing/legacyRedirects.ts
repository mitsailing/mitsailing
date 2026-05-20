import 'server-only';

const LEGACY_DOTTED_EXTENSIONS = ['.php', '.htm', '.html'] as const;

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 1 && value.codePointAt(end - 1) === 47) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
}

function isLegacyPathCharacter(value: string): boolean {
  const code = value.codePointAt(0) ?? 0;
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    value === '_' ||
    value === '.' ||
    value === '-'
  );
}

function isLegacyDottedPath(value: string): boolean {
  if (!value.startsWith('/')) {
    return false;
  }
  const segments = value.split('/');
  const [root, ...pathSegments] = segments;
  if (root !== '' || pathSegments.length === 0) {
    return false;
  }
  for (const segment of pathSegments) {
    if (!segment) {
      return false;
    }
    for (const character of segment) {
      if (!isLegacyPathCharacter(character)) {
        return false;
      }
    }
  }
  const lastSegment = pathSegments.at(-1) ?? '';
  const lowerLastSegment = lastSegment.toLowerCase();
  return LEGACY_DOTTED_EXTENSIONS.some(
    (extension) =>
      lowerLastSegment.length > extension.length &&
      lowerLastSegment.endsWith(extension)
  );
}

/**
 * Normalizes old-site dotted source paths for lookup and admin storage.
 *
 * @param value - Submitted or requested path
 * @returns Normalized source path, or null when unsupported
 */
export function normalizeLegacyRedirectPath(value: string): string | null {
  const withoutQuery = value.trim().split('?')[0]?.trim() ?? '';
  const withSlash = withoutQuery.startsWith('/')
    ? withoutQuery
    : `/${withoutQuery}`;
  const normalized = trimTrailingSlashes(withSlash);
  return isLegacyDottedPath(normalized) ? normalized : null;
}

/**
 * Normalizes internal redirect target paths for admin storage and runtime use.
 *
 * @param value - Submitted or stored target path
 * @returns Normalized target path, or null when unsafe for public redirects
 */
export function normalizeLegacyRedirectTargetPath(
  value: string
): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null;
  }
  if (trimmed.includes('?') || trimmed.includes('#')) {
    return null;
  }
  if (trimmed.includes('\\')) {
    return null;
  }
  if (
    trimmed === '/api' ||
    trimmed.startsWith('/api/') ||
    trimmed === '/_next' ||
    trimmed.startsWith('/_next/') ||
    trimmed === '/monitoring' ||
    trimmed.startsWith('/monitoring/')
  ) {
    return null;
  }
  return trimTrailingSlashes(trimmed);
}

/**
 * Resolves an old-site dotted path to a localized internal target path.
 *
 * @param options - Active locale and request pathname
 * @returns Localized target path, or null when no safe redirect exists
 */
export async function resolveLegacyRedirect(options: {
  locale: string;
  pathname: string;
}): Promise<string | null> {
  const sourcePath = normalizeLegacyRedirectPath(options.pathname);
  if (!sourcePath) {
    return null;
  }

  const [{ prisma }, { getI18nPath }] = await Promise.all([
    import('@/libs/DB'),
    import('@/utils/Helpers'),
  ]);
  const row = await prisma.legacyRedirect.findUnique({
    select: { targetPath: true },
    where: { sourcePath },
  });
  if (!row) {
    return null;
  }

  const targetPath = normalizeLegacyRedirectTargetPath(row.targetPath);
  return targetPath ? getI18nPath(targetPath, options.locale) : null;
}
