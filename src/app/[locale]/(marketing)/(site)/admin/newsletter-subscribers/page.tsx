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
import { getAdminNewsletterSubscribers } from '@/libs/newsletter/newsletterBroadcasts';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  return { title: t('subscribers_meta_title') };
}

export default async function AdminNewsletterSubscribersPage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  const subscribers = await getAdminNewsletterSubscribers();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AdminPageHeader title={t('subscribers_title')} />
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('column_email')}</TableHead>
              <TableHead>{t('column_lists')}</TableHead>
              <TableHead>{t('column_suppression')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscribers.map((subscriber) => (
              <TableRow key={subscriber.id}>
                <TableCell className="font-medium">
                  {subscriber.email}
                </TableCell>
                <TableCell>
                  {subscriber.subscriptions
                    .filter(
                      (subscription) => subscription.status === 'subscribed'
                    )
                    .map((subscription) => subscription.list.name)
                    .join(', ') || t('empty_lists')}
                </TableCell>
                <TableCell>
                  {subscriber.suppressionReason ?? t('not_suppressed')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
