import { ArrowLeft, Eye, Pencil, Trash2 } from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import type * as React from 'react';
import { AdminEventRegistrationsView } from '@/components/mit-sailing/admin/events/AdminEventRegistrationsView';
import type { RegistrationFilter } from '@/components/mit-sailing/admin/events/AdminEventRegistrationsView';
import {
  AdminEventBackLink,
  AdminEventListStatusBadge,
  AdminEventReadOnlyNotice,
} from '@/components/mit-sailing/admin/events/AdminEventShared';
import { CmsRichText } from '@/components/mit-sailing/cms/CmsRichText';
import { Button } from '@/components/ui/button';
import {
  adminEventDeletePath,
  adminEventEditPath,
  adminEventsIndexPath,
} from '@/libs/admin/events/eventAdminPaths';
import type {
  AdminEventPublicContentSectionDto,
  AdminEventShowDto,
} from '@/libs/admin/events/eventAdminQueries';
import { Link } from '@/libs/I18nNavigation';
import {
  formatEasternDateTime,
  formatEasternEventRange,
} from '@/libs/mit-sailing/easternTimeFormat';

type AdminEventShowTranslations = Awaited<
  ReturnType<typeof getTranslations<'AdminEvents'>>
>;

type AdminEventShowViewProps = {
  errorCode: string | null;
  event: AdminEventShowDto;
  filter: RegistrationFilter;
  locale: string;
  t: AdminEventShowTranslations;
};

function primaryDateLabel(props: {
  event: AdminEventShowDto;
  t: AdminEventShowTranslations;
}) {
  const date =
    props.event.dates.toSorted(
      (a, b) => a.startDateTime.getTime() - b.startDateTime.getTime()
    )[0] ?? null;
  return date
    ? formatEasternEventRange(date.startDateTime, date.endDateTime)
    : props.t('date_empty');
}

function registrationWindowLabel(props: {
  event: AdminEventShowDto;
  t: AdminEventShowTranslations;
}) {
  if (props.event.registrationStart && props.event.registrationEnd) {
    return props.t('show_registration_window_range', {
      end: formatEasternDateTime(props.event.registrationEnd),
      start: formatEasternDateTime(props.event.registrationStart),
    });
  }
  if (props.event.registrationStart) {
    return props.t('show_registration_window_open_after', {
      start: formatEasternDateTime(props.event.registrationStart),
    });
  }
  if (props.event.registrationEnd) {
    return props.t('show_registration_window_until', {
      end: formatEasternDateTime(props.event.registrationEnd),
    });
  }
  return props.t('show_registration_window_open');
}

function registrationModeLabel(props: {
  event: AdminEventShowDto;
  t: AdminEventShowTranslations;
}) {
  const registrationMode = props.event.registrationMode ?? 'standard';
  if (registrationMode === 'none') {
    return props.t('registration_mode_none');
  }
  if (registrationMode === 'external') {
    return props.t('registration_mode_external');
  }
  return props.t('registration_mode_standard');
}

function publicEventHref(event: AdminEventShowDto) {
  if (event.detailPageKind === 'external' && event.externalDetailUrl) {
    return event.externalDetailUrl;
  }
  return `/events/${encodeURIComponent(event.slug)}`;
}

function visiblePublicContentSections(
  sections: AdminEventShowDto['publicContentSections']
) {
  return sections.filter((section) => section.body.trim().length > 0);
}

function AdminEventPublicContentBody(props: {
  section: AdminEventPublicContentSectionDto;
}) {
  const className = 'mt-2 text-sm leading-relaxed text-mit-readable-ink';
  return <CmsRichText className={className} html={props.section.body} />;
}

