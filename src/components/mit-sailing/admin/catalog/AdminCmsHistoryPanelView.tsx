import { Button } from '@/components/ui/button';
import { Link } from '@/libs/I18nNavigation';

type AdminCmsHistoryRevisionView = {
  id: string;
  version: number;
  action: 'create' | 'update' | 'delete';
  createdAt: string;
  editorName?: string;
  editorEmail?: string;
  preview: {
    blockCount: number;
    excerpt?: string;
    pagePath?: string;
    pageTitle?: string;
  };
};

type CmsHistoryActionLabels = {
  create: string;
  delete: string;
  update: string;
};

type AdminCmsHistoryPanelViewProps = {
  actionLabels: CmsHistoryActionLabels;
  compareHrefFor: (revisionId: string) => string;
  locale: string;
  revisions: readonly AdminCmsHistoryRevisionView[];
  text: {
    compare: string;
    empty: string;
    heading: string;
    snapshotBlocks: (count: number) => string;
    unknownEditor: string;
    version: (version: number) => string;
  };
};

function revisionActionLabel(
  action: AdminCmsHistoryRevisionView['action'],
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

function formatRevisionTimestamp(locale: string, value: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
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
            const snapshotTitle = [
              revision.preview.pageTitle,
              revision.preview.pagePath,
            ]
              .filter(Boolean)
              .join(' / ');
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
                      {props.text.compare}
                    </Link>
                  </Button>
                </div>
                {snapshotTitle ? (
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {snapshotTitle}
                  </p>
                ) : null}
                <p className="mt-1 text-sm text-muted-foreground">
                  {props.text.snapshotBlocks(revision.preview.blockCount)}
                  {revision.preview.excerpt
                    ? ` - ${revision.preview.excerpt}`
                    : ''}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
