import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { requireAdmin } from '@/libs/auth/dal';
import { sendNewsletterBroadcastTestAction } from '@/libs/newsletter/newsletterAdminActions';
import {
  getAdminNewsletterBroadcastDetail,
  renderAdminNewsletterBroadcastPreviewHtml,
} from '@/libs/newsletter/newsletterBroadcasts';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ status?: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  return { title: t('broadcast_detail_meta_title') };
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

function statusMessageKey(status: string) {
  if (status === 'test_sent') {
    return 'broadcast_test_sent';
  }
  if (status === 'test_failed') {
    return 'form_error_test_failed';
  }
  if (status === 'invalid_test_email') {
    return 'form_error_invalid_test_email';
  }
  return null;
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

function deliveryStatusKey(status: string) {
  if (status === 'bounced') {
    return 'delivery_status_bounced';
  }
  if (status === 'cancelled') {
    return 'delivery_status_cancelled';
  }
  if (status === 'complained') {
    return 'delivery_status_complained';
  }
  if (status === 'delivered') {
    return 'delivery_status_delivered';
  }
  if (status === 'delivery_delayed') {
    return 'delivery_status_delivery_delayed';
  }
  if (status === 'failed') {
    return 'delivery_status_failed';
  }
  if (status === 'queued') {
    return 'delivery_status_queued';
  }
  if (status === 'sending') {
    return 'delivery_status_sending';
  }
  if (status === 'sent') {
    return 'delivery_status_sent';
  }
  if (status === 'suppressed') {
    return 'delivery_status_suppressed';
  }
  return 'delivery_status_unknown';
}

export default async function AdminNewsletterBroadcastDetailPage(
  props: PageProps
) {
  const { locale, id } = await props.params;
  const { status = '' } = await props.searchParams;
  setRequestLocale(locale);
  const session = await requireAdmin(locale);
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  const detail = await getAdminNewsletterBroadcastDetail(id);
  if (!detail) {
    notFound();
  }

  const { broadcast, deliveryStatusCounts } = detail;
  const previewHtml =
    await renderAdminNewsletterBroadcastPreviewHtml(broadcast);
  const notificationKey = statusMessageKey(status);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AdminPageHeader title={broadcast.subject} />
      {notificationKey ? (
        <p
          className="rounded-lg border border-border bg-card p-3 text-sm text-foreground"
          role={
            status === 'test_failed' || status === 'invalid_test_email'
              ? 'alert'
              : 'status'
          }
        >
          {t(notificationKey)}
        </p>
      ) : null}

      <section className="grid gap-4 rounded-lg border border-border bg-card p-5 text-sm text-foreground sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            {t('detail_status')}
          </p>
          <p className="mt-1">{t(broadcastStatusKey(broadcast.status))}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            {t('detail_lists')}
          </p>
          <p className="mt-1">
            {broadcast.targetLists.map((target) => target.list.name).join(', ')}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            {t('detail_created_by')}
          </p>
          <p className="mt-1">
            {broadcast.createdBy.name || broadcast.createdBy.email}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            {t('detail_deliveries')}
          </p>
          <p className="mt-1">{broadcast._count.deliveries}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            {t('detail_template')}
          </p>
          <p className="mt-1">{broadcast.template.name}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            {t('detail_created_at')}
          </p>
          <p className="mt-1">{formatDate(broadcast.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            {t('detail_scheduled_at')}
          </p>
          <p className="mt-1">
            {formatDate(broadcast.scheduledAt) || t('empty_value')}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            {t('detail_sent_at')}
          </p>
          <p className="mt-1">
            {formatDate(broadcast.sentAt) || t('empty_value')}
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t('preview_heading')}</h2>
          <iframe
            className="h-[680px] w-full rounded-lg border border-border bg-white"
            sandbox=""
            srcDoc={previewHtml}
            title={t('preview_iframe_title')}
          />
        </div>
        <div className="flex flex-col gap-4">
          <form
            action={sendNewsletterBroadcastTestAction.bind(null, locale, id)}
            className="rounded-lg border border-border bg-card p-4"
          >
            <h2 className="text-base font-semibold">
              {t('test_send_heading')}
            </h2>
            <div className="mt-3 flex flex-col gap-1.5">
              <Label htmlFor="newsletter-test-email">
                {t('field_test_email')}
              </Label>
              <Input
                defaultValue={session.user.email ?? ''}
                id="newsletter-test-email"
                name="email"
                required
                type="email"
              />
            </div>
            <Button className="mt-3" type="submit" variant="mit">
              {t('send_test')}
            </Button>
          </form>

          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-base font-semibold">
              {t('delivery_summary_heading')}
            </h2>
            {deliveryStatusCounts.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {t('delivery_summary_empty')}
              </p>
            ) : (
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                {deliveryStatusCounts.map((item) => (
                  <div key={item.status}>
                    <dt className="text-muted-foreground">
                      {t(deliveryStatusKey(item.status))}
                    </dt>
                    <dd className="font-semibold">{item._count._all}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('deliveries_heading')}</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('column_email')}</TableHead>
                <TableHead>{t('column_status')}</TableHead>
                <TableHead>{t('column_attempts')}</TableHead>
                <TableHead>{t('column_updated_at')}</TableHead>
                <TableHead>{t('column_error')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {broadcast.deliveries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>{t('deliveries_empty')}</TableCell>
                </TableRow>
              ) : (
                broadcast.deliveries.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell>{delivery.email}</TableCell>
                    <TableCell>
                      {t(deliveryStatusKey(delivery.status))}
                    </TableCell>
                    <TableCell>{delivery.attemptCount}</TableCell>
                    <TableCell>{formatDate(delivery.updatedAt)}</TableCell>
                    <TableCell>
                      {delivery.lastError ?? t('empty_value')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
