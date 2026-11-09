'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import type * as React from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AdminCatalogEditStatusBadge } from '@/components/mit-sailing/admin/catalog/AdminCatalogListCell';
import {
  AdminImageField,
  AdminImageListField,
} from '@/components/mit-sailing/admin/catalog/AdminCmsMediaControls';
import { AdminNewsBodyEditor } from '@/components/mit-sailing/admin/catalog/AdminNewsBodyEditor';
import { AdminRichTextEditor } from '@/components/mit-sailing/admin/catalog/AdminRichTextEditor';
import { Checkbox } from '@/components/ui/checkbox';
import { FormErrorSummary } from '@/components/ui/form-error-summary';
import type { FormValidationSummaryEntry } from '@/components/ui/form-error-summary';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { SubmitButton } from '@/components/ui/submit-button';
import { Textarea } from '@/components/ui/textarea';
import {
  ADMIN_FORM_REDIRECT_TO_EDIT,
  ADMIN_FORM_REDIRECT_TO_FIELD,
} from '@/libs/admin/adminFormRedirect';
import type {
  AdminFieldKind,
  AdminFormFieldDef,
  AdminFormSectionDef,
  CatalogResourceDefinition,
  CatalogRow,
} from '@/libs/admin/catalog/types';
import { eventCategoryUpdateSchema } from '@/libs/zenstack/zod';
import type messages from '@/locales/en.json';
import { ariaInvalidWhenShown } from '@/utils/ariaInvalidWhenShown';

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

function catalogServerFieldSummaryErrors(
  fieldErrors: Record<string, string> | undefined,
  definition: CatalogResourceDefinition,
  translateLabel: (key: AdminFormFieldDef['labelKey']) => string
): FormValidationSummaryEntry[] {
  if (!fieldErrors) {
    return [];
  }

  return Object.entries(fieldErrors).map(([field, message]) => {
    const fieldDef = definition.formFields.find((item) => item.field === field);
    return {
      controlId: `catalog-field-${field}`,
      label: fieldDef ? translateLabel(fieldDef.labelKey) : field,
      message,
    };
  });
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
  if (code === 'role_mirror_inconsistent') {
    return t('form_error_role_mirror_inconsistent');
  }
  if (code === 'role_assignment_rollback_failed') {
    return t('form_error_role_assignment_rollback_failed');
  }
  return t('form_error_unknown');
}

type DynamicSelectOption = { value: string; label: string };

function describedBy(...ids: (string | undefined)[]): string | undefined {
  const value = ids.filter(Boolean).join(' ');
  return value.length > 0 ? value : undefined;
}

function CatalogFieldError(props: { id?: string; message?: string | null }) {
  if (!props.id || !props.message) {
    return null;
  }
  return (
    <p className="text-sm text-destructive" id={props.id} role="alert">
      {props.message}
    </p>
  );
}

function catalogDynamicSelectField(props: {
  errorId?: string;
  errorMessage?: string | null;
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
      <NativeSelect
        aria-describedby={props.errorMessage ? props.errorId : undefined}
        aria-invalid={ariaInvalidWhenShown({
          shown: Boolean(props.errorMessage),
          invalid: true,
        })}
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
      </NativeSelect>
      <CatalogFieldError id={props.errorId} message={props.errorMessage} />
    </div>
  );
}

function catalogStaticSelectField(props: {
  errorId?: string;
  errorMessage?: string | null;
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
      <NativeSelect
        aria-describedby={props.errorMessage ? props.errorId : undefined}
        aria-invalid={ariaInvalidWhenShown({
          shown: Boolean(props.errorMessage),
          invalid: true,
        })}
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
      </NativeSelect>
      <CatalogFieldError id={props.errorId} message={props.errorMessage} />
    </div>
  );
}

type AdminCatalogFormProps = {
  definition: CatalogResourceDefinition;
  row?: CatalogRow;
  formAction: (formData: FormData) => Promise<void>;
  headingKey: 'new_heading' | 'edit_heading';
  errorCode?: string | null;
  fieldErrors?: Record<string, string>;
  /** Use `AdminUsers` strings for `/admin/users` forms. */
  messageNamespace?: 'AdminCatalogResource' | 'AdminUsers';
  /** Server-loaded `<NativeSelect>` options (e.g. sailing classes for fleet `requiredClassId`). */
  dynamicSelectOptions?: Readonly<
    Record<string, readonly { value: string; label: string }[]>
  >;
  /** Hides the page title when a parent shell already shows context. */
  suppressPageHeading?: boolean;
};

