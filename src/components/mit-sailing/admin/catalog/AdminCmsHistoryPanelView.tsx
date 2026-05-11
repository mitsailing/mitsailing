import { Button } from '@/components/ui/button';
import { Link } from '@/libs/I18nNavigation';
import type {
  AdminCmsPageRevision,
  AdminCmsPageRevisionBlockField,
  AdminCmsPageRevisionPageField,
  AdminCmsPageRevisionSummary,
} from '@/libs/mit-sailing/cmsHistory';
import {
  formatRevisionTimestamp,
  revisionSummaryLineItems,
} from './adminRevisionFormatting';

type CmsHistoryActionLabels = {
  create: string;
  delete: string;
  update: string;
};

type CmsHistoryFieldLabels = Record<
  AdminCmsPageRevisionPageField | AdminCmsPageRevisionBlockField,
  string
>;

type AdminCmsHistoryPanelViewProps = {
  actionLabels: CmsHistoryActionLabels;
  compareHrefFor: (revisionId: string) => string;
  fieldLabels: CmsHistoryFieldLabels;
  locale: string;
  revisions: readonly AdminCmsPageRevision[];
  text: {
    addedBlock: (blockTitle: string) => string;
    changed: (changes: string) => string;
    createdSummary: string;
    empty: string;
    heading: string;
    moreChanges: (count: number) => string;
    noChangesSummary: string;
    removedBlock: (blockTitle: string) => string;
    unknownEditor: string;
    version: (version: number) => string;
    viewChanges: string;
  };
};

function revisionActionLabel(
  action: AdminCmsPageRevision['action'],
  labels: CmsHistoryActionLabels
): string {
  if (action === 'create') {
    return labels.create;
  }
  if (action === 'delete') {
    return labels.delete;
  }
  return labels.update;
}

function revisionSummaryLines(props: {
  fieldLabels: CmsHistoryFieldLabels;
  summary: AdminCmsPageRevisionSummary;
  text: AdminCmsHistoryPanelViewProps['text'];
}): string[] {
  if (props.summary.kind === 'created') {
    return [props.text.createdSummary];
  }
  if (props.summary.kind === 'empty') {
    return [props.text.noChangesSummary];
  }
  const changedLabels: string[] = [];
  const lines: string[] = [];
  for (const change of props.summary.changes) {
    if (change.kind === 'page_field') {
      changedLabels.push(props.fieldLabels[change.field]);
    } else if (change.kind === 'block_field') {
      changedLabels.push(
        `${change.blockTitle} / ${props.fieldLabels[change.field]}`
      );
    } else if (change.kind === 'block_added') {
      lines.push(props.text.addedBlock(change.blockTitle));
    } else {
      lines.push(props.text.removedBlock(change.blockTitle));
    }
  }
  if (changedLabels.length > 0) {
    lines.unshift(props.text.changed(changedLabels.join(', ')));
  }
  if (props.summary.remainingCount > 0) {
    lines.push(props.text.moreChanges(props.summary.remainingCount));
  }
  return lines;
}

export function AdminCmsHistoryPanelView(props: AdminCmsHistoryPanelViewProps) {
  return (
    <section className="flex max-w-3xl flex-col gap-3 border-t border-mit-line pt-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {props.text.heading}
        </h2>
      </div>
      {props.revisions.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          {props.text.empty}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {props.revisions.map((revision) => {
            const editor =
              revision.editorName ??
              revision.editorEmail ??
              props.text.unknownEditor;
            const summaryLines = revisionSummaryLines({
              fieldLabels: props.fieldLabels,
              summary: revision.summary,
              text: props.text,
            });
            return (
              <li
                className="rounded-lg border border-border bg-card p-3 text-card-foreground"
                key={revision.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="font-semibold">
                        {props.text.version(revision.version)}
                      </span>
                      <span className="text-muted-foreground">
                        {revisionActionLabel(
                          revision.action,
                          props.actionLabels
                        )}
                      </span>
                      <time
                        className="text-muted-foreground"
                        dateTime={revision.createdAt}
                      >
                        {formatRevisionTimestamp(
                          props.locale,
                          revision.createdAt
                        )}
                      </time>
                    </div>
                    <p className="mt-1 text-sm text-foreground">{editor}</p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={props.compareHrefFor(revision.id)}>
                      {props.text.viewChanges}
                    </Link>
                  </Button>
                </div>
                <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                  {revisionSummaryLineItems(summaryLines).map((item) => (
                    <p key={item.key}>{item.line}</p>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
