'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import {
  AdminCatalogEditHistoryPanel,
  AdminCatalogEditMetadataPanel,
} from '@/components/mit-sailing/admin/catalog/AdminCatalogEditMetadataPanel';
import { AdminFleetVisibleBoatsTagCloud } from '@/components/mit-sailing/admin/catalog/AdminFleetVisibleBoatsTagCloud';
import { AdminRichTextField } from '@/components/mit-sailing/admin/catalog/AdminRichTextField';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import type {
  AdminFieldKind,
  CatalogEditMetadata,
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
  if (code === 'version_not_found') {
    return t('form_error_version_not_found');
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
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <Label className="text-foreground" htmlFor={props.fieldKey}>
        {props.label}
      </Label>
      <select
        className={adminNativeSelectClassName}
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
    </div>
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
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <Label className="text-foreground" htmlFor={props.fieldKey}>
        {props.label}
      </Label>
      <select
        className={adminNativeSelectClassName}
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
    </div>
  );
}

type AdminCatalogFormProps = {
  definition: CatalogResourceDefinition;
  row?: CatalogRow;
  formAction: (formData: FormData) => Promise<unknown>;
  headingKey: 'new_heading' | 'edit_heading';
  errorCode?: string | null;
  /** Use `AdminUsers` strings for `/admin/users` forms. */
  messageNamespace?: 'AdminCatalogResource' | 'AdminUsers';
  /** Server-loaded `<select>` options (e.g. sailing classes for fleet `requiredClassId`). */
  dynamicSelectOptions?: Readonly<
    Record<string, readonly { value: string; label: string }[]>
  >;
  metadata?: CatalogEditMetadata | null;
  restoreAction?: (formData: FormData) => Promise<void>;
  visibilityAction?: (
    formData: FormData
  ) => Promise<
    | { ok: true; isVisible: boolean; changed?: boolean }
    | { ok: false; code: string }
  >;
};

type AdminCatalogSaveState = {
  changed: boolean | null;
  savedAt: number | null;
};

type AdminCatalogVisibilityState = {
  changed: boolean | null;
  errorCode: string | null;
  isPublished: boolean | null;
  savedAt: number | null;
};

const initialSaveState: AdminCatalogSaveState = {
  changed: null,
  savedAt: null,
};

function catalogSaveResultChanged(result: unknown): boolean {
  if (
    result &&
    typeof result === 'object' &&
    'ok' in result &&
    result.ok === true
  ) {
    return 'changed' in result && typeof result.changed === 'boolean'
      ? result.changed
      : true;
  }
  return true;
}

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

