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
import type {
  CatalogMutationContext,
  CatalogReorderScope,
  CatalogRow,
} from '@/libs/admin/catalog/types';
import { requireAdmin } from '@/libs/auth/dal';
import type { AuthSession } from '@/libs/auth/dal';
import {
  isCatalogHistoryResourceId,
  restoreCatalogRevision,
} from '@/libs/mit-sailing/catalogHistory';
import { restoreCmsPageRevision } from '@/libs/mit-sailing/cmsHistory';
import { SITE_ALERTS_CACHE_TAG } from '@/libs/mit-sailing/siteAlertQueries';
import { sitemapCatalogCacheTag } from '@/libs/mit-sailing/sitemapCache';
import { getI18nPath } from '@/utils/Helpers';

const orderedIdsSchema = z.array(z.string().min(1)).min(1);

function catalogMutationContextFromSession(
  session: NonNullable<AuthSession>
): CatalogMutationContext {
  const actorUserId =
    typeof session.session.impersonatedBy === 'string'
      ? session.session.impersonatedBy
      : session.user.id;
  return {
    impersonatedUserId:
      actorUserId === session.user.id ? undefined : session.user.id,
    userId: actorUserId,
  };
}

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
  cms_pages: ['/', '/about'],
  cms_page_blocks: ['/', '/about'],
  cms_menus: ['/'],
  cms_menu_items: ['/'],
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
    updateTag(SITE_ALERTS_CACHE_TAG);
  }
  if (resourceId === 'sailing_classes' || resourceId === 'fleet') {
    updateTag(sitemapCatalogCacheTag);
  }
  if (resourceId.startsWith('cms_')) {
    revalidatePath(getI18nPath('/', locale), 'layout');
  }
  revalidatePath(getI18nPath(ADMIN_INDEX_PATH, locale));
  revalidatePath(
    getI18nPath(adminCatalogResourceIndexPath(resourceId), locale),
    'layout'
  );
}

function catalogDetailPath(
  resourceId: CatalogResourceId,
  slug: string
): string | null {
  if (resourceId === 'sailing_classes') {
    return `/classes/${slug}`;
  }
  if (resourceId === 'fleet') {
    return `/fleet/${slug}`;
  }
  return null;
}

function slugFromCatalogFormData(formData: FormData): string | null {
  const slug = formData.get('slug');
  return typeof slug === 'string' && slug.trim().length > 0
    ? slug.trim()
    : null;
}

function slugFromCatalogRow(row: CatalogRow | null): string | null {
  const slug = row?.slug;
  return typeof slug === 'string' && slug.trim().length > 0
    ? slug.trim()
    : null;
}

function revalidateCatalogDetailPath(
  locale: string,
  resourceId: CatalogResourceId,
  slug: string | null
): void {
  if (!slug) {
    return;
  }
  const path = catalogDetailPath(resourceId, slug);
  if (path) {
    revalidatePath(getI18nPath(path, locale));
  }
}

function scopedCatalogMutationSearchParam(
  resourceId: CatalogResourceId,
  formData: FormData
): { name: string; value: string } | undefined {
  if (resourceId === 'cms_page_blocks') {
    const pageId = formData.get('pageId');
    return typeof pageId === 'string' && pageId.trim().length > 0
      ? { name: 'page', value: pageId }
      : undefined;
  }
  if (resourceId === 'cms_menu_items') {
    const menuId = formData.get('menuId');
    return typeof menuId === 'string' && menuId.trim().length > 0
      ? { name: 'menu', value: menuId }
      : undefined;
  }
  return undefined;
}

/** Keeps redirect URLs bounded when Zod surfaces long issue messages. */
const MAX_FIELD_ERROR_MESSAGE_CHARS = 500;

