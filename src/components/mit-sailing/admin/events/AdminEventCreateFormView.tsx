import { ArrowLeft, Save } from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import { AdminErrorAlert } from '@/components/mit-sailing/admin/AdminErrorAlert';
import {
  AdminEventBackLink,
  AdminEventCheckbox,
  AdminEventField,
  AdminEventFormSection,
  adminEventFormErrorMessage,
} from '@/components/mit-sailing/admin/events/AdminEventShared';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { Textarea } from '@/components/ui/textarea';
import { EventDetailPageKind } from '@/generated/prisma/enums';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import { createAdminEventAction } from '@/libs/admin/events/eventAdminActions';
import { adminEventsIndexPath } from '@/libs/admin/events/eventAdminPaths';
import type { AdminEventCategoryOption } from '@/libs/admin/events/eventAdminQueries';

type AdminEventCreateTranslations = Awaited<
  ReturnType<typeof getTranslations<'AdminEvents'>>
>;

type AdminEventCreateCommonTranslations = Awaited<
  ReturnType<typeof getTranslations<'Common'>>
>;

type AdminEventCreateFormViewProps = {
  categories: AdminEventCategoryOption[];
  errorCode: string | null;
  locale: string;
  t: AdminEventCreateTranslations;
  tCommon: AdminEventCreateCommonTranslations;
};

function AdminEventCreateErrorAlert(props: {
  code: string | null;
  t: AdminEventCreateTranslations;
}) {
  const message = adminEventFormErrorMessage(props.code, props.t);
  if (!message) {
    return null;
  }
  return <AdminErrorAlert>{message}</AdminErrorAlert>;
}

export function AdminEventCreateFormView(props: AdminEventCreateFormViewProps) {
  const createAction = createAdminEventAction.bind(null, props.locale);
  const hasCategories = props.categories.length > 0;
  return (
    <div className="flex w-full max-w-4xl flex-col gap-6">
      <AdminEventBackLink href={adminEventsIndexPath()}>
        <ArrowLeft aria-hidden className="size-4" />
        {props.t('back_to_events')}
      </AdminEventBackLink>

      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-widest text-mit-red-ink uppercase">
          {props.t('new_eyebrow')}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {props.t('new_title')}
        </h1>
        <p className="max-w-3xl text-sm text-mit-readable-ink">
          {props.t('new_subtitle')}
        </p>
      </header>

      <AdminEventCreateErrorAlert code={props.errorCode} t={props.t} />

      <form action={createAction} className="flex flex-col gap-5">
        <AdminEventFormSection
          id="new-event-basics"
          subtitle={props.t('basics_subtitle')}
          title={props.t('section_basics')}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <AdminEventField htmlFor="event-name" label={props.t('field_name')}>
              <Input id="event-name" name="name" required />
            </AdminEventField>
            <AdminEventField
              htmlFor="event-short-name"
              hint={props.t('field_short_name_hint')}
              label={props.t('field_short_name')}
            >
              {(controlProps) => (
                <Input
                  id="event-short-name"
                  name="shortName"
                  {...controlProps}
                />
              )}
            </AdminEventField>
            <AdminEventField
              htmlFor="event-slug"
              hint={props.t('new_slug_hint')}
              label={props.t('field_slug')}
            >
              {(controlProps) => (
                <Input id="event-slug" name="slug" {...controlProps} />
              )}
            </AdminEventField>
            <AdminEventField
              htmlFor="event-category"
              hint={
                hasCategories ? undefined : props.t('new_category_empty_hint')
              }
              label={props.t('field_category')}
            >
              {(controlProps) => (
                <select
                  className={adminNativeSelectClassName}
                  defaultValue={props.categories[0]?.id ?? ''}
                  disabled={!hasCategories}
                  id="event-category"
                  name="eventCategoryId"
                  required
                  {...controlProps}
                >
                  {props.categories.length === 0 ? (
                    <option disabled value="">
                      {props.t('field_category_placeholder')}
                    </option>
                  ) : null}
                  {props.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              )}
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
                id="event-description"
                name="description"
                {...controlProps}
              />
            )}
          </AdminEventField>

          <div className="grid gap-4 md:grid-cols-2">
            <AdminEventCheckbox
              defaultChecked
              hint={props.t('field_published_hint')}
              label={props.t('field_published')}
              name="isPublished"
            />
            <AdminEventCheckbox
              hint={props.t('field_special_hint')}
              label={props.t('field_special')}
              name="isSpecial"
            />
            <AdminEventCheckbox
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
                  id="event-max-participants"
                  min={1}
                  name="maxParticipants"
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
                id="event-internal-notes"
                name="internalNotes"
                {...controlProps}
              />
            )}
          </AdminEventField>
        </AdminEventFormSection>

        <AdminEventFormSection
          id="new-event-public-page"
          subtitle={props.t('public_page_subtitle')}
          title={props.t('section_public_page')}
        >
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">
              {props.t('field_detail_page_kind')}
            </legend>
            <label
              aria-labelledby="new-event-detail-page-kind-standard-label"
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              htmlFor="new-event-detail-page-kind-standard"
            >
              <input
                className="mt-0.5"
                defaultChecked
                id="new-event-detail-page-kind-standard"
                name="detailPageKind"
                type="radio"
                value={EventDetailPageKind.standard}
              />
              <span className="flex flex-col gap-0.5">
                <span
                  className="font-medium"
                  id="new-event-detail-page-kind-standard-label"
                >
                  {props.t('detail_standard_label')}
                </span>
                <span className="text-xs text-mit-readable-ink">
                  {props.t('new_detail_standard_hint')}
                </span>
              </span>
            </label>
            <label
              aria-labelledby="new-event-detail-page-kind-external-label"
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              htmlFor="new-event-detail-page-kind-external"
            >
              <input
                className="mt-0.5"
                id="new-event-detail-page-kind-external"
                name="detailPageKind"
                type="radio"
                value={EventDetailPageKind.external}
              />
              <span className="flex flex-col gap-0.5">
                <span
                  className="font-medium"
                  id="new-event-detail-page-kind-external-label"
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
              id="event-external-url"
              name="externalDetailUrl"
              placeholder={props.t('field_external_detail_url_placeholder')}
              type="url"
            />
          </AdminEventField>
        </AdminEventFormSection>

        <div className="flex justify-end gap-3">
          <SubmitButton
            disabled={!hasCategories}
            pendingLabel={props.tCommon('pending_saving')}
            variant="mit"
          >
            <Save aria-hidden className="size-4" />
            {props.t('action_create_event')}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
