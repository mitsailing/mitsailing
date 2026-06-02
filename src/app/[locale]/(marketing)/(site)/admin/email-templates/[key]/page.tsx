import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { AdminEmailTemplateEditor } from '@/components/mit-sailing/admin/email-templates/AdminEmailTemplateEditor';
import { Button } from '@/components/ui/button';
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

type EmailTemplateDetail = NonNullable<
  Awaited<ReturnType<typeof getAdminEmailTemplateDetail>>
>;

type EmailTemplateRevision = EmailTemplateDetail['revisions'][number];

type RevisionHistoryText = Readonly<{
  createdAt: string;
  createdBy: string;
  empty: string;
  publishedAt: string;
  publishedBy: string;
  statuses: Readonly<Record<keyof typeof REVISION_STATUS_KEYS, string>>;
  title: string;
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

function RevisionHistory(
  props: Readonly<{
    locale: string;
    revisions: readonly EmailTemplateRevision[];
    text: RevisionHistoryText;
  }>
) {
  if (props.revisions.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{props.text.title}</h2>
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          {props.text.empty}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{props.text.title}</h2>
      <ol className="flex flex-col gap-3">
        {props.revisions.map((revision) => (
          <li
            className="rounded-lg border border-border bg-card p-4"
            key={revision.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{revision.subject}</p>
                <p className="text-sm text-muted-foreground">
                  {props.text.statuses[revision.status]}
                </p>
              </div>
              <dl className="grid gap-x-4 gap-y-1 text-sm md:grid-cols-[auto_1fr]">
                <dt className="text-muted-foreground">
                  {props.text.createdAt}
                </dt>
                <dd>{formatAdminDate(revision.createdAt, props.locale)}</dd>
                <dt className="text-muted-foreground">
                  {props.text.createdBy}
                </dt>
                <dd>{actorName(revision.createdBy ?? null)}</dd>
                <dt className="text-muted-foreground">
                  {props.text.publishedAt}
                </dt>
                <dd>
                  {formatAdminDate(revision.publishedAt, props.locale) || ''}
                </dd>
                <dt className="text-muted-foreground">
                  {props.text.publishedBy}
                </dt>
                <dd>{actorName(revision.publishedBy ?? null)}</dd>
              </dl>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
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

      <RevisionHistory
        locale={locale}
        revisions={detail.revisions}
        text={{
          createdAt: t('column_created_at'),
          createdBy: t('column_created_by'),
          empty: t('revisions_empty'),
          publishedAt: t('column_published_at'),
          publishedBy: t('column_published_by'),
          statuses: {
            archived: t('revision_status_archived'),
            draft: t('revision_status_draft'),
            published: t('revision_status_published'),
          },
          title: t('revisions_title'),
        }}
      />
    </div>
  );
}
