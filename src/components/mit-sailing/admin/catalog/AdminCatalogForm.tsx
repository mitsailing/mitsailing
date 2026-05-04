'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AdminCatalogEditStatusBadge } from '@/components/mit-sailing/admin/catalog/AdminCatalogListCell';
import { AdminFleetVisibleBoatsTagCloud } from '@/components/mit-sailing/admin/catalog/AdminFleetVisibleBoatsTagCloud';
import { AdminRichTextField } from '@/components/mit-sailing/admin/catalog/AdminRichTextField';
import type {
  AdminFieldKind,
  AdminFormFieldDef,
  CatalogResourceDefinition,
  CatalogRow,
} from '@/libs/admin/catalog/types';
import type messages from '@/locales/en.json';

function inputTypeForFieldKind(
  kind: AdminFieldKind
): 'url' | 'number' | 'text' | 'password' {
  if (kind === 'url') {
    return 'url';
  }
  if (kind === 'number') {
    return 'number';
  }
  if (kind === 'password') {
    return 'password';
  }
  if (kind === 'fleetVisibleBoats') {
    return 'text';
  }
  return 'text';
}

function catalogResourceFormErrorMessage(
  code: string | null | undefined,
  t: ReturnType<typeof useTranslations<'AdminCatalogResource'>>
): string | null {
  if (!code) {
    return null;
  }
  if (code === 'validation_failed') {
    return t('form_error_validation_failed');
  }
  if (code === 'duplicate_designation') {
    return t('form_error_duplicate_designation');
  }
  if (code === 'duplicate_slug') {
    return t('form_error_duplicate_slug');
  }
  if (code === 'foreign_key') {
    return t('form_error_foreign_key');
  }
  return t('form_error_unknown');
}

function usersAdminFormErrorMessage(
  code: string | null | undefined,
  t: ReturnType<typeof useTranslations<'AdminUsers'>>
): string | null {
  if (!code) {
    return null;
  }
  if (code === 'validation_failed') {
    return t('form_error_validation_failed');
  }
  if (code === 'duplicate_email') {
    return t('form_error_duplicate_email');
  }
  if (code === 'cannot_remove_self') {
    return t('form_error_cannot_remove_self');
  }
  if (code === 'last_admin') {
    return t('form_error_last_admin');
  }
  if (code === 'no_data_to_update') {
    return t('form_error_no_change');
  }
  if (code === 'password_compromised') {
    return t('form_error_password_compromised');
  }
  if (code === 'not_allowed') {
    return t('form_error_not_allowed');
  }
  return t('form_error_unknown');
}

type DynamicSelectOption = { value: string; label: string };

function parseFleetVisibleBoatsFromRow(
  row: CatalogRow | undefined,
  field: string
): { name: string; slug: string }[] {
  const raw = row?.[field];
  if (typeof raw !== 'string' || raw.length === 0) {
    return [];
  }
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) {
      return [];
    }
    const out: { name: string; slug: string }[] = [];
    for (const item of v) {
      if (
        item !== null &&
        typeof item === 'object' &&
        'name' in item &&
        'slug' in item &&
        typeof item.name === 'string' &&
        typeof item.slug === 'string'
      ) {
        out.push({ name: item.name, slug: item.slug });
      }
    }
    return out;
  } catch {
    return [];
  }
}

