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
import { getAdminNewsletterTemplates } from '@/libs/newsletter/newsletterBroadcasts';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  return { title: t('templates_meta_title') };
}

export default async function AdminNewsletterTemplatesPage(props: PageProps) {
  await connection();
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  const templates = await getAdminNewsletterTemplates();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <AdminPageHeader
        actions={
          <Button asChild variant="mit">
            <Link href="/admin/newsletter-templates/new/">
              {t('templates_new')}
            </Link>
          </Button>
        }
        title={t('templates_title')}
      />
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('column_name')}</TableHead>
              <TableHead>{t('column_slug')}</TableHead>
              <TableHead>{t('column_default')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">{template.name}</TableCell>
                <TableCell>{template.slug}</TableCell>
                <TableCell>{template.isDefault ? t('yes') : t('no')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
