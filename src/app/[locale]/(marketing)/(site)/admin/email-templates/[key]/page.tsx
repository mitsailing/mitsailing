import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { AdminEmailTemplateEditor } from '@/components/mit-sailing/admin/email-templates/AdminEmailTemplateEditor';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatAdminDate } from '@/libs/admin/adminDateFormatting';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import {
  publishEmailTemplateRevisionAction,
  saveEmailTemplateDraftAction,
  sendEmailTemplateTestAction,
} from '@/libs/email-templates/emailTemplateAdminActions';
import { getAdminEmailTemplateDetail } from '@/libs/email-templates/emailTemplateAdminQueries';
import { Link } from '@/libs/I18nNavigation';

type PageProps = Readonly<{
  params: Promise<{ key: string; locale: string }>;
  searchParams: Promise<{ status?: string }>;
}>;

const STATUS_MESSAGE_KEYS = {
  draft_saved: 'status_draft_saved',
  invalid_test_email: 'status_invalid_test_email',
  published: 'status_published',
  render_failed: 'status_render_failed',
  test_failed: 'status_test_failed',
  test_sent: 'status_test_sent',
  validation_failed: 'status_validation_failed',
} as const;

const REVISION_STATUS_KEYS = {
  archived: 'revision_status_archived',
  draft: 'revision_status_draft',
  published: 'revision_status_published',
} as const;

function isStatusMessage(
  status: string
): status is keyof typeof STATUS_MESSAGE_KEYS {
  return Object.hasOwn(STATUS_MESSAGE_KEYS, status);
}

function statusMessageKey(status: string) {
  return isStatusMessage(status) ? STATUS_MESSAGE_KEYS[status] : null;
}

function actorName(
  actor: { email: string | null; name: string | null } | null
) {
  return actor?.name ?? actor?.email ?? '';
}

function revisionStatusKey(status: keyof typeof REVISION_STATUS_KEYS) {
  return REVISION_STATUS_KEYS[status];
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'AdminEmailTemplates',
  });
  return { title: t('detail_meta_title') };
}

export default async function AdminEmailTemplateDetailPage(props: PageProps) {
  await connection();
  const { key, locale } = await props.params;
  const { status = '' } = await props.searchParams;
  setRequestLocale(locale);
  const session = await requirePermission(Permission.NEWSLETTER_MANAGE, locale);
  const t = await getTranslations({ locale, namespace: 'AdminEmailTemplates' });
  const detail = await getAdminEmailTemplateDetail(key);
  if (!detail) {
    notFound();
  }

  const notificationKey = statusMessageKey(status);
  const { activeRevision } = detail;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <AdminPageHeader
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/email-templates">{t('back_to_list')}</Link>
          </Button>
        }
        title={detail.name}
      />

      {notificationKey ? (
        <output className="rounded-lg border border-border bg-card p-3 text-sm text-foreground">
          {t(notificationKey)}
        </output>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,32rem)]">
        <div className="rounded-lg border border-border bg-card p-5">
          {activeRevision ? (
            <AdminEmailTemplateEditor
              content={activeRevision.editorBodyHtml}
              previewText={activeRevision.previewText}
              saveAction={saveEmailTemplateDraftAction.bind(
                null,
                locale,
                detail.key
              )}
              sendTestAction={sendEmailTemplateTestAction.bind(
                null,
                locale,
                detail.key
              )}
              subject={activeRevision.subject}
              templateKey={detail.key}
              testEmail={session.user.email ?? ''}
              text={{
                bodyLabel: t('field_body'),
                previewTextLabel: t('field_preview_text'),
                saveDraft: t('save_draft'),
                sendTest: t('send_test'),
                subjectLabel: t('field_subject'),
                testEmailLabel: t('field_test_email'),
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t('no_revision')}</p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{t('preview_title')}</h2>
              {activeRevision ? (
                <form
                  action={publishEmailTemplateRevisionAction.bind(
                    null,
                    locale,
                    detail.key,
                    activeRevision.id
                  )}
                >
                  <Button type="submit" variant="mit">
                    {t('publish')}
                  </Button>
                </form>
              ) : null}
            </div>
            {detail.previewError ? (
              <p className="rounded-lg border border-border bg-card p-3 text-sm text-foreground">
                {t('preview_error')}
              </p>
            ) : (
              <iframe
                className="h-[620px] w-full rounded-lg border border-border bg-white"
                sandbox=""
                srcDoc={detail.previewHtml ?? ''}
                title={t('preview_iframe_title')}
              />
            )}
          </section>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t('revisions_title')}</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('column_status')}</TableHead>
                <TableHead>{t('column_subject')}</TableHead>
                <TableHead>{t('column_created_at')}</TableHead>
                <TableHead>{t('column_created_by')}</TableHead>
                <TableHead>{t('column_published_at')}</TableHead>
                <TableHead>{t('column_published_by')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.revisions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>{t('revisions_empty')}</TableCell>
                </TableRow>
              ) : (
                detail.revisions.map((revision) => (
                  <TableRow key={revision.id}>
                    <TableCell>
                      {t(revisionStatusKey(revision.status))}
                    </TableCell>
                    <TableCell>{revision.subject}</TableCell>
                    <TableCell>
                      {formatAdminDate(revision.createdAt, locale)}
                    </TableCell>
                    <TableCell>
                      {actorName(revision.createdBy ?? null)}
                    </TableCell>
                    <TableCell>
                      {formatAdminDate(revision.publishedAt, locale) || ''}
                    </TableCell>
                    <TableCell>
                      {actorName(revision.publishedBy ?? null)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
