import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';
import {
  deleteContactSubmissionAction,
  retryContactSubmissionNotificationAction,
  updateContactSubmissionStatusAction,
} from '@/libs/mit-sailing/contactSubmissionActions';
import { getContactSubmissionForAdmin } from '@/libs/mit-sailing/contactSubmissions';
import type { ContactSubmissionDetail } from '@/libs/mit-sailing/contactSubmissions';

type AdminContactSubmissionDetailPageProps = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ result?: string }>;
};

type AdminContactT = Awaited<
  ReturnType<typeof getTranslations<'AdminContactSubmissions'>>
>;

export async function generateMetadata(
  props: AdminContactSubmissionDetailPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'AdminContactSubmissions',
  });
  return { title: t('detail_meta_title') };
}

function formatDate(
  value: Date | null,
  locale: string,
  emptyLabel: string
): string {
  if (!value) {
    return emptyLabel;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

function statusClassName(status: string): string {
  if (status === 'unread') {
    return 'bg-mit-red-highlight text-mit-red-ink';
  }
  if (status === 'failed') {
    return 'bg-destructive/10 text-destructive';
  }
  if (status === 'sent' || status === 'resolved') {
    return 'bg-green-50 text-green-800';
  }
  return 'bg-muted text-muted-foreground';
}

function DetailRow(props: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-mit-text">{props.label}</dt>
      <dd className="mt-1 text-sm break-words text-mit-text">
        {props.children}
      </dd>
    </div>
  );
}

function StatusBadge(props: { label: string; value: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
        statusClassName(props.value)
      )}
    >
      {props.label}
    </span>
  );
}

function statusLabel(status: string, t: AdminContactT): string {
  if (status === 'unread') {
    return t('status_unread');
  }
  if (status === 'resolved') {
    return t('status_resolved');
  }
  return t('status_archived');
}

function notificationLabel(status: string, t: AdminContactT): string {
  if (status === 'sent') {
    return t('notification_sent');
  }
  if (status === 'sending') {
    return t('notification_sending');
  }
  if (status === 'failed') {
    return t('notification_failed');
  }
  return t('notification_pending');
}

function StatusActions(props: {
  locale: string;
  submission: ContactSubmissionDetail;
  t: AdminContactT;
}) {
  const resolveAction = updateContactSubmissionStatusAction.bind(
    null,
    props.locale,
    props.submission.id,
    'resolved'
  );
  const archiveAction = updateContactSubmissionStatusAction.bind(
    null,
    props.locale,
    props.submission.id,
    'archived'
  );
  const reopenAction = updateContactSubmissionStatusAction.bind(
    null,
    props.locale,
    props.submission.id,
    'unread'
  );
  const resolveButton =
    props.submission.status === 'resolved' ? null : (
      <form action={resolveAction}>
        <Button type="submit" variant="mit">
          {props.t('action_resolve')}
        </Button>
      </form>
    );
  const archiveButton =
    props.submission.status === 'archived' ? null : (
      <form action={archiveAction}>
        <Button type="submit" variant="outline">
          {props.t('action_archive')}
        </Button>
      </form>
    );
  const reopenButton =
    props.submission.status === 'unread' ? null : (
      <form action={reopenAction}>
        <Button type="submit" variant="outline">
          {props.t('action_reopen')}
        </Button>
      </form>
    );

  return (
    <div className="flex flex-wrap gap-2">
      {resolveButton}
      {archiveButton}
      {reopenButton}
    </div>
  );
}

function statusMessage(status: string | undefined, t: AdminContactT) {
  if (status === 'updated') {
    return t('status_updated');
  }
  if (status === 'notification') {
    return t('notification_retried');
  }
  if (status === 'notification_failed') {
    return t('notification_retry_failed');
  }
  if (status === 'confirm') {
    return t('delete_confirm_error');
  }
  return null;
}

/**
 * `GET /admin/contact_submissions/:id` — submission detail and workflow actions.
 *
 * @param props - App Router page props
 * @returns Admin contact submission detail
 */
