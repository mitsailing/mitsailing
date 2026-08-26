import Form from 'next/form';
import { NativeSelect } from '@/components/ui/native-select';
import { SubmitButton } from '@/components/ui/submit-button';

type AdminCatalogScopeFilterOption = {
  value: string;
  label: string;
};

type AdminCatalogScopeFilterProps = {
  /** Localized pathname for GET filter submission (see `getPathname`). */
  action: string;
  actionLabel: string;
  label: string;
  options: readonly AdminCatalogScopeFilterOption[];
  pendingLabel: string;
  queryParamName: string;
  selectedValue: string;
};

export function AdminCatalogScopeFilter(props: AdminCatalogScopeFilterProps) {
  return (
    <Form action={props.action} className="flex max-w-sm items-end gap-3">
      <label className="flex flex-1 flex-col gap-1.5 text-sm">
        <span className="font-medium text-mit-text">{props.label}</span>
        <NativeSelect
          defaultValue={props.selectedValue}
          disabled={props.options.length === 0}
          name={props.queryParamName}
        >
          {props.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      </label>
      <SubmitButton
        disabled={props.options.length === 0}
        pendingLabel={props.pendingLabel}
        variant="outline"
      >
        {props.actionLabel}
      </SubmitButton>
    </Form>
  );
}
