import { Button } from '@/components/ui/button';
import { Link } from '@/libs/I18nNavigation';
import type {
  AdminCatalogRevisionChange,
  AdminCatalogRevisionChangeValue,
  AdminCatalogRevisionCompare,
  CatalogRevisionAction,
} from '@/libs/mit-sailing/catalogHistory';

type CatalogRevisionCompareActionLabels = Record<CatalogRevisionAction, string>;

type AdminCatalogRevisionCompareViewProps = {
  actionLabels: CatalogRevisionCompareActionLabels;
  compare: AdminCatalogRevisionCompare;
  editHref: string;
  fieldLabels: Record<string, string>;
  locale: string;
  restoreAction: (formData: FormData) => Promise<void>;
  text: {
    backToEdit: string;
    changed: string;
    compareHeading: string;
    comparingAgainst: string;
    current: string;
    currentlyViewing: string;
    emptyValue: string;
    falseValue: string;
    moreChanges: (count: number) => string;
    noChanges: string;
    restore: string;
    restoreConfirm: string;
    snapshotVersion: (version: number) => string;
    trueValue: string;
    unknownEditor: string;
  };
};

function baseVersionLabel(props: AdminCatalogRevisionCompareViewProps): string {
  return props.compare.baseVersion
    ? props.text.snapshotVersion(props.compare.baseVersion)
    : props.text.current;
}

function formatRevisionTimestamp(locale: string, value: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function changeValueText(
  value: AdminCatalogRevisionChangeValue,
  text: AdminCatalogRevisionCompareViewProps['text']
): string {
  if (value.kind === 'empty') {
    return text.emptyValue;
  }
  if (value.kind === 'boolean') {
    return value.value ? text.trueValue : text.falseValue;
  }
  if (value.kind === 'number') {
    return String(value.value);
  }
  return value.value;
}

function changeLabel(
  change: AdminCatalogRevisionChange,
  labels: Record<string, string>
): string {
  return labels[change.field] ?? change.field;
}

function RevisionChangeRow(props: {
  change: AdminCatalogRevisionChange;
  fieldLabels: Record<string, string>;
  text: AdminCatalogRevisionCompareViewProps['text'];
}) {
  return (
    <li className="px-4 py-4">
      <p className="text-sm font-medium text-foreground">
        <span>{props.text.changed}</span>
        {` - ${changeLabel(props.change, props.fieldLabels)}`}
      </p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <p className="min-h-10 rounded-md bg-muted px-3 py-2 text-sm break-words text-foreground">
          {changeValueText(props.change.before, props.text)}
        </p>
        <p className="min-h-10 rounded-md bg-muted px-3 py-2 text-sm break-words text-foreground">
          {changeValueText(props.change.after, props.text)}
        </p>
      </div>
    </li>
  );
}

export function AdminCatalogRevisionCompareView(
  props: AdminCatalogRevisionCompareViewProps
) {
  const editor =
    props.compare.editorName ??
    props.compare.editorEmail ??
    props.text.unknownEditor;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {props.text.compareHeading}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{editor}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={props.editHref}>{props.text.backToEdit}</Link>
        </Button>
      </div>

      <section className="rounded-lg border border-border bg-card text-card-foreground">
        <div className="grid gap-4 border-b border-border p-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">
              {props.text.comparingAgainst}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {baseVersionLabel(props)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {props.actionLabels[props.compare.action]}
              {' / '}
              {formatRevisionTimestamp(props.locale, props.compare.createdAt)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">
              {props.text.currentlyViewing}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {props.text.snapshotVersion(props.compare.version)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 border-b border-border p-4 md:grid-cols-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {baseVersionLabel(props)}
          </p>
          <p className="text-xs font-semibold text-muted-foreground">
            {props.text.snapshotVersion(props.compare.version)}
          </p>
        </div>

        {props.compare.comparison.changes.length > 0 ? (
          <ol className="divide-y divide-border">
            {props.compare.comparison.changes.map((change) => (
              <RevisionChangeRow
                change={change}
                fieldLabels={props.fieldLabels}
                key={change.field}
                text={props.text}
              />
            ))}
          </ol>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            {props.text.noChanges}
          </p>
        )}

        {props.compare.comparison.remainingCount > 0 ? (
          <p className="border-t border-border p-4 text-sm text-muted-foreground">
            {props.text.moreChanges(props.compare.comparison.remainingCount)}
          </p>
        ) : null}
      </section>

      <form
        action={props.restoreAction}
        className="flex max-w-3xl flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
      >
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            className="mt-0.5 size-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
            name="confirmRestore"
            required
            type="checkbox"
            value="true"
          />
          <span>{props.text.restoreConfirm}</span>
        </label>
        <div>
          <Button size="sm" type="submit" variant="destructive">
            {props.text.restore}
          </Button>
        </div>
      </form>
    </main>
  );
}
