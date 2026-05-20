import 'server-only';

const LEGACY_DOTTED_PATH_PATTERN = /^\/(?:[\w.-]+\/)*[\w.-]+\.(?:php|html?)$/i;

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
  const normalized =
    withSlash.length > 1 ? withSlash.replace(/\/+$/u, '') : withSlash;
  return LEGACY_DOTTED_PATH_PATTERN.test(normalized) ? normalized : null;
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
  return trimmed.length > 1 ? trimmed.replace(/\/+$/u, '') : trimmed;
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
