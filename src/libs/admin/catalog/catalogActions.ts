'use server';

/**
 * Catalog mutations use `redirect` with `?error=` for failure paths so HTML
 * forms stay progressive-enhancement friendly without a client wrapper.
 *
 * For field-level validation surfaced on the same page, Next.js documents
 * returning structured errors from a Server Action and wiring the client with
 * `useActionState` (see nextjs.org docs: Forms / Mutating data). Consider that
 * pattern if catalog forms need inline errors without a full round-trip redirect.
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import * as z from 'zod';
import {
  adminCatalogResourceDeletePath,
  adminCatalogResourceEditPath,
  adminCatalogResourceIndexPath,
  adminCatalogResourceNewPath,
  ADMIN_INDEX_PATH,
} from '@/libs/admin/catalog/adminCatalogPaths';
import type { CatalogResourceId } from '@/libs/admin/catalog/catalogDefinitions';
import { isCatalogResourceId } from '@/libs/admin/catalog/catalogDefinitions';
import { getCatalogServerHandlers } from '@/libs/admin/catalog/catalogServerRegistry';
import type { CatalogReorderScope } from '@/libs/admin/catalog/types';
import { requireAdmin } from '@/libs/auth/dal';
import { SITE_ALERTS_CACHE_TAG } from '@/libs/mit-sailing/siteAlertQueries';
import { getI18nPath } from '@/utils/Helpers';

const orderedIdsSchema = z.array(z.string().min(1)).min(1);

/** Public segments to invalidate when a catalog resource mutates (beyond `/donate`). */
const CATALOG_EXTRA_PUBLIC_PATHS: Partial<
  Record<CatalogResourceId, readonly string[]>
> = {
  event_categories: ['/events'],
  class_categories: ['/classes'],
  sailing_classes: ['/classes'],
  sailing_ratings: ['/ratings', '/classes', '/fleet'],
  sailing_rating_rules: ['/ratings', '/classes', '/fleet'],
  fleet: ['/fleet'],
  site_alerts: ['/', '/alerts'],
};

function revalidateAfterCatalogMutation(
  locale: string,
  resourceId: CatalogResourceId
): void {
  revalidatePath(getI18nPath('/donate', locale));
  const extra = CATALOG_EXTRA_PUBLIC_PATHS[resourceId];
  if (extra) {
    for (const path of extra) {
      revalidatePath(getI18nPath(path, locale));
    }
  }
  if (resourceId === 'site_alerts') {
    revalidateTag(SITE_ALERTS_CACHE_TAG, { expire: 0 });
  }
  revalidatePath(getI18nPath(ADMIN_INDEX_PATH, locale));
  revalidatePath(
    getI18nPath(adminCatalogResourceIndexPath(resourceId), locale),
    'layout'
  );
}

/**
 * Persists a new catalog row from an admin form submission.
 *
 * @param locale - Active locale for auth redirects and navigation
 * @param resourceId - Registered catalog resource key
 * @param formData - Raw multipart form body
 */
export async function createCatalogResourceAction(
  locale: string,
  resourceId: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  if (!isCatalogResourceId(resourceId)) {
    redirect(getI18nPath(ADMIN_INDEX_PATH, locale));
  }
  const handlers = getCatalogServerHandlers(resourceId);
  const result = await handlers.createFromForm(formData);
  if (!result.ok) {
    redirect(
      `${getI18nPath(adminCatalogResourceNewPath(resourceId), locale)}?error=${encodeURIComponent(result.code)}`
    );
  }
  revalidateAfterCatalogMutation(locale, resourceId);
  redirect(getI18nPath(adminCatalogResourceIndexPath(resourceId), locale));
}

/**
 * Updates an existing catalog row.
 *
 * @param locale - Active locale
 * @param resourceId - Registered catalog resource key
 * @param id - Primary key
 * @param formData - Raw multipart form body
 */
export async function updateCatalogResourceAction(
  locale: string,
  resourceId: string,
  id: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  if (!isCatalogResourceId(resourceId)) {
    redirect(getI18nPath(ADMIN_INDEX_PATH, locale));
  }
  const handlers = getCatalogServerHandlers(resourceId);
  const result = await handlers.updateFromForm(id, formData);
  if (!result.ok) {
    redirect(
      `${getI18nPath(adminCatalogResourceEditPath(resourceId, id), locale)}?error=${encodeURIComponent(result.code)}`
    );
  }
  revalidateAfterCatalogMutation(locale, resourceId);
  redirect(getI18nPath(adminCatalogResourceIndexPath(resourceId), locale));
}

/**
 * Deletes a catalog row after confirmation.
 *
 * @param locale - Active locale
 * @param resourceId - Registered catalog resource key
 * @param id - Primary key
 */
export async function deleteCatalogResourceAction(
  locale: string,
  resourceId: string,
  id: string
): Promise<void> {
  await requireAdmin(locale);
  if (!isCatalogResourceId(resourceId)) {
    redirect(getI18nPath(ADMIN_INDEX_PATH, locale));
  }
  const handlers = getCatalogServerHandlers(resourceId);
  const result = await handlers.delete(id);
  if (!result.ok) {
    redirect(
      `${getI18nPath(adminCatalogResourceDeletePath(resourceId, id), locale)}?error=${encodeURIComponent(result.code)}`
    );
  }
  revalidateAfterCatalogMutation(locale, resourceId);
  redirect(getI18nPath(adminCatalogResourceIndexPath(resourceId), locale));
}

const reorderScopeSchema = z.object({
  classCategoryId: z.string().min(1),
});

/**
 * Reorders rows after drag-and-drop; persists `displayOrder` in one transaction.
 *
 * @param locale - Active locale
 * @param resourceId - Registered catalog resource key
 * @param orderedIds - Full ordered list of row ids (or category subset when `scope` is set)
 * @param reorderScope - Optional scope (e.g. `sailing_classes` requires `classCategoryId`)
 * @returns Success flag for client UI (no redirect)
 */
export async function reorderCatalogResourceAction(
  locale: string,
  resourceId: string,
  orderedIds: unknown,
  reorderScope?: unknown
): Promise<{ ok: true } | { ok: false; code: string }> {
  await requireAdmin(locale);
  if (!isCatalogResourceId(resourceId)) {
    return { ok: false, code: 'unknown_resource' };
  }
  const handlers = getCatalogServerHandlers(resourceId);
  if (!handlers.reorder) {
    return { ok: false, code: 'reorder_disabled' };
  }
  const parsed = orderedIdsSchema.safeParse(orderedIds);
  if (!parsed.success) {
    return { ok: false, code: 'invalid_payload' };
  }
  let scope: CatalogReorderScope | undefined;
  if (resourceId === 'sailing_classes') {
    const scoped = reorderScopeSchema.safeParse(reorderScope);
    if (!scoped.success) {
      return { ok: false, code: 'invalid_payload' };
    }
    scope = scoped.data;
  } else if (reorderScope !== undefined && reorderScope !== null) {
    return { ok: false, code: 'invalid_payload' };
  }
  const result = await handlers.reorder(parsed.data, scope);
  if (!result.ok) {
    return { ok: false, code: result.code };
  }
  revalidateAfterCatalogMutation(locale, resourceId);
  return { ok: true };
}
