/**
 * Configuration-driven catalog admin: field kinds map to shared renderers and
 * list cell formatting (visibility badges, plain text, numbers).
 */

import type { EmailDeliverabilityStatus } from '@/libs/email/emailDeliverabilityStatus';
import type { AppAuthContext } from '@/libs/zenstack/authContext';
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
  | 'image'
  | 'imageList'
  | 'url'
  | 'number'
  | 'boolean'
  | 'visibility'
  | 'password'
  | 'select'
  | 'datetimeLocal'
  | 'date';

export type AdminEmailDeliverabilityStatus = EmailDeliverabilityStatus;

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

export type AdminFormSectionDef = {
  fields: readonly string[];
  helperKey?: AdminCatalogResourceMessageKey | AdminUsersMessageKey;
  headingKey: AdminCatalogResourceMessageKey | AdminUsersMessageKey;
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
  formSections?: readonly AdminFormSectionDef[];
  capabilities: CatalogCapabilities;
  /** Row field containing an app-relative public URL for a View action. */
  publicViewHrefField?: string;
};

/** Serialized row for list/detail forms (dates as ISO strings). */
export type CatalogRow = Record<
  string,
  string | string[] | number | boolean | null | undefined
>;

/**
 * Admin user row for `/admin/users` lists and forms.
 *
 * Deliverability-related fields are nullable because webhook updates and legacy
 * rows can temporarily expose partial state while the admin surface stays
 * read-only for these fields.
 */
export type AdminUserRow = {
  id: string;
  email: string;
  emailBouncedAt: string | null;
  emailDeliverabilityStatus: AdminEmailDeliverabilityStatus;
  emailSuppressedAt: string | null;
  emailSuppressionReason: string | null;
  mitId: string | null;
  sailingCardNumber: number | null;
  name: string;
  appRole: string;
  emailVerified: boolean;
  banned: boolean;
};

export type CatalogMutationOk = { ok: true };

export type CatalogMutationErr = {
  ok: false;
  code: string;
  fieldErrors?: Record<string, string>;
};

export type CatalogCreateResult = { ok: true; id: string } | CatalogMutationErr;

export type CatalogMutationContext = {
  /** ZenStack policy auth context bound to the actor session. */
  authContext?: AppAuthContext;
  /** Real actor responsible for the change. */
  userId?: string;
  /** Session target when an actor is impersonating another user. */
  impersonatedUserId?: string;
};

/** Optional scope for category-scoped reorder (e.g. sailing classes per `ClassCategory`). */
export type CatalogReorderScope = {
  classCategoryId: string;
};

/** Optional context for {@link CatalogServerHandlers.list} (e.g. locale-scoped public URLs). */
export type CatalogListOptions = {
  locale?: string;
  menuId?: string;
  pageId?: string;
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
    context?: CatalogMutationContext
  ) => Promise<CatalogCreateResult>;
  updateFromForm: (
    id: string,
    formData: FormData,
    context?: CatalogMutationContext
  ) => Promise<CatalogMutationOk | CatalogMutationErr>;
  delete: (
    id: string,
    context?: CatalogMutationContext
  ) => Promise<CatalogMutationOk | CatalogMutationErr>;
  reorder?: (
    orderedIds: readonly string[],
    scope?: CatalogReorderScope,
    context?: CatalogMutationContext
  ) => Promise<CatalogMutationOk | CatalogMutationErr>;
};
