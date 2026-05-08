import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
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
import { getAdminNewsletterLists } from '@/libs/newsletter/newsletterBroadcasts';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  return { title: t('lists_meta_title') };
}

export default async function AdminNewsletterListsPage(props: PageProps) {
  const { locale } = await props.params;
  const { status = '' } = await props.searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  const lists = await getAdminNewsletterLists();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AdminPageHeader
        actions={
          <Button asChild variant="mit">
            <Link href="/admin/newsletter-lists/new/">{t('lists_new')}</Link>
          </Button>
        }
        title={t('lists_title')}
      />
      {status === 'created' ? (
        <p
          className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-950"
          role="status"
        >
          {t('list_created')}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('column_name')}</TableHead>
              <TableHead>{t('column_slug')}</TableHead>
              <TableHead>{t('column_default')}</TableHead>
              <TableHead>{t('column_visibility')}</TableHead>
              <TableHead>{t('column_subscribers')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lists.map((list) => (
              <TableRow key={list.id}>
                <TableCell className="font-medium">{list.name}</TableCell>
                <TableCell>{list.slug}</TableCell>
                <TableCell>{list.defaultSubscription}</TableCell>
                <TableCell>{list.visibility}</TableCell>
                <TableCell>{list._count.subscriptions}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
