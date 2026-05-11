'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type * as React from 'react';
import { useRef, useState } from 'react';
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
import { SubmitButton } from '@/components/ui/submit-button';
import { Textarea } from '@/components/ui/textarea';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import type {
  AdminFieldKind,
  AdminFormFieldDef,
  AdminFormSectionDef,
  CatalogResourceDefinition,
  CatalogRow,
} from '@/libs/admin/catalog/types';
import {
  CMS_HOME_OVERVIEW_MAX_EVENTS,
  CMS_HOME_OVERVIEW_MAX_SCHEDULE_ROWS,
  CMS_HOME_OVERVIEW_MAX_STEPS,
  parseCmsHomeOverviewBody,
  serializeCmsHomeOverviewBody,
} from '@/libs/mit-sailing/cmsHomeOverview';
import type { CmsHomeOverviewData } from '@/libs/mit-sailing/cmsHomeOverview';
import {
  CMS_PRICING_MAX_PLANS,
  parseCmsPricingBody,
  serializeCmsPricingBody,
} from '@/libs/mit-sailing/cmsPricing';
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
  fieldErrors?: Record<string, string>;
  /** Use `AdminUsers` strings for `/admin/users` forms. */
  messageNamespace?: 'AdminCatalogResource' | 'AdminUsers';
  /** Server-loaded `<select>` options (e.g. sailing classes for fleet `requiredClassId`). */
  dynamicSelectOptions?: Readonly<
    Record<string, readonly { value: string; label: string }[]>
  >;
};

type CmsBlockKind =
  | 'hero'
  | 'text_section'
  | 'callout'
  | 'pricing'
  | 'home_overview'
  | 'home_classes';

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

type CmsBlockPairErrors = Record<
  'ctaLabel' | 'ctaUrl' | 'imageAlt' | 'imageSrc',
  boolean
>;

function cmsBlockUsesStandalonePairs(state: CmsBlockPreviewState) {
  return state.kind !== 'pricing' && state.kind !== 'home_overview';
}

function hasCmsBlockPairErrors(errors: CmsBlockPairErrors) {
  return errors.ctaLabel || errors.ctaUrl || errors.imageAlt || errors.imageSrc;
}

function stringValue(value: CatalogRow[string]): string {
  return value !== undefined && value !== null ? String(value) : '';
}

function cmsBlockKindValue(value: CatalogRow[string]): CmsBlockKind {
  if (
    value === 'hero' ||
    value === 'callout' ||
    value === 'pricing' ||
    value === 'home_classes'
  ) {
    return value;
  }
  if (value === 'home_overview') {
    return value;
  }
  return 'text_section';
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
  pricingBody?: string;
  t: ReturnType<typeof useTranslations<'AdminCatalogResource'>>;
}) {
  let previewBody = props.previewState.body;
  if (props.previewState.kind === 'pricing') {
    previewBody = props.pricingBody ?? '';
  }
  const previewHasStandaloneFields =
    props.previewState.kind !== 'home_overview';
  if (props.previewState.kind === 'home_overview') {
    previewBody = '';
  }

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
            body: previewBody,
            ctaLabel: previewHasStandaloneFields
              ? props.previewState.ctaLabel
              : undefined,
            ctaUrl: previewHasStandaloneFields
              ? props.previewState.ctaUrl
              : undefined,
            id: 'admin-cms-block-preview',
            imageAlt: previewHasStandaloneFields
              ? props.previewState.imageAlt
              : undefined,
            imageSrc: previewHasStandaloneFields
              ? props.previewState.imageSrc
              : undefined,
            kind: props.previewState.kind,
            subtitle: props.previewState.subtitle,
            title: props.previewState.title,
          }}
        />
      </div>
    </section>
  );
}

type CmsPricingEditorPlan = {
  badge: string;
  description: string;
  features: { id: string; text: string }[];
  frequency: string;
  highlighted: boolean;
  id: string;
  linkLabel: string;
  linkUrl: string;
  price: string;
  title: string;
};

type CmsPricingEditorState = {
  footnote: string;
  plans: CmsPricingEditorPlan[];
};

type CmsHomeOverviewEditorScheduleRow = {
  day: string;
  hours: string;
  id: string;
};

type CmsHomeOverviewEditorStep = {
  description: string;
  id: string;
  title: string;
};

type CmsHomeOverviewEditorState = {
  eventsCtaLabel: string;
  eventsCtaUrl: string;
  eventCount: number;
  eventsEmptyText: string;
  eventsTitle: string;
  hoursNote: string;
  schedule: CmsHomeOverviewEditorScheduleRow[];
  steps: CmsHomeOverviewEditorStep[];
  stepsTitle: string;
};

function blankCmsPricingPlan(id: string): CmsPricingEditorPlan {
  return {
    badge: '',
    description: '',
    features: [{ id: `${id}-feature-1`, text: '' }],
    frequency: '',
    highlighted: false,
    id,
    linkLabel: '',
    linkUrl: '',
    price: '',
    title: '',
  };
}

