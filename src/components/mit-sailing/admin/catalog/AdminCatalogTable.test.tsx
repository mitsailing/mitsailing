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

const userRows = [
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
];

function renderUsersTable() {
  render(
    <AdminCatalogTable
      adminBasePath="/admin/users"
      definition={userDefinition}
      locale="en"
      messageNamespace="AdminUsers"
      resourceId="users"
      rows={userRows}
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
}

async function searchUsers(
  user: ReturnType<typeof userEvent.setup>,
  query: string
) {
  const searchbox = screen.getByRole('searchbox', { name: 'Search users' });
  await user.clear(searchbox);
  await user.type(searchbox, query);
}

function expectOnlyUserLink(name: 'Ada Lovelace' | 'Grace Hopper') {
  const hiddenName = name === 'Ada Lovelace' ? 'Grace Hopper' : 'Ada Lovelace';
  expect(screen.getByRole('link', { name })).toBeVisible();
  expect(screen.queryByRole('link', { name: hiddenName })).toBeNull();
}

describe('AdminCatalogTable', () => {
  it('filters users by configured search fields without navigation', async () => {
    renderUsersTable();
    const user = userEvent.setup();
    const originalHref = window.location.href;

    await searchUsers(user, 'grace');

    expectOnlyUserLink('Grace Hopper');
    expect(window.location.href).toBe(originalHref);

    await searchUsers(user, 'admin');

    expectOnlyUserLink('Ada Lovelace');

    await searchUsers(user, '222222222');

    expectOnlyUserLink('Grace Hopper');

    await searchUsers(user, '61');

    expectOnlyUserLink('Ada Lovelace');
  });

  it('combines configured filters and empty state', async () => {
    renderUsersTable();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText('Email status'), 'bounced');

    expectOnlyUserLink('Grace Hopper');

    await searchUsers(user, 'missing');

    expect(screen.getByText('No users match that search.')).toBeVisible();
  });
});
