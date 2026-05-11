import { ArrowLeft, Save } from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import {
  AdminEventBackLink,
  AdminEventCheckbox,
  AdminEventField,
  AdminEventFormSection,
  adminEventFormErrorMessage,
} from '@/components/mit-sailing/admin/events/AdminEventShared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EventDetailPageKind } from '@/generated/prisma/enums';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import { createAdminEventAction } from '@/libs/admin/events/eventAdminActions';
import { adminEventsIndexPath } from '@/libs/admin/events/eventAdminPaths';
import type { AdminEventCategoryOption } from '@/libs/admin/events/eventAdminQueries';

type AdminEventCreateTranslations = Awaited<
  ReturnType<typeof getTranslations<'AdminEvents'>>
>;

type AdminEventCreateFormViewProps = {
  categories: AdminEventCategoryOption[];
  errorCode: string | null;
  locale: string;
  t: AdminEventCreateTranslations;
};

function AdminEventCreateErrorAlert(props: {
  code: string | null;
  t: AdminEventCreateTranslations;
}) {
  const message = adminEventFormErrorMessage(props.code, props.t);
  if (!message) {
    return null;
  }
  return (
    <p
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950"
      role="alert"
    >
      {message}
    </p>
  );
}

export function AdminEventCreateFormView(props: AdminEventCreateFormViewProps) {
  const createAction = createAdminEventAction.bind(null, props.locale);
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <AdminEventBackLink href={adminEventsIndexPath()}>
        <ArrowLeft aria-hidden className="size-4" />
        {props.t('back_to_events')}
      </AdminEventBackLink>

      <header className="flex flex-col gap-2">
        <p className="text-xs font-semibold tracking-widest text-mit-red uppercase dark:text-white">
          {props.t('new_eyebrow')}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {props.t('new_title')}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground dark:text-white">
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
              <Input id="event-short-name" name="shortName" />
            </AdminEventField>
            <AdminEventField
              htmlFor="event-slug"
              hint={props.t('new_slug_hint')}
              label={props.t('field_slug')}
            >
              <Input id="event-slug" name="slug" />
            </AdminEventField>
            <AdminEventField
              htmlFor="event-category"
              label={props.t('field_category')}
            >
              <select
                className={adminNativeSelectClassName}
                defaultValue={props.categories[0]?.id ?? ''}
                id="event-category"
                name="eventCategoryId"
                required
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
            </AdminEventField>
          </div>

          <AdminEventField
            htmlFor="event-description"
            hint={props.t('field_description_hint')}
            label={props.t('field_description')}
          >
            <Textarea
              className="min-h-28"
              id="event-description"
              name="description"
            />
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
              label={props.t('field_registration_start')}
            >
              <Input
                id="event-registration-start"
                name="registrationStart"
                type="datetime-local"
              />
            </AdminEventField>
            <AdminEventField
              htmlFor="event-registration-end"
              label={props.t('field_registration_end')}
            >
              <Input
                id="event-registration-end"
                name="registrationEnd"
                type="datetime-local"
              />
            </AdminEventField>
            <AdminEventField
              htmlFor="event-max-participants"
              hint={props.t('field_max_participants_hint')}
              label={props.t('field_max_participants')}
            >
              <Input
                id="event-max-participants"
                min={1}
                name="maxParticipants"
                type="number"
              />
            </AdminEventField>
          </div>

          <AdminEventField
            htmlFor="event-internal-notes"
            hint={props.t('field_internal_notes_hint')}
            label={props.t('field_internal_notes')}
          >
            <Textarea
              className="min-h-24"
              id="event-internal-notes"
              name="internalNotes"
            />
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
              aria-label={props.t('detail_standard_label')}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <input
                className="mt-0.5"
                defaultChecked
                name="detailPageKind"
                type="radio"
                value={EventDetailPageKind.standard}
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">
                  {props.t('detail_standard_label')}
                </span>
                <span className="text-xs text-muted-foreground dark:text-white">
                  {props.t('new_detail_standard_hint')}
                </span>
              </span>
            </label>
            <label
              aria-label={props.t('detail_external_label')}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <input
                className="mt-0.5"
                name="detailPageKind"
                type="radio"
                value={EventDetailPageKind.external}
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">
                  {props.t('detail_external_label')}
                </span>
                <span className="text-xs text-muted-foreground dark:text-white">
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
              placeholder="https://"
              type="url"
            />
          </AdminEventField>
        </AdminEventFormSection>

        <div className="flex justify-end gap-3">
          <Button type="submit" variant="mit">
            <Save aria-hidden className="size-4" />
            {props.t('action_create_event')}
          </Button>
        </div>
      </form>
    </div>
  );
}
