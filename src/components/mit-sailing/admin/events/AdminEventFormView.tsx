import {
  ArrowLeft,
  CreditCard,
  ExternalLink,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import type * as React from 'react';
import { AdminErrorAlert } from '@/components/mit-sailing/admin/AdminErrorAlert';
import {
  adminEventFormErrorMessage,
  AdminEventBackLink,
  AdminEventCheckbox,
  AdminEventEmptyState,
  AdminEventField,
  AdminEventFormSection,
  AdminEventReadOnlyNotice,
} from '@/components/mit-sailing/admin/events/AdminEventShared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { Textarea } from '@/components/ui/textarea';
import { EventAnswerType, EventDetailPageKind } from '@/generated/prisma/enums';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import {
  addAdminEventDateAction,
  addAdminEventFeeAction,
  addAdminEventQuestionAction,
  updateAdminEventAdminsAction,
  updateAdminEventBasicsAction,
  updateAdminEventDateAction,
  updateAdminEventFeeAction,
  updateAdminEventQuestionAction,
  deleteAdminEventDateAction,
  deleteAdminEventFeeAction,
  deleteAdminEventQuestionAction,
} from '@/libs/admin/events/eventAdminActions';
import { adminEventsIndexPath } from '@/libs/admin/events/eventAdminPaths';
import type {
  AdminEventCategoryOption,
  AdminEventDateDto,
  AdminEventEditorDto,
  AdminEventFeeDto,
  AdminEventQuestionDto,
  AdminEventUserOption,
} from '@/libs/admin/events/eventAdminQueries';
import {
  eventAdminCentsToDollars,
  formatEasternDateTimeLocal,
} from '@/libs/admin/events/eventAdminSchemas';
import type { AdminEventAccessMode } from '@/libs/admin/events/zenstackEventAccess';
import { Link } from '@/libs/I18nNavigation';
import { formatEasternDateTime } from '@/libs/mit-sailing/easternTimeFormat';

type AdminEventFormTranslations = Awaited<
  ReturnType<typeof getTranslations<'AdminEvents'>>
>;

type AdminEventCommonTranslations = Awaited<
  ReturnType<typeof getTranslations<'Common'>>
>;

type AdminEventFormViewProps = {
  accessMode: AdminEventAccessMode;
  event: AdminEventEditorDto;
  categories: AdminEventCategoryOption[];
  users: AdminEventUserOption[];
  errorCode: string | null;
  locale: string;
  t: AdminEventFormTranslations;
  tCommon: AdminEventCommonTranslations;
};

function userInitials(user: AdminEventUserOption): string {
  const words = user.name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? user.email[0] ?? '?';
  const second = words[1]?.[0] ?? '';
  return `${first}${second}`.toUpperCase();
}

function eventAdminPublicHref(slug: string): string {
  return `/events/${encodeURIComponent(slug)}`;
}

function AdminEventErrorAlert(props: {
  code: string | null;
  t: AdminEventFormTranslations;
}) {
  const message = adminEventFormErrorMessage(props.code, props.t);
  if (!message) {
    return null;
  }
  return <AdminErrorAlert>{message}</AdminErrorAlert>;
}

function EventBasicsForm(props: AdminEventFormViewProps) {
  const updateAction = updateAdminEventBasicsAction.bind(
    null,
    props.locale,
    props.event.slug
  );
  const detailPageKind =
    props.event.detailPageKind ?? EventDetailPageKind.standard;

  return (
    <form action={updateAction} className="flex flex-col gap-5">
      <AdminEventFormSection
        id="event-basics"
        subtitle={props.t('basics_subtitle')}
        title={props.t('section_basics')}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <AdminEventField htmlFor="event-name" label={props.t('field_name')}>
            <Input
              defaultValue={props.event.name}
              id="event-name"
              name="name"
              required
            />
          </AdminEventField>
          <AdminEventField
            htmlFor="event-short-name"
            hint={props.t('field_short_name_hint')}
            label={props.t('field_short_name')}
          >
            {(controlProps) => (
              <Input
                defaultValue={props.event.shortName}
                id="event-short-name"
                name="shortName"
                {...controlProps}
              />
            )}
          </AdminEventField>
          <AdminEventField
            htmlFor="event-slug"
            hint={props.t('field_slug_hint', { slug: props.event.slug })}
            label={props.t('field_slug')}
          >
            {(controlProps) => (
              <Input
                defaultValue={props.event.slug}
                id="event-slug"
                name="slug"
                required
                {...controlProps}
              />
            )}
          </AdminEventField>
          <AdminEventField
            htmlFor="event-category"
            label={props.t('field_category')}
          >
            <select
              className={adminNativeSelectClassName}
              defaultValue={props.event.eventCategoryId}
              id="event-category"
              name="eventCategoryId"
              required
            >
              {props.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </AdminEventField>
        </div>

        <AdminEventField
          htmlFor="event-description"
          hint={props.t('field_description_hint')}
          label={props.t('field_description')}
        >
          {(controlProps) => (
            <Textarea
              className="min-h-28"
              defaultValue={props.event.description}
              id="event-description"
              name="description"
              {...controlProps}
            />
          )}
        </AdminEventField>

        <div className="grid gap-4 md:grid-cols-2">
          <AdminEventCheckbox
            defaultChecked={props.event.isPublished}
            hint={props.t('field_published_hint')}
            label={props.t('field_published')}
            name="isPublished"
          />
          <AdminEventCheckbox
            defaultChecked={props.event.isSpecial}
            hint={props.t('field_special_hint')}
            label={props.t('field_special')}
            name="isSpecial"
          />
          <AdminEventCheckbox
            defaultChecked={props.event.requiresApproval}
            label={props.t('field_requires_approval')}
            name="requiresApproval"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <AdminEventField
            htmlFor="event-registration-start"
            hint={props.t('field_datetime_et_hint')}
            label={props.t('field_registration_start')}
          >
            {(controlProps) => (
              <Input
                defaultValue={formatEasternDateTimeLocal(
                  props.event.registrationStart
                )}
                id="event-registration-start"
                name="registrationStart"
                type="datetime-local"
                {...controlProps}
              />
            )}
          </AdminEventField>
          <AdminEventField
            htmlFor="event-registration-end"
            hint={props.t('field_datetime_et_hint')}
            label={props.t('field_registration_end')}
          >
            {(controlProps) => (
              <Input
                defaultValue={formatEasternDateTimeLocal(
                  props.event.registrationEnd
                )}
                id="event-registration-end"
                name="registrationEnd"
                type="datetime-local"
                {...controlProps}
              />
            )}
          </AdminEventField>
          <AdminEventField
            htmlFor="event-max-participants"
            hint={props.t('field_max_participants_hint')}
            label={props.t('field_max_participants')}
          >
            {(controlProps) => (
              <Input
                defaultValue={props.event.maxParticipants ?? ''}
                id="event-max-participants"
                min={1}
                name="maxParticipants"
                step={1}
                type="number"
                {...controlProps}
              />
            )}
          </AdminEventField>
        </div>

        <AdminEventField
          htmlFor="event-internal-notes"
          hint={props.t('field_internal_notes_hint')}
          label={props.t('field_internal_notes')}
        >
          {(controlProps) => (
            <Textarea
              className="min-h-24"
              defaultValue={props.event.internalNotes ?? ''}
              id="event-internal-notes"
              name="internalNotes"
              {...controlProps}
            />
          )}
        </AdminEventField>
      </AdminEventFormSection>

      <AdminEventFormSection
        id="event-public-page"
        subtitle={props.t('public_page_subtitle')}
        title={props.t('section_public_page')}
      >
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">
            {props.t('field_detail_page_kind')}
          </legend>
          <label
            aria-labelledby="event-detail-page-kind-standard-label"
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            htmlFor="event-detail-page-kind-standard"
          >
            <input
              className="mt-0.5"
              defaultChecked={detailPageKind === EventDetailPageKind.standard}
              id="event-detail-page-kind-standard"
              name="detailPageKind"
              type="radio"
              value={EventDetailPageKind.standard}
            />
            <span className="flex flex-col gap-0.5">
              <span
                className="font-medium"
                id="event-detail-page-kind-standard-label"
              >
                {props.t('detail_standard_label')}
              </span>
              <span className="text-xs text-mit-readable-ink">
                {props.t('detail_standard_hint', {
                  slug: props.event.slug,
                })}
              </span>
            </span>
          </label>
          <label
            aria-labelledby="event-detail-page-kind-external-label"
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            htmlFor="event-detail-page-kind-external"
          >
            <input
              className="mt-0.5"
              defaultChecked={detailPageKind === EventDetailPageKind.external}
              id="event-detail-page-kind-external"
              name="detailPageKind"
              type="radio"
              value={EventDetailPageKind.external}
            />
            <span className="flex flex-col gap-0.5">
              <span
                className="font-medium"
                id="event-detail-page-kind-external-label"
              >
                {props.t('detail_external_label')}
              </span>
              <span className="text-xs text-mit-readable-ink">
                {props.t('detail_external_hint')}
              </span>
            </span>
          </label>
        </fieldset>
        <AdminEventField
          htmlFor="event-external-url"
          label={props.t('field_external_detail_url')}
        >
          <Input
            defaultValue={props.event.externalDetailUrl ?? ''}
            id="event-external-url"
            name="externalDetailUrl"
            placeholder={props.t('field_external_detail_url_placeholder')}
            type="url"
          />
        </AdminEventField>
      </AdminEventFormSection>

      <div className="flex justify-end">
        <SubmitButton
          pendingLabel={props.tCommon('pending_saving')}
          variant="mit"
        >
          <Save aria-hidden className="size-4" />
          {props.t('action_save_event')}
        </SubmitButton>
      </div>
    </form>
  );
}

function EventMetadataSection(props: {
  event: AdminEventEditorDto;
  t: AdminEventFormTranslations;
}) {
  return (
    <AdminEventFormSection
      id="event-metadata"
      subtitle={props.t('metadata_subtitle')}
      title={props.t('section_metadata')}
    >
      <dl className="grid gap-4 md:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold text-mit-readable-ink uppercase">
            {props.t('metadata_created_at')}
          </dt>
          <dd className="mt-1 text-sm font-medium">
            {formatEasternDateTime(props.event.createdAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-mit-readable-ink uppercase">
            {props.t('metadata_registrations')}
          </dt>
          <dd className="mt-1 text-sm font-medium">
            {props.t('metadata_registration_counts', {
              approved: props.event.registrationCounts.approved,
              pending: props.event.registrationCounts.pending,
              cancelled: props.event.registrationCounts.cancelled,
            })}
          </dd>
        </div>
      </dl>
    </AdminEventFormSection>
  );
}

function ReadOnlyValue(props: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold text-mit-readable-ink uppercase">
        {props.label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{props.children}</dd>
    </div>
  );
}

function readOnlyTextValue(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  if (trimmed) {
    return trimmed;
  }
  return fallback;
}

function readOnlyQuestionTypeLabel(props: {
  question: AdminEventQuestionDto;
  t: AdminEventFormTranslations;
}): string {
  if (props.question.answerType === EventAnswerType.select) {
    return props.t('question_type_select');
  }
  if (props.question.answerType === EventAnswerType.checkbox) {
    return props.t('question_type_checkbox');
  }
  return props.t('question_type_text');
}

function ReadOnlyBasicsSection(props: AdminEventFormViewProps) {
  const category = props.categories.find(
    (option) => option.id === props.event.eventCategoryId
  );
  const detailPageKind =
    props.event.detailPageKind ?? EventDetailPageKind.standard;
  return (
    <>
      <AdminEventFormSection
        id="event-basics"
        subtitle={props.t('basics_subtitle')}
        title={props.t('section_basics')}
      >
        <dl className="grid gap-4 md:grid-cols-2">
          <ReadOnlyValue label={props.t('field_name')}>
            {props.event.name}
          </ReadOnlyValue>
          <ReadOnlyValue label={props.t('field_short_name')}>
            {readOnlyTextValue(props.event.shortName, props.t('empty_value'))}
          </ReadOnlyValue>
          <ReadOnlyValue label={props.t('field_slug')}>
            {props.event.slug}
          </ReadOnlyValue>
          <ReadOnlyValue label={props.t('field_category')}>
            {category?.name ?? props.t('empty_value')}
          </ReadOnlyValue>
          <ReadOnlyValue label={props.t('field_description')}>
            {readOnlyTextValue(props.event.description, props.t('empty_value'))}
          </ReadOnlyValue>
          <ReadOnlyValue label={props.t('field_max_participants')}>
            {props.event.maxParticipants ?? props.t('empty_value')}
          </ReadOnlyValue>
        </dl>
      </AdminEventFormSection>

      <AdminEventFormSection
        id="event-public-page"
        subtitle={props.t('public_page_subtitle')}
        title={props.t('section_public_page')}
      >
        <dl className="grid gap-4 md:grid-cols-2">
          <ReadOnlyValue label={props.t('field_detail_page_kind')}>
            {detailPageKind === EventDetailPageKind.external
              ? props.t('detail_external_label')
              : props.t('detail_standard_label')}
          </ReadOnlyValue>
          <ReadOnlyValue label={props.t('field_external_detail_url')}>
            {readOnlyTextValue(
              props.event.externalDetailUrl,
              props.t('empty_value')
            )}
          </ReadOnlyValue>
        </dl>
      </AdminEventFormSection>
    </>
  );
}

function ReadOnlyDatesSection(props: AdminEventFormViewProps) {
  return (
    <AdminEventFormSection
      id="event-dates"
      subtitle={props.t('dates_subtitle')}
      title={props.t('section_dates')}
    >
      {props.event.dates.length === 0 ? (
        <AdminEventEmptyState>{props.t('dates_empty')}</AdminEventEmptyState>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {props.event.dates.map((date) => (
            <li
              className="grid gap-3 rounded-lg border border-border bg-background p-3 md:grid-cols-2"
              key={date.id}
            >
              <ReadOnlyValue label={props.t('field_date_start')}>
                {formatEasternDateTime(date.startDateTime)}
              </ReadOnlyValue>
              <ReadOnlyValue label={props.t('field_date_end')}>
                {formatEasternDateTime(date.endDateTime)}
              </ReadOnlyValue>
            </li>
          ))}
        </ol>
      )}
    </AdminEventFormSection>
  );
}

function ReadOnlyAdminsSection(props: AdminEventFormViewProps) {
  return (
    <AdminEventFormSection
      id="event-admins"
      subtitle={props.t('admins_subtitle')}
      title={props.t('section_admins')}
    >
      {props.event.admins.length === 0 ? (
        <AdminEventEmptyState>{props.t('empty_value')}</AdminEventEmptyState>
      ) : (
        <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
          {props.event.admins.map((admin) => (
            <li
              className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              key={admin.id}
            >
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-mit-readable-ink">
                {userInitials(admin.admin)}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{admin.admin.name}</span>
                <span className="truncate text-xs text-mit-readable-ink">
                  {admin.admin.email}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </AdminEventFormSection>
  );
}

function ReadOnlyQuestionsSection(props: AdminEventFormViewProps) {
  return (
    <AdminEventFormSection
      id="event-questions"
      subtitle={props.t('questions_subtitle')}
      title={props.t('section_questions')}
    >
      {props.event.registrationQuestions.length === 0 ? (
        <AdminEventEmptyState>
          {props.t('questions_empty')}
        </AdminEventEmptyState>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {props.event.registrationQuestions.map((question) => (
            <li
              className="rounded-lg border border-border bg-background p-3"
              key={question.id}
            >
              <p className="font-medium text-foreground">
                {question.questionText}
              </p>
              <p className="mt-1 text-sm text-mit-readable-ink">
                {readOnlyQuestionTypeLabel({ question, t: props.t })}
              </p>
            </li>
          ))}
        </ol>
      )}
    </AdminEventFormSection>
  );
}

function ReadOnlyFeesSection(props: AdminEventFormViewProps) {
  return (
    <AdminEventFormSection
      id="event-fees"
      subtitle={props.t('fees_subtitle')}
      title={props.t('section_fees')}
    >
      {props.event.entryFees.length === 0 ? (
        <AdminEventEmptyState>{props.t('fees_empty')}</AdminEventEmptyState>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {props.event.entryFees.map((fee) => (
            <li
              className="grid gap-3 rounded-lg border border-border bg-background p-3 md:grid-cols-[1fr_auto]"
              key={fee.id}
            >
              <ReadOnlyValue label={props.t('field_fee_description')}>
                {fee.description}
              </ReadOnlyValue>
              <ReadOnlyValue label={props.t('field_fee_amount')}>
                {eventAdminCentsToDollars(fee.amountCents)}
              </ReadOnlyValue>
            </li>
          ))}
        </ol>
      )}
    </AdminEventFormSection>
  );
}

function DateRow(props: {
  date: AdminEventDateDto;
  event: AdminEventEditorDto;
  locale: string;
  t: AdminEventFormTranslations;
  tCommon: AdminEventCommonTranslations;
}) {
  const updateAction = updateAdminEventDateAction.bind(
    null,
    props.locale,
    props.event.slug,
    props.date.id
  );
  const deleteAction = deleteAdminEventDateAction.bind(
    null,
    props.locale,
    props.event.slug,
    props.date.id
  );
  return (
    <li className="grid gap-3 rounded-lg border border-border bg-background p-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
      <form action={updateAction} className="contents">
        <AdminEventField
          htmlFor={`date-start-${props.date.id}`}
          hint={props.t('field_datetime_et_hint')}
          label={props.t('field_date_start')}
        >
          {(controlProps) => (
            <Input
              defaultValue={formatEasternDateTimeLocal(
                props.date.startDateTime
              )}
              id={`date-start-${props.date.id}`}
              name="startDateTime"
              required
              type="datetime-local"
              {...controlProps}
            />
          )}
        </AdminEventField>
        <AdminEventField
          htmlFor={`date-end-${props.date.id}`}
          hint={props.t('field_datetime_et_hint')}
          label={props.t('field_date_end')}
        >
          {(controlProps) => (
            <Input
              defaultValue={formatEasternDateTimeLocal(props.date.endDateTime)}
              id={`date-end-${props.date.id}`}
              name="endDateTime"
              required
              type="datetime-local"
              {...controlProps}
            />
          )}
        </AdminEventField>
        <SubmitButton
          pendingLabel={props.tCommon('pending_saving')}
          variant="outline"
        >
          {props.t('action_save')}
        </SubmitButton>
      </form>
      <form action={deleteAction}>
        <SubmitButton
          aria-label={props.t('action_delete_date')}
          pendingLabel={props.tCommon('pending_deleting')}
          variant="destructive"
        >
          <Trash2 aria-hidden className="size-4" />
        </SubmitButton>
      </form>
    </li>
  );
}

function EventDatesSection(props: AdminEventFormViewProps) {
  const addAction = addAdminEventDateAction.bind(
    null,
    props.locale,
    props.event.slug,
    props.event.id
  );
  return (
    <AdminEventFormSection
      id="event-dates"
      subtitle={props.t('dates_subtitle')}
      title={props.t('section_dates')}
    >
      {props.event.dates.length === 0 ? (
        <AdminEventEmptyState>{props.t('dates_empty')}</AdminEventEmptyState>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {props.event.dates.map((date) => (
            <DateRow
              date={date}
              event={props.event}
              key={date.id}
              locale={props.locale}
              t={props.t}
              tCommon={props.tCommon}
            />
          ))}
        </ol>
      )}
      <form
        action={addAction}
        className="grid gap-3 border-t border-dashed border-border pt-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
      >
        <AdminEventField
          htmlFor="new-date-start"
          hint={props.t('field_datetime_et_hint')}
          label={props.t('field_new_date_start')}
        >
          {(controlProps) => (
            <Input
              id="new-date-start"
              name="startDateTime"
              required
              type="datetime-local"
              {...controlProps}
            />
          )}
        </AdminEventField>
        <AdminEventField
          htmlFor="new-date-end"
          hint={props.t('field_datetime_et_hint')}
          label={props.t('field_new_date_end')}
        >
          {(controlProps) => (
            <Input
              id="new-date-end"
              name="endDateTime"
              required
              type="datetime-local"
              {...controlProps}
            />
          )}
        </AdminEventField>
        <SubmitButton
          pendingLabel={props.tCommon('pending_adding')}
          variant="mit"
        >
          <Plus aria-hidden className="size-4" />
          {props.t('action_add_date')}
        </SubmitButton>
      </form>
    </AdminEventFormSection>
  );
}

function EventAdminsSection(props: AdminEventFormViewProps) {
  const updateAction = updateAdminEventAdminsAction.bind(
    null,
    props.locale,
    props.event.slug,
    props.event.id
  );
  const selectedIds = new Set(
    props.event.admins.map((admin) => admin.adminUserId)
  );
  return (
    <AdminEventFormSection
      id="event-admins"
      subtitle={props.t('admins_subtitle')}
      title={props.t('section_admins')}
    >
      <form action={updateAction} className="flex flex-col gap-4">
        <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2 xl:grid-cols-3">
          {props.users.map((user) => {
            const selected = selectedIds.has(user.id);
            return (
              <li key={user.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors duration-200 has-checked:border-mit-red has-checked:bg-mit-red-highlight has-checked:text-mit-red dark:has-checked:border-white/40 dark:has-checked:bg-white/10 dark:has-checked:text-white">
                  <input
                    className="size-4 shrink-0 rounded border border-input text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                    defaultChecked={selected}
                    name="adminUserId"
                    type="checkbox"
                    value={user.id}
                  />
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-mit-readable-ink">
                    {userInitials(user)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-mit-readable-ink">
                      {user.email}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end">
          <SubmitButton
            pendingLabel={props.tCommon('pending_saving')}
            variant="outline"
          >
            {props.t('action_save_admins')}
          </SubmitButton>
        </div>
      </form>
    </AdminEventFormSection>
  );
}

function questionOptionsText(question: AdminEventQuestionDto): string {
  return question.options.join('\n');
}

function QuestionFields(props: {
  question?: AdminEventQuestionDto;
  suggestedDisplayOrder?: number;
  t: AdminEventFormTranslations;
}) {
  const prefix = props.question?.id ?? 'new';
  return (
    <>
      <div className="grid gap-3 md:grid-cols-[1fr_180px]">
        <AdminEventField
          htmlFor={`question-text-${prefix}`}
          label={props.t('field_question_text')}
        >
          <Input
            defaultValue={props.question?.questionText ?? ''}
            id={`question-text-${prefix}`}
            name="questionText"
            required
          />
        </AdminEventField>
        <AdminEventField
          htmlFor={`question-type-${prefix}`}
          label={props.t('field_answer_type')}
        >
          <select
            className={adminNativeSelectClassName}
            defaultValue={props.question?.answerType ?? EventAnswerType.text}
            id={`question-type-${prefix}`}
            name="answerType"
          >
            <option value={EventAnswerType.text}>
              {props.t('question_type_text')}
            </option>
            <option value={EventAnswerType.select}>
              {props.t('question_type_select')}
            </option>
            <option value={EventAnswerType.checkbox}>
              {props.t('question_type_checkbox')}
            </option>
          </select>
        </AdminEventField>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_120px_auto] md:items-end">
        <AdminEventField
          htmlFor={`question-options-${prefix}`}
          hint={props.t('field_question_options_hint')}
          label={props.t('field_question_options')}
        >
          {(controlProps) => (
            <Textarea
              className="min-h-24"
              defaultValue={
                props.question ? questionOptionsText(props.question) : ''
              }
              id={`question-options-${prefix}`}
              name="optionsText"
              {...controlProps}
            />
          )}
        </AdminEventField>
        <AdminEventField
          htmlFor={`question-order-${prefix}`}
          label={props.t('field_display_order')}
        >
          <Input
            defaultValue={props.question?.displayOrder ?? ''}
            id={`question-order-${prefix}`}
            min={0}
            name="displayOrder"
            step={1}
            placeholder={
              props.question === undefined &&
              props.suggestedDisplayOrder !== undefined
                ? String(props.suggestedDisplayOrder)
                : undefined
            }
            type="number"
          />
        </AdminEventField>
        <AdminEventCheckbox
          defaultChecked={props.question?.required ?? false}
          label={props.t('field_required')}
          name="required"
        />
      </div>
    </>
  );
}

function QuestionRow(props: {
  event: AdminEventEditorDto;
  locale: string;
  question: AdminEventQuestionDto;
  t: AdminEventFormTranslations;
  tCommon: AdminEventCommonTranslations;
}) {
  const updateAction = updateAdminEventQuestionAction.bind(
    null,
    props.locale,
    props.event.slug,
    props.question.id
  );
  const deleteAction = deleteAdminEventQuestionAction.bind(
    null,
    props.locale,
    props.event.slug,
    props.question.id
  );
  return (
    <li className="rounded-lg border border-border bg-background p-3">
      <form action={updateAction} className="flex flex-col gap-3">
        <QuestionFields question={props.question} t={props.t} />
        <div className="flex justify-end gap-2">
          <SubmitButton
            pendingLabel={props.tCommon('pending_saving')}
            variant="outline"
          >
            {props.t('action_save')}
          </SubmitButton>
        </div>
      </form>
      <form action={deleteAction} className="mt-2 flex justify-end">
        <SubmitButton
          pendingLabel={props.tCommon('pending_deleting')}
          variant="destructive"
        >
          <Trash2 aria-hidden className="size-4" />
          {props.t('action_delete_question')}
        </SubmitButton>
      </form>
    </li>
  );
}

function EventQuestionsSection(props: AdminEventFormViewProps) {
  const addAction = addAdminEventQuestionAction.bind(
    null,
    props.locale,
    props.event.slug,
    props.event.id
  );
  const maxQuestionOrder = Math.max(
    0,
    ...props.event.registrationQuestions.map(
      (question) => question.displayOrder
    )
  );
  const suggestedDisplayOrder = maxQuestionOrder + 1;
  return (
    <AdminEventFormSection
      id="event-questions"
      subtitle={props.t('questions_subtitle')}
      title={props.t('section_questions')}
    >
      {props.event.registrationQuestions.length === 0 ? (
        <AdminEventEmptyState>
          {props.t('questions_empty')}
        </AdminEventEmptyState>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {props.event.registrationQuestions.map((question) => (
            <QuestionRow
              event={props.event}
              key={question.id}
              locale={props.locale}
              question={question}
              t={props.t}
              tCommon={props.tCommon}
            />
          ))}
        </ol>
      )}
      <form
        action={addAction}
        className="flex flex-col gap-3 border-t border-dashed border-border pt-4"
      >
        <h3 className="text-sm font-semibold text-foreground">
          {props.t('add_question_heading')}
        </h3>
        <QuestionFields
          suggestedDisplayOrder={suggestedDisplayOrder}
          t={props.t}
        />
        <div className="flex justify-end">
          <SubmitButton
            pendingLabel={props.tCommon('pending_adding')}
            variant="mit"
          >
            <Plus aria-hidden className="size-4" />
            {props.t('action_add_question')}
          </SubmitButton>
        </div>
      </form>
    </AdminEventFormSection>
  );
}

function FeeFields(props: {
  fee?: AdminEventFeeDto;
  t: AdminEventFormTranslations;
}) {
  const prefix = props.fee?.id ?? 'new';
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">
      <AdminEventField
        htmlFor={`fee-description-${prefix}`}
        label={props.t('field_fee_description')}
      >
        <Input
          defaultValue={props.fee?.description ?? ''}
          id={`fee-description-${prefix}`}
          name="description"
          required
        />
      </AdminEventField>
      <AdminEventField
        htmlFor={`fee-amount-${prefix}`}
        label={props.t('field_fee_amount')}
      >
        <Input
          defaultValue={
            props.fee ? eventAdminCentsToDollars(props.fee.amountCents) : ''
          }
          id={`fee-amount-${prefix}`}
          inputMode="decimal"
          name="amountDollars"
          placeholder={props.t('field_fee_amount_placeholder')}
          required
        />
      </AdminEventField>
      <AdminEventCheckbox
        defaultChecked={props.fee?.isDeposit ?? false}
        label={props.t('field_fee_deposit')}
        name="isDeposit"
      />
    </div>
  );
}

function FeeRow(props: {
  event: AdminEventEditorDto;
  fee: AdminEventFeeDto;
  locale: string;
  t: AdminEventFormTranslations;
  tCommon: AdminEventCommonTranslations;
}) {
  const updateAction = updateAdminEventFeeAction.bind(
    null,
    props.locale,
    props.event.slug,
    props.fee.id
  );
  const deleteAction = deleteAdminEventFeeAction.bind(
    null,
    props.locale,
    props.event.slug,
    props.fee.id
  );
  return (
    <li className="rounded-lg border border-border bg-background p-3">
      <form action={updateAction} className="flex flex-col gap-3">
        <FeeFields fee={props.fee} t={props.t} />
        <div className="flex justify-end">
          <SubmitButton
            pendingLabel={props.tCommon('pending_saving')}
            variant="outline"
          >
            {props.t('action_save')}
          </SubmitButton>
        </div>
      </form>
      <form action={deleteAction} className="mt-2 flex justify-end">
        <SubmitButton
          pendingLabel={props.tCommon('pending_deleting')}
          variant="destructive"
        >
          <Trash2 aria-hidden className="size-4" />
          {props.t('action_delete_fee')}
        </SubmitButton>
      </form>
    </li>
  );
}

function EventFeesSection(props: AdminEventFormViewProps) {
  const addAction = addAdminEventFeeAction.bind(
    null,
    props.locale,
    props.event.slug,
    props.event.id
  );
  return (
    <AdminEventFormSection
      id="event-fees"
      subtitle={props.t('fees_subtitle')}
      title={props.t('section_fees')}
    >
      {props.event.entryFees.length === 0 ? (
        <AdminEventEmptyState>{props.t('fees_empty')}</AdminEventEmptyState>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {props.event.entryFees.map((fee) => (
            <FeeRow
              event={props.event}
              fee={fee}
              key={fee.id}
              locale={props.locale}
              t={props.t}
              tCommon={props.tCommon}
            />
          ))}
        </ol>
      )}
      <form
        action={addAction}
        className="flex flex-col gap-3 border-t border-dashed border-border pt-4"
      >
        <h3 className="text-sm font-semibold text-foreground">
          {props.t('add_fee_heading')}
        </h3>
        <FeeFields t={props.t} />
        <div className="flex justify-end">
          <SubmitButton
            pendingLabel={props.tCommon('pending_adding')}
            variant="mit"
          >
            <Plus aria-hidden className="size-4" />
            {props.t('action_add_fee')}
          </SubmitButton>
        </div>
      </form>
    </AdminEventFormSection>
  );
}

function StripePlaceholder(props: { t: AdminEventFormTranslations }) {
  return (
    <AdminEventFormSection
      id="event-stripe"
      subtitle={props.t('stripe_placeholder_body')}
      title={props.t('section_stripe')}
    >
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-mit-readable-ink">
        <CreditCard aria-hidden className="size-5" />
        <span>{props.t('stripe_placeholder_status')}</span>
      </div>
    </AdminEventFormSection>
  );
}

export function AdminEventFormView(props: AdminEventFormViewProps) {
  return (
    <div className="flex w-full max-w-4xl flex-col gap-6">
      <AdminEventBackLink href={adminEventsIndexPath()}>
        <ArrowLeft aria-hidden className="size-4" />
        {props.t('back_to_events')}
      </AdminEventBackLink>

      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-widest text-mit-red uppercase dark:text-white">
          {props.t('edit_eyebrow')}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {props.event.name}
          </h1>
          <Button asChild size="sm" variant="outline">
            <Link href={eventAdminPublicHref(props.event.slug)}>
              <ExternalLink aria-hidden className="size-4" />
              {props.t('action_view_public')}
            </Link>
          </Button>
        </div>
        <p className="text-sm text-mit-readable-ink">
          {props.t('edit_public_url', { slug: props.event.slug })}
        </p>
      </header>

      <AdminEventErrorAlert code={props.errorCode} t={props.t} />
      {props.accessMode === 'readOnly' ? (
        <AdminEventReadOnlyNotice t={props.t} />
      ) : null}
      <EventMetadataSection event={props.event} t={props.t} />
      {props.accessMode === 'editable' ? (
        <>
          <EventBasicsForm {...props} />
          <EventDatesSection {...props} />
          <EventAdminsSection {...props} />
          <EventQuestionsSection {...props} />
          <EventFeesSection {...props} />
        </>
      ) : (
        <>
          <ReadOnlyBasicsSection {...props} />
          <ReadOnlyDatesSection {...props} />
          <ReadOnlyAdminsSection {...props} />
          <ReadOnlyQuestionsSection {...props} />
          <ReadOnlyFeesSection {...props} />
        </>
      )}
      <StripePlaceholder t={props.t} />
    </div>
  );
}
