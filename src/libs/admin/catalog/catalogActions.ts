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

import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import * as z from 'zod';
import { sitemapCatalogCacheTag } from '@/app/sitemap';
import {
  adminCatalogResourceDeletePath,
  adminCatalogResourceEditPath,
  adminCatalogResourceIndexPath,
  adminCatalogResourceNewPath,
  ADMIN_INDEX_PATH,
} from '@/libs/admin/catalog/adminCatalogPaths';
import type { CatalogResourceId } from '@/libs/admin/catalog/catalogDefinitions';
import {
  isCatalogResourceId,
  tryGetCatalogDefinition,
} from '@/libs/admin/catalog/catalogDefinitions';
import {
  getCatalogChangeVersion,
  logCatalogChange,
} from '@/libs/admin/catalog/catalogEditMetadata';
import { getCatalogServerHandlers } from '@/libs/admin/catalog/catalogServerRegistry';
import {
  catalogSnapshotFormData,
  catalogSnapshotFromRow,
} from '@/libs/admin/catalog/catalogVersionSnapshots';
import type { CatalogReorderScope } from '@/libs/admin/catalog/types';
import { requireAdmin } from '@/libs/auth/dal';
import { getI18nPath } from '@/utils/Helpers';

const orderedIdsSchema = z.array(z.string().min(1)).min(1);
const catalogVersionIdSchema = z.string().min(1);
const catalogVisibilitySchema = z.object({
  isVisible: z.enum(['true', 'false']),
});

/** Public segments to invalidate when a catalog resource mutates (beyond `/donate`). */
const CATALOG_EXTRA_PUBLIC_PATHS: Partial<
  Record<CatalogResourceId, readonly string[]>
> = {
  event_categories: ['/events'],
  class_categories: ['/classes'],
  sailing_classes: ['/classes'],
  fleet: ['/fleet'],
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
  revalidatePath(getI18nPath(ADMIN_INDEX_PATH, locale));
  revalidatePath(
    getI18nPath(adminCatalogResourceIndexPath(resourceId), locale),
    'layout'
  );
  updateTag(sitemapCatalogCacheTag);
}

function revalidateAfterCatalogVisibilityMutation(
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
  revalidatePath(getI18nPath(ADMIN_INDEX_PATH, locale));
  revalidatePath(
    getI18nPath(adminCatalogResourceIndexPath(resourceId), locale)
  );
  updateTag(sitemapCatalogCacheTag);
}

