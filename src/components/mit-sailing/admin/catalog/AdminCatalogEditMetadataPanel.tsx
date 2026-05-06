'use client';

import { ExternalLink } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  catalogEditContributorLabel,
  formatCatalogEditDate,
  catalogEditTimestamp,
  formatCatalogEditRelativeTime,
} from '@/components/mit-sailing/admin/catalog/catalogEditMetadataFormat';
import type {
  CatalogChangeAction,
  CatalogEditChange,
  CatalogEditMetadata,
} from '@/libs/admin/catalog/types';

function changeLabel(
  action: CatalogChangeAction,
  t: ReturnType<typeof useTranslations<'AdminCatalogResource'>>
): string {
  if (action === 'created') {
    return t('metadata_change_created');
  }
  if (action === 'deleted') {
    return t('metadata_change_deleted');
  }
  if (action === 'restored') {
    return t('metadata_change_restored');
  }
  return t('metadata_change_updated');
}

function metadataDateLabel(props: {
  contributor: CatalogEditMetadata['createdBy'];
  date: string | null;
  locale: string;
  unknownEditorLabel: string;
}): string {
  if (!props.date) {
    return props.unknownEditorLabel;
  }
  if (props.contributor) {
    return catalogEditContributorLabel(
      props.contributor,
      props.date,
      props.locale
    );
  }
  return formatCatalogEditDate(props.date, props.locale);
}

function ChangeRow(props: {
  change: CatalogEditChange;
  locale: string;
  restoreAction: ((formData: FormData) => Promise<void>) | undefined;
  renderedAt: number;
  unknownEditorLabel: string;
}) {
  const t = useTranslations('AdminCatalogResource');
  const editor = props.change.editorName ?? props.unknownEditorLabel;
  return (
    <tr className="border-b border-slate-200 last:border-b-0">
      <td className="px-3 py-3 text-sm font-medium text-mit-text">
        {changeLabel(props.change.action, t)}
      </td>
      <td className="px-3 py-3 text-sm text-slate-600">{editor}</td>
      <td className="px-3 py-3 text-sm text-slate-600">
        <time dateTime={props.change.createdAt}>
          {formatCatalogEditRelativeTime(
            props.change.createdAt,
            props.locale,
            props.renderedAt
          )}
        </time>
      </td>
      <td className="px-3 py-3">
        {props.change.canRestore ? (
          <div className="flex flex-wrap items-center gap-2">
            {props.change.viewHref ? (
              <a
                className="text-sm font-semibold text-mit-red underline decoration-mit-red/30 underline-offset-4 hover:text-mit-red-hover focus-visible:ring-2 focus-visible:ring-mit-red focus-visible:outline-none"
                href={props.change.viewHref}
              >
                {t('metadata_action_view')}
              </a>
            ) : null}
            {props.change.compareHref ? (
              <a
                className="text-sm font-semibold text-mit-red underline decoration-mit-red/30 underline-offset-4 hover:text-mit-red-hover focus-visible:ring-2 focus-visible:ring-mit-red focus-visible:outline-none"
                href={props.change.compareHref}
              >
                {t('metadata_action_compare')}
              </a>
            ) : null}
            {props.restoreAction ? (
              <form action={props.restoreAction}>
                <input name="changeId" type="hidden" value={props.change.id} />
                <button
                  className="text-sm font-semibold text-mit-red underline decoration-mit-red/30 underline-offset-4 hover:text-mit-red-hover focus-visible:ring-2 focus-visible:ring-mit-red focus-visible:outline-none"
                  type="submit"
                >
                  {t('metadata_action_restore')}
                </button>
              </form>
            ) : null}
          </div>
        ) : (
          <span className="text-sm text-slate-500">
            {t('metadata_actions_unavailable')}
          </span>
        )}
      </td>
    </tr>
  );
}

/**
 * WordPress-style edit metadata bar for catalog CMS pages.
 *
 * @param props - Creator, last editor, current status, and public page link
 * @returns Compact metadata bar for the editor header
 */
