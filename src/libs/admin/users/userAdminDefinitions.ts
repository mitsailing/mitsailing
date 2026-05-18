import type { CatalogResourceDefinition } from '@/libs/admin/catalog/types';
import { ROLE_DEFINITIONS } from '@/libs/auth/roles';

const ROLE_SELECT_OPTIONS = ROLE_DEFINITIONS.map((definition) => ({
  labelKey: definition.labelKey,
  value: definition.key,
}));

/**
 * Catalog-shaped definition for `/admin/users` (explicit routes; not in catalog registry).
 */
export const usersAdminDefinition = {
  id: 'users',
  titleKey: 'title_admin_users',
  metaTitleKey: 'meta_title_admin_users',
  hubLabelKey: 'hub_label_users',
  listColumns: [
    {
      field: 'email',
      kind: 'string',
      headerKey: 'column_email',
    },
    {
      field: 'name',
      kind: 'string',
      headerKey: 'column_name_label',
    },
    {
      field: 'role',
      kind: 'string',
      headerKey: 'column_role',
    },
    {
      field: 'emailVerified',
      kind: 'boolean',
      headerKey: 'column_email_verified',
    },
    {
      field: 'emailDeliverabilityStatus',
      kind: 'string',
      headerKey: 'column_email_status',
    },
    {
      field: 'banned',
      kind: 'boolean',
      headerKey: 'column_banned',
      booleanPolarity: 'badWhenTrue',
    },
  ],
  formFields: [
    {
      field: 'email',
      kind: 'string',
      required: true,
      labelKey: 'field_email',
    },
    {
      field: 'name',
      kind: 'string',
      required: true,
      labelKey: 'field_name',
    },
    {
      field: 'password',
      kind: 'password',
      required: true,
      labelKey: 'field_password',
    },
    {
      field: 'role',
      kind: 'select',
      required: true,
      labelKey: 'field_role',
      selectOptions: ROLE_SELECT_OPTIONS,
    },
  ],
  capabilities: {
    create: true,
    update: true,
    delete: true,
    reorder: false,
  },
} as const satisfies CatalogResourceDefinition;

const usersAdminEditFormFields = [
  {
    field: 'email',
    kind: 'string',
    required: true,
    labelKey: 'field_email',
  },
  {
    field: 'name',
    kind: 'string',
    required: true,
    labelKey: 'field_name',
  },
  {
    field: 'role',
    kind: 'select',
    required: true,
    labelKey: 'field_role',
    selectOptions: ROLE_SELECT_OPTIONS,
  },
  {
    field: 'emailVerified',
    kind: 'boolean',
    labelKey: 'field_email_verified',
  },
  {
    field: 'banned',
    kind: 'boolean',
    labelKey: 'field_banned',
  },
  {
    field: 'newPassword',
    kind: 'password',
    required: false,
    labelKey: 'field_new_password',
  },
] as const;

export const usersAdminEditDefinition = {
  ...usersAdminDefinition,
  formFields: usersAdminEditFormFields,
} as const satisfies CatalogResourceDefinition;
