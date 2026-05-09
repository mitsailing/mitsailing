import { Button } from '@/components/ui/button';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';

type AdminCatalogScopeFilterOption = {
  value: string;
  label: string;
};

type AdminCatalogScopeFilterProps = {
  actionLabel: string;
  label: string;
  options: readonly AdminCatalogScopeFilterOption[];
  queryParamName: string;
  selectedValue: string;
};

export function AdminCatalogScopeFilter(props: AdminCatalogScopeFilterProps) {
  return (
    <form className="flex max-w-sm items-end gap-3" method="get">
      <label className="flex flex-1 flex-col gap-1.5 text-sm">
        <span className="font-medium text-mit-text">{props.label}</span>
        <select
          className={adminNativeSelectClassName}
          defaultValue={props.selectedValue}
          disabled={props.options.length === 0}
          name={props.queryParamName}
        >
          {props.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <Button
        disabled={props.options.length === 0}
        type="submit"
        variant="outline"
      >
        {props.actionLabel}
      </Button>
    </form>
  );
}