export function AdminCatalogEditMetadataPanel(props: {
  metadata: CatalogEditMetadata;
  isPublished: boolean | null;
  isVisibilityPending?: boolean;
  visibilityChanged?: boolean | null;
  visibilityAction?: (formData: FormData) => void;
  visibilityErrorCode?: string | null;
  visibilitySavedAt?: number | null;
}) {
  const locale = useLocale();
  const t = useTranslations('AdminCatalogResource');
  let publishedLabel: string | null = null;
  if (props.isPublished === true) {
    publishedLabel = t('metadata_status_published');
  } else if (props.isPublished === false) {
    publishedLabel = t('metadata_status_unpublished');
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-2 px-4 py-3 text-sm text-slate-600">
        {publishedLabel ? (
          <div>
            <span>{t('metadata_status')}</span>{' '}
            <strong className="font-semibold text-mit-text">
              {publishedLabel}
            </strong>
            {props.visibilityAction ? (
              <>
                {' '}
                <span aria-hidden>-</span>{' '}
                <form action={props.visibilityAction} className="inline">
                  <input
                    name="isVisible"
                    type="hidden"
                    value={props.isPublished ? 'false' : 'true'}
                  />
                  <button
                    className="font-semibold text-mit-red underline decoration-mit-red/30 underline-offset-4 hover:text-mit-red-hover focus-visible:ring-2 focus-visible:ring-mit-red focus-visible:outline-none disabled:text-slate-500 disabled:no-underline"
                    disabled={props.isVisibilityPending}
                    type="submit"
                  >
                    {props.isPublished
                      ? t('metadata_action_set_unpublished')
                      : t('metadata_action_set_published')}
                  </button>
                </form>
              </>
            ) : null}
          </div>
        ) : null}
        <p>
          <span>{t('metadata_modified')}</span>{' '}
          <strong className="font-semibold text-mit-text">
            {metadataDateLabel({
              contributor: props.metadata.lastEditedBy,
              date: props.metadata.lastEditedAt,
              locale,
              unknownEditorLabel: t('metadata_unknown_editor'),
            })}
          </strong>
        </p>
        <p>
          <span>{t('metadata_created')}</span>{' '}
          <strong className="font-semibold text-mit-text">
            {metadataDateLabel({
              contributor: props.metadata.createdBy,
              date: props.metadata.createdAt,
              locale,
              unknownEditorLabel: t('metadata_unknown_editor'),
            })}
          </strong>
        </p>
        <a
          className="font-semibold text-mit-red underline decoration-mit-red/30 underline-offset-4 hover:text-mit-red-hover focus-visible:ring-2 focus-visible:ring-mit-red focus-visible:outline-none"
          href="#catalog-change-history"
        >
          {t('metadata_history_link')}
        </a>
        {props.metadata.viewPageHref ? (
          <a
            className="inline-flex shrink-0 items-center gap-1 font-semibold text-mit-red underline decoration-mit-red/30 underline-offset-4 hover:text-mit-red-hover focus-visible:ring-2 focus-visible:ring-mit-red focus-visible:outline-none"
            href={props.metadata.viewPageHref}
            rel="noreferrer"
            target="_blank"
          >
            {t('metadata_view_page')}
            <ExternalLink aria-hidden size={14} />
          </a>
        ) : null}
        {props.visibilitySavedAt ? (
          <p className="font-medium text-mit-text" role="status">
            {props.visibilityChanged === false
              ? t('metadata_visibility_no_change')
              : t('metadata_visibility_saved')}
          </p>
        ) : null}
        {props.visibilityErrorCode ? (
          <p className="font-medium text-mit-red" role="alert">
            {t('metadata_visibility_error')}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function AdminCatalogEditHistoryPanel(props: {
  metadata: CatalogEditMetadata;
  restoreAction?: (formData: FormData) => Promise<void>;
}) {
  const locale = useLocale();
  const t = useTranslations('AdminCatalogResource');
  const renderedAt = catalogEditTimestamp(props.metadata.renderedAt) ?? 0;

  return (
    <section
      className="rounded-md border border-slate-200 bg-white shadow-sm"
      id="catalog-change-history"
    >
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-base font-semibold text-mit-text">
          {t('metadata_change_history')}
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          {t('metadata_change_history_intro')}
        </p>
      </div>
      {props.metadata.recentChanges.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-left">
            <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2">{t('metadata_history_action')}</th>
                <th className="px-3 py-2">{t('metadata_history_editor')}</th>
                <th className="px-3 py-2">{t('metadata_history_time')}</th>
                <th className="px-3 py-2">{t('metadata_history_tools')}</th>
              </tr>
            </thead>
            <tbody>
              {props.metadata.recentChanges.map((change) => (
                <ChangeRow
                  change={change}
                  key={change.id}
                  locale={locale}
                  renderedAt={renderedAt}
                  restoreAction={props.restoreAction}
                  unknownEditorLabel={t('metadata_unknown_editor')}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-4 text-sm text-slate-600">
          {t('metadata_no_recent_changes')}
        </p>
      )}
    </section>
  );
}