function cmsPricingEditorId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function initialCmsPricingEditorState(row?: CatalogRow): CmsPricingEditorState {
  const parsed = parseCmsPricingBody(stringValue(row?.body));
  if (!parsed) {
    return { footnote: '', plans: [blankCmsPricingPlan('pricing-plan-1')] };
  }
  return {
    footnote: parsed.footnote ?? '',
    plans: parsed.plans.map((plan, planIndex) => ({
      badge: plan.badge ?? '',
      description: plan.description ?? '',
      features:
        plan.features.length > 0
          ? plan.features.map((feature, featureIndex) => ({
              id: `pricing-plan-${planIndex + 1}-feature-${featureIndex + 1}`,
              text: feature,
            }))
          : [
              {
                id: `pricing-plan-${planIndex + 1}-feature-1`,
                text: '',
              },
            ],
      frequency: plan.frequency ?? '',
      highlighted: plan.highlighted ?? false,
      id: `pricing-plan-${planIndex + 1}`,
      linkLabel: plan.linkLabel ?? '',
      linkUrl: plan.linkUrl ?? '',
      price: plan.price,
      title: plan.title,
    })),
  };
}

function blankCmsHomeOverviewScheduleRow(
  id: string
): CmsHomeOverviewEditorScheduleRow {
  return { day: '', hours: '', id };
}

function blankCmsHomeOverviewStep(id: string): CmsHomeOverviewEditorStep {
  return { description: '', id, title: '' };
}

function initialCmsHomeOverviewEditorState(
  row?: CatalogRow
): CmsHomeOverviewEditorState {
  const parsed = parseCmsHomeOverviewBody(stringValue(row?.body));
  if (!parsed) {
    return {
      eventsCtaLabel: '',
      eventsCtaUrl: '',
      eventCount: 4,
      eventsEmptyText: '',
      eventsTitle: '',
      hoursNote: '',
      schedule: [blankCmsHomeOverviewScheduleRow('home-overview-hours-1')],
      steps: [blankCmsHomeOverviewStep('home-overview-step-1')],
      stepsTitle: '',
    };
  }
  return {
    eventsCtaLabel: parsed.eventsCtaLabel,
    eventsCtaUrl: parsed.eventsCtaUrl,
    eventCount: parsed.eventCount,
    eventsEmptyText: parsed.eventsEmptyText,
    eventsTitle: parsed.eventsTitle,
    hoursNote: parsed.hoursNote ?? '',
    schedule: parsed.schedule.map((scheduleRow, index) => ({
      day: scheduleRow.day,
      hours: scheduleRow.hours,
      id: `home-overview-hours-${index + 1}`,
    })),
    steps: parsed.steps.map((step, index) => ({
      description: step.description,
      id: `home-overview-step-${index + 1}`,
      title: step.title,
    })),
    stepsTitle: parsed.stepsTitle,
  };
}

function cmsHomeOverviewBodyFromEditorState(
  state: CmsHomeOverviewEditorState
): string {
  const data: CmsHomeOverviewData = {
    eventsCtaLabel: state.eventsCtaLabel,
    eventsCtaUrl: state.eventsCtaUrl,
    eventCount: state.eventCount,
    eventsEmptyText: state.eventsEmptyText,
    eventsTitle: state.eventsTitle,
    hoursNote: state.hoursNote,
    schedule: state.schedule.map((row) => ({
      day: row.day,
      hours: row.hours,
    })),
    steps: state.steps.map((step) => ({
      description: step.description,
      title: step.title,
    })),
    stepsTitle: state.stepsTitle,
  };
  return serializeCmsHomeOverviewBody(data);
}