function catalogDynamicSelectField(props: {
  fieldKey: string;
  label: string;
  defaultValue: string;
  required: boolean | undefined;
  options: readonly DynamicSelectOption[];
}) {
  const selectClassName =
    'rounded-md border border-slate-300 px-3 py-2 text-mit-text shadow-sm focus-visible:border-mit-red focus-visible:ring-2 focus-visible:ring-mit-red/25 focus-visible:outline-none';
  return (
    <label className="flex flex-col gap-1 text-sm" htmlFor={props.fieldKey}>
      <span className="font-medium text-mit-text">{props.label}</span>
      <select
        className={selectClassName}
        defaultValue={props.defaultValue || undefined}
        id={props.fieldKey}
        name={props.fieldKey}
        required={props.required}
      >
        {props.options.map((opt) => (
          <option key={`${opt.value}\u0000${opt.label}`} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function catalogStaticSelectField(props: {
  fieldKey: string;
  label: string;
  defaultValue: string;
  required: boolean | undefined;
  options: AdminFormFieldDef['selectOptions'];
  translateLabel: (key: AdminFormFieldDef['labelKey']) => string;
}) {
  const opts = props.options;
  if (!opts || opts.length === 0) {
    return null;
  }
  const selectClassName =
    'rounded-md border border-slate-300 px-3 py-2 text-mit-text shadow-sm focus-visible:border-mit-red focus-visible:ring-2 focus-visible:ring-mit-red/25 focus-visible:outline-none';
  return (
    <label className="flex flex-col gap-1 text-sm" htmlFor={props.fieldKey}>
      <span className="font-medium text-mit-text">{props.label}</span>
      <select
        className={selectClassName}
        defaultValue={props.defaultValue || undefined}
        id={props.fieldKey}
        name={props.fieldKey}
        required={props.required}
      >
        {opts.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {props.translateLabel(opt.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}

type AdminCatalogFormProps = {
  definition: CatalogResourceDefinition;
  row?: CatalogRow;
  formAction: (formData: FormData) => Promise<void>;
  headingKey: 'new_heading' | 'edit_heading';
  errorCode?: string | null;
  /** Use `AdminUsers` strings for `/admin/users` forms. */
  messageNamespace?: 'AdminCatalogResource' | 'AdminUsers';
  /** Server-loaded `<select>` options (e.g. sailing classes for fleet `requiredClassId`). */
  dynamicSelectOptions?: Readonly<
    Record<string, readonly { value: string; label: string }[]>
  >;
};

function initialBooleanFields(
  fields: readonly AdminFormFieldDef[],
  row?: CatalogRow
): Record<string, boolean> {
  const m: Record<string, boolean> = {};
  for (const f of fields) {
    if (f.kind === 'boolean') {
      const v = row?.[f.field];
      if (typeof v === 'boolean') {
        m[f.field] = v;
      } else if (f.field === 'isVisible') {
        m[f.field] = true;
      } else {
        m[f.field] = false;
      }
    }
  }
  return m;
}

/**
 * Generic create/edit form driven by catalog field definitions.
 *
 * @param props - Resource metadata, optional row, bound server action, heading
 * @returns Form element
 */
export function AdminCatalogForm(props: AdminCatalogFormProps) {
  const ns = props.messageNamespace ?? 'AdminCatalogResource';
  const tCatalog = useTranslations('AdminCatalogResource');
  const tUsers = useTranslations('AdminUsers');
  const tc = useTranslations('AdminCatalog');

  function translateLabel(key: AdminFormFieldDef['labelKey']): string {
    /* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- definition `messageNamespace` picks catalog vs users keys */
    if (ns === 'AdminUsers') {
      return tUsers(key as keyof typeof messages.AdminUsers);
    }
    return tCatalog(key as keyof typeof messages.AdminCatalogResource);
    /* eslint-enable @typescript-eslint/no-unsafe-type-assertion */
  }

  const errorMessage =
    ns === 'AdminUsers'
      ? usersAdminFormErrorMessage(props.errorCode, tUsers)
      : catalogResourceFormErrorMessage(props.errorCode, tCatalog);

  const [bools, setBools] = useState(() =>
    initialBooleanFields(props.definition.formFields, props.row)
  );

  const visibilityField = props.definition.formFields.find(
    (f) => f.kind === 'boolean' && f.field === 'isVisible'
  );

  const compactBooleanLabels = ns === 'AdminUsers';

  /* eslint-disable complexity -- branches mirror catalog field kinds (text, boolean, select, default inputs). */
  function renderCatalogField(field: AdminFormFieldDef) {
    const key = field.field;
    const label = translateLabel(field.labelKey);

    if (field.kind === 'fleetVisibleBoats') {
      const boats = parseFleetVisibleBoatsFromRow(props.row, key);
      return (
        <div key={key} className="flex flex-col gap-2">
          <span className="text-sm font-medium text-mit-text">{label}</span>
          <AdminFleetVisibleBoatsTagCloud boats={boats} />
        </div>
      );
    }

    const defaultValue =
      props.row && props.row[key] !== undefined && props.row[key] !== null
        ? String(props.row[key])
        : '';

    if (field.kind === 'richText') {
      const fieldId = `catalog-field-${key}`;
      return (
        <div key={key}>
          <AdminRichTextField
            fieldId={fieldId}
            initialHtml={defaultValue}
            label={label}
            name={key}
            required={field.required}
          />
        </div>
      );
    }

    if (field.kind === 'text') {
      const fieldId = `catalog-field-${key}`;
      return (
        <label
          key={key}
          className="flex flex-col gap-1 text-sm"
          htmlFor={fieldId}
        >
          <span className="font-medium text-mit-text">{label}</span>
          <textarea
            className="min-h-[120px] rounded-md border border-slate-300 px-3 py-2 text-mit-text shadow-sm focus-visible:border-mit-red focus-visible:ring-2 focus-visible:ring-mit-red/25 focus-visible:outline-none"
            defaultValue={defaultValue}
            id={fieldId}
            name={key}
            required={field.required}
          />
        </label>
      );
    }

    if (field.kind === 'boolean') {
      const checked = bools[key] ?? false;
      if (compactBooleanLabels) {
        return (
          <label
            key={key}
            className="flex cursor-pointer items-center gap-2 text-sm text-mit-text"
          >
            <input name={key} type="hidden" value="false" />
            <input
              checked={checked}
              className="size-4 rounded border-slate-300 text-mit-red focus:ring-mit-red"
              name={key}
              onChange={(event) => {
                setBools((prev) => ({
                  ...prev,
                  [key]: event.target.checked,
                }));
              }}
              type="checkbox"
              value="true"
            />
            <span className="font-medium">{label}</span>
          </label>
        );
      }
      return (
        <div key={key} className="flex flex-col gap-2">
          <span className="text-sm font-medium text-mit-text">{label}</span>
          <input name={key} type="hidden" value="false" />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-mit-text">
            <input
              checked={checked}
              className="size-4 rounded border-slate-300 text-mit-red focus:ring-mit-red"
              name={key}
              onChange={(event) => {
                setBools((prev) => ({
                  ...prev,
                  [key]: event.target.checked,
                }));
              }}
              type="checkbox"
              value="true"
            />
            {tc('column_visible')}
          </label>
        </div>
      );
    }

    if (field.kind === 'select') {
      const dynOpts = props.dynamicSelectOptions?.[key];
      if (dynOpts && dynOpts.length > 0) {
        return (
          <div key={key}>
            {catalogDynamicSelectField({
              fieldKey: key,
              label,
              defaultValue,
              required: field.required,
              options: dynOpts,
            })}
          </div>
        );
      }
      if (field.selectOptions && field.selectOptions.length > 0) {
        return (
          <div key={key}>
            {catalogStaticSelectField({
              fieldKey: key,
              label,
              defaultValue,
              required: field.required,
              options: field.selectOptions,
              translateLabel,
            })}
          </div>
        );
      }
      return null;
    }

    const inputType = inputTypeForFieldKind(field.kind);

    return (
      <div key={key} className="flex flex-col gap-1 text-sm">
        <label className="flex flex-col gap-1">
          <span className="font-medium text-mit-text">{label}</span>
          <input
            autoComplete={
              field.kind === 'password' ? 'new-password' : undefined
            }
            className="rounded-md border border-slate-300 px-3 py-2 text-mit-text shadow-sm focus-visible:border-mit-red focus-visible:ring-2 focus-visible:ring-mit-red/25 focus-visible:outline-none"
            defaultValue={defaultValue}
            name={key}
            required={field.required}
            type={inputType}
          />
        </label>
        {ns === 'AdminUsers' &&
        field.kind === 'password' &&
        key === 'password' ? (
          <p className="text-xs text-mit-text">{tUsers('password_hint')}</p>
        ) : null}
        {ns === 'AdminUsers' &&
        field.kind === 'password' &&
        key === 'newPassword' ? (
          <p className="text-xs text-mit-text">{tUsers('new_password_hint')}</p>
        ) : null}
      </div>
    );
  }
  /* eslint-enable complexity */

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-mit-text">
          {ns === 'AdminUsers'
            ? tUsers(props.headingKey)
            : tCatalog(props.headingKey)}
        </h2>
        {props.row && visibilityField ? (
          <AdminCatalogEditStatusBadge
            isVisible={bools[visibilityField.field] ?? true}
          />
        ) : null}
      </div>

      {errorMessage ? (
        <p
          className="rounded-md border border-mit-line bg-mit-red-highlight px-3 py-2 text-sm text-mit-text"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <form action={props.formAction} className="flex max-w-xl flex-col gap-4">
        {props.definition.formFields.map(renderCatalogField)}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            className="rounded-md bg-mit-red px-4 py-2 text-sm font-semibold text-white hover:bg-mit-red-hover focus-visible:ring-2 focus-visible:ring-mit-red focus-visible:ring-offset-2 focus-visible:outline-none"
            type="submit"
          >
            {ns === 'AdminUsers'
              ? tUsers('action_save')
              : tCatalog('action_save')}
          </button>
        </div>
      </form>
    </div>
  );
}
