import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { Link } from '@/libs/I18nNavigation';
import type {
  AdminCmsPageRevisionChange,
  AdminCmsPageRevisionChangeValue,
  AdminCmsPageRevisionCompare,
  AdminCmsPageRevisionPageField,
  AdminCmsPageRevisionBlockField,
} from '@/libs/mit-sailing/cmsHistory';
import { formatRevisionTimestamp } from './adminRevisionFormatting';

type CmsRevisionCompareFieldLabels = Record<
  AdminCmsPageRevisionPageField | AdminCmsPageRevisionBlockField,
  string
>;

type CmsRevisionCompareActionLabels = {
  create: string;
  delete: string;
  update: string;
};

type AdminCmsRevisionCompareViewProps = {
  actionLabels: CmsRevisionCompareActionLabels;
  compare: AdminCmsPageRevisionCompare;
  editHref: string;
  fieldLabels: CmsRevisionCompareFieldLabels;
  locale: string;
  restoreAction: (formData: FormData) => Promise<void>;
  text: {
    added: string;
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
    removed: string;
    restore: string;
    restoreConfirm: string;
    restorePending: string;
    snapshotVersion: (version: number) => string;
    trueValue: string;
    unknownEditor: string;
  };
};

function baseVersionLabel(props: AdminCmsRevisionCompareViewProps): string {
  return props.compare.baseVersion
    ? props.text.snapshotVersion(props.compare.baseVersion)
    : props.text.current;
}

function revisionActionLabel(
  action: AdminCmsPageRevisionCompare['action'],
  labels: CmsRevisionCompareActionLabels
): string {
  if (action === 'create') {
    return labels.create;
  }
  if (action === 'delete') {
    return labels.delete;
  }
  return labels.update;
}

function changeValueText(
  value: AdminCmsPageRevisionChangeValue,
  text: AdminCmsRevisionCompareViewProps['text']
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
  change: AdminCmsPageRevisionChange,
  labels: CmsRevisionCompareFieldLabels
): string {
  if (change.kind === 'page_field') {
    return labels[change.field];
  }
  if (change.kind === 'block_field') {
    return `${change.blockTitle} / ${labels[change.field]}`;
  }
  return change.blockTitle;
}

function revisionChangeKey(change: AdminCmsPageRevisionChange): string {
  if (change.kind === 'page_field') {
    return `${change.kind}-${change.field}`;
  }
  if (change.kind === 'block_field') {
    return `${change.kind}-${change.blockId}-${change.field}`;
  }
  return `${change.kind}-${change.blockId}`;
}

function RevisionChangeRow(props: {
  change: AdminCmsPageRevisionChange;
  fieldLabels: CmsRevisionCompareFieldLabels;
  text: AdminCmsRevisionCompareViewProps['text'];
}) {
  const { change } = props;
  if (change.kind === 'block_added') {
    return (
      <li className="px-4 py-4">
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
          <span>{props.text.added}</span>
          {` - ${change.blockTitle}`}
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <p className="min-h-10 rounded-md bg-muted px-3 py-2 text-sm break-words text-muted-foreground">
            {props.text.emptyValue}
          </p>
          <p className="min-h-10 rounded-md bg-emerald-50 px-3 py-2 text-sm break-words text-foreground dark:bg-emerald-950/30">
            {change.blockTitle}
          </p>
        </div>
      </li>
    );
  }
  if (change.kind === 'block_removed') {
    return (
      <li className="px-4 py-4">
        <p className="text-sm font-medium text-red-800 dark:text-red-200">
          <span>{props.text.removed}</span>
          {` - ${change.blockTitle}`}
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <p className="min-h-10 rounded-md bg-red-50 px-3 py-2 text-sm break-words text-foreground dark:bg-red-950/30">
            {change.blockTitle}
          </p>
          <p className="min-h-10 rounded-md bg-muted px-3 py-2 text-sm break-words text-muted-foreground">
            {props.text.emptyValue}
          </p>
        </div>
      </li>
    );
  }
  return (
    <li className="px-4 py-4">
      <p className="text-sm font-medium text-foreground">
        <span>{props.text.changed}</span>
        {` - ${changeLabel(change, props.fieldLabels)}`}
      </p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <p className="min-h-10 rounded-md bg-muted px-3 py-2 text-sm break-words text-foreground">
          {changeValueText(change.before, props.text)}
        </p>
        <p className="min-h-10 rounded-md bg-muted px-3 py-2 text-sm break-words text-foreground">
          {changeValueText(change.after, props.text)}
        </p>
      </div>
    </li>
  );
}

export function AdminCmsRevisionCompareView(
  props: AdminCmsRevisionCompareViewProps
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
              {revisionActionLabel(props.compare.action, props.actionLabels)}
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
                key={revisionChangeKey(change)}
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
          <SubmitButton
            pendingLabel={props.text.restorePending}
            size="sm"
            variant="destructive"
          >
            {props.text.restore}
          </SubmitButton>
        </div>
      </form>
    </main>
  );
}
