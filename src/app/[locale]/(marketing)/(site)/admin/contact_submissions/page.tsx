import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';
import {
  contactSubmissionAdminFilter,
  CONTACT_SUBMISSION_STATUSES,
  listContactSubmissionsForAdmin,
} from '@/libs/mit-sailing/contactSubmissions';
import type { ContactSubmissionAdminFilter } from '@/libs/mit-sailing/contactSubmissions';

type AdminContactSubmissionsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

type AdminContactT = Awaited<
  ReturnType<typeof getTranslations<'AdminContactSubmissions'>>
>;

const filterValues: readonly ContactSubmissionAdminFilter[] = [
  'all',
  ...CONTACT_SUBMISSION_STATUSES,
];

export async function generateMetadata(
  props: AdminContactSubmissionsPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'AdminContactSubmissions',
  });
  return { title: t('meta_title') };
}

function formatDate(value: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

function excerpt(value: string): string {
  const normalized = value.replaceAll(/\s+/g, ' ').trim();
  return normalized.length > 120
    ? `${normalized.slice(0, 117).trimEnd()}...`
    : normalized;
}

function statusClassName(status: string): string {
  if (status === 'unread') {
    return 'bg-mit-red-highlight text-mit-red-ink';
  }
  if (status === 'failed') {
    return 'bg-destructive/10 text-destructive';
  }
  if (status === 'sent' || status === 'resolved') {
    return 'bg-green-50 text-green-800';
  }
  return 'bg-muted text-muted-foreground';
}

function filterLabel(
  filter: ContactSubmissionAdminFilter,
  t: AdminContactT
): string {
  if (filter === 'all') {
    return t('filter_all');
  }
  if (filter === 'unread') {
    return t('filter_unread');
  }
  if (filter === 'resolved') {
    return t('filter_resolved');
  }
  return t('filter_archived');
}

function statusLabel(status: string, t: AdminContactT): string {
  if (status === 'unread') {
    return t('status_unread');
  }
  if (status === 'resolved') {
    return t('status_resolved');
  }
  return t('status_archived');
}

function notificationLabel(status: string, t: AdminContactT): string {
  if (status === 'sent') {
    return t('notification_sent');
  }
  if (status === 'sending') {
    return t('notification_sending');
  }
  if (status === 'failed') {
    return t('notification_failed');
  }
  return t('notification_pending');
}

/**
 * `GET /admin/contact_submissions` — stored public contact form submissions.
 *
 * @param props - App Router page props
 * @returns Admin inbox table
 */
export default async function AdminContactSubmissionsPage(
  props: AdminContactSubmissionsPageProps
) {
  const { locale } = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(locale);

  const activeFilter = contactSubmissionAdminFilter(searchParams.status);
  const rows = await listContactSubmissionsForAdmin(activeFilter);
  const t = await getTranslations({
    locale,
    namespace: 'AdminContactSubmissions',
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <AdminPageHeader title={t('title')} />

      <p className="max-w-3xl text-sm leading-relaxed text-mit-text">
        {t('intro')}
      </p>

      {searchParams.status === 'deleted' ? (
        <p
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-900"
          role="status"
        >
          {t('deleted')}
        </p>
      ) : null}

      <nav aria-label={t('filter_aria')} className="flex flex-wrap gap-2">
        {filterValues.map((filter) => {
          const active = filter === activeFilter;
          const href =
            filter === 'all'
              ? '/admin/contact_submissions/'
              : `/admin/contact_submissions/?status=${filter}`;
          return (
            <Link
              aria-current={active ? 'page' : undefined}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm font-semibold no-underline',
                active
                  ? 'border-mit-red bg-mit-red text-white'
                  : 'border-mit-line bg-card text-mit-text hover:bg-mit-surface'
              )}
              href={href}
              key={filter}
            >
              {filterLabel(filter, t)}
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-mit-line bg-card p-6 text-sm text-mit-text">
          {t('empty')}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('column_sender')}</TableHead>
              <TableHead>{t('column_message')}</TableHead>
              <TableHead>{t('column_status')}</TableHead>
              <TableHead>{t('column_notification')}</TableHead>
              <TableHead>{t('column_received')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-normal">
                  <Link
                    className="font-semibold text-mit-red-ink no-underline hover:underline"
                    href={`/admin/contact_submissions/${row.id}/`}
                  >
                    {row.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.email}
                  </p>
                </TableCell>
                <TableCell className="max-w-md whitespace-normal text-mit-text">
                  {excerpt(row.message)}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
                      statusClassName(row.status)
                    )}
                  >
                    {statusLabel(row.status, t)}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
                      statusClassName(row.notificationStatus)
                    )}
                  >
                    {notificationLabel(row.notificationStatus, t)}
                  </span>
                </TableCell>
                <TableCell>{formatDate(row.createdAt, locale)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