function booleanFieldsFromFormData(
  fields: readonly AdminFormFieldDef[],
  formData: FormData
): Record<string, boolean> {
  const m: Record<string, boolean> = {};
  for (const f of fields) {
    if (f.kind === 'boolean') {
      const values = formData.getAll(f.field);
      m[f.field] = values.includes('true') || values.includes('on');
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

  /* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- definition `messageNamespace` selects which translation namespace owns each label key. */
  function translateLabel(key: AdminFormFieldDef['labelKey']): string {
    if (ns === 'AdminUsers') {
      return tUsers(key as keyof typeof messages.AdminUsers);
    }
    return tCatalog(key as keyof typeof messages.AdminCatalogResource);
  }
  /* eslint-enable @typescript-eslint/no-unsafe-type-assertion */

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
  const usesMetadataVisibility = Boolean(props.metadata && visibilityField);
  const initialIsPublished = visibilityField
    ? (bools[visibilityField.field] ?? true)
    : (props.metadata?.isPublished ?? null);
  const [visibilityState, visibilityFormAction, isVisibilityPending] =
    useActionState(
      async (
        state: AdminCatalogVisibilityState,
        formData: FormData
      ): Promise<AdminCatalogVisibilityState> => {
        if (!visibilityField || !props.visibilityAction) {
          return state;
        }
        const nextIsPublished = formData.get('isVisible') === 'true';
        setBools((prev) => ({
          ...prev,
          [visibilityField.field]: nextIsPublished,
        }));
        const result = await props.visibilityAction(formData);
        if (!result.ok) {
          setBools((prev) => ({
            ...prev,
            [visibilityField.field]: state.isPublished ?? true,
          }));
          return {
            changed: null,
            errorCode: result.code,
            isPublished: state.isPublished,
            savedAt: null,
          };
        }
        return {
          changed: result.changed ?? true,
          errorCode: null,
          isPublished: result.isVisible,
          savedAt: Date.now(),
        };
      },
      {
        changed: null,
        errorCode: null,
        isPublished: initialIsPublished,
        savedAt: null,
      }
    );
  const [saveState, formAction, isPending] = useActionState(
    async (
      _state: AdminCatalogSaveState,
      formData: FormData
    ): Promise<AdminCatalogSaveState> => {
      const submittedBools = booleanFieldsFromFormData(
        props.definition.formFields,
        formData
      );
      setBools(submittedBools);
      const result = await props.formAction(formData);
      setBools(submittedBools);
      return {
        changed: catalogSaveResultChanged(result),
        savedAt: Date.now(),
      };
    },
    initialSaveState
  );

  const compactBooleanLabels = ns === 'AdminUsers';
  const hasRichText = props.definition.formFields.some(
    (field) => field.kind === 'richText'
  );
  const saveButtonLabel =
    ns === 'AdminUsers' ? tUsers('action_save') : tCatalog('action_save');
  const savingButtonLabel =
    ns === 'AdminUsers'
      ? tUsers('form_status_saving')
      : tCatalog('form_status_saving');
  const savedStatusLabel =
    ns === 'AdminUsers'
      ? tUsers('form_status_saved')
      : tCatalog('form_status_saved');
  const unchangedStatusLabel =
    ns === 'AdminUsers'
      ? tUsers('form_status_no_changes')
      : tCatalog('form_status_no_changes');

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
        <div key={key} className="flex flex-col gap-1.5 text-sm">
          <Label className="text-foreground" htmlFor={fieldId}>
            {label}
          </Label>
          <Textarea
            className="min-h-[120px]"
            defaultValue={defaultValue}
            id={fieldId}
            name={key}
            required={field.required}
          />
        </div>
      );
    }

    if (field.kind === 'boolean') {
      if (usesMetadataVisibility && key === 'isVisible') {
        return null;
      }
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
              className="size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
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
              className="size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
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
    const fieldId = `catalog-field-${key}`;

    return (
      <div key={key} className="flex flex-col gap-1.5 text-sm">
        <Label className="text-foreground" htmlFor={fieldId}>
          {label}
        </Label>
        <Input
          autoComplete={field.kind === 'password' ? 'new-password' : undefined}
          defaultValue={defaultValue}
          id={fieldId}
          name={key}
          required={field.required}
          type={inputType}
        />
        {ns === 'AdminUsers' &&
        field.kind === 'password' &&
        key === 'password' ? (
          <p className="text-xs text-muted-foreground">
            {tUsers('password_hint')}
          </p>
        ) : null}
        {ns === 'AdminUsers' &&
        field.kind === 'password' &&
        key === 'newPassword' ? (
          <p className="text-xs text-muted-foreground">
            {tUsers('new_password_hint')}
          </p>
        ) : null}
      </div>
    );
  }
  /* eslint-enable complexity */

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-foreground">
          {ns === 'AdminUsers'
            ? tUsers(props.headingKey)
            : tCatalog(props.headingKey)}
        </h2>
      </div>

      {errorMessage ? (
        <p
          className="rounded-md border border-mit-line bg-mit-red-highlight px-3 py-2 text-sm text-foreground"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      {props.metadata ? (
        <AdminCatalogEditMetadataPanel
          isPublished={visibilityState.isPublished}
          isVisibilityPending={isVisibilityPending}
          metadata={props.metadata}
          visibilityErrorCode={visibilityState.errorCode}
          visibilityAction={
            props.visibilityAction ? visibilityFormAction : undefined
          }
          visibilityChanged={visibilityState.changed}
          visibilitySavedAt={visibilityState.savedAt}
        />
      ) : null}

      <form
        action={formAction}
        className={`flex flex-col gap-4 ${hasRichText ? 'w-full' : 'max-w-2xl'}`}
      >
        {usesMetadataVisibility && visibilityField ? (
          <input
            name={visibilityField.field}
            type="hidden"
            value={visibilityState.isPublished ? 'true' : 'false'}
          />
        ) : null}
        <div className="flex min-w-0 flex-col gap-4">
          {props.definition.formFields.map(renderCatalogField)}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            className="rounded-md bg-mit-red px-4 py-2 text-sm font-semibold text-white hover:bg-mit-red-hover focus-visible:ring-2 focus-visible:ring-mit-red focus-visible:ring-offset-2 focus-visible:outline-none"
            disabled={isPending}
            type="submit"
          >
            {isPending ? savingButtonLabel : saveButtonLabel}
          </button>
          {saveState.savedAt ? (
            <p className="text-sm font-medium text-mit-text" role="status">
              {saveState.changed === false
                ? unchangedStatusLabel
                : savedStatusLabel}
            </p>
          ) : null}
        </div>
      </form>

      {props.metadata ? (
        <AdminCatalogEditHistoryPanel
          metadata={props.metadata}
          restoreAction={props.restoreAction}
        />
      ) : null}
    </div>
  );
}
