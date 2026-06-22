'use client';

import { useTranslations } from 'next-intl';
import { AdminStatusPill } from '@/components/mit-sailing/admin/catalog/AdminStatusPill';
import type { AdminStatusPillTone } from '@/components/mit-sailing/admin/catalog/AdminStatusPill';
import { AdminUsersCatalogListCell } from '@/components/mit-sailing/admin/catalog/AdminUsersCatalogListCell';
import type {
  AdminBooleanListPolarity,
  AdminFieldKind,
  CatalogRow,
} from '@/libs/admin/catalog/types';
import { Link } from '@/libs/I18nNavigation';
import {
  externalCmsLinkProps,
  isAppRelativeCmsHref,
  safeCmsHref,
} from '@/libs/mit-sailing/cmsHref';

const nameEditLinkClassName =
  'text-sm font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink';
const urlLinkClassName =
  'text-mit-red underline decoration-mit-red/30 underline-offset-2 hover:decoration-mit-red dark:text-mit-red-ink';

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
}) {
  const str =
    props.raw === null || props.raw === undefined ? '' : String(props.raw);
  const display = str.trim();
  if (display.length === 0) {
    return <span className="text-slate-400">—</span>;
  }
  if (props.listNameEditHref && isAppRelativeCmsHref(props.listNameEditHref)) {
    const editHrefProps = { href: props.listNameEditHref };
    return (
      <Link className={nameEditLinkClassName} {...editHrefProps}>
        {display}
      </Link>
    );
  }
  return <span>{str}</span>;
}

function booleanListTone(
  on: boolean,
  polarity: AdminBooleanListPolarity = 'goodWhenTrue'
): AdminStatusPillTone {
  if (polarity === 'goodWhenTrue') {
    return on ? 'success' : 'neutral';
  }
  return on ? 'danger' : 'neutral';
}

function renderUrlListContent(raw: string) {
  const href = safeCmsHref(raw);
  if (!href) {
    return <span>{raw}</span>;
  }
  const label = raw.length > 48 ? `${raw.slice(0, 45)}…` : raw;
  const hrefProps = { href };
  if (isAppRelativeCmsHref(href)) {
    return (
      <Link className={urlLinkClassName} {...hrefProps}>
        {label}
      </Link>
    );
  }
  return (
    <a
      className={urlLinkClassName}
      {...hrefProps}
      {...externalCmsLinkProps(href)}
    >
      {label}
    </a>
  );
}

type AdminCatalogListCellProps = {
  kind: AdminFieldKind;
  field: string;
  row: CatalogRow;
  /** When `kind` is `boolean`, maps true/false to pill tones. */
  booleanPolarity?: AdminBooleanListPolarity;
  /**
   * When set on the `name` list column and the value is non-empty, renders an
   * edit link (same target as the row's Edit action).
   */
  listNameEditHref?: string;
};

function renderStandardCatalogListCell(props: {
  booleanPolarity?: AdminBooleanListPolarity;
  field: string;
  kind: AdminFieldKind;
  listNameEditHref?: string;
  raw: CatalogCellValue;
  tCatalog: ReturnType<typeof useTranslations<'AdminCatalogResource'>>;
  tc: ReturnType<typeof useTranslations<'AdminCatalog'>>;
}) {
  if (props.kind === 'boolean') {
    if (props.raw === null || props.raw === undefined) {
      return <span className="text-slate-400">—</span>;
    }
    const on = Boolean(props.raw);
    return (
      <AdminStatusPill tone={booleanListTone(on, props.booleanPolarity)}>
        {on ? props.tc('yes') : props.tc('no')}
      </AdminStatusPill>
    );
  }

  if (props.kind === 'visibility') {
    const visible = Boolean(props.raw);
    return (
      <AdminStatusPill tone={visible ? 'success' : 'neutral'}>
        {visible
          ? props.tCatalog('status_live')
          : props.tCatalog('status_draft')}
      </AdminStatusPill>
    );
  }

  if (
    props.kind === 'url' &&
    typeof props.raw === 'string' &&
    props.raw.length > 0
  ) {
    return renderUrlListContent(props.raw);
  }

  if (props.kind === 'number' && typeof props.raw === 'number') {
    return <span className="tabular-nums">{props.raw}</span>;
  }

  if (
    props.field === 'name' &&
    (props.kind === 'string' || props.kind === 'text')
  ) {
    return renderAdminCatalogNameListContent({
      listNameEditHref: props.listNameEditHref,
      raw: props.raw,
    });
  }

  if (props.raw === null || props.raw === undefined) {
    return <span className="text-slate-400">—</span>;
  }

  return <span>{String(props.raw)}</span>;
}

/**
 * Renders one catalog list cell (visibility badge, links, plain text, numbers).
 *
 * Boolean pills use `AdminCatalog` (`yes` / `no`); visibility uses `AdminCatalogResource`
 * (`status_live` / `status_draft`). The admin catalog table's `messageNamespace` prop
 * affects column headers and actions only, not these cell labels.
 *
 * @param props - Field metadata and row payload
 * @returns Table cell inner content
 */
export function AdminCatalogListCell(props: AdminCatalogListCellProps) {
  const tCatalog = useTranslations('AdminCatalogResource');
  const tc = useTranslations('AdminCatalog');
  const raw = props.row[props.field];

  if (
    props.field === 'sailingCardStatus' ||
    props.field === 'pendingCardType' ||
    props.field === 'membershipPaymentStatus'
  ) {
    return <AdminUsersCatalogListCell field={props.field} raw={raw} />;
  }

  return renderStandardCatalogListCell({
    booleanPolarity: props.booleanPolarity,
    field: props.field,
    kind: props.kind,
    listNameEditHref: props.listNameEditHref,
    raw,
    tCatalog,
    tc,
  });
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
    <AdminStatusPill
      density="comfortable"
      tone={props.isVisible ? 'success' : 'neutral'}
    >
      {props.isVisible ? t('status_live') : t('status_draft')}
    </AdminStatusPill>
  );
}
