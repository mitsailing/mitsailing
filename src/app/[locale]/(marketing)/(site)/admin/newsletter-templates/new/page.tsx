import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { connection } from 'next/server';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { requireAdmin } from '@/libs/auth/dal';
import { createNewsletterTemplateAction } from '@/libs/newsletter/newsletterAdminActions';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  return { title: t('templates_new_meta_title') };
}

export default async function AdminNewsletterTemplateNewPage(props: PageProps) {
  await connection();
  const { locale } = await props.params;
  const { status = '' } = await props.searchParams;
  setRequestLocale(locale);
  await requireAdmin(locale);
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <AdminPageHeader title={t('templates_new')} />
      {status ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {status === 'duplicate_template'
            ? t('form_error_duplicate_template')
            : t('form_error_validation_failed')}
        </p>
      ) : null}
      <form
        action={createNewsletterTemplateAction.bind(null, locale)}
        className="space-y-5 rounded-lg border border-border bg-card p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newsletter-template-name">{t('field_name')}</Label>
            <Input id="newsletter-template-name" name="name" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newsletter-template-slug">{t('field_slug')}</Label>
            <Input id="newsletter-template-slug" name="slug" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newsletter-template-description">
            {t('field_description')}
          </Label>
          <Textarea id="newsletter-template-description" name="description" />
        </div>
        <Button type="submit" variant="mit">
          {t('create')}
        </Button>
      </form>
    </div>
  );
}