function stringValue(value: CatalogRow[string]): string {
  return value !== undefined && value !== null ? String(value) : '';
}

function CatalogTextareaField(props: {
  errorId?: string;
  errorMessage?: string | null;
  fieldId: string;
  label: string;
  defaultValue: string;
  fieldKey: string;
  required: boolean | undefined;
  linksHint?: string;
  onChange?: (value: string) => void;
}) {
  const linksHintId = props.linksHint ? `${props.fieldId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <Label className="text-foreground" htmlFor={props.fieldId}>
        {props.label}
      </Label>
      <Textarea
        aria-describedby={describedBy(
          linksHintId,
          props.errorMessage ? props.errorId : undefined
        )}
        aria-invalid={ariaInvalidWhenShown({
          shown: Boolean(props.errorMessage),
          invalid: true,
        })}
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
        <p className="text-xs text-muted-foreground" id={linksHintId}>
          {props.linksHint}
        </p>
      ) : null}
      <CatalogFieldError id={props.errorId} message={props.errorMessage} />
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
        <Checkbox
          checked={props.checked}
          name={props.fieldKey}
          onChange={(event) => {
            props.onToggle(event.target.checked);
          }}
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
        <Checkbox
          checked={props.checked}
          name={props.fieldKey}
          onChange={(event) => {
            props.onToggle(event.target.checked);
          }}
          value="true"
        />
        {props.checkboxLabel}
      </label>
    </div>
  );
}

function CatalogSelectFieldBranch(props: {
  errorId?: string;
  errorMessage?: string | null;
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
      errorId: props.errorId,
      errorMessage: props.errorMessage,
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
      errorId: props.errorId,
      errorMessage: props.errorMessage,
      required: props.required,
      options: props.selectOptions,
      onChange: props.onChange,
      translateLabel: props.translateLabel,
    });
  }
  return null;
}

function CatalogMediaFieldBranch(props: {
  errorId?: string;
  errorMessage?: string | null;
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
        errorId={props.errorId}
        errorMessage={props.errorMessage}
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
      errorId={props.errorId}
      errorMessage={props.errorMessage}
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

function EventCategoryCatalogForm(props: AdminCatalogFormProps) {
  const tCatalog = useTranslations('AdminCatalogResource');
  const tCommon = useTranslations('Common');
  const tc = useTranslations('AdminCatalog');
  const form = useForm({
    defaultValues: {
      isVisible: props.row?.isVisible === true,
      name: stringValue(props.row?.name),
    },
    mode: 'onBlur',
    resolver: zodResolver(eventCategoryUpdateSchema),
  });
  const visible = form.watch('isVisible');
  const nameError =
    props.fieldErrors?.name ??
    (form.formState.errors.name
      ? tCatalog('form_error_validation_failed')
      : null);
  const nameErrorId = 'catalog-field-name-error';
  const errorMessage = catalogResourceFormErrorMessage(
    props.errorCode,
    tCatalog
  );
  const summaryEntries: FormValidationSummaryEntry[] = nameError
    ? [
        {
          controlId: 'catalog-field-name',
          label: tCatalog('field_name'),
          message: nameError,
        },
      ]
    : [];

  async function handleSubmit(event: { preventDefault: () => void }) {
    const parsed = eventCategoryUpdateSchema.safeParse(form.getValues());
    if (parsed.success) {
      return;
    }
    event.preventDefault();
    await form.trigger();
    form.setFocus('name');
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-foreground">
          {tCatalog(props.headingKey)}
        </h2>
        {props.row ? <AdminCatalogEditStatusBadge isVisible={visible} /> : null}
      </div>

      {errorMessage ? (
        <p
          className="rounded-md border border-mit-line bg-mit-red-highlight px-3 py-2 text-sm text-foreground"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <form
        action={props.formAction}
        className="flex max-w-xl flex-col gap-4"
        onSubmit={(event) => {
          // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the validation promise.
          void handleSubmit(event);
        }}
      >
        <FormErrorSummary entries={summaryEntries} />

        <div className="flex flex-col gap-1.5 text-sm">
          <Label className="text-foreground" htmlFor="catalog-field-name">
            {tCatalog('field_name')}
          </Label>
          <Input
            aria-describedby={nameError ? nameErrorId : undefined}
            aria-invalid={ariaInvalidWhenShown({
              shown: Boolean(nameError),
              invalid: true,
            })}
            id="catalog-field-name"
            required
            type="text"
            {...form.register('name')}
          />
          <CatalogFieldError id={nameErrorId} message={nameError} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-mit-text">
            {tCatalog('field_visible')}
          </span>
          <input name="isVisible" type="hidden" value="false" />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-mit-text">
            <Checkbox value="true" {...form.register('isVisible')} />
            {tc('column_visible')}
          </label>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <SubmitButton pendingLabel={tCommon('pending_saving')} variant="mit">
            {tCatalog('action_save')}
          </SubmitButton>
          {props.headingKey === 'edit_heading' ? (
            <SubmitButton
              name={ADMIN_FORM_REDIRECT_TO_FIELD}
              pendingLabel={tCommon('pending_saving')}
              value={ADMIN_FORM_REDIRECT_TO_EDIT}
              variant="outline"
            >
              {tCatalog('action_save_and_continue_editing')}
            </SubmitButton>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function GenericAdminCatalogForm(props: AdminCatalogFormProps) {
  const ns = props.messageNamespace ?? 'AdminCatalogResource';
  const tCatalog = useTranslations('AdminCatalogResource');
  const tCommon = useTranslations('Common');
  const tUsers = useTranslations('AdminUsers');
  const tc = useTranslations('AdminCatalog');

  function translateLabel(key: AdminFormFieldDef['labelKey']): string {
    if (ns === 'AdminUsers') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- definition `messageNamespace` picks catalog vs users keys
      return tUsers(key as keyof typeof messages.AdminUsers);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- definition `messageNamespace` picks catalog vs users keys
    return tCatalog(key as keyof typeof messages.AdminCatalogResource);
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
  const formMaxWidth = props.definition.formFields.some(
    (field) => field.kind === 'richText'
  )
    ? 'max-w-3xl'
    : 'max-w-xl';

  const serverFieldSummaryErrors = catalogServerFieldSummaryErrors(
    props.fieldErrors,
    props.definition,
    translateLabel
  );

  function updateBooleanField(fieldKey: string, next: boolean) {
    setBools((prev) => ({ ...prev, [fieldKey]: next }));
  }

  function renderCatalogField(field: AdminFormFieldDef): React.ReactNode {
    const key = field.field;
    const label = translateLabel(field.labelKey);
    const rawDefaultValue = props.row?.[key];
    const defaultValue = stringValue(rawDefaultValue);
    const fieldId = `catalog-field-${key}`;
    const fieldErrorMessage = props.fieldErrors?.[key] ?? null;
    const errorId = `${fieldId}-error`;

    if (field.kind === 'text') {
      return (
        <CatalogTextareaField
          key={key}
          defaultValue={defaultValue}
          errorId={errorId}
          errorMessage={fieldErrorMessage}
          fieldId={fieldId}
          fieldKey={key}
          label={label}
          required={field.required}
        />
      );
    }

    if (field.kind === 'newsBody') {
      return (
        <AdminNewsBodyEditor
          key={key}
          defaultValue={defaultValue}
          errorId={errorId}
          errorMessage={fieldErrorMessage}
          fieldId={fieldId}
          fieldKey={key}
          label={label}
          required={field.required}
        />
      );
    }

    if (field.kind === 'richText') {
      return (
        <AdminRichTextEditor
          key={key}
          defaultValue={defaultValue}
          errorId={errorId}
          errorMessage={fieldErrorMessage}
          fieldId={fieldId}
          fieldKey={key}
          label={label}
          required={field.required}
        />
      );
    }

    if (field.kind === 'image' || field.kind === 'imageList') {
      return (
        <CatalogMediaFieldBranch
          key={key}
          defaultValue={defaultValue}
          errorId={errorId}
          errorMessage={fieldErrorMessage}
          field={field}
          fieldId={fieldId}
          label={label}
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
          errorId={errorId}
          errorMessage={fieldErrorMessage}
          fieldKey={key}
          label={label}
          required={field.required}
          selectOptions={field.selectOptions}
          translateLabel={translateLabel}
        />
      );
    }

    const inputType = inputTypeForFieldKind(field.kind);

    return (
      <div key={key} className="flex flex-col gap-1.5 text-sm">
        <Label className="text-foreground" htmlFor={fieldId}>
          {label}
        </Label>
        <Input
          aria-describedby={fieldErrorMessage ? errorId : undefined}
          aria-invalid={ariaInvalidWhenShown({
            shown: Boolean(fieldErrorMessage),
            invalid: true,
          })}
          autoComplete={autoCompleteForCatalogField(field.kind)}
          defaultValue={defaultValue}
          id={fieldId}
          name={key}
          required={field.required}
          type={inputType}
        />
        <CatalogPasswordHint
          fieldKey={key}
          fieldKind={field.kind}
          namespace={ns}
          tUsers={tUsers}
        />
        <CatalogFieldError id={errorId} message={fieldErrorMessage} />
      </div>
    );
  }

  function renderCatalogFormSection(
    section: AdminFormSectionDef,
    index: number
  ): React.ReactNode {
    const headingId = `catalog-section-${section.headingKey}`;
    const sectionFields = props.definition.formFields.filter((field) =>
      section.fields.includes(field.field)
    );
    if (sectionFields.length === 0) {
      return null;
    }
    return (
      <section
        aria-labelledby={headingId}
        className={`flex flex-col gap-4 ${index === 0 ? '' : 'border-t border-border pt-6'}`}
        key={section.headingKey}
      >
        <div className="flex flex-col gap-1">
          <h3
            className="text-base font-semibold text-foreground"
            id={headingId}
          >
            {translateLabel(section.headingKey)}
          </h3>
          {section.helperKey ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {translateLabel(section.helperKey)}
            </p>
          ) : null}
        </div>
        {sectionFields.map(renderCatalogField)}
      </section>
    );
  }

  function renderCatalogFormFields(): React.ReactNode {
    if (!props.definition.formSections) {
      return props.definition.formFields.map(renderCatalogField);
    }
    const sectionFieldNames = new Set(
      props.definition.formSections.flatMap((section) => [...section.fields])
    );
    return [
      ...props.definition.formSections.map(renderCatalogFormSection),
      ...props.definition.formFields
        .filter((field) => !sectionFieldNames.has(field.field))
        .map(renderCatalogField),
    ];
  }

  const formElement = (
    <form
      action={props.formAction}
      autoComplete={props.definition.id === 'news' ? 'off' : undefined}
      className={`flex ${formMaxWidth} flex-col gap-4`}
    >
      <FormErrorSummary entries={serverFieldSummaryErrors} />

      {renderCatalogFormFields()}

      <div className="flex flex-wrap gap-3 pt-2">
        <SubmitButton pendingLabel={tCommon('pending_saving')} variant="mit">
          {ns === 'AdminUsers'
            ? tUsers('action_save')
            : tCatalog('action_save')}
        </SubmitButton>
        {props.headingKey === 'edit_heading' ? (
          <SubmitButton
            name={ADMIN_FORM_REDIRECT_TO_FIELD}
            pendingLabel={tCommon('pending_saving')}
            value={ADMIN_FORM_REDIRECT_TO_EDIT}
            variant="outline"
          >
            {ns === 'AdminUsers'
              ? tUsers('action_save_and_continue_editing')
              : tCatalog('action_save_and_continue_editing')}
          </SubmitButton>
        ) : null}
      </div>
    </form>
  );

  return (
    <div className="flex flex-col gap-6">
      {props.suppressPageHeading ? null : (
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
      )}

      {errorMessage ? (
        <p
          className="rounded-md border border-mit-line bg-mit-red-highlight px-3 py-2 text-sm text-foreground"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      {formElement}
    </div>
  );
}

/**
 * Generic create/edit form driven by catalog field definitions.
 *
 * @param props - Resource metadata, optional row, bound server action, heading
 * @returns Form element
 */
export function AdminCatalogForm(props: AdminCatalogFormProps) {
  if (
    props.definition.id === 'event_categories' &&
    props.messageNamespace !== 'AdminUsers'
  ) {
    return <EventCategoryCatalogForm {...props} />;
  }

  return <GenericAdminCatalogForm {...props} />;
}
