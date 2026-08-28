'use client';

import { useTranslations } from 'next-intl';
import { AdminStatusPill } from '@/components/mit-sailing/admin/catalog/AdminStatusPill';
import type { AdminStatusPillTone } from '@/components/mit-sailing/admin/catalog/AdminStatusPill';
import type {
  AdminUsersMessageKey,
  CatalogRow,
} from '@/libs/admin/catalog/types';

type CatalogCellValue = CatalogRow[string];

const sailingCardStatusLabels = {
  current: 'list_sailing_card_status_current',
  expired: 'list_sailing_card_status_expired',
  none: 'list_sailing_card_status_none',
  pending: 'list_sailing_card_status_pending',
} as const satisfies Record<string, AdminUsersMessageKey>;

const pendingCardTypeLabels = {
  normal: 'list_card_type_normal',
  racing: 'list_card_type_racing',
  team_racing: 'list_card_type_team_racing',
} as const satisfies Record<string, AdminUsersMessageKey>;

const membershipPaymentStatusLabels = {
  checkout_started: 'list_membership_payment_checkout_started',
  paid: 'list_membership_payment_paid',
  past_due: 'list_membership_payment_past_due',
  unpaid: 'list_membership_payment_unpaid',
} as const satisfies Record<string, AdminUsersMessageKey>;

function sailingCardStatusTone(status: string): AdminStatusPillTone {
  if (status === 'current') {
    return 'success';
  }
  if (status === 'pending') {
    return 'danger';
  }
  return 'neutral';
}

function membershipPaymentStatusTone(status: string): AdminStatusPillTone {
  if (status === 'paid') {
    return 'success';
  }
  if (status === 'past_due' || status === 'unpaid') {
    return 'danger';
  }
  return 'neutral';
}

function hasLabelKey<T extends Record<string, AdminUsersMessageKey>>(
  labels: T,
  value: string
): value is Extract<keyof T, string> {
  return Object.hasOwn(labels, value);
}

/**
 * Renders admin users list cells that need localized labels or status pills.
 *
 * @param props - Field name and raw row value
 * @returns Cell content or null when the field is not handled here
 */
export function AdminUsersCatalogListCell(props: {
  field: string;
  raw: CatalogCellValue;
}) {
  const tUsers = useTranslations('AdminUsers');

  if (props.field === 'sailingCardStatus' && typeof props.raw === 'string') {
    if (!hasLabelKey(sailingCardStatusLabels, props.raw)) {
      return <span className="text-slate-400">—</span>;
    }
    return (
      <AdminStatusPill tone={sailingCardStatusTone(props.raw)}>
        {tUsers(sailingCardStatusLabels[props.raw])}
      </AdminStatusPill>
    );
  }

  if (props.field === 'pendingCardType') {
    if (props.raw === null || props.raw === undefined || props.raw === '') {
      return <span className="text-slate-400">—</span>;
    }
    const cardType = String(props.raw);
    if (!hasLabelKey(pendingCardTypeLabels, cardType)) {
      return <span>{cardType}</span>;
    }
    return <span>{tUsers(pendingCardTypeLabels[cardType])}</span>;
  }

  if (
    props.field === 'membershipPaymentStatus' &&
    typeof props.raw === 'string'
  ) {
    if (props.raw === 'not_applicable') {
      return <span className="text-slate-400">—</span>;
    }
    if (!hasLabelKey(membershipPaymentStatusLabels, props.raw)) {
      return <span className="text-slate-400">—</span>;
    }
    return (
      <AdminStatusPill tone={membershipPaymentStatusTone(props.raw)}>
        {tUsers(membershipPaymentStatusLabels[props.raw])}
      </AdminStatusPill>
    );
  }

  return null;
}
