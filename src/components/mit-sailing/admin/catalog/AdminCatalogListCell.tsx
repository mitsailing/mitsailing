'use client';

import { useTranslations } from 'next-intl';
import type { AdminFieldKind, CatalogRow } from '@/libs/admin/catalog/types';
import { Link } from '@/libs/I18nNavigation';

const nameEditLinkClassName =
  'text-sm font-medium text-mit-red no-underline hover:underline';

type CatalogCellValue = CatalogRow[string];

/**
 * Renders the `name` list column (plain text, em dash when empty, or edit link).
 *
 * @param props - Raw cell value and optional edit URL
 * @returns Cell inner content
 */
function renderAdminCatalogNameListContent(props: {
  raw: CatalogCellValue;
  listNameEditHref?: string;
}): React.ReactElement {
  const str =
    props.raw === null || props.raw === undefined ? '' : String(props.raw);
  const display = str.trim();
  if (display.length === 0) {
    return <span className="text-slate-400">—</span>;
  }
  if (props.listNameEditHref) {
    return (
      <Link className={nameEditLinkClassName} href={props.listNameEditHref}>
        {display}
      </Link>
    );
  }
  return <span>{str}</span>;
}

type AdminCatalogListCellProps = {
  kind: AdminFieldKind;
  field: string;
  row: CatalogRow;
  /** When `AdminUsers`, boolean headers come from that namespace. */
  messageNamespace?: 'AdminCatalogResource' | 'AdminUsers';
  /**
   * When set on the `name` list column and the value is non-empty, renders an
   * edit link (same target as the row's Edit action).
   */
  listNameEditHref?: string;
};

/**
 * Renders one catalog list cell (visibility badge, links, plain text, numbers).
 *
 * @param props - Field metadata and row payload
 * @returns Table cell inner content
 */
export function AdminCatalogListCell(
  props: AdminCatalogListCellProps
): React.ReactElement {
  const tCatalog = useTranslations('AdminCatalogResource');
  const tUsers = useTranslations('AdminUsers');
  const t = props.messageNamespace === 'AdminUsers' ? tUsers : tCatalog;
  const tc = useTranslations('AdminCatalog');
  const raw = props.row[props.field];

  if (props.kind === 'boolean') {
    if (raw === null || raw === undefined) {
      return <span className="text-slate-400">—</span>;
    }
    const on = Boolean(raw);
    return <span className="text-mit-text">{on ? tc('yes') : tc('no')}</span>;
  }

  if (props.kind === 'visibility') {
    const visible = Boolean(raw);
    return (
      <span
        className={
          visible
            ? 'inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-600/20 ring-inset'
            : 'inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-500/20 ring-inset'
        }
      >
        {visible ? t('status_live') : t('status_draft')}
      </span>
    );
  }

  if (props.kind === 'url' && typeof raw === 'string' && raw.length > 0) {
    return (
      <a
        className="text-mit-red underline decoration-mit-red/30 underline-offset-2 hover:decoration-mit-red"
        href={raw}
        rel="noopener noreferrer"
        target="_blank"
      >
        {raw.length > 48 ? `${raw.slice(0, 45)}…` : raw}
      </a>
    );
  }

  if (props.kind === 'number' && typeof raw === 'number') {
    return <span className="tabular-nums">{raw}</span>;
  }

  if (
    props.field === 'name' &&
    (props.kind === 'string' || props.kind === 'text')
  ) {
    return renderAdminCatalogNameListContent({
      listNameEditHref: props.listNameEditHref,
      raw,
    });
  }

  if (raw === null || raw === undefined) {
    return <span className="text-slate-400">—</span>;
  }

  return <span>{String(raw)}</span>;
}

type AdminCatalogEditStatusBadgeProps = {
  isVisible: boolean;
};

/**
 * Live/Draft badge shown beside the edit form heading (updates with checkbox).
 *
 * @param props - Visibility flag
 * @returns Badge element
 */
export function AdminCatalogEditStatusBadge(
  props: AdminCatalogEditStatusBadgeProps
) {
  const t = useTranslations('AdminCatalogResource');
  return (
    <span
      className={
        props.isVisible
          ? 'inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-600/20 ring-inset'
          : 'inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-500/20 ring-inset'
      }
    >
      {props.isVisible ? t('status_live') : t('status_draft')}
    </span>
  );
}
