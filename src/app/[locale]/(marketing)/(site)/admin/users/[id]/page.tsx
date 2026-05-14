import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { AdminPrimaryActionLink } from '@/components/mit-sailing/admin/AdminPrimaryActionLink';
import { AdminUserRatingsPanel } from '@/components/mit-sailing/admin/users/AdminUserRatingsPanel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminUsersEditPath } from '@/libs/admin/users/adminUserPaths';
import { usersAdminHandlers } from '@/libs/admin/users/usersAdminHandlers';
import { requireAdmin } from '@/libs/auth/dal';
import { getAdminUserEmailMessages } from '@/libs/email/emailMessages';
import type { AdminUserEmailMessageRow } from '@/libs/email/emailMessages';
import { logger } from '@/libs/Logger';
import { listUserRatingAssignmentRows } from '@/libs/mit-sailing/sailingRatingQueries';
import type { UserRatingAssignmentRow } from '@/libs/mit-sailing/sailingRatingQueries';

type EmailDeliverabilityStatus = 'ok' | 'bounced' | 'suppressed';

type AdminUserShowPageProps = {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
};

function emailDeliverabilityStatus(value: unknown): EmailDeliverabilityStatus {
  return value === 'bounced' || value === 'suppressed' ? value : 'ok';
}

const emailStatusMessageKeys = {
  bounced: 'email_status_bounced',
  ok: 'email_status_ok',
  suppressed: 'email_status_suppressed',
} as const satisfies Record<EmailDeliverabilityStatus, string>;

function formatDate(value: Date | null): string {
  if (!value) {
    return '';
  }
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/New_York',
  }).format(value);
}

function emailEventMessageKey(eventType: string | null) {
  if (eventType === 'email.bounced') {
    return 'email_event_bounced';
  }
  if (eventType === 'email.complained') {
    return 'email_event_complained';
  }
  if (eventType === 'email.delivered') {
    return 'email_event_delivered';
  }
  if (eventType === 'email.delivery_delayed') {
    return 'email_event_delivery_delayed';
  }
  if (eventType === 'email.failed') {
    return 'email_event_failed';
  }
  if (eventType === 'email.sent') {
    return 'email_event_sent';
  }
  if (eventType === 'email.suppressed') {
    return 'email_event_suppressed';
  }
  return 'email_event_unknown';
}

function emailCategoryMessageKey(category: string) {
  if (category === 'account_locked') {
    return 'email_category_account_locked';
  }
  if (category === 'contact') {
    return 'email_category_contact';
  }
  if (category === 'delete_account') {
    return 'email_category_delete_account';
  }
  if (category === 'email_change') {
    return 'email_category_email_change';
  }
  if (category === 'newsletter') {
    return 'email_category_newsletter';
  }
  if (category === 'newsletter_test') {
    return 'email_category_newsletter_test';
  }
  if (category === 'password_changed') {
    return 'email_category_password_changed';
  }
  if (category === 'password_reset') {
    return 'email_category_password_reset';
  }
  if (category === 'sign_in_otp') {
    return 'email_category_sign_in_otp';
  }
  if (category === 'verify_email') {
    return 'email_category_verify_email';
  }
  return 'email_category_other';
}

function AdminUserEmailsPanel(props: {
  emails: AdminUserEmailMessageRow[];
  loadFailed: boolean;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{props.t('emails_heading')}</h2>
      {props.loadFailed ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
          role="status"
        >
          {props.t('emails_load_failed')}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{props.t('email_column_subject')}</TableHead>
              <TableHead>{props.t('email_column_to')}</TableHead>
              <TableHead>{props.t('email_column_category')}</TableHead>
              <TableHead>{props.t('email_column_status')}</TableHead>
              <TableHead>{props.t('email_column_sent')}</TableHead>
              <TableHead>{props.t('email_column_error')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.emails.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>{props.t('emails_empty')}</TableCell>
              </TableRow>
            ) : (
              props.emails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell className="font-medium">{email.subject}</TableCell>
                  <TableCell>{email.toEmail}</TableCell>
                  <TableCell>
                    {props.t(emailCategoryMessageKey(email.category))}
                  </TableCell>
                  <TableCell>
                    {props.t(emailEventMessageKey(email.lastEventType))}
                  </TableCell>
                  <TableCell>
                    {formatDate(email.sentAt ?? email.createdAt)}
                  </TableCell>
                  <TableCell>
                    {email.lastError ?? props.t('empty_value')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

export async function generateMetadata(
  props: AdminUserShowPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'MitSailingRoutes' });
  return { title: t('meta_title_admin_users_show') };
}

export default async function AdminUserShowPage(props: AdminUserShowPageProps) {
  const { locale, id } = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(locale);
  await requireAdmin(locale);

  const user = await usersAdminHandlers.getById(id);
  if (!user) {
    notFound();
  }
  const userEmail = typeof user.email === 'string' ? user.email : '';
  let rows: UserRatingAssignmentRow[] = [];
  let ratingsLoadError = false;
  let emailMessages: AdminUserEmailMessageRow[] = [];
  let emailMessagesLoadError = false;
  try {
    rows = await listUserRatingAssignmentRows(id);
  } catch (error) {
    ratingsLoadError = true;
    logger.error('Failed to load admin user rating rows: {error}', {
      error,
      userId: id,
    });
  }
  try {
    emailMessages = await getAdminUserEmailMessages({
      email: userEmail,
      userId: id,
    });
  } catch (error) {
    emailMessagesLoadError = true;
    logger.error('Failed to load admin user email message rows: {error}', {
      error,
      userId: id,
    });
  }
  const t = await getTranslations({ locale, namespace: 'AdminUsers' });
  const emailStatus = emailDeliverabilityStatus(user.emailDeliverabilityStatus);
  const emailStatusReason =
    typeof user.emailSuppressionReason === 'string'
      ? user.emailSuppressionReason
      : emailStatus;
  const hasEmailDeliverabilityWarning = emailStatus !== 'ok';

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <AdminPageHeader
        actions={
          <AdminPrimaryActionLink href={adminUsersEditPath(id)}>
            {t('action_edit')}
          </AdminPrimaryActionLink>
        }
        title={user.name}
      />
      <div className="rounded-lg border border-border bg-card p-5 text-sm text-foreground">
        <dl className="m-0 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="font-semibold">{t('column_email')}</dt>
            <dd className="m-0">{userEmail}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t('column_role')}</dt>
            <dd className="m-0">{user.role}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t('column_email_verified')}</dt>
            <dd className="m-0">
              {user.emailVerified ? t('boolean_yes') : t('boolean_no')}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">{t('column_email_status')}</dt>
            <dd className="m-0">{t(emailStatusMessageKeys[emailStatus])}</dd>
          </div>
        </dl>
      </div>
      {hasEmailDeliverabilityWarning ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
          role="status"
        >
          <p className="font-semibold">{t('email_status_warning_title')}</p>
          <p className="mt-1">
            {t('email_status_warning_body', {
              reason: emailStatusReason,
            })}
          </p>
        </div>
      ) : null}
      <AdminUserRatingsPanel
        errorCode={searchParams.error}
        locale={locale}
        ratingsLoadFailed={ratingsLoadError}
        rows={rows}
        userId={id}
      />
      <AdminUserEmailsPanel
        emails={emailMessages}
        loadFailed={emailMessagesLoadError}
        t={t}
      />
    </div>
  );
}