function AdminEventSummaryLink(props: { href: string }) {
  return (
    <a
      className="break-all text-mit-red no-underline hover:underline dark:text-mit-red-ink"
      href={props.href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {props.href}
    </a>
  );
}

export function AdminEventShowView(props: AdminEventShowViewProps) {
  const signedUp =
    props.event.registrationCounts.approved +
    props.event.registrationCounts.pending;
  const publicContentSections = visiblePublicContentSections(
    props.event.publicContentSections
  );
  const remaining =
    props.event.maxParticipants === null
      ? props.t('show_remaining_open')
      : Math.max(
          0,
          props.event.maxParticipants - props.event.registrationCounts.approved
        );
  const metrics = [
    [props.t('show_stat_signed_up'), signedUp],
    [props.t('show_stat_confirmed'), props.event.registrationCounts.approved],
    [props.t('show_stat_awaiting'), props.event.registrationCounts.pending],
    [props.t('show_stat_remaining'), remaining],
  ];
  const details: { label: string; value: React.ReactNode }[] = [
    {
      label: props.t('show_primary_date'),
      value: primaryDateLabel(props),
    },
    {
      label: props.t('show_capacity'),
      value:
        props.event.maxParticipants === null
          ? props.t('show_capacity_open')
          : props.t('show_capacity_limited', {
              capacity: props.event.maxParticipants,
            }),
    },
    {
      label: props.t('show_registration_window'),
      value: registrationWindowLabel(props),
    },
    {
      label: props.t('show_registration_mode'),
      value: registrationModeLabel(props),
    },
    {
      label: props.t('show_assigned_admins'),
      value:
        props.event.admins.length === 0
          ? props.t('show_assigned_admins_empty')
          : props.event.admins
              .map((admin) => admin.admin.name || admin.admin.email)
              .join(', '),
    },
  ];
  if (props.event.externalRegistrationUrl) {
    details.push({
      label: props.t('show_external_registration_url'),
      value: (
        <AdminEventSummaryLink href={props.event.externalRegistrationUrl} />
      ),
    });
  }
  if (props.event.externalEntriesUrl) {
    details.push({
      label: props.t('show_external_entries_url'),
      value: <AdminEventSummaryLink href={props.event.externalEntriesUrl} />,
    });
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <AdminEventBackLink href={adminEventsIndexPath()}>
        <ArrowLeft aria-hidden className="size-4" />
        {props.t('back_to_events')}
      </AdminEventBackLink>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-xs font-semibold tracking-widest text-mit-red uppercase dark:text-mit-red-ink">
            {props.t('show_eyebrow')}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {props.event.name}
          </h1>
          <p className="text-sm text-mit-readable-ink">
            {props.event.category.name} · /events/{props.event.slug}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <AdminEventListStatusBadge
              tone={props.event.isPublished ? 'success' : 'neutral'}
            >
              {props.event.isPublished
                ? props.t('status_published')
                : props.t('status_draft')}
            </AdminEventListStatusBadge>
            {props.event.isSpecial ? (
              <AdminEventListStatusBadge tone="danger">
                {props.t('status_special')}
              </AdminEventListStatusBadge>
            ) : null}
            {props.event.detailPageKind === 'external' ? (
              <AdminEventListStatusBadge tone="neutral">
                {props.t('status_external')}
              </AdminEventListStatusBadge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {props.event.accessMode === 'editable' ? (
            <Button asChild size="sm" variant="outline">
              <Link href={adminEventEditPath(props.event.slug)}>
                <Pencil aria-hidden className="size-4" />
                {props.t('action_edit')}
              </Link>
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <a href={publicEventHref(props.event)}>
              <Eye aria-hidden className="size-4" />
              {props.t('action_view_public')}
            </a>
          </Button>
          {props.event.accessMode === 'editable' ? (
            <Button asChild size="sm" variant="ghost">
              <Link href={adminEventDeletePath(props.event.slug)}>
                <Trash2 aria-hidden className="size-4" />
                {props.t('action_delete')}
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      {props.event.accessMode === 'readOnly' ? (
        <AdminEventReadOnlyNotice t={props.t} />
      ) : null}

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div
            className="rounded-lg border border-border bg-card p-4"
            key={label}
          >
            <dt className="text-sm font-medium text-mit-readable-ink">
              {label}
            </dt>
            <dd className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-xl font-semibold text-foreground">
          {props.t('show_summary_heading')}
        </h2>
        <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
          {details.map((detail) => (
            <div key={detail.label}>
              <dt className="font-semibold text-foreground">{detail.label}</dt>
              <dd className="mt-1 text-mit-readable-ink">{detail.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-xl font-semibold text-foreground">
          {props.t('show_public_content_heading')}
        </h2>
        <div className="mt-4 grid gap-4">
          {publicContentSections.length === 0 ? (
            <p className="text-sm text-mit-readable-ink">
              {props.t('show_public_content_empty')}
            </p>
          ) : (
            publicContentSections.map((section) => (
              <article
                className="rounded-lg border border-border bg-background p-4"
                key={section.id}
              >
                <h3 className="text-base font-semibold text-foreground">
                  {props.t(section.titleKey)}
                </h3>
                <AdminEventPublicContentBody section={section} />
              </article>
            ))
          )}
        </div>
      </section>

      <section aria-labelledby="registrations-heading" className="grid gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-mit-red uppercase dark:text-mit-red-ink">
            {props.t('registrations_eyebrow')}
          </p>
          <h2
            className="mt-1 text-2xl font-semibold tracking-tight text-foreground"
            id="registrations-heading"
          >
            {props.t('registration_table_label')}
          </h2>
        </div>
        <AdminEventRegistrationsView
          accessMode={props.event.accessMode}
          chrome="embedded"
          errorCode={props.errorCode}
          event={{
            id: props.event.id,
            entryFees: props.event.entryFees,
            name: props.event.name,
            questions: props.event.questions,
            registrationCounts: props.event.registrationCounts,
            registrations: props.event.registrations,
            requiresPhone: props.event.requiresPhone,
            slug: props.event.slug,
            usesTeamRegistration: props.event.usesTeamRegistration ?? false,
          }}
          filter={props.filter}
          id="registrations"
          locale={props.locale}
          showReadOnlyNotice={false}
          t={props.t}
        />
      </section>
    </div>
  );
}
