import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogResourceDefinition } from '@/libs/admin/catalog/types';
import { AdminCatalogTable } from './AdminCatalogTable';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      action_delete: 'Delete',
      action_edit: 'Edit',
      action_view_page: 'View page',
      column_actions: 'Actions',
      column_email: 'Email',
      column_mit_id: 'MIT ID',
      column_name_label: 'Name',
      column_role: 'Role',
      column_sailing_card_number: 'Sailing card #',
      drag_handle_aria: 'Drag row',
      filter_empty: 'No users match that search.',
      filter_search_label: 'Search users',
      filter_search_placeholder:
        'Search by name, email, MIT ID, sailing card number, or role',
      filter_email_status_all: 'All email statuses',
      filter_email_status_label: 'Email status',
      email_status_bounced: 'Bounced',
      email_status_ok: 'OK',
      no: 'No',
      reorder_error: 'Could not reorder rows.',
      yes: 'Yes',
    };
    return messages[key] ?? key;
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('@/libs/I18nNavigation', () => ({
  Link: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={props.href}>{props.children}</a>
  ),
}));

vi.mock('@/libs/admin/catalog/catalogActions', () => ({
  reorderCatalogResourceAction: vi.fn(),
}));

const userDefinition = {
  capabilities: {
    create: false,
    delete: false,
    reorder: false,
    update: true,
  },
  formFields: [],
  hubLabelKey: 'hub_label_users',
  id: 'users',
  listColumns: [
    { field: 'email', headerKey: 'column_email', kind: 'string' },
    { field: 'name', headerKey: 'column_name_label', kind: 'string' },
    { field: 'mitId', headerKey: 'column_mit_id', kind: 'string' },
    {
      field: 'sailingCardNumber',
      headerKey: 'column_sailing_card_number',
      kind: 'string',
    },
    { field: 'appRole', headerKey: 'column_role', kind: 'string' },
  ],
  metaTitleKey: 'meta_title_admin_users',
  titleKey: 'title_admin_users',
} as const satisfies CatalogResourceDefinition;

describe('AdminCatalogTable', () => {
  it('filters users by configured search fields without navigation', async () => {
    render(
      <AdminCatalogTable
        adminBasePath="/admin/users"
        definition={userDefinition}
        locale="en"
        messageNamespace="AdminUsers"
        resourceId="users"
        rows={[
          {
            appRole: 'admin',
            email: 'ada@example.com',
            emailDeliverabilityStatus: 'ok',
            id: 'user-1',
            mitId: '111111111',
            name: 'Ada Lovelace',
            sailingCardNumber: 61,
          },
          {
            appRole: 'dock_staff',
            email: 'grace@example.com',
            emailDeliverabilityStatus: 'bounced',
            id: 'user-2',
            mitId: '222222222',
            name: 'Grace Hopper',
            sailingCardNumber: 110,
          },
        ]}
        search={{
          emptyKey: 'filter_empty',
          fields: ['email', 'name', 'mitId', 'sailingCardNumber', 'appRole'],
          labelKey: 'filter_search_label',
          placeholderKey: 'filter_search_placeholder',
        }}
        filters={[
          {
            allKey: 'filter_email_status_all',
            field: 'emailDeliverabilityStatus',
            labelKey: 'filter_email_status_label',
            options: [
              { labelKey: 'email_status_ok', value: 'ok' },
              { labelKey: 'email_status_bounced', value: 'bounced' },
            ],
          },
        ]}
      />
    );
    const user = userEvent.setup();
    const originalHref = window.location.href;

    await user.type(
      screen.getByRole('searchbox', { name: 'Search users' }),
      'grace'
    );

    expect(screen.getByRole('link', { name: 'Grace Hopper' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Ada Lovelace' })).toBeNull();
    expect(window.location.href).toBe(originalHref);

    await user.clear(screen.getByRole('searchbox', { name: 'Search users' }));
    await user.type(
      screen.getByRole('searchbox', { name: 'Search users' }),
      'admin'
    );

    expect(screen.getByRole('link', { name: 'Ada Lovelace' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Grace Hopper' })).toBeNull();

    await user.clear(screen.getByRole('searchbox', { name: 'Search users' }));
    await user.type(
      screen.getByRole('searchbox', { name: 'Search users' }),
      '222222222'
    );

    expect(screen.getByRole('link', { name: 'Grace Hopper' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Ada Lovelace' })).toBeNull();

    await user.clear(screen.getByRole('searchbox', { name: 'Search users' }));
    await user.type(
      screen.getByRole('searchbox', { name: 'Search users' }),
      '61'
    );

    expect(screen.getByRole('link', { name: 'Ada Lovelace' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Grace Hopper' })).toBeNull();

    await user.clear(screen.getByRole('searchbox', { name: 'Search users' }));
    await user.selectOptions(screen.getByLabelText('Email status'), 'bounced');

    expect(screen.getByRole('link', { name: 'Grace Hopper' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Ada Lovelace' })).toBeNull();

    await user.clear(screen.getByRole('searchbox', { name: 'Search users' }));
    await user.type(
      screen.getByRole('searchbox', { name: 'Search users' }),
      'missing'
    );

    expect(screen.getByText('No users match that search.')).toBeVisible();
  });
});
