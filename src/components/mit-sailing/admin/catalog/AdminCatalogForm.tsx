'use client';

import { useTranslations } from 'next-intl';
import type * as React from 'react';
import { useState } from 'react';
import { AdminCatalogEditStatusBadge } from '@/components/mit-sailing/admin/catalog/AdminCatalogListCell';
import {
  AdminImageField,
  AdminImageListField,
} from '@/components/mit-sailing/admin/catalog/AdminCmsMediaControls';
import { AdminRichTextEditor } from '@/components/mit-sailing/admin/catalog/AdminRichTextEditor';
import { CmsPageBlockPreview } from '@/components/mit-sailing/cms/CmsPageBlocks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import type {
  AdminFieldKind,
  AdminFormFieldDef,
  CatalogResourceDefinition,
  CatalogRow,
} from '@/libs/admin/catalog/types';
import type messages from '@/locales/en.json';

function inputTypeForFieldKind(
  kind: AdminFieldKind
): 'url' | 'number' | 'text' | 'password' | 'datetime-local' | 'date' {
  if (kind === 'url') {
    return 'url';
  }
  if (kind === 'number') {
    return 'number';
  }
  if (kind === 'password') {
    return 'password';
  }
  if (kind === 'datetimeLocal') {
    return 'datetime-local';
  }
  if (kind === 'date') {
    return 'date';
  }
  return 'text';
}

