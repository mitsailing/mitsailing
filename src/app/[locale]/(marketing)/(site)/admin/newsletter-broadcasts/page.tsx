import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { connection } from 'next/server';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EVENTS_TIME_ZONE } from '@/lib/mit-sailing/nyTime';
import { requireAdmin } from '@/libs/auth/dal';
import { Link } from '@/libs/I18nNavigation';
import { getAdminNewsletterBroadcasts } from '@/libs/newsletter/newsletterBroadcasts';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  return { title: t('broadcasts_meta_title') };
}

const BROADCAST_STATUS_KEYS = {
  cancelled: 'status_cancelled',
  draft: 'status_draft',
  failed: 'status_failed',
  paused: 'status_paused',
  queued: 'status_queued',
  sending: 'status_sending',
  sent: 'status_sent',
} as const;

function formatDate(value: Date | null, locale: string): string {
  if (!value) {
    return '';
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: EVENTS_TIME_ZONE,
  }).format(value);
}

function isBroadcastStatus(
  status: string
): status is keyof typeof BROADCAST_STATUS_KEYS {
  return status in BROADCAST_STATUS_KEYS;
}

function broadcastStatusKey(status: string) {
  return isBroadcastStatus(status)
    ? BROADCAST_STATUS_KEYS[status]
    : 'status_unknown';
}

export default async function AdminNewsletterBroadcastsPage(props: PageProps) {
  await connection();
  const { locale } = await props.params;
  const { status = '' } = await props.searchParams;
  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  const broadcasts = await getAdminNewsletterBroadcasts();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AdminPageHeader
        actions={
          <Button asChild variant="mit">
            <Link href="/admin/newsletter-broadcasts/new">
              {t('broadcasts_new')}
            </Link>
          </Button>
        }
        title={t('broadcasts_title')}
      />
      {status ? (
        <p
          className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-950"
          role="status"
        >
          {status === 'queued' ? t('broadcast_queued') : t('broadcast_created')}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('column_subject')}</TableHead>
              <TableHead>{t('column_lists')}</TableHead>
              <TableHead>{t('column_status')}</TableHead>
              <TableHead>{t('column_deliveries')}</TableHead>
              <TableHead>{t('column_sent_at')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {broadcasts.length === 0 ? (
              <TableRow>
                <TableCell
                  className="py-8 text-center text-muted-foreground"
                  colSpan={5}
                >
                  {t('broadcasts_empty')}
                </TableCell>
              </TableRow>
            ) : (
              broadcasts.map((broadcast) => (
                <TableRow key={broadcast.id}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/newsletter-broadcasts/${broadcast.id}`}>
                      {broadcast.subject}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {broadcast.targetLists
                      .map((target) => target.list.name)
                      .join(', ')}
                  </TableCell>
                  <TableCell>
                    {t(broadcastStatusKey(broadcast.status))}
                  </TableCell>
                  <TableCell>{broadcast._count.deliveries}</TableCell>
                  <TableCell>{formatDate(broadcast.sentAt, locale)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
