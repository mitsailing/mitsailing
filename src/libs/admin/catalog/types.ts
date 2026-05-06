/**
 * Configuration-driven catalog admin: field kinds map to shared renderers and
 * list cell formatting (visibility badges, plain text, numbers).
 */

import type messages from '@/locales/en.json';

/** Keys under `AdminCatalogResource` in locale JSON (strict next-intl typing). */
export type AdminCatalogResourceMessageKey =
  keyof typeof messages.AdminCatalogResource;

/** Keys under `AdminUsers` for the users admin scaffold. */
export type AdminUsersMessageKey = keyof typeof messages.AdminUsers;

/** Keys under `MitSailingRoutes` used by catalog admin pages. */
export type MitSailingRoutesCatalogMessageKey =
  keyof typeof messages.MitSailingRoutes;

export type AdminFieldKind =
  | 'string'
  | 'text'
  | 'richText'
  | 'url'
  | 'number'
  | 'boolean'
  | 'visibility'
  | 'password'
  | 'select'
  | 'fleetVisibleBoats';

export type AdminSelectOption = {
  value: string;
  labelKey: AdminCatalogResourceMessageKey | AdminUsersMessageKey;
};

/** Maps list `boolean` values to pill tones (`goodWhenTrue`: verified-style; `badWhenTrue`: banned-style). */
export type AdminBooleanListPolarity = 'goodWhenTrue' | 'badWhenTrue';

export type AdminListColumnDef = {
  field: string;
  kind: AdminFieldKind;
  /** next-intl key for the table header */
  headerKey: AdminCatalogResourceMessageKey | AdminUsersMessageKey;
  /** When `kind` is `boolean`, how true/false map to success/neutral/danger pills. */
  booleanPolarity?: AdminBooleanListPolarity;
};

export type AdminFormFieldDef = {
  field: string;
  kind: AdminFieldKind;
  required?: boolean;
  /** next-intl key for the label */
  labelKey: AdminCatalogResourceMessageKey | AdminUsersMessageKey;
  /** Required when `kind` is `select` */
  selectOptions?: readonly AdminSelectOption[];
};

export type CatalogCapabilities = {
  create: boolean;
  update: boolean;
  delete: boolean;
  reorder: boolean;
};

export type CatalogResourceDefinition = {
  id: string;
  /** MitSailingRoutes — page title / meta */
  titleKey: MitSailingRoutesCatalogMessageKey;
  metaTitleKey: MitSailingRoutesCatalogMessageKey;
  /** AdminCatalogResource — resource label on hub (users use {@link AdminUsersMessageKey} via `usersAdminDefinition`) */
  hubLabelKey: AdminCatalogResourceMessageKey;
  listColumns: readonly AdminListColumnDef[];
  formFields: readonly AdminFormFieldDef[];
  capabilities: CatalogCapabilities;
  /**
   * Public marketing path for preview (locale prefix is applied by `Link` from
   * the current request).
   */
  publicPreview?: {
    path: `/${string}`;
    labelKey: AdminCatalogResourceMessageKey;
  };
};

/** Serialized row for list/detail forms (dates as ISO strings). */
export type CatalogRow = Record<
  string,
  string | number | boolean | null | undefined
>;

/** Admin user row for `/admin/users` lists and forms (assignable to {@link CatalogRow}). */
export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  banned: boolean;
};

export type CatalogMutationOk = { ok: true };

export type CatalogMutationErr = { ok: false; code: string };

export type CatalogCreateResult = { ok: true; id: string } | CatalogMutationErr;

export type CatalogMutationContext = {
  userId: string;
};

export type CatalogSnapshotValue = string | number | boolean | null;

export type CatalogVersionSnapshot = Record<string, CatalogSnapshotValue>;

export type CatalogChangeAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'restored';

export type CatalogEditChange = {
  id: string;
  action: CatalogChangeAction;
  editorName: string | null;
  editorEmail: string | null;
  createdAt: string;
  canRestore: boolean;
  viewHref: string | null;
  compareHref: string | null;
};

export type CatalogEditVersion = CatalogEditChange & {
  snapshot: CatalogVersionSnapshot;
};

export type CatalogEditContributor = {
  name: string;
  email: string | null;
};

export type CatalogEditMetadata = {
  createdBy: CatalogEditContributor | null;
  createdAt: string | null;
  lastEditedBy: CatalogEditContributor | null;
  lastEditedAt: string | null;
  isPublished: boolean | null;
  renderedAt: string;
  recentChanges: readonly CatalogEditChange[];
  viewPageHref: string | null;
};

/** Optional scope for category-scoped reorder (e.g. sailing classes per `ClassCategory`). */
export type CatalogReorderScope = {
  classCategoryId: string;
};

/** Optional context for {@link CatalogServerHandlers.list} (e.g. locale-scoped public URLs). */
export type CatalogListOptions = {
  locale?: string;
};

/**
 * Server-side handler bundle for one catalog resource. Mutations use
 * {@link FormData} so boolean fields and future file uploads stay consistent.
 */
export type CatalogServerHandlers = {
  list: (options?: CatalogListOptions) => Promise<CatalogRow[]>;
  getById: (id: string) => Promise<CatalogRow | null>;
  createFromForm: (
    formData: FormData,
    context: CatalogMutationContext
  ) => Promise<CatalogCreateResult>;
  updateFromForm: (
    id: string,
    formData: FormData,
    context: CatalogMutationContext
  ) => Promise<CatalogMutationOk | CatalogMutationErr>;
  delete: (id: string) => Promise<CatalogMutationOk | CatalogMutationErr>;
  reorder?: (
    orderedIds: readonly string[],
    scope?: CatalogReorderScope
  ) => Promise<CatalogMutationOk | CatalogMutationErr>;
};