export default async function AdminContactSubmissionDetailPage(
  props: AdminContactSubmissionDetailPageProps
) {
  const { locale, id } = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(locale);

  const submission = await getContactSubmissionForAdmin(id);
  if (!submission) {
    notFound();
  }

  const t = await getTranslations({
    locale,
    namespace: 'AdminContactSubmissions',
  });
  const retryAction = retryContactSubmissionNotificationAction.bind(
    null,
    locale,
    submission.id
  );
  const deleteAction = deleteContactSubmissionAction.bind(
    null,
    locale,
    submission.id
  );
  const message = statusMessage(searchParams.result, t);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Link
        className="font-semibold text-mit-red-ink no-underline hover:underline"
        href="/admin/contact_submissions/"
      >
        {t('back_to_inbox')}
      </Link>

      <AdminPageHeader title={t('detail_title')} />

      {message ? (
        <p
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-900"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <section className="rounded-xl border border-mit-line bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-mit-serif text-2xl font-semibold text-mit-text">
              {submission.name}
            </h2>
            <p className="mt-1 text-sm text-mit-text">{submission.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge
              label={statusLabel(submission.status, t)}
              value={submission.status}
            />
            <StatusBadge
              label={notificationLabel(submission.notificationStatus, t)}
              value={submission.notificationStatus}
            />
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-mit-line bg-mit-surface p-4">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-mit-text">
            {submission.message}
          </p>
        </div>
      </section>

      <section
        aria-labelledby="contact-workflow-heading"
        className="rounded-xl border border-mit-line bg-card p-6 shadow-sm"
      >
        <h2
          className="mb-4 font-mit-serif text-xl font-semibold text-mit-text"
          id="contact-workflow-heading"
        >
          {t('workflow_heading')}
        </h2>
        <StatusActions locale={locale} submission={submission} t={t} />
      </section>

      <section
        aria-labelledby="contact-delivery-heading"
        className="rounded-xl border border-mit-line bg-card p-6 shadow-sm"
      >
        <h2
          className="mb-4 font-mit-serif text-xl font-semibold text-mit-text"
          id="contact-delivery-heading"
        >
          {t('delivery_heading')}
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailRow label={t('field_notification_status')}>
            {notificationLabel(submission.notificationStatus, t)}
          </DetailRow>
          <DetailRow label={t('field_attempts')}>
            {submission.notificationAttemptCount}
          </DetailRow>
          <DetailRow label={t('field_notified_at')}>
            {formatDate(submission.notifiedAt, locale, t('field_empty'))}
          </DetailRow>
          <DetailRow label={t('field_error')}>
            {submission.notificationError ?? t('field_empty')}
          </DetailRow>
        </dl>
        <form action={retryAction} className="mt-5">
          <Button type="submit" variant="outline">
            {t('action_retry')}
          </Button>
        </form>
      </section>

      <section
        aria-labelledby="contact-metadata-heading"
        className="rounded-xl border border-mit-line bg-card p-6 shadow-sm"
      >
        <h2
          className="mb-4 font-mit-serif text-xl font-semibold text-mit-text"
          id="contact-metadata-heading"
        >
          {t('metadata_heading')}
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailRow label={t('field_received')}>
            {formatDate(submission.createdAt, locale, t('field_empty'))}
          </DetailRow>
          <DetailRow label={t('field_updated')}>
            {formatDate(submission.updatedAt, locale, t('field_empty'))}
          </DetailRow>
          <DetailRow label={t('field_signed_in_user')}>
            {submission.submittedBy
              ? `${submission.submittedBy.name} (${submission.submittedBy.email})`
              : t('field_empty')}
          </DetailRow>
          <DetailRow label={t('field_ip')}>
            {submission.ipAddress ?? t('field_empty')}
          </DetailRow>
          <DetailRow label={t('field_user_agent')}>
            {submission.userAgent ?? t('field_empty')}
          </DetailRow>
        </dl>
      </section>

      <section
        aria-labelledby="contact-delete-heading"
        className="rounded-xl border border-destructive/30 bg-card p-6 shadow-sm"
      >
        <h2
          className="font-mit-serif text-xl font-semibold text-mit-text"
          id="contact-delete-heading"
        >
          {t('delete_heading')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-mit-text">
          {t('delete_intro')}
        </p>
        <form action={deleteAction} className="mt-4 flex flex-col gap-4">
          <div className="flex items-start gap-2">
            <input
              className="mt-1"
              id="confirm-delete-contact-submission"
              name="confirm"
              required
              type="checkbox"
              value="delete-contact-submission"
            />
            <Label
              className="leading-relaxed text-mit-text"
              htmlFor="confirm-delete-contact-submission"
            >
              {t('delete_confirm')}
            </Label>
          </div>
          <Button className="w-fit" type="submit" variant="destructive">
            {t('delete_submit')}
          </Button>
        </form>
      </section>
    </div>
  );
}