function catalogRedirectPath(props: {
  basePath: string;
  errorCode?: string;
  fieldErrors?: Record<string, string>;
  scope?: { name: string; value: string };
}): string {
  const searchParams = new URLSearchParams();
  if (props.scope) {
    searchParams.set(props.scope.name, props.scope.value);
  }
  if (props.errorCode) {
    searchParams.set('error', props.errorCode);
  }
  if (props.fieldErrors) {
    for (const [field, message] of Object.entries(props.fieldErrors)) {
      const safeMessage =
        message.length > MAX_FIELD_ERROR_MESSAGE_CHARS
          ? `${message.slice(0, MAX_FIELD_ERROR_MESSAGE_CHARS)}…`
          : message;
      searchParams.append(
        'fieldError',
        JSON.stringify({ f: field, m: safeMessage })
      );
    }
  }
  const query = searchParams.toString();
  return query ? `${props.basePath}?${query}` : props.basePath;
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
  const scope = scopedCatalogMutationSearchParam(resourceId, formData);
  const result = await handlers.createFromForm(
    formData,
    catalogMutationContextFromSession(session)
  );
  if (!result.ok) {
    redirect(
      catalogRedirectPath({
        basePath: getI18nPath(adminCatalogResourceNewPath(resourceId), locale),
        errorCode: result.code,
        fieldErrors: result.fieldErrors,
        scope,
      })
    );
  }
  revalidateAfterCatalogMutation(locale, resourceId);
  revalidateCatalogDetailPath(
    locale,
    resourceId,
    slugFromCatalogFormData(formData)
  );
  redirect(
    catalogRedirectPath({
      basePath: getI18nPath(
        adminCatalogResourceEditPath(resourceId, result.id),
        locale
      ),
      scope,
    })
  );
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
  const scope = scopedCatalogMutationSearchParam(resourceId, formData);
  const oldSlug = slugFromCatalogRow(await handlers.getById(id));
  const result = await handlers.updateFromForm(
    id,
    formData,
    catalogMutationContextFromSession(session)
  );
  if (!result.ok) {
    redirect(
      catalogRedirectPath({
        basePath: getI18nPath(
          adminCatalogResourceEditPath(resourceId, id),
          locale
        ),
        errorCode: result.code,
        fieldErrors: result.fieldErrors,
        scope,
      })
    );
  }
  revalidateAfterCatalogMutation(locale, resourceId);
  revalidateCatalogDetailPath(locale, resourceId, oldSlug);
  revalidateCatalogDetailPath(
    locale,
    resourceId,
    slugFromCatalogFormData(formData)
  );
  redirect(
    catalogRedirectPath({
      basePath: getI18nPath(
        adminCatalogResourceEditPath(resourceId, id),
        locale
      ),
      scope,
    })
  );
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
  const session = await requireAdmin(locale);
  if (!isCatalogResourceId(resourceId)) {
    redirect(getI18nPath(ADMIN_INDEX_PATH, locale));
  }
  const handlers = getCatalogServerHandlers(resourceId);
  const oldSlug = slugFromCatalogRow(await handlers.getById(id));
  const result = await handlers.delete(
    id,
    catalogMutationContextFromSession(session)
  );
  if (!result.ok) {
    redirect(
      `${getI18nPath(adminCatalogResourceDeletePath(resourceId, id), locale)}?error=${encodeURIComponent(result.code)}`
    );
  }
  revalidateAfterCatalogMutation(locale, resourceId);
  revalidateCatalogDetailPath(locale, resourceId, oldSlug);
  redirect(getI18nPath(adminCatalogResourceIndexPath(resourceId), locale));
}

/**
 * Restores a CMS page and its blocks from a recorded page revision.
 *
 * @param locale - Active locale
 * @param pageId - CMS page id
 * @param revisionId - CMS page revision id
 * @param formData - Confirmation form body
 */
export async function restoreCmsPageRevisionAction(
  locale: string,
  pageId: string,
  revisionId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAdmin(locale);
  if (formData.get('confirmRestore') !== 'true') {
    redirect(
      `${getI18nPath(adminCatalogResourceEditPath('cms_pages', pageId), locale)}?error=validation_failed`
    );
  }
  const context = catalogMutationContextFromSession(session);
  const result = await restoreCmsPageRevision({
    createdByUserId: context.userId,
    impersonatedUserId: context.impersonatedUserId,
    pageId,
    revisionId,
  });
  if (!result.ok) {
    redirect(
      `${getI18nPath(adminCatalogResourceEditPath('cms_pages', pageId), locale)}?error=${encodeURIComponent(result.code)}`
    );
  }
  revalidateAfterCatalogMutation(locale, 'cms_pages');
  redirect(
    getI18nPath(adminCatalogResourceEditPath('cms_pages', pageId), locale)
  );
}

/**
 * Restores class or fleet form fields from a recorded user audit revision.
 *
 * @param locale - Active locale
 * @param resourceId - Supported catalog resource key
 * @param id - Row primary key
 * @param revisionId - User audit revision id
 * @param formData - Confirmation form body
 */
export async function restoreCatalogResourceRevisionAction(
  locale: string,
  resourceId: string,
  id: string,
  revisionId: string,
  formData: FormData
): Promise<void> {
  const session = await requireAdmin(locale);
  if (!isCatalogResourceId(resourceId)) {
    redirect(getI18nPath(ADMIN_INDEX_PATH, locale));
  }
  if (!isCatalogHistoryResourceId(resourceId)) {
    redirect(getI18nPath(adminCatalogResourceEditPath(resourceId, id), locale));
  }
  if (formData.get('confirmRestore') !== 'true') {
    redirect(
      `${getI18nPath(adminCatalogResourceEditPath(resourceId, id), locale)}?error=validation_failed`
    );
  }

  const handlers = getCatalogServerHandlers(resourceId);
  const oldSlug = slugFromCatalogRow(await handlers.getById(id));
  const result = await restoreCatalogRevision({
    context: catalogMutationContextFromSession(session),
    itemId: id,
    resourceId,
    revisionId,
  });
  if (!result.ok) {
    redirect(
      `${getI18nPath(adminCatalogResourceEditPath(resourceId, id), locale)}?error=${encodeURIComponent(result.code)}`
    );
  }
  revalidateAfterCatalogMutation(locale, resourceId);
  revalidateCatalogDetailPath(locale, resourceId, oldSlug);
  revalidateCatalogDetailPath(locale, resourceId, result.slug);
  redirect(getI18nPath(adminCatalogResourceEditPath(resourceId, id), locale));
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
