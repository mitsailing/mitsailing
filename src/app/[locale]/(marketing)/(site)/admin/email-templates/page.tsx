import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { connection } from 'next/server';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { AdminEmailTemplateList } from '@/components/mit-sailing/admin/email-templates/AdminEmailTemplateList';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import { getAdminEmailTemplateList } from '@/libs/email-templates/emailTemplateAdminQueries';

type PageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'AdminEmailTemplates',
  });
  return { title: t('meta_title') };
}

export default async function AdminEmailTemplatesPage(props: PageProps) {
  await connection();
  const { locale } = await props.params;
  setRequestLocale(locale);
  await requirePermission(Permission.EMAIL_TEMPLATES_MANAGE, locale);
  const t = await getTranslations({ locale, namespace: 'AdminEmailTemplates' });
  const rows = await getAdminEmailTemplateList();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <AdminPageHeader title={t('title')} />
        <p className="mt-2 text-sm text-muted-foreground">{t('intro')}</p>
      </div>
      <AdminEmailTemplateList
        locale={locale}
        rows={rows}
        text={{
          columnDraft: t('column_draft'),
          columnFamily: t('column_family'),
          columnPublished: t('column_published'),
          columnRevisions: t('column_revisions'),
          columnTemplate: t('column_template'),
          edit: t('edit'),
          empty: t('empty'),
          notPublished: t('not_published'),
        }}
      />
    </div>
  );
}
