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
import { formatAdminDate } from '@/libs/admin/adminDateFormatting';
import { requireAdmin } from '@/libs/auth/dal';
import { Link } from '@/libs/I18nNavigation';
import { newsletterBroadcastStatusKey } from '@/libs/newsletter/newsletterAdminDisplay';
import { getAdminNewsletterBroadcasts } from '@/libs/newsletter/newsletterBroadcasts';
import { getI18nPath } from '@/utils/Helpers';

type PageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}>;

const STATUS_MESSAGE_KEYS = {
  created: 'broadcast_created',
  queued: 'broadcast_queued',
} as const;

function isStatusMessage(
  status: string
): status is keyof typeof STATUS_MESSAGE_KEYS {
  return Object.hasOwn(STATUS_MESSAGE_KEYS, status);
}

function statusMessageKey(status: string) {
  return isStatusMessage(status) ? STATUS_MESSAGE_KEYS[status] : null;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  return { title: t('broadcasts_meta_title') };
}

export default async function AdminNewsletterBroadcastsPage(props: PageProps) {
  await connection();
  const { locale } = await props.params;
  const { status = '' } = await props.searchParams;
  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  const broadcasts = await getAdminNewsletterBroadcasts();
  const notificationKey = statusMessageKey(status);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AdminPageHeader
        actions={
          <Button asChild variant="mit">
            <Link
              href={getI18nPath('/admin/newsletter-broadcasts/new', locale)}
            >
              {t('broadcasts_new')}
            </Link>
          </Button>
        }
        title={t('broadcasts_title')}
      />
      {notificationKey ? (
        <output className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-950">
          {t(notificationKey)}
        </output>
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
                    <Link
                      href={getI18nPath(
                        `/admin/newsletter-broadcasts/${broadcast.id}`,
                        locale
                      )}
                    >
                      {broadcast.subject}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {broadcast.targetLists
                      .map((target) => target.list.name)
                      .join(', ')}
                  </TableCell>
                  <TableCell>
                    {t(newsletterBroadcastStatusKey(broadcast.status))}
                  </TableCell>
                  <TableCell>{broadcast._count.deliveries}</TableCell>
                  <TableCell>
                    {formatAdminDate(broadcast.sentAt, locale)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
