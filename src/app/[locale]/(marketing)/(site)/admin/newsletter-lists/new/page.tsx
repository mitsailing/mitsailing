import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { connection } from 'next/server';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import { createNewsletterListAction } from '@/libs/newsletter/newsletterAdminActions';

type PageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}>;

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  return { title: t('lists_new_meta_title') };
}

export default async function AdminNewsletterListNewPage(props: PageProps) {
  await connection();
  const { locale } = await props.params;
  const { status = '' } = await props.searchParams;
  setRequestLocale(locale);
  await requirePermission(Permission.NEWSLETTER_MANAGE, locale);
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <AdminPageHeader title={t('lists_new')} />
      {status ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          id="newsletter-list-form-error"
          role="alert"
        >
          {status === 'duplicate_list'
            ? t('form_error_duplicate_list')
            : t('form_error_validation_failed')}
        </p>
      ) : null}
      <form
        aria-describedby={status ? 'newsletter-list-form-error' : undefined}
        action={createNewsletterListAction.bind(null, locale)}
        className="space-y-5 rounded-lg border border-border bg-card p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newsletter-list-name">{t('field_name')}</Label>
            <Input id="newsletter-list-name" name="name" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newsletter-list-slug">{t('field_slug')}</Label>
            <Input id="newsletter-list-slug" name="slug" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newsletter-list-description">
            {t('field_description')}
          </Label>
          <Textarea id="newsletter-list-description" name="description" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newsletter-list-default">
              {t('field_default_subscription')}
            </Label>
            <select
              className={adminNativeSelectClassName}
              id="newsletter-list-default"
              name="defaultSubscription"
            >
              <option value="opt_out">{t('default_opt_out')}</option>
              <option value="opt_in">{t('default_opt_in')}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newsletter-list-visibility">
              {t('field_visibility')}
            </Label>
            <select
              className={adminNativeSelectClassName}
              id="newsletter-list-visibility"
              name="visibility"
            >
              <option value="public">{t('visibility_public')}</option>
              <option value="private">{t('visibility_private')}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newsletter-list-resend">
              {t('field_resend_topic')}
            </Label>
            <Input id="newsletter-list-resend" name="resendTopicId" />
          </div>
        </div>
        <Button type="submit" variant="mit">
          {t('create')}
        </Button>
      </form>
    </div>
  );
}
