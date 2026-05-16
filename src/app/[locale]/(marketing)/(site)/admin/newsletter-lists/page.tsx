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
import { requireAdmin } from '@/libs/auth/dal';
import { Link } from '@/libs/I18nNavigation';
import { getAdminNewsletterLists } from '@/libs/newsletter/newsletterBroadcasts';

type PageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}>;

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  return { title: t('lists_meta_title') };
}

function defaultSubscriptionKey(value: string) {
  if (value === 'opt_in') {
    return 'default_opt_in';
  }
  if (value === 'opt_out') {
    return 'default_opt_out';
  }
  return 'default_unknown';
}

function visibilityKey(value: string) {
  if (value === 'private') {
    return 'visibility_private';
  }
  if (value === 'public') {
    return 'visibility_public';
  }
  return 'visibility_unknown';
}

export default async function AdminNewsletterListsPage(props: PageProps) {
  await connection();
  const { locale } = await props.params;
  const { status = '' } = await props.searchParams;
  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  const lists = await getAdminNewsletterLists();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AdminPageHeader
        actions={
          <Button asChild variant="mit">
            <Link href="/admin/newsletter-lists/new">{t('lists_new')}</Link>
          </Button>
        }
        title={t('lists_title')}
      />
      {status === 'created' ? (
        <output className="rounded-lg border border-border bg-card p-3 text-sm text-foreground">
          {t('list_created')}
        </output>
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
            {lists.length === 0 ? (
              <TableRow>
                <TableCell
                  className="py-8 text-center text-muted-foreground"
                  colSpan={5}
                >
                  {t('lists_empty')}
                </TableCell>
              </TableRow>
            ) : (
              lists.map((list) => (
                <TableRow key={list.id}>
                  <TableCell className="font-medium">{list.name}</TableCell>
                  <TableCell>{list.slug}</TableCell>
                  <TableCell>
                    {t(defaultSubscriptionKey(list.defaultSubscription))}
                  </TableCell>
                  <TableCell>{t(visibilityKey(list.visibility))}</TableCell>
                  <TableCell>{list._count.subscriptions}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