function catalogEditErrorRedirect(
  locale: string,
  resourceId: CatalogResourceId,
  id: string,
  code: string
): never {
  redirect(
    `${getI18nPath(adminCatalogResourceEditPath(resourceId, id), locale)}?error=${encodeURIComponent(code)}`
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
  const session = await requireAdmin(locale);
  if (!isCatalogResourceId(resourceId)) {
    redirect(getI18nPath(ADMIN_INDEX_PATH, locale));
  }
  const handlers = getCatalogServerHandlers(resourceId);
  const result = await handlers.createFromForm(formData, {
    userId: session.user.id,
  });
  if (!result.ok) {
    redirect(
      `${getI18nPath(adminCatalogResourceNewPath(resourceId), locale)}?error=${encodeURIComponent(result.code)}`
    );
  }
  const row = await handlers.getById(result.id);
  await logCatalogChange({
    resourceId,
    rowId: result.id,
    action: 'created',
    userId: session.user.id,
    snapshot: row,
  });
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
  const session = await requireAdmin(locale);
  if (!isCatalogResourceId(resourceId)) {
    redirect(getI18nPath(ADMIN_INDEX_PATH, locale));
  }
  const handlers = getCatalogServerHandlers(resourceId);
  const result = await handlers.updateFromForm(id, formData, {
    userId: session.user.id,
  });
  if (!result.ok) {
    redirect(
      `${getI18nPath(adminCatalogResourceEditPath(resourceId, id), locale)}?error=${encodeURIComponent(result.code)}`
    );
  }
  const row = await handlers.getById(id);
  await logCatalogChange({
    resourceId,
    rowId: id,
    action: 'updated',
    userId: session.user.id,
    snapshot: row,
  });
  revalidateAfterCatalogMutation(locale, resourceId);
  revalidatePath(
    getI18nPath(adminCatalogResourceEditPath(resourceId, id), locale)
  );
}

/**
 * Updates only the publish status for a catalog row.
 *
 * @param locale - Active locale
 * @param resourceId - Registered catalog resource key
 * @param id - Primary key
 * @param formData - Form containing the next `isVisible` value
 * @returns Result for optimistic client status UI
 */
export async function updateCatalogVisibilityAction(
  locale: string,
  resourceId: string,
  id: string,
  formData: FormData
): Promise<{ ok: true; isVisible: boolean } | { ok: false; code: string }> {
  const session = await requireAdmin(locale);
  if (!isCatalogResourceId(resourceId)) {
    return { ok: false, code: 'unknown_resource' };
  }
  const definition = tryGetCatalogDefinition(resourceId);
  const visibilityField = definition?.formFields.find(
    (field) => field.kind === 'boolean' && field.field === 'isVisible'
  );
  if (!definition || !visibilityField || !definition.capabilities.update) {
    return { ok: false, code: 'visibility_disabled' };
  }
  const parsed = catalogVisibilitySchema.safeParse({
    isVisible: formData.get('isVisible'),
  });
  if (!parsed.success) {
    return { ok: false, code: 'validation_failed' };
  }

  const handlers = getCatalogServerHandlers(resourceId);
  const row = await handlers.getById(id);
  if (!row) {
    return { ok: false, code: 'not_found' };
  }
  const isVisible = parsed.data.isVisible === 'true';
  const snapshot = {
    ...catalogSnapshotFromRow(row),
    isVisible,
  };
  const result = await handlers.updateFromForm(
    id,
    catalogSnapshotFormData(definition, snapshot),
    { userId: session.user.id }
  );
  if (!result.ok) {
    return { ok: false, code: result.code };
  }
  const updatedRow = await handlers.getById(id);
  await logCatalogChange({
    resourceId,
    rowId: id,
    action: 'updated',
    userId: session.user.id,
    snapshot: updatedRow,
  });
  revalidateAfterCatalogVisibilityMutation(locale, resourceId);
  return { ok: true, isVisible };
}

/**
 * Restores a catalog row from a stored version snapshot.
 *
 * @param locale - Active locale
 * @param resourceId - Registered catalog resource key
 * @param id - Primary key
 * @param formData - Restore form containing `changeId`
 */
export async function restoreCatalogVersionAction(
  locale: string,
  resourceId: string,
  id: string,
  formData: FormData
): Promise<void> {
  const session = await requireAdmin(locale);
  if (!isCatalogResourceId(resourceId)) {
    redirect(getI18nPath(ADMIN_INDEX_PATH, locale));
  }
  const definition = tryGetCatalogDefinition(resourceId);
  if (!definition || !definition.capabilities.update) {
    redirect(getI18nPath(ADMIN_INDEX_PATH, locale));
  }
  const parsed = catalogVersionIdSchema.safeParse(formData.get('changeId'));
  if (!parsed.success) {
    catalogEditErrorRedirect(locale, resourceId, id, 'version_not_found');
  }
  const version = await getCatalogChangeVersion({
    resourceId,
    rowId: id,
    changeId: parsed.data,
    locale,
  });
  if (!version) {
    catalogEditErrorRedirect(locale, resourceId, id, 'version_not_found');
  }

  const handlers = getCatalogServerHandlers(resourceId);
  const result = await handlers.updateFromForm(
    id,
    catalogSnapshotFormData(definition, version.snapshot),
    { userId: session.user.id }
  );
  if (!result.ok) {
    catalogEditErrorRedirect(locale, resourceId, id, result.code);
  }
  const row = await handlers.getById(id);
  await logCatalogChange({
    resourceId,
    rowId: id,
    action: 'restored',
    userId: session.user.id,
    snapshot: row,
  });
  revalidateAfterCatalogMutation(locale, resourceId);
  revalidatePath(
    getI18nPath(adminCatalogResourceEditPath(resourceId, id), locale)
  );
  redirect(getI18nPath(adminCatalogResourceEditPath(resourceId, id), locale));
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
