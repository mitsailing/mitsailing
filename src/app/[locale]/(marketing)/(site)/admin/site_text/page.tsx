import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import {
  resetSiteTextOverrideAction,
  saveSiteTextOverrideAction,
} from '@/libs/admin/site-text/siteTextActions';
import { getSiteTextAdminRows } from '@/libs/admin/site-text/siteTextQueries';
import { Link } from '@/libs/I18nNavigation';
import type { SiteTextEntry } from '@/libs/site-text/siteTextMessages';

type AdminSiteTextPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    namespace?: string;
    q?: string;
    status?: string;
  }>;
};

export async function generateMetadata(
  props: AdminSiteTextPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AdminSiteText' });
  return { title: t('meta_title') };
}

function normalizeSearchParam(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function filterSiteTextEntries(
  entries: readonly SiteTextEntry[],
  namespace: string,
  query: string
): SiteTextEntry[] {
  const normalizedQuery = query.toLocaleLowerCase();
  return entries.filter((entry) => {
    const namespaceMatches =
      namespace.length === 0 || entry.namespace === namespace;
    const queryMatches =
      normalizedQuery.length === 0 ||
      `${entry.namespace} ${entry.key} ${entry.defaultValue} ${entry.liveValue}`
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    return namespaceMatches && queryMatches;
  });
}

function statusMessage(
  status: string,
  t: Awaited<ReturnType<typeof getTranslations<'AdminSiteText'>>>
): { tone: 'success' | 'error'; message: string } | null {
  if (status === 'saved') {
    return { tone: 'success', message: t('saved') };
  }
  if (status === 'reset') {
    return { tone: 'success', message: t('reset_done') };
  }
  if (status === 'unknown_key') {
    return { tone: 'error', message: t('error_unknown_key') };
  }
  if (status === 'validation_failed') {
    return { tone: 'error', message: t('error_validation_failed') };
  }
  if (status === 'placeholder_mismatch') {
    return { tone: 'error', message: t('error_placeholder_mismatch') };
  }
  if (status.length > 0) {
    return { tone: 'error', message: t('error_unknown') };
  }
  return null;
}

function formatUpdatedAt(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function SiteTextRow(props: {
  entry: SiteTextEntry;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<'AdminSiteText'>>>;
}) {
  const saveAction = saveSiteTextOverrideAction.bind(
    null,
    props.locale,
    props.entry.namespace,
    props.entry.key
  );
  const resetAction = resetSiteTextOverrideAction.bind(
    null,
    props.locale,
    props.entry.namespace,
    props.entry.key
  );
  const hasOverride = props.entry.overrideValue !== null;
  const updatedAt = formatUpdatedAt(props.entry.updatedAt);
  const editor =
    props.entry.updatedByName ??
    props.entry.updatedByEmail ??
    props.t('unknown_editor');

  return (
    <li className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs break-words text-muted-foreground">
            {props.entry.namespace}.{props.entry.key}
          </p>
          <span
            className={
              hasOverride
                ? 'mt-2 inline-flex rounded-full bg-mit-red-50 px-2 py-0.5 text-xs font-medium text-mit-red-ink'
                : 'mt-2 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
            }
          >
            {hasOverride
              ? props.t('status_overridden')
              : props.t('status_default')}
          </span>
        </div>
        {hasOverride ? (
          <div className="text-right text-xs text-muted-foreground">
            <p>{props.t('updated_by', { name: editor })}</p>
            {updatedAt ? (
              <p>{props.t('updated_at', { date: updatedAt })}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-foreground">
            {props.t('default_value')}
          </p>
          <p className="mt-1 rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap text-muted-foreground">
            {props.entry.defaultValue}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {props.t('live_value')}
          </p>
          <p className="mt-1 rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap text-muted-foreground">
            {props.entry.liveValue}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <form action={saveAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label
              className="text-foreground"
              htmlFor={`${props.entry.namespace}-${props.entry.key}-value`}
            >
              {props.t('override_value')}
            </Label>
            <Textarea
              className="min-h-24"
              defaultValue={
                props.entry.overrideValue ?? props.entry.defaultValue
              }
              id={`${props.entry.namespace}-${props.entry.key}-value`}
              name="value"
              required
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="mit">
              {props.t('save')}
            </Button>
          </div>
        </form>
        {hasOverride ? (
          <form action={resetAction}>
            <Button type="submit" variant="outline">
              {props.t('reset')}
            </Button>
          </form>
        ) : null}
      </div>
    </li>
  );
}

/**
 * `GET /admin/site_text` — live locale override editor.
 *
 * @param props - App Router page props
 * @returns Admin site text editor
 */
export default async function AdminSiteTextPage(props: AdminSiteTextPageProps) {
  const { locale } = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(locale);

  const namespace = normalizeSearchParam(searchParams.namespace);
  const query = normalizeSearchParam(searchParams.q);
  const status = normalizeSearchParam(searchParams.status);
  const rows = await getSiteTextAdminRows(locale);
  const entries = filterSiteTextEntries(rows.entries, namespace, query);
  const namespaces = [...new Set(rows.entries.map((entry) => entry.namespace))];
  const t = await getTranslations({ locale, namespace: 'AdminSiteText' });
  const message = statusMessage(status, t);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AdminPageHeader title={t('title')} />
      <p className="max-w-3xl text-sm text-muted-foreground">{t('intro')}</p>

      {message ? (
        <div
          className={
            message.tone === 'success'
              ? 'rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950'
              : 'rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-950'
          }
          role="status"
        >
          {message.message}
        </div>
      ) : null}

      {rows.staleOverrides.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <h2 className="font-semibold">{t('stale_heading')}</h2>
          <p className="mt-1">{t('stale_intro')}</p>
          <ul className="mt-2 list-disc pl-5">
            {rows.staleOverrides.map((override) => (
              <li key={`${override.namespace}\u0000${override.key}`}>
                <code>
                  {override.namespace}.{override.key}
                </code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[16rem_1fr_auto_auto]">
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" htmlFor="site-text-namespace">
            {t('filter_label')}
          </Label>
          <select
            className={adminNativeSelectClassName}
            defaultValue={namespace}
            id="site-text-namespace"
            name="namespace"
          >
            <option value="">{t('filter_all')}</option>
            {namespaces.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" htmlFor="site-text-search">
            {t('search_label')}
          </Label>
          <Input
            defaultValue={query}
            id="site-text-search"
            name="q"
            placeholder={t('search_placeholder')}
            type="search"
          />
        </div>
        <div className="flex items-end">
          <Button className="w-full" type="submit" variant="mit">
            {t('filter_submit')}
          </Button>
        </div>
        <div className="flex items-end">
          <Button asChild className="w-full" type="button" variant="outline">
            <Link href="/admin/site_text/">{t('clear_filters')}</Link>
          </Button>
        </div>
      </form>

      {entries.length > 0 ? (
        <ul className="flex list-none flex-col gap-4 p-0">
          {entries.map((entry) => (
            <SiteTextRow
              entry={entry}
              key={`${entry.namespace}\u0000${entry.key}`}
              locale={locale}
              t={t}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          {t('empty')}
        </p>
      )}
    </div>
  );
}