function autoCompleteForCatalogField(kind: AdminFieldKind): string | undefined {
  if (kind === 'password') {
    return 'new-password';
  }
  if (kind === 'date') {
    return 'off';
  }
  return undefined;
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

function catalogDynamicSelectField(props: {
  fieldKey: string;
  label: string;
  defaultValue: string;
  required: boolean | undefined;
  options: readonly DynamicSelectOption[];
  onChange?: (value: string) => void;
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
        onChange={(event) => {
          props.onChange?.(event.target.value);
        }}
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
  onChange?: (value: string) => void;
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
        onChange={(event) => {
          props.onChange?.(event.target.value);
        }}
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

type CmsBlockKind = 'hero' | 'text_section' | 'callout';

type CmsBlockPreviewState = {
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  imageAlt: string;
  imageSrc: string;
  isVisible: boolean;
  kind: CmsBlockKind;
  subtitle: string;
  title: string;
};

function stringValue(value: CatalogRow[string]): string {
  return value !== undefined && value !== null ? String(value) : '';
}

function cmsBlockKindValue(value: CatalogRow[string]): CmsBlockKind {
  return value === 'hero' || value === 'callout' ? value : 'text_section';
}

function initialCmsBlockPreviewState(row?: CatalogRow): CmsBlockPreviewState {
  return {
    body: stringValue(row?.body),
    ctaLabel: stringValue(row?.ctaLabel),
    ctaUrl: stringValue(row?.ctaUrl),
    imageAlt: stringValue(row?.imageAlt),
    imageSrc: stringValue(row?.imageSrc),
    isVisible: typeof row?.isVisible === 'boolean' ? row.isVisible : true,
    kind: cmsBlockKindValue(row?.kind),
    subtitle: stringValue(row?.subtitle),
    title: stringValue(row?.title),
  };
}

function updateCmsBlockPreviewField(
  setPreviewState: React.Dispatch<React.SetStateAction<CmsBlockPreviewState>>,
  field: keyof CmsBlockPreviewState,
  value: string | boolean
) {
  setPreviewState((prev) => ({ ...prev, [field]: value }));
}

function AdminCmsBlockPreviewPanel(props: {
  previewState: CmsBlockPreviewState;
  t: ReturnType<typeof useTranslations<'AdminCatalogResource'>>;
}) {
  return (
    <section className="flex max-w-5xl flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">
          {props.t('cms_block_preview_heading')}
        </h3>
        {props.previewState.isVisible ? null : (
          <AdminCatalogEditStatusBadge isVisible={false} />
        )}
      </div>
      {props.previewState.isVisible ? null : (
        <p className="text-xs text-muted-foreground">
          {props.t('cms_block_preview_hidden')}
        </p>
      )}
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <CmsPageBlockPreview
          block={{
            body: props.previewState.body,
            ctaLabel: props.previewState.ctaLabel,
            ctaUrl: props.previewState.ctaUrl,
            id: 'admin-cms-block-preview',
            imageAlt: props.previewState.imageAlt,
            imageSrc: props.previewState.imageSrc,
            kind: props.previewState.kind,
            subtitle: props.previewState.subtitle,
            title: props.previewState.title,
          }}
        />
      </div>
    </section>
  );
}

function CatalogTextareaField(props: {
  fieldId: string;
  label: string;
  defaultValue: string;
  fieldKey: string;
  required: boolean | undefined;
  linksHint: string | undefined;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <Label className="text-foreground" htmlFor={props.fieldId}>
        {props.label}
      </Label>
      <Textarea
        className="min-h-[120px]"
        defaultValue={props.defaultValue}
        id={props.fieldId}
        name={props.fieldKey}
        onChange={(event) => {
          props.onChange?.(event.target.value);
        }}
        required={props.required}
      />
      {props.linksHint ? (
        <p className="text-xs text-muted-foreground">{props.linksHint}</p>
      ) : null}
    </div>
  );
}

function CatalogBooleanField(props: {
  fieldKey: string;
  label: string;
  checked: boolean;
  compactBooleanLabels: boolean;
  checkboxLabel: string;
  onToggle: (next: boolean) => void;
}) {
  if (props.compactBooleanLabels) {
    return (
      <label className="flex cursor-pointer items-center gap-2 text-sm text-mit-text">
        <input name={props.fieldKey} type="hidden" value="false" />
        <input
          checked={props.checked}
          className="size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
          name={props.fieldKey}
          onChange={(event) => {
            props.onToggle(event.target.checked);
          }}
          type="checkbox"
          value="true"
        />
        <span className="font-medium">{props.label}</span>
      </label>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-mit-text">{props.label}</span>
      <input name={props.fieldKey} type="hidden" value="false" />
      <label className="flex cursor-pointer items-center gap-2 text-sm text-mit-text">
        <input
          checked={props.checked}
          className="size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
          name={props.fieldKey}
          onChange={(event) => {
            props.onToggle(event.target.checked);
          }}
          type="checkbox"
          value="true"
        />
        {props.checkboxLabel}
      </label>
    </div>
  );
}

function CatalogSelectFieldBranch(props: {
  fieldKey: string;
  label: string;
  defaultValue: string;
  required: boolean | undefined;
  selectOptions: AdminFormFieldDef['selectOptions'];
  dynamicOptions: readonly DynamicSelectOption[] | undefined;
  onChange?: (value: string) => void;
  translateLabel: (key: AdminFormFieldDef['labelKey']) => string;
}) {
  const dynOpts = props.dynamicOptions;
  if (dynOpts && dynOpts.length > 0) {
    return catalogDynamicSelectField({
      fieldKey: props.fieldKey,
      label: props.label,
      defaultValue: props.defaultValue,
      required: props.required,
      options: dynOpts,
      onChange: props.onChange,
    });
  }
  if (props.selectOptions && props.selectOptions.length > 0) {
    return catalogStaticSelectField({
      fieldKey: props.fieldKey,
      label: props.label,
      defaultValue: props.defaultValue,
      required: props.required,
      options: props.selectOptions,
      onChange: props.onChange,
      translateLabel: props.translateLabel,
    });
  }
  return null;
}

function CatalogMediaFieldBranch(props: {
  field: AdminFormFieldDef;
  rawDefaultValue: CatalogRow[string];
  defaultValue: string;
  fieldId: string;
  label: string;
  onChange?: (value: string) => void;
}) {
  if (props.field.kind === 'image') {
    return (
      <AdminImageField
        defaultValue={props.defaultValue}
        fieldId={props.fieldId}
        fieldKey={props.field.field}
        label={props.label}
        onChange={props.onChange}
        required={props.field.required}
      />
    );
  }
  return (
    <AdminImageListField
      defaultValue={
        Array.isArray(props.rawDefaultValue)
          ? props.rawDefaultValue
          : props.defaultValue
      }
      fieldId={props.fieldId}
      fieldKey={props.field.field}
      label={props.label}
      required={props.field.required}
    />
  );
}

function CatalogPasswordHint(props: {
  namespace: 'AdminCatalogResource' | 'AdminUsers';
  fieldKind: AdminFieldKind;
  fieldKey: string;
  tUsers: ReturnType<typeof useTranslations<'AdminUsers'>>;
}) {
  if (props.namespace !== 'AdminUsers' || props.fieldKind !== 'password') {
    return null;
  }
  if (props.fieldKey === 'password') {
    return (
      <p className="text-xs text-muted-foreground">
        {props.tUsers('password_hint')}
      </p>
    );
  }
  if (props.fieldKey === 'newPassword') {
    return (
      <p className="text-xs text-muted-foreground">
        {props.tUsers('new_password_hint')}
      </p>
    );
  }
  return null;
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
  const isCmsBlockForm = props.definition.id === 'cms_page_blocks';
  const [cmsBlockPreviewState, setCmsBlockPreviewState] = useState(() =>
    initialCmsBlockPreviewState(props.row)
  );

  const visibilityField = props.definition.formFields.find(
    (f) => f.kind === 'boolean' && f.field === 'isVisible'
  );

  const compactBooleanLabels = ns === 'AdminUsers';
  const formMaxWidth = props.definition.formFields.some(
    (field) => field.kind === 'richText'
  )
    ? 'max-w-3xl'
    : 'max-w-xl';

  function setCmsPreviewField(
    field: keyof CmsBlockPreviewState,
    value: string | boolean
  ) {
    updateCmsBlockPreviewField(setCmsBlockPreviewState, field, value);
  }

  function cmsPreviewTextChange(fieldKey: string) {
    if (!isCmsBlockForm || fieldKey !== 'subtitle') {
      return;
    }
    return (value: string) => {
      setCmsPreviewField('subtitle', value);
    };
  }

  function cmsPreviewRichTextChange(fieldKey: string) {
    if (!isCmsBlockForm || fieldKey !== 'body') {
      return;
    }
    return (value: string) => {
      setCmsPreviewField('body', value);
    };
  }

  function cmsPreviewImageChange(fieldKey: string) {
    if (!isCmsBlockForm || fieldKey !== 'imageSrc') {
      return;
    }
    return (value: string) => {
      setCmsPreviewField('imageSrc', value);
    };
  }

  function cmsPreviewSelectChange(fieldKey: string) {
    if (!isCmsBlockForm || fieldKey !== 'kind') {
      return;
    }
    return (value: string) => {
      setCmsPreviewField('kind', cmsBlockKindValue(value));
    };
  }

  function updateBooleanField(fieldKey: string, next: boolean) {
    setBools((prev) => ({ ...prev, [fieldKey]: next }));
    if (isCmsBlockForm && fieldKey === 'isVisible') {
      setCmsPreviewField('isVisible', next);
    }
  }

  function updateInputPreviewField(fieldKey: string, value: string) {
    if (!isCmsBlockForm) {
      return;
    }
    if (
      fieldKey !== 'title' &&
      fieldKey !== 'ctaLabel' &&
      fieldKey !== 'ctaUrl' &&
      fieldKey !== 'imageAlt'
    ) {
      return;
    }
    setCmsPreviewField(fieldKey, value);
  }

  function renderCatalogField(field: AdminFormFieldDef) {
    const key = field.field;
    const label = translateLabel(field.labelKey);
    const rawDefaultValue = props.row?.[key];
    const defaultValue =
      rawDefaultValue !== undefined && rawDefaultValue !== null
        ? String(rawDefaultValue)
        : '';

    if (field.kind === 'text') {
      const fieldId = `catalog-field-${key}`;
      const linksHint =
        props.definition.id === 'site_alerts' && key === 'body'
          ? tCatalog('field_site_alert_message_links_hint')
          : undefined;
      return (
        <CatalogTextareaField
          key={key}
          defaultValue={defaultValue}
          fieldId={fieldId}
          fieldKey={key}
          label={label}
          linksHint={linksHint}
          onChange={cmsPreviewTextChange(key)}
          required={field.required}
        />
      );
    }

    if (field.kind === 'richText') {
      const fieldId = `catalog-field-${key}`;
      return (
        <AdminRichTextEditor
          key={key}
          defaultValue={defaultValue}
          fieldId={fieldId}
          fieldKey={key}
          label={label}
          onChange={cmsPreviewRichTextChange(key)}
          required={field.required}
        />
      );
    }

    if (field.kind === 'image' || field.kind === 'imageList') {
      const fieldId = `catalog-field-${key}`;
      return (
        <CatalogMediaFieldBranch
          key={key}
          defaultValue={defaultValue}
          field={field}
          fieldId={fieldId}
          label={label}
          onChange={cmsPreviewImageChange(key)}
          rawDefaultValue={rawDefaultValue}
        />
      );
    }

    if (field.kind === 'boolean') {
      const checked = bools[key] ?? false;
      return (
        <CatalogBooleanField
          key={key}
          checked={checked}
          checkboxLabel={key === 'isVisible' ? tc('column_visible') : label}
          compactBooleanLabels={compactBooleanLabels}
          fieldKey={key}
          label={label}
          onToggle={(next) => {
            updateBooleanField(key, next);
          }}
        />
      );
    }

    if (field.kind === 'select') {
      return (
        <CatalogSelectFieldBranch
          key={key}
          defaultValue={defaultValue}
          dynamicOptions={props.dynamicSelectOptions?.[key]}
          fieldKey={key}
          label={label}
          onChange={cmsPreviewSelectChange(key)}
          required={field.required}
          selectOptions={field.selectOptions}
          translateLabel={translateLabel}
        />
      );
    }

    const inputType = inputTypeForFieldKind(field.kind);
    const fieldId = `catalog-field-${key}`;

    return (
      <div key={key} className="flex flex-col gap-1.5 text-sm">
        <Label className="text-foreground" htmlFor={fieldId}>
          {label}
        </Label>
        <Input
          autoComplete={autoCompleteForCatalogField(field.kind)}
          defaultValue={defaultValue}
          id={fieldId}
          name={key}
          onChange={(event) => {
            updateInputPreviewField(key, event.target.value);
          }}
          required={field.required}
          type={inputType}
        />
        <CatalogPasswordHint
          fieldKey={key}
          fieldKind={field.kind}
          namespace={ns}
          tUsers={tUsers}
        />
      </div>
    );
  }

  const formElement = (
    <form
      action={props.formAction}
      autoComplete={props.definition.id === 'site_alerts' ? 'off' : undefined}
      className={`flex ${formMaxWidth} flex-col gap-4`}
    >
      {props.definition.formFields.map(renderCatalogField)}

      <div className="flex flex-wrap gap-3 pt-2">
        <Button type="submit" variant="mit">
          {ns === 'AdminUsers'
            ? tUsers('action_save')
            : tCatalog('action_save')}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-foreground">
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
          className="rounded-md border border-mit-line bg-mit-red-highlight px-3 py-2 text-sm text-foreground"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      {isCmsBlockForm ? (
        <div className="flex flex-col gap-6">
          {formElement}
          <AdminCmsBlockPreviewPanel
            previewState={cmsBlockPreviewState}
            t={tCatalog}
          />
        </div>
      ) : (
        formElement
      )}
    </div>
  );
}
