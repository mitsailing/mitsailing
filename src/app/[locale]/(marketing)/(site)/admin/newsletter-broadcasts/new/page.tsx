import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { connection } from 'next/server';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { AdminNewsletterBroadcastEditor } from '@/components/mit-sailing/admin/newsletters/AdminNewsletterBroadcastEditor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import { createNewsletterBroadcastAction } from '@/libs/newsletter/newsletterAdminActions';
import {
  getAdminNewsletterLists,
  getAdminNewsletterTemplates,
} from '@/libs/newsletter/newsletterBroadcasts';

type PageProps = Readonly<{
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}>;

type ErrorMessageKey =
  | 'form_error_body_required'
  | 'form_error_body_too_long'
  | 'form_error_body_too_short'
  | 'form_error_enqueue_failed'
  | 'form_error_invalid_lists'
  | 'form_error_invalid_template'
  | 'form_error_lists_required'
  | 'form_error_no_recipients'
  | 'form_error_preview_required'
  | 'form_error_preview_too_long'
  | 'form_error_redis_unavailable'
  | 'form_error_scheduled_at_invalid'
  | 'form_error_subject_required'
  | 'form_error_subject_too_long'
  | 'form_error_template_required'
  | 'form_error_validation_failed';

const errorMessageKeyByStatus: Record<string, ErrorMessageKey> = {
  body_required: 'form_error_body_required',
  body_too_long: 'form_error_body_too_long',
  body_too_short: 'form_error_body_too_short',
  enqueue_failed: 'form_error_enqueue_failed',
  invalid_lists: 'form_error_invalid_lists',
  invalid_template: 'form_error_invalid_template',
  lists_required: 'form_error_lists_required',
  no_recipients: 'form_error_no_recipients',
  preview_required: 'form_error_preview_required',
  preview_too_long: 'form_error_preview_too_long',
  redis_unavailable: 'form_error_redis_unavailable',
  scheduled_at_invalid: 'form_error_scheduled_at_invalid',
  subject_required: 'form_error_subject_required',
  subject_too_long: 'form_error_subject_too_long',
  template_required: 'form_error_template_required',
};

function errorMessageKey(status: string): ErrorMessageKey {
  return errorMessageKeyByStatus[status] ?? 'form_error_validation_failed';
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  return { title: t('broadcasts_new_meta_title') };
}

export default async function AdminNewsletterBroadcastNewPage(
  props: PageProps
) {
  await connection();
  const { locale } = await props.params;
  const { status = '' } = await props.searchParams;
  setRequestLocale(locale);
  await requirePermission(Permission.NEWSLETTER_MANAGE, locale);
  const t = await getTranslations({ locale, namespace: 'AdminNewsletters' });
  const lists = await getAdminNewsletterLists();
  const templates = await getAdminNewsletterTemplates();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <AdminPageHeader title={t('broadcasts_new')} />
      {status ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          id="newsletter-broadcast-form-error"
          role="alert"
        >
          {t(errorMessageKey(status))}
        </p>
      ) : null}
      <AdminNewsletterBroadcastEditor
        action={createNewsletterBroadcastAction.bind(null, locale)}
        ariaDescribedBy={status ? 'newsletter-broadcast-form-error' : undefined}
        initialBody="<p></p>"
        text={{
          bodyLabel: t('field_body'),
          queueBroadcast: t('queue_broadcast'),
          saveDraft: t('save_draft'),
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newsletter-broadcast-subject">
              {t('field_subject')}
            </Label>
            <Input id="newsletter-broadcast-subject" name="subject" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newsletter-broadcast-name">{t('field_name')}</Label>
            <Input id="newsletter-broadcast-name" name="name" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newsletter-broadcast-preview">
            {t('field_preview')}
          </Label>
          <Input
            id="newsletter-broadcast-preview"
            name="previewText"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newsletter-broadcast-scheduled-at">
            {t('field_scheduled_at')}
          </Label>
          <Input
            id="newsletter-broadcast-scheduled-at"
            name="scheduledAt"
            type="datetime-local"
          />
          <p className="text-xs text-muted-foreground">
            {t('field_scheduled_at_hint')}{' '}
            {t('field_scheduled_at_timezone_note')}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newsletter-broadcast-template">
            {t('field_template')}
          </Label>
          <select
            className={adminNativeSelectClassName}
            id="newsletter-broadcast-template"
            name="templateId"
            required
          >
            {templates.length === 0 ? (
              <option disabled value="">
                {t('field_template_empty')}
              </option>
            ) : (
              <>
                <option value="">{t('field_template_placeholder')}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-foreground">
            {t('field_target_lists')}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {lists
              .filter((list) => !list.isArchived)
              .map((list) => (
                <label
                  aria-label={list.name}
                  className="rounded-lg border border-border bg-background p-3 text-sm"
                  htmlFor={`newsletter-broadcast-list-${list.id}`}
                  key={list.id}
                >
                  <span className="flex items-start gap-3">
                    <input
                      className="mt-1"
                      id={`newsletter-broadcast-list-${list.id}`}
                      name="listId"
                      type="checkbox"
                      value={list.id}
                    />
                    <span>
                      <span className="block font-medium">{list.name}</span>
                      {list.description ? (
                        <span className="mt-1 block text-muted-foreground">
                          {list.description}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </label>
              ))}
          </div>
        </fieldset>
      </AdminNewsletterBroadcastEditor>
    </div>
  );
}
