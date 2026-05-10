/**
 * Rails-style URL helpers for scaffolded catalog resources under `admin`:
 * `GET /admin/:resource` (index), `GET /admin/:resource/new` (new),
 * `GET /admin/:resource/:id/edit` (edit), and the delete confirmation flow
 * (destroy).
 *
 * The admin dashboard that lists every section lives at {@link ADMIN_INDEX_PATH}.
 * User admin URLs live in `@/libs/admin/users/adminUserPaths`.
 */
export const ADMIN_INDEX_PATH = '/admin';

/**
 * @param resourceId - Registered catalog resource key (e.g. `donation_funds`)
 * @returns Path to the resource index
 */
export function adminCatalogResourceIndexPath(resourceId: string): string {
  return `/admin/${resourceId}`;
}

/**
 * @param resourceId - Registered catalog resource key
 * @returns Path to the new-row form
 */
export function adminCatalogResourceNewPath(resourceId: string): string {
  return `/admin/${resourceId}/new`;
}

/**
 * @param resourceId - Registered catalog resource key
 * @param id - Row primary key
 * @returns Path to the edit form
 */
export function adminCatalogResourceEditPath(
  resourceId: string,
  id: string
): string {
  return `/admin/${resourceId}/${id}/edit`;
}

/**
 * @param resourceId - Registered catalog resource key
 * @param id - Row primary key
 * @returns Path to the delete confirmation screen
 */
export function adminCatalogResourceDeletePath(
  resourceId: string,
  id: string
): string {
  return `/admin/${resourceId}/${id}/delete`;
}

/**
 * @param resourceId - Registered catalog resource key
 * @param id - Row primary key
 * @param segment - Child segment (e.g. `related-events`)
 * @returns Path to an association sub-page under the catalog edit flow
 */
export function adminCatalogResourceAssociationPath(
  resourceId: string,
  id: string,
  segment: string
): string {
  return `/admin/${resourceId}/${id}/${segment}`;
}

/**
 * @param pageId - CMS page id
 * @param revisionId - CMS page revision id
 * @returns Path to the CMS page revision comparison screen
 */
export function adminCmsPageRevisionPath(
  pageId: string,
  revisionId: string
): string {
  return `/admin/cms_pages/${encodeURIComponent(pageId)}/revisions/${encodeURIComponent(revisionId)}`;
}

/**
 * @param resourceId - Registered catalog resource key
 * @param id - Row primary key
 * @param revisionId - User audit revision id
 * @returns Path to a catalog item revision comparison screen
 */
export function adminCatalogResourceRevisionPath(
  resourceId: string,
  id: string,
  revisionId: string
): string {
  return `/admin/${encodeURIComponent(resourceId)}/${encodeURIComponent(id)}/revisions/${encodeURIComponent(revisionId)}`;
}
