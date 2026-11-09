import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usersAdminDefinition } from '@/libs/admin/users/userAdminDefinitions';
import { AdminCatalogForm } from './AdminCatalogForm';
import { AdminCatalogScopeFilter } from './AdminCatalogScopeFilter';

vi.mock('@/libs/admin/catalog/catalogActions', () => ({
  reorderCatalogResourceAction: vi.fn(),
}));

async function noopFormAction(): Promise<void> {
  await Promise.resolve();
}

describe('AdminCatalogScopeFilter', () => {
  it('renders a page dropdown for page block indexes', () => {
    render(
      <AdminCatalogScopeFilter
        action="/admin/example_resource"
        actionLabel="Filter"
        label="Page"
        options={[
          { label: '/about About', value: 'page-1' },
          { label: '/contact Contact', value: 'page-2' },
        ]}
        queryParamName="page"
        pendingLabel="Filtering..."
        selectedValue="page-2"
      />
    );

    const pageSelect = screen.getByLabelText('Page');
    expect(pageSelect).toHaveAttribute('name', 'page');
    expect(pageSelect).toHaveValue('page-2');
    expect(screen.getByRole('button', { name: 'Filter' })).toBeEnabled();
  });

  it('renders a menu dropdown for menu item indexes', () => {
    render(
      <AdminCatalogScopeFilter
        action="/admin/example_resource"
        actionLabel="Filter"
        label="Menu"
        options={[{ label: 'Header (header)', value: 'menu-1' }]}
        queryParamName="menu"
        pendingLabel="Filtering..."
        selectedValue="menu-1"
      />
    );

    const menuSelect = screen.getByLabelText('Menu');
    expect(menuSelect).toHaveAttribute('name', 'menu');
    expect(menuSelect).toHaveValue('menu-1');
  });
});

describe('AdminCatalogForm user errors', () => {
  it('maps role assignment rollback failures', () => {
    render(
      <AdminCatalogForm
        definition={usersAdminDefinition}
        errorCode="role_assignment_rollback_failed"
        formAction={noopFormAction}
        headingKey="new_heading"
        messageNamespace="AdminUsers"
      />
    );

    expect(
      screen.getByText(
        'The user was created, but the requested role could not be assigned or rolled back. Review the account before making more changes.'
      )
    ).toBeVisible();
  });
});
