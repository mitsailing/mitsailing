import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
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
import { formatAdminDate } from '@/libs/admin/adminDateFormatting';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import { sendNewsletterBroadcastTestAction } from '@/libs/newsletter/newsletterAdminActions';
import { newsletterBroadcastStatusKey } from '@/libs/newsletter/newsletterAdminDisplay';
import {
  getAdminNewsletterBroadcastDetail,
  renderAdminNewsletterBroadcastPreviewHtml,
} from '@/libs/newsletter/newsletterBroadcasts';

type PageProps = Readonly<{
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ status?: string }>;
}>;

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  return { title: t('broadcast_detail_meta_title') };
}

const STATUS_MESSAGE_KEYS = {
  invalid_test_email: 'form_error_invalid_test_email',
  test_failed: 'form_error_test_failed',
  test_sent: 'broadcast_test_sent',
} as const;

const DELIVERY_STATUS_KEYS = {
  bounced: 'delivery_status_bounced',
  cancelled: 'delivery_status_cancelled',
  complained: 'delivery_status_complained',
  delivered: 'delivery_status_delivered',
  delivery_delayed: 'delivery_status_delivery_delayed',
  failed: 'delivery_status_failed',
  queued: 'delivery_status_queued',
  sending: 'delivery_status_sending',
  sent: 'delivery_status_sent',
  suppressed: 'delivery_status_suppressed',
} as const;

function isStatusMessage(
  status: string
): status is keyof typeof STATUS_MESSAGE_KEYS {
  return Object.hasOwn(STATUS_MESSAGE_KEYS, status);
}

function isDeliveryStatus(
  status: string
): status is keyof typeof DELIVERY_STATUS_KEYS {
  return Object.hasOwn(DELIVERY_STATUS_KEYS, status);
}

function statusMessageKey(status: string) {
  return isStatusMessage(status) ? STATUS_MESSAGE_KEYS[status] : null;
}

function deliveryStatusKey(status: string) {
  return isDeliveryStatus(status)
    ? DELIVERY_STATUS_KEYS[status]
    : 'delivery_status_unknown';
}

export default async function AdminNewsletterBroadcastDetailPage(
  props: PageProps
) {
  await connection();
  const { locale, id } = await props.params;
  const { status = '' } = await props.searchParams;
  setRequestLocale(locale);
  const session = await requirePermission(Permission.NEWSLETTER_MANAGE, locale);
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
      {notificationKey &&
      (status === 'test_failed' || status === 'invalid_test_email') ? (
        <p
          className="rounded-lg border border-border bg-card p-3 text-sm text-foreground"
          role="alert"
        >
          {t(notificationKey)}
        </p>
      ) : null}
      {notificationKey &&
      status !== 'test_failed' &&
      status !== 'invalid_test_email' ? (
        <output className="rounded-lg border border-border bg-card p-3 text-sm text-foreground">
          {t(notificationKey)}
        </output>
      ) : null}

      <section className="grid gap-4 rounded-lg border border-border bg-card p-5 text-sm text-foreground sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            {t('detail_status')}
          </p>
          <p className="mt-1">
            {t(newsletterBroadcastStatusKey(broadcast.status))}
          </p>
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
          <p className="mt-1">{formatAdminDate(broadcast.createdAt, locale)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            {t('detail_scheduled_at')}
          </p>
          <p className="mt-1">
            {formatAdminDate(broadcast.scheduledAt, locale) || t('empty_value')}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            {t('detail_sent_at')}
          </p>
          <p className="mt-1">
            {formatAdminDate(broadcast.sentAt, locale) || t('empty_value')}
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
                    <TableCell>
                      {formatAdminDate(delivery.updatedAt, locale)}
                    </TableCell>
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
