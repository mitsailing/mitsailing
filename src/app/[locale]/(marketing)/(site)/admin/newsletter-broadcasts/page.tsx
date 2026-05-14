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

function formatDate(value: Date | null): string {
  if (!value) {
    return '';
  }
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/New_York',
  }).format(value);
}

function broadcastStatusKey(status: string) {
  if (status === 'cancelled') {
    return 'status_cancelled';
  }
  if (status === 'draft') {
    return 'status_draft';
  }
  if (status === 'failed') {
    return 'status_failed';
  }
  if (status === 'paused') {
    return 'status_paused';
  }
  if (status === 'queued') {
    return 'status_queued';
  }
  if (status === 'sending') {
    return 'status_sending';
  }
  if (status === 'sent') {
    return 'status_sent';
  }
  return 'status_unknown';
}

export default async function AdminNewsletterBroadcastsPage(props: PageProps) {
  await connection();
  const { locale } = await props.params;
  const { status = '' } = await props.searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  const broadcasts = await getAdminNewsletterBroadcasts();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AdminPageHeader
        actions={
          <Button asChild variant="mit">
            <Link href="/admin/newsletter-broadcasts/new/">
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
            {broadcasts.map((broadcast) => (
              <TableRow key={broadcast.id}>
                <TableCell className="font-medium">
                  <Link href={`/admin/newsletter-broadcasts/${broadcast.id}/`}>
                    {broadcast.subject}
                  </Link>
                </TableCell>
                <TableCell>
                  {broadcast.targetLists
                    .map((target) => target.list.name)
                    .join(', ')}
                </TableCell>
                <TableCell>{t(broadcastStatusKey(broadcast.status))}</TableCell>
                <TableCell>{broadcast._count.deliveries}</TableCell>
                <TableCell>{formatDate(broadcast.sentAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
