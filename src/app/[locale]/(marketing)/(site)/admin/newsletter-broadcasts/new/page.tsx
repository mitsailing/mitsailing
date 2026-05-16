import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { connection } from 'next/server';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import { createNewsletterBroadcastAction } from '@/libs/newsletter/newsletterAdminActions';
import {
  getAdminNewsletterLists,
  getAdminNewsletterTemplates,
} from '@/libs/newsletter/newsletterBroadcasts';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

function errorMessageKey(
  status: string
):
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
  | 'form_error_validation_failed' {
  switch (status) {
    case 'body_required': {
      return 'form_error_body_required';
    }
    case 'body_too_long': {
      return 'form_error_body_too_long';
    }
    case 'body_too_short': {
      return 'form_error_body_too_short';
    }
    case 'enqueue_failed': {
      return 'form_error_enqueue_failed';
    }
    case 'invalid_lists': {
      return 'form_error_invalid_lists';
    }
    case 'invalid_template': {
      return 'form_error_invalid_template';
    }
    case 'lists_required': {
      return 'form_error_lists_required';
    }
    case 'no_recipients': {
      return 'form_error_no_recipients';
    }
    case 'preview_required': {
      return 'form_error_preview_required';
    }
    case 'preview_too_long': {
      return 'form_error_preview_too_long';
    }
    case 'redis_unavailable': {
      return 'form_error_redis_unavailable';
    }
    case 'scheduled_at_invalid': {
      return 'form_error_scheduled_at_invalid';
    }
    case 'subject_required': {
      return 'form_error_subject_required';
    }
    case 'subject_too_long': {
      return 'form_error_subject_too_long';
    }
    case 'template_required': {
      return 'form_error_template_required';
    }
    default: {
      return 'form_error_validation_failed';
    }
  }
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
      <form
        aria-describedby={
          status ? 'newsletter-broadcast-form-error' : undefined
        }
        action={createNewsletterBroadcastAction.bind(null, locale)}
        className="space-y-5 rounded-lg border border-border bg-card p-5"
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
            {t('field_scheduled_at_hint')}
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
                  aria-labelledby={`newsletter-broadcast-list-${list.id}-label`}
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
                      <span
                        className="block font-medium"
                        id={`newsletter-broadcast-list-${list.id}-label`}
                      >
                        {list.name}
                      </span>
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newsletter-broadcast-body">{t('field_body')}</Label>
          <Textarea
            className="min-h-64"
            id="newsletter-broadcast-body"
            name="body"
            required
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button name="intent" type="submit" value="draft" variant="outline">
            {t('save_draft')}
          </Button>
          <Button name="intent" type="submit" value="queue" variant="mit">
            {t('queue_broadcast')}
          </Button>
        </div>
      </form>
    </div>
  );
}
