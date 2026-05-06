import 'server-only';
import { SanitizedMarketingHtml } from '@/components/mit-sailing/marketing/SanitizedMarketingHtml';
import { marketingRichTextCompactClassName } from '@/lib/mit-sailing/marketingRichTextContentClassName';
import type { CatalogVersionDiffField } from '@/libs/admin/catalog/catalogVersionSnapshots';
import type {
  AdminCatalogResourceMessageKey,
  AdminFormFieldDef,
  CatalogResourceDefinition,
  CatalogSnapshotValue,
  CatalogVersionSnapshot,
} from '@/libs/admin/catalog/types';
import messages from '@/locales/en.json';

type CatalogResourceTranslator = (
  key: AdminCatalogResourceMessageKey
) => string;

function isCatalogResourceMessageKey(
  key: AdminFormFieldDef['labelKey']
): key is AdminCatalogResourceMessageKey {
  return key in messages.AdminCatalogResource;
}

function fieldLabel(props: {
  field: AdminFormFieldDef;
  t: CatalogResourceTranslator;
}): string {
  if (isCatalogResourceMessageKey(props.field.labelKey)) {
    return props.t(props.field.labelKey);
  }
  return props.field.labelKey;
}

function valueText(props: {
  value: CatalogSnapshotValue;
  t: CatalogResourceTranslator;
}): string {
  if (typeof props.value === 'boolean') {
    return props.value
      ? props.t('metadata_value_yes')
      : props.t('metadata_value_no');
  }
  if (props.value === null || String(props.value).trim().length === 0) {
    return props.t('metadata_value_empty');
  }
  return String(props.value);
}

function VersionValue(props: {
  field: AdminFormFieldDef;
  value: CatalogSnapshotValue;
  t: CatalogResourceTranslator;
}) {
  if (props.field.kind === 'richText') {
    const html = typeof props.value === 'string' ? props.value : '';
    if (html.trim().length === 0) {
      return (
        <p className="text-sm text-slate-500 italic">
          {props.t('metadata_value_empty')}
        </p>
      );
    }
    return (
      <SanitizedMarketingHtml
        className={marketingRichTextCompactClassName}
        html={html}
      />
    );
  }
  return (
    <p className="text-sm break-words text-mit-text">
      {valueText({ value: props.value, t: props.t })}
    </p>
  );
}

function restorableFields(
  definition: CatalogResourceDefinition
): readonly AdminFormFieldDef[] {
  return definition.formFields.filter(
    (field) => field.kind !== 'fleetVisibleBoats'
  );
}

export function AdminCatalogVersionSnapshotFields(props: {
  definition: CatalogResourceDefinition;
  snapshot: CatalogVersionSnapshot;
  t: CatalogResourceTranslator;
}) {
  return (
    <dl className="grid gap-3">
      {restorableFields(props.definition).map((field) => (
        <div
          className="rounded-md border border-slate-200 bg-white p-4"
          key={field.field}
        >
          <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {fieldLabel({ field, t: props.t })}
          </dt>
          <dd className="mt-2">
            <VersionValue
              field={field}
              t={props.t}
              value={props.snapshot[field.field] ?? null}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function AdminCatalogVersionCompareFields(props: {
  fields: readonly CatalogVersionDiffField[];
  t: CatalogResourceTranslator;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <div className="min-w-[44rem]">
          <div className="grid grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)_minmax(0,1fr)] border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <div className="px-4 py-3">{props.t('metadata_compare_field')}</div>
            <div className="px-4 py-3">
              {props.t('metadata_compare_version')}
            </div>
            <div className="px-4 py-3">
              {props.t('metadata_compare_current')}
            </div>
          </div>
          {props.fields.map((field) => (
            <div
              className={`grid grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)_minmax(0,1fr)] border-b border-slate-200 last:border-b-0 ${field.changed ? 'bg-amber-50/60' : 'bg-white'}`}
              key={field.field.field}
            >
              <div className="px-4 py-3 text-sm font-semibold text-mit-text">
                {fieldLabel({ field: field.field, t: props.t })}
                {field.changed ? (
                  <span className="mt-1 block text-xs font-medium text-amber-800">
                    {props.t('metadata_compare_changed')}
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 border-l border-slate-200 px-4 py-3">
                <VersionValue
                  field={field.field}
                  t={props.t}
                  value={field.snapshotValue}
                />
              </div>
              <div className="min-w-0 border-l border-slate-200 px-4 py-3">
                <VersionValue
                  field={field.field}
                  t={props.t}
                  value={field.currentValue}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