function cmsPricingBodyFromEditorState(state: CmsPricingEditorState): string {
  return serializeCmsPricingBody({
    footnote: state.footnote,
    plans: state.plans.map((plan) => ({
      badge: plan.badge,
      description: plan.description,
      features: plan.features.map((feature) => feature.text),
      frequency: plan.frequency,
      highlighted: plan.highlighted,
      linkLabel: plan.linkLabel,
      linkUrl: plan.linkUrl,
      price: plan.price,
      title: plan.title,
    })),
  });
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

function hasCmsOptionalValue(row: CatalogRow | undefined, fields: string[]) {
  return fields.some((field) => stringValue(row?.[field]).trim().length > 0);
}

function AdminCmsOptionalGroup(props: {
  children: React.ReactNode;
  enabled: boolean;
  hiddenFields: readonly { name: string; value: string }[];
  legend: string;
  onToggle: (next: boolean) => void;
  toggleLabel: string;
}) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm">
      <legend className="px-1 font-medium text-foreground">
        {props.legend}
      </legend>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-mit-text">
        <input
          checked={props.enabled}
          className="size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
          onChange={(event) => {
            props.onToggle(event.target.checked);
          }}
          type="checkbox"
        />
        <span>{props.toggleLabel}</span>
      </label>
      {props.enabled ? props.children : null}
      {props.enabled
        ? null
        : props.hiddenFields.map((field) => (
            <input
              key={field.name}
              name={field.name}
              type="hidden"
              value={field.value}
            />
          ))}
    </fieldset>
  );
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
  const isCmsBlockForm = props.definition.id === 'cms_page_blocks';
  const [cmsBlockPreviewState, setCmsBlockPreviewState] = useState(() =>
    initialCmsBlockPreviewState(props.row)
  );
  const cmsCtaLabelErrorId = 'catalog-field-ctaLabel-error';
  const cmsCtaUrlErrorId = 'catalog-field-ctaUrl-error';
  const cmsImageSrcErrorId = 'catalog-field-imageSrc-error';
  const cmsImageAltErrorId = 'catalog-field-imageAlt-error';
  const cmsCtaLabelInputRef = useRef<HTMLInputElement>(null);
  const cmsCtaUrlInputRef = useRef<HTMLInputElement>(null);
  const cmsImageSrcUploadButtonRef = useRef<HTMLButtonElement>(null);
  const cmsImageAltInputRef = useRef<HTMLInputElement>(null);
  const [cmsPairErrors, setCmsPairErrors] = useState<CmsBlockPairErrors>(
    () => ({
      ctaLabel: isCmsBlockForm && Boolean(props.fieldErrors?.ctaLabel),
      ctaUrl: isCmsBlockForm && Boolean(props.fieldErrors?.ctaUrl),
      imageAlt: isCmsBlockForm && Boolean(props.fieldErrors?.imageAlt),
      imageSrc: isCmsBlockForm && Boolean(props.fieldErrors?.imageSrc),
    })
  );
  const [cmsBlockGroupsEnabled, setCmsBlockGroupsEnabled] = useState(() => ({
    cta: hasCmsOptionalValue(props.row, ['ctaLabel', 'ctaUrl']),
    image: hasCmsOptionalValue(props.row, ['imageSrc', 'imageAlt']),
  }));
  const [cmsPricingEditorState, setCmsPricingEditorState] = useState(() =>
    initialCmsPricingEditorState(props.row)
  );
  const [cmsHomeOverviewEditorState, setCmsHomeOverviewEditorState] = useState(
    () => initialCmsHomeOverviewEditorState(props.row)
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

  function cmsBlockStateWith(
    field: keyof CmsBlockPreviewState,
    value: string | boolean
  ): CmsBlockPreviewState {
    return { ...cmsBlockPreviewState, [field]: value };
  }

  function clearCompletedCmsPairErrors(nextState: CmsBlockPreviewState) {
    setCmsPairErrors((prev) => {
      const ctaLabel = nextState.ctaLabel.trim();
      const ctaUrl = nextState.ctaUrl.trim();
      const imageAlt = nextState.imageAlt.trim();
      const imageSrc = nextState.imageSrc.trim();
      const ctaCompleteOrEmpty =
        !cmsBlockUsesStandalonePairs(nextState) ||
        Boolean(ctaLabel) === Boolean(ctaUrl);
      const imageCompleteOrEmpty =
        !cmsBlockUsesStandalonePairs(nextState) ||
        Boolean(imageAlt) === Boolean(imageSrc);

      return {
        ctaLabel: ctaCompleteOrEmpty
          ? false
          : prev.ctaLabel && ctaLabel.length === 0,
        ctaUrl: ctaCompleteOrEmpty ? false : prev.ctaUrl && ctaUrl.length === 0,
        imageAlt: imageCompleteOrEmpty
          ? false
          : prev.imageAlt && imageAlt.length === 0,
        imageSrc: imageCompleteOrEmpty
          ? false
          : prev.imageSrc && imageSrc.length === 0,
      };
    });
  }

  function cmsBlockPairErrorsFromState(
    state: CmsBlockPreviewState
  ): CmsBlockPairErrors {
    const ctaLabel = state.ctaLabel.trim();
    const ctaUrl = state.ctaUrl.trim();
    const imageAlt = state.imageAlt.trim();
    const imageSrc = state.imageSrc.trim();
    if (!cmsBlockUsesStandalonePairs(state)) {
      return {
        ctaLabel: false,
        ctaUrl: false,
        imageAlt: false,
        imageSrc: false,
      };
    }
    return {
      ctaLabel:
        cmsBlockGroupsEnabled.cta && ctaUrl.length > 0 && ctaLabel.length === 0,
      ctaUrl:
        cmsBlockGroupsEnabled.cta && ctaLabel.length > 0 && ctaUrl.length === 0,
      imageAlt:
        cmsBlockGroupsEnabled.image &&
        imageSrc.length > 0 &&
        imageAlt.length === 0,
      imageSrc:
        cmsBlockGroupsEnabled.image &&
        imageAlt.length > 0 &&
        imageSrc.length === 0,
    };
  }

  function focusFirstCmsBlockPairError(errors: CmsBlockPairErrors) {
    if (errors.ctaLabel) {
      cmsCtaLabelInputRef.current?.focus();
      return;
    }
    if (errors.ctaUrl) {
      cmsCtaUrlInputRef.current?.focus();
      return;
    }
    if (errors.imageSrc) {
      cmsImageSrcUploadButtonRef.current?.focus();
      return;
    }
    if (errors.imageAlt) {
      cmsImageAltInputRef.current?.focus();
    }
  }

  function setCmsPreviewField(
    field: keyof CmsBlockPreviewState,
    value: string | boolean
  ) {
    clearCompletedCmsPairErrors(cmsBlockStateWith(field, value));
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

  function setCmsOptionalGroupEnabled(
    group: keyof typeof cmsBlockGroupsEnabled,
    next: boolean
  ) {
    setCmsBlockGroupsEnabled((prev) => ({ ...prev, [group]: next }));
  }

  function renderCmsBlockCtaGroup() {
    const ctaLabelErrorMessage = cmsPairErrors.ctaLabel
      ? tCatalog('field_error_cms_cta_label_required')
      : null;
    const ctaUrlErrorMessage = cmsPairErrors.ctaUrl
      ? tCatalog('field_error_cms_cta_url_required')
      : null;

    return (
      <AdminCmsOptionalGroup
        enabled={cmsBlockGroupsEnabled.cta}
        hiddenFields={[
          { name: 'ctaLabel', value: '' },
          { name: 'ctaUrl', value: '' },
        ]}
        key="cms-block-cta-group"
        legend={tCatalog('cms_block_cta_group')}
        onToggle={(next) => {
          setCmsOptionalGroupEnabled('cta', next);
        }}
        toggleLabel={tCatalog('cms_block_cta_toggle')}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground" htmlFor="catalog-field-ctaLabel">
              {translateLabel('field_cms_cta_label')}
            </Label>
            <Input
              aria-describedby={
                ctaLabelErrorMessage ? cmsCtaLabelErrorId : undefined
              }
              aria-invalid={ctaLabelErrorMessage ? true : undefined}
              id="catalog-field-ctaLabel"
              name="ctaLabel"
              onChange={(event) => {
                updateInputPreviewField('ctaLabel', event.target.value);
              }}
              ref={cmsCtaLabelInputRef}
              value={cmsBlockPreviewState.ctaLabel}
            />
            {ctaLabelErrorMessage ? (
              <p className="text-sm text-destructive" id={cmsCtaLabelErrorId}>
                {ctaLabelErrorMessage}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground" htmlFor="catalog-field-ctaUrl">
              {translateLabel('field_cms_cta_url')}
            </Label>
            <Input
              aria-describedby={
                ctaUrlErrorMessage ? cmsCtaUrlErrorId : undefined
              }
              aria-invalid={ctaUrlErrorMessage ? true : undefined}
              id="catalog-field-ctaUrl"
              name="ctaUrl"
              onChange={(event) => {
                updateInputPreviewField('ctaUrl', event.target.value);
              }}
              ref={cmsCtaUrlInputRef}
              value={cmsBlockPreviewState.ctaUrl}
            />
            {ctaUrlErrorMessage ? (
              <p className="text-sm text-destructive" id={cmsCtaUrlErrorId}>
                {ctaUrlErrorMessage}
              </p>
            ) : null}
          </div>
        </div>
      </AdminCmsOptionalGroup>
    );
  }

  function renderCmsBlockImageGroup() {
    const imageSrcErrorMessage = cmsPairErrors.imageSrc
      ? tCatalog('field_error_cms_image_src_required')
      : null;
    const imageAltErrorMessage = cmsPairErrors.imageAlt
      ? tCatalog('field_error_cms_image_alt_required')
      : null;

    return (
      <AdminCmsOptionalGroup
        enabled={cmsBlockGroupsEnabled.image}
        hiddenFields={[
          { name: 'imageSrc', value: '' },
          { name: 'imageAlt', value: '' },
        ]}
        key="cms-block-image-group"
        legend={tCatalog('cms_block_picture_group')}
        onToggle={(next) => {
          setCmsOptionalGroupEnabled('image', next);
        }}
        toggleLabel={tCatalog('cms_block_picture_toggle')}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminImageField
            defaultValue={cmsBlockPreviewState.imageSrc}
            fieldId="catalog-field-imageSrc"
            fieldKey="imageSrc"
            label={translateLabel('field_cms_image_src')}
            onChange={(value) => {
              setCmsPreviewField('imageSrc', value);
            }}
            errorId={cmsImageSrcErrorId}
            errorMessage={imageSrcErrorMessage}
            uploadButtonRef={cmsImageSrcUploadButtonRef}
          />
          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground" htmlFor="catalog-field-imageAlt">
              {translateLabel('field_cms_image_alt')}
            </Label>
            <Input
              aria-describedby={
                imageAltErrorMessage ? cmsImageAltErrorId : undefined
              }
              aria-invalid={imageAltErrorMessage ? true : undefined}
              id="catalog-field-imageAlt"
              name="imageAlt"
              onChange={(event) => {
                updateInputPreviewField('imageAlt', event.target.value);
              }}
              onInvalid={(event) => {
                if (cmsBlockPreviewState.imageSrc.trim().length > 0) {
                  event.preventDefault();
                  setCmsPairErrors((prev) => ({ ...prev, imageAlt: true }));
                  cmsImageAltInputRef.current?.focus();
                }
              }}
              ref={cmsImageAltInputRef}
              required={cmsBlockPreviewState.imageSrc.trim().length > 0}
              value={cmsBlockPreviewState.imageAlt}
            />
            {imageAltErrorMessage ? (
              <p className="text-sm text-destructive" id={cmsImageAltErrorId}>
                {imageAltErrorMessage}
              </p>
            ) : null}
          </div>
        </div>
      </AdminCmsOptionalGroup>
    );
  }

  function updateCmsPricingEditorState(next: CmsPricingEditorState) {
    setCmsPricingEditorState(next);
    setCmsPreviewField('body', cmsPricingBodyFromEditorState(next));
  }

  function updateCmsHomeOverviewEditorState(next: CmsHomeOverviewEditorState) {
    setCmsHomeOverviewEditorState(next);
    setCmsPreviewField('body', cmsHomeOverviewBodyFromEditorState(next));
  }

  function updateCmsPricingPlan(options: {
    field: keyof CmsPricingEditorPlan;
    planIndex: number;
    value: string | boolean;
  }) {
    updateCmsPricingEditorState({
      ...cmsPricingEditorState,
      plans: cmsPricingEditorState.plans.map((plan, planIndex) =>
        planIndex === options.planIndex
          ? { ...plan, [options.field]: options.value }
          : plan
      ),
    });
  }

  function updateCmsPricingFeature(options: {
    featureIndex: number;
    planIndex: number;
    value: string;
  }) {
    updateCmsPricingEditorState({
      ...cmsPricingEditorState,
      plans: cmsPricingEditorState.plans.map((plan, planIndex) =>
        planIndex === options.planIndex
          ? {
              ...plan,
              features: plan.features.map((feature, featureIndex) =>
                featureIndex === options.featureIndex
                  ? { ...feature, text: options.value }
                  : feature
              ),
            }
          : plan
      ),
    });
  }

  function renderCmsPricingEditor() {
    const pricingBody = cmsPricingBodyFromEditorState(cmsPricingEditorState);
    return (
      <div
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-sm"
        key="cms-pricing-editor"
      >
        <input name="body" type="hidden" value={pricingBody} />
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" htmlFor="catalog-field-footnote">
            {tCatalog('cms_pricing_footnote')}
          </Label>
          <Textarea
            id="catalog-field-footnote"
            onChange={(event) => {
              updateCmsPricingEditorState({
                ...cmsPricingEditorState,
                footnote: event.target.value,
              });
            }}
            value={cmsPricingEditorState.footnote}
          />
        </div>
        <div className="flex flex-col gap-4">
          {cmsPricingEditorState.plans.map((plan, planIndex) => (
            <fieldset
              className="grid gap-3 rounded-md border border-border bg-background p-4"
              key={plan.id}
            >
              <legend className="px-1 font-medium text-foreground">
                {tCatalog('cms_pricing_option_heading', {
                  number: planIndex + 1,
                })}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label
                    className="text-foreground"
                    htmlFor={`catalog-field-pricing-title-${planIndex}`}
                  >
                    {tCatalog('cms_pricing_title')}
                  </Label>
                  <Input
                    id={`catalog-field-pricing-title-${planIndex}`}
                    onChange={(event) => {
                      updateCmsPricingPlan({
                        field: 'title',
                        planIndex,
                        value: event.target.value,
                      });
                    }}
                    required
                    value={plan.title}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label
                    className="text-foreground"
                    htmlFor={`catalog-field-pricing-description-${planIndex}`}
                  >
                    {tCatalog('cms_pricing_description')}
                  </Label>
                  <Input
                    id={`catalog-field-pricing-description-${planIndex}`}
                    onChange={(event) => {
                      updateCmsPricingPlan({
                        field: 'description',
                        planIndex,
                        value: event.target.value,
                      });
                    }}
                    value={plan.description}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label
                    className="text-foreground"
                    htmlFor={`catalog-field-pricing-price-${planIndex}`}
                  >
                    {tCatalog('cms_pricing_price')}
                  </Label>
                  <Input
                    id={`catalog-field-pricing-price-${planIndex}`}
                    onChange={(event) => {
                      updateCmsPricingPlan({
                        field: 'price',
                        planIndex,
                        value: event.target.value,
                      });
                    }}
                    required
                    value={plan.price}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label
                    className="text-foreground"
                    htmlFor={`catalog-field-pricing-frequency-${planIndex}`}
                  >
                    {tCatalog('cms_pricing_frequency')}
                  </Label>
                  <Input
                    id={`catalog-field-pricing-frequency-${planIndex}`}
                    onChange={(event) => {
                      updateCmsPricingPlan({
                        field: 'frequency',
                        planIndex,
                        value: event.target.value,
                      });
                    }}
                    value={plan.frequency}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label
                    className="text-foreground"
                    htmlFor={`catalog-field-pricing-badge-${planIndex}`}
                  >
                    {tCatalog('cms_pricing_badge')}
                  </Label>
                  <Input
                    id={`catalog-field-pricing-badge-${planIndex}`}
                    onChange={(event) => {
                      updateCmsPricingPlan({
                        field: 'badge',
                        planIndex,
                        value: event.target.value,
                      });
                    }}
                    value={plan.badge}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label
                    className="text-foreground"
                    htmlFor={`catalog-field-pricing-link-label-${planIndex}`}
                  >
                    {tCatalog('cms_pricing_link_label')}
                  </Label>
                  <Input
                    id={`catalog-field-pricing-link-label-${planIndex}`}
                    onChange={(event) => {
                      updateCmsPricingPlan({
                        field: 'linkLabel',
                        planIndex,
                        value: event.target.value,
                      });
                    }}
                    value={plan.linkLabel}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label
                    className="text-foreground"
                    htmlFor={`catalog-field-pricing-link-url-${planIndex}`}
                  >
                    {tCatalog('cms_pricing_link_url')}
                  </Label>
                  <Input
                    id={`catalog-field-pricing-link-url-${planIndex}`}
                    onChange={(event) => {
                      updateCmsPricingPlan({
                        field: 'linkUrl',
                        planIndex,
                        value: event.target.value,
                      });
                    }}
                    value={plan.linkUrl}
                  />
                </div>
                <label className="flex items-center gap-2 pt-6 text-sm text-mit-text">
                  <input
                    checked={plan.highlighted}
                    className="size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
                    onChange={(event) => {
                      updateCmsPricingPlan({
                        field: 'highlighted',
                        planIndex,
                        value: event.target.checked,
                      });
                    }}
                    type="checkbox"
                  />
                  <span>{tCatalog('cms_pricing_highlighted')}</span>
                </label>
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-medium text-foreground">
                  {tCatalog('cms_pricing_features')}
                </span>
                {plan.features.map((feature, featureIndex) => (
                  <div className="flex items-center gap-2" key={feature.id}>
                    <Input
                      aria-label={tCatalog('cms_pricing_feature_label', {
                        number: featureIndex + 1,
                      })}
                      onChange={(event) => {
                        updateCmsPricingFeature({
                          featureIndex,
                          planIndex,
                          value: event.target.value,
                        });
                      }}
                      required={featureIndex === 0}
                      value={feature.text}
                    />
                    {plan.features.length > 1 ? (
                      <Button
                        aria-label={tCatalog('cms_pricing_remove_feature')}
                        onClick={() => {
                          updateCmsPricingEditorState({
                            ...cmsPricingEditorState,
                            plans: cmsPricingEditorState.plans.map(
                              (item, index) =>
                                index === planIndex
                                  ? {
                                      ...item,
                                      features: item.features.filter(
                                        (_feature, indexToKeep) =>
                                          indexToKeep !== featureIndex
                                      ),
                                    }
                                  : item
                            ),
                          });
                        }}
                        size="icon"
                        type="button"
                        variant="outline"
                      >
                        <Trash2 aria-hidden className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                ))}
                <Button
                  className="self-start"
                  onClick={() => {
                    updateCmsPricingEditorState({
                      ...cmsPricingEditorState,
                      plans: cmsPricingEditorState.plans.map((item, index) =>
                        index === planIndex
                          ? {
                              ...item,
                              features: [
                                ...item.features,
                                {
                                  id: cmsPricingEditorId(`${item.id}-feature`),
                                  text: '',
                                },
                              ],
                            }
                          : item
                      ),
                    });
                  }}
                  type="button"
                  variant="outline"
                >
                  <Plus aria-hidden className="size-4" />
                  {tCatalog('cms_pricing_add_feature')}
                </Button>
              </div>
              {cmsPricingEditorState.plans.length > 1 ? (
                <Button
                  className="self-start"
                  onClick={() => {
                    updateCmsPricingEditorState({
                      ...cmsPricingEditorState,
                      plans: cmsPricingEditorState.plans.filter(
                        (_plan, index) => index !== planIndex
                      ),
                    });
                  }}
                  type="button"
                  variant="outline"
                >
                  <Trash2 aria-hidden className="size-4" />
                  {tCatalog('cms_pricing_remove_option')}
                </Button>
              ) : null}
            </fieldset>
          ))}
        </div>
        {cmsPricingEditorState.plans.length < CMS_PRICING_MAX_PLANS ? (
          <Button
            className="self-start"
            onClick={() => {
              updateCmsPricingEditorState({
                ...cmsPricingEditorState,
                plans: [
                  ...cmsPricingEditorState.plans,
                  blankCmsPricingPlan(cmsPricingEditorId('pricing-plan')),
                ],
              });
            }}
            type="button"
            variant="outline"
          >
            <Plus aria-hidden className="size-4" />
            {tCatalog('cms_pricing_add_option')}
          </Button>
        ) : null}
      </div>
    );
  }

  function renderCmsHomeOverviewEditor() {
    const homeOverviewBody = cmsHomeOverviewBodyFromEditorState(
      cmsHomeOverviewEditorState
    );
    return (
      <div
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-sm"
        key="cms-home-overview-editor"
      >
        <input name="body" type="hidden" value={homeOverviewBody} />
        <fieldset className="grid gap-3 rounded-md border border-border bg-background p-4">
          <legend className="px-1 font-medium text-foreground">
            {tCatalog('cms_home_overview_hours_heading')}
          </legend>
          <div className="flex flex-col gap-1.5">
            <Label
              className="text-foreground"
              htmlFor="catalog-field-hours-note"
            >
              {tCatalog('cms_home_overview_hours_note')}
            </Label>
            <Textarea
              id="catalog-field-hours-note"
              onChange={(event) => {
                updateCmsHomeOverviewEditorState({
                  ...cmsHomeOverviewEditorState,
                  hoursNote: event.target.value,
                });
              }}
              value={cmsHomeOverviewEditorState.hoursNote}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-foreground">
              {tCatalog('cms_home_overview_schedule_rows')}
            </span>
            {cmsHomeOverviewEditorState.schedule.map((row, rowIndex) => (
              <div
                className="grid items-start gap-2 sm:grid-cols-[1fr_1fr_auto]"
                key={row.id}
              >
                <Input
                  aria-label={tCatalog('cms_home_overview_schedule_day', {
                    number: rowIndex + 1,
                  })}
                  onChange={(event) => {
                    updateCmsHomeOverviewEditorState({
                      ...cmsHomeOverviewEditorState,
                      schedule: cmsHomeOverviewEditorState.schedule.map(
                        (item, index) =>
                          index === rowIndex
                            ? { ...item, day: event.target.value }
                            : item
                      ),
                    });
                  }}
                  required
                  value={row.day}
                />
                <Input
                  aria-label={tCatalog('cms_home_overview_schedule_hours', {
                    number: rowIndex + 1,
                  })}
                  onChange={(event) => {
                    updateCmsHomeOverviewEditorState({
                      ...cmsHomeOverviewEditorState,
                      schedule: cmsHomeOverviewEditorState.schedule.map(
                        (item, index) =>
                          index === rowIndex
                            ? { ...item, hours: event.target.value }
                            : item
                      ),
                    });
                  }}
                  required
                  value={row.hours}
                />
                {cmsHomeOverviewEditorState.schedule.length > 1 ? (
                  <Button
                    aria-label={tCatalog(
                      'cms_home_overview_remove_schedule_row'
                    )}
                    onClick={() => {
                      updateCmsHomeOverviewEditorState({
                        ...cmsHomeOverviewEditorState,
                        schedule: cmsHomeOverviewEditorState.schedule.filter(
                          (_item, index) => index !== rowIndex
                        ),
                      });
                    }}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                ) : null}
              </div>
            ))}
            {cmsHomeOverviewEditorState.schedule.length <
            CMS_HOME_OVERVIEW_MAX_SCHEDULE_ROWS ? (
              <Button
                className="self-start"
                onClick={() => {
                  updateCmsHomeOverviewEditorState({
                    ...cmsHomeOverviewEditorState,
                    schedule: [
                      ...cmsHomeOverviewEditorState.schedule,
                      blankCmsHomeOverviewScheduleRow(
                        cmsPricingEditorId('home-overview-hours')
                      ),
                    ],
                  });
                }}
                type="button"
                variant="outline"
              >
                <Plus aria-hidden className="size-4" />
                {tCatalog('cms_home_overview_add_schedule_row')}
              </Button>
            ) : null}
          </div>
        </fieldset>

        <fieldset className="grid gap-3 rounded-md border border-border bg-background p-4">
          <legend className="px-1 font-medium text-foreground">
            {tCatalog('cms_home_overview_steps_heading')}
          </legend>
          <div className="flex flex-col gap-1.5">
            <Label
              className="text-foreground"
              htmlFor="catalog-field-steps-title"
            >
              {tCatalog('cms_home_overview_steps_title')}
            </Label>
            <Input
              id="catalog-field-steps-title"
              onChange={(event) => {
                updateCmsHomeOverviewEditorState({
                  ...cmsHomeOverviewEditorState,
                  stepsTitle: event.target.value,
                });
              }}
              required
              value={cmsHomeOverviewEditorState.stepsTitle}
            />
          </div>
          {cmsHomeOverviewEditorState.steps.map((step, stepIndex) => (
            <fieldset
              className="grid gap-3 rounded-md border border-border bg-card p-3"
              key={step.id}
            >
              <legend className="px-1 font-medium text-foreground">
                {tCatalog('cms_home_overview_step_heading', {
                  number: stepIndex + 1,
                })}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label
                    className="text-foreground"
                    htmlFor={`catalog-field-step-title-${stepIndex}`}
                  >
                    {tCatalog('cms_home_overview_step_title')}
                  </Label>
                  <Input
                    id={`catalog-field-step-title-${stepIndex}`}
                    onChange={(event) => {
                      updateCmsHomeOverviewEditorState({
                        ...cmsHomeOverviewEditorState,
                        steps: cmsHomeOverviewEditorState.steps.map(
                          (item, index) =>
                            index === stepIndex
                              ? { ...item, title: event.target.value }
                              : item
                        ),
                      });
                    }}
                    required
                    value={step.title}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label
                    className="text-foreground"
                    htmlFor={`catalog-field-step-description-${stepIndex}`}
                  >
                    {tCatalog('cms_home_overview_step_description')}
                  </Label>
                  <Input
                    id={`catalog-field-step-description-${stepIndex}`}
                    onChange={(event) => {
                      updateCmsHomeOverviewEditorState({
                        ...cmsHomeOverviewEditorState,
                        steps: cmsHomeOverviewEditorState.steps.map(
                          (item, index) =>
                            index === stepIndex
                              ? { ...item, description: event.target.value }
                              : item
                        ),
                      });
                    }}
                    required
                    value={step.description}
                  />
                </div>
              </div>
              {cmsHomeOverviewEditorState.steps.length > 1 ? (
                <Button
                  className="self-start"
                  onClick={() => {
                    updateCmsHomeOverviewEditorState({
                      ...cmsHomeOverviewEditorState,
                      steps: cmsHomeOverviewEditorState.steps.filter(
                        (_item, index) => index !== stepIndex
                      ),
                    });
                  }}
                  type="button"
                  variant="outline"
                >
                  <Trash2 aria-hidden className="size-4" />
                  {tCatalog('cms_home_overview_remove_step')}
                </Button>
              ) : null}
            </fieldset>
          ))}
          {cmsHomeOverviewEditorState.steps.length <
          CMS_HOME_OVERVIEW_MAX_STEPS ? (
            <Button
              className="self-start"
              onClick={() => {
                updateCmsHomeOverviewEditorState({
                  ...cmsHomeOverviewEditorState,
                  steps: [
                    ...cmsHomeOverviewEditorState.steps,
                    blankCmsHomeOverviewStep(
                      cmsPricingEditorId('home-overview-step')
                    ),
                  ],
                });
              }}
              type="button"
              variant="outline"
            >
              <Plus aria-hidden className="size-4" />
              {tCatalog('cms_home_overview_add_step')}
            </Button>
          ) : null}
        </fieldset>

        <fieldset className="grid gap-3 rounded-md border border-border bg-background p-4">
          <legend className="px-1 font-medium text-foreground">
            {tCatalog('cms_home_overview_events_heading')}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label
                className="text-foreground"
                htmlFor="catalog-field-events-title"
              >
                {tCatalog('cms_home_overview_events_title')}
              </Label>
              <Input
                id="catalog-field-events-title"
                onChange={(event) => {
                  updateCmsHomeOverviewEditorState({
                    ...cmsHomeOverviewEditorState,
                    eventsTitle: event.target.value,
                  });
                }}
                required
                value={cmsHomeOverviewEditorState.eventsTitle}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label
                className="text-foreground"
                htmlFor="catalog-field-event-count"
              >
                {tCatalog('cms_home_overview_event_count')}
              </Label>
              <Input
                id="catalog-field-event-count"
                max={CMS_HOME_OVERVIEW_MAX_EVENTS}
                min={1}
                onChange={(event) => {
                  const eventCount = Number.parseInt(event.target.value, 10);
                  updateCmsHomeOverviewEditorState({
                    ...cmsHomeOverviewEditorState,
                    eventCount: Number.isFinite(eventCount) ? eventCount : 1,
                  });
                }}
                required
                type="number"
                value={cmsHomeOverviewEditorState.eventCount}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label
                className="text-foreground"
                htmlFor="catalog-field-events-empty"
              >
                {tCatalog('cms_home_overview_events_empty')}
              </Label>
              <Input
                id="catalog-field-events-empty"
                onChange={(event) => {
                  updateCmsHomeOverviewEditorState({
                    ...cmsHomeOverviewEditorState,
                    eventsEmptyText: event.target.value,
                  });
                }}
                required
                value={cmsHomeOverviewEditorState.eventsEmptyText}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label
                className="text-foreground"
                htmlFor="catalog-field-events-cta-label"
              >
                {tCatalog('cms_home_overview_events_cta_label')}
              </Label>
              <Input
                id="catalog-field-events-cta-label"
                onChange={(event) => {
                  updateCmsHomeOverviewEditorState({
                    ...cmsHomeOverviewEditorState,
                    eventsCtaLabel: event.target.value,
                  });
                }}
                required
                value={cmsHomeOverviewEditorState.eventsCtaLabel}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label
                className="text-foreground"
                htmlFor="catalog-field-events-cta-url"
              >
                {tCatalog('cms_home_overview_events_cta_url')}
              </Label>
              <Input
                id="catalog-field-events-cta-url"
                onChange={(event) => {
                  updateCmsHomeOverviewEditorState({
                    ...cmsHomeOverviewEditorState,
                    eventsCtaUrl: event.target.value,
                  });
                }}
                required
                value={cmsHomeOverviewEditorState.eventsCtaUrl}
              />
            </div>
          </div>
        </fieldset>
      </div>
    );
  }

  function renderCmsBlockSpecialField(key: string): React.ReactNode {
    if (!isCmsBlockForm) {
      return undefined;
    }
    if (key === 'body' && cmsBlockPreviewState.kind === 'pricing') {
      return renderCmsPricingEditor();
    }
    if (key === 'body' && cmsBlockPreviewState.kind === 'home_overview') {
      return renderCmsHomeOverviewEditor();
    }
    if (
      (cmsBlockPreviewState.kind === 'pricing' ||
        cmsBlockPreviewState.kind === 'home_overview') &&
      (key === 'ctaLabel' ||
        key === 'ctaUrl' ||
        key === 'imageSrc' ||
        key === 'imageAlt')
    ) {
      return null;
    }
    if (key === 'ctaLabel') {
      return renderCmsBlockCtaGroup();
    }
    if (key === 'imageSrc') {
      return renderCmsBlockImageGroup();
    }
    if (key === 'ctaUrl' || key === 'imageAlt') {
      return null;
    }
    return undefined;
  }

  function renderCatalogField(field: AdminFormFieldDef): React.ReactNode {
    const key = field.field;
    const label = translateLabel(field.labelKey);
    const rawDefaultValue = props.row?.[key];
    const defaultValue =
      rawDefaultValue !== undefined && rawDefaultValue !== null
        ? String(rawDefaultValue)
        : '';

    const cmsBlockSpecialField = renderCmsBlockSpecialField(key);
    if (cmsBlockSpecialField !== undefined) {
      return cmsBlockSpecialField;
    }

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
      autoComplete={props.definition.id === 'site_alerts' ? 'off' : undefined}
      className={`flex ${formMaxWidth} flex-col gap-4`}
      onSubmit={(event) => {
        if (!isCmsBlockForm) {
          return;
        }
        const nextPairErrors =
          cmsBlockPairErrorsFromState(cmsBlockPreviewState);
        if (hasCmsBlockPairErrors(nextPairErrors)) {
          event.preventDefault();
          setCmsPairErrors(nextPairErrors);
          focusFirstCmsBlockPairError(nextPairErrors);
        }
      }}
    >
      {renderCatalogFormFields()}

      <div className="flex flex-wrap gap-3 pt-2">
        <SubmitButton pendingLabel={tCommon('pending_saving')} variant="mit">
          {ns === 'AdminUsers'
            ? tUsers('action_save')
            : tCatalog('action_save')}
        </SubmitButton>
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
            pricingBody={cmsPricingBodyFromEditorState(cmsPricingEditorState)}
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
