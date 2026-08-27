import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { catalogResourceDefinitions } from '@/libs/admin/catalog/catalogDefinitions';
import { usersAdminDefinition } from '@/libs/admin/users/userAdminDefinitions';
import { AdminCatalogForm } from './AdminCatalogForm';
import { AdminCatalogScopeFilter } from './AdminCatalogScopeFilter';
import { AdminCatalogTable } from './AdminCatalogTable';

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
        action="/admin/cms_page_blocks"
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
        action="/admin/cms_menu_items"
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

describe('AdminCatalogTable scoped CMS definitions', () => {
  it('renders public view actions for cms pages', () => {
    render(
      <AdminCatalogTable
        definition={catalogResourceDefinitions.cms_pages}
        locale="en"
        resourceId="cms_pages"
        rows={[
          {
            id: 'page-1',
            isPublished: true,
            path: '/about',
            title: 'About',
          },
        ]}
      />
    );

    expect(screen.getByRole('link', { name: 'View page' })).toHaveAttribute(
      'href',
      '/about'
    );
  });

  it('hides mutation links when the definition is view only', () => {
    render(
      <AdminCatalogTable
        definition={{
          ...catalogResourceDefinitions.cms_pages,
          capabilities: {
            create: false,
            delete: false,
            reorder: false,
            update: false,
          },
        }}
        locale="en"
        resourceId="cms_pages"
        rows={[
          {
            id: 'page-1',
            isPublished: true,
            path: '/about',
            title: 'About',
          },
        ]}
      />
    );

    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Delete' })).toBeNull();
    expect(screen.getByRole('link', { name: 'View page' })).toBeVisible();
  });

  it('omits the page path column from page blocks', () => {
    render(
      <AdminCatalogTable
        definition={catalogResourceDefinitions.cms_page_blocks}
        locale="en"
        resourceId="cms_page_blocks"
        rows={[
          {
            displayOrder: 1,
            id: 'block-1',
            isVisible: true,
            kind: 'hero',
            title: 'Hero',
          },
        ]}
      />
    );

    const table = screen.getByRole('table');
    expect(
      within(table).queryByRole('columnheader', { name: 'Path' })
    ).toBeNull();
    expect(
      within(table).queryByRole('columnheader', { name: 'Order' })
    ).toBeNull();
    expect(
      within(table).getByRole('columnheader', { name: 'Block type' })
    ).toBeVisible();
    expect(
      within(table).getByRole('button', { name: 'Reorder row' })
    ).toBeVisible();
  });

  it('renders menu items with drag handles and no order column', () => {
    render(
      <AdminCatalogTable
        definition={catalogResourceDefinitions.cms_menu_items}
        locale="en"
        resourceId="cms_menu_items"
        rows={[
          {
            displayOrder: 1,
            id: 'item-1',
            isVisible: true,
            label: 'About',
            parentLabel: '',
            url: '/about',
          },
        ]}
      />
    );

    const table = screen.getByRole('table');
    expect(
      within(table).queryByRole('columnheader', { name: 'Menu' })
    ).toBeNull();
    expect(
      within(table).queryByRole('columnheader', { name: 'Order' })
    ).toBeNull();
    expect(
      within(table).getByRole('columnheader', { name: 'Parent' })
    ).toBeVisible();
    expect(
      within(table).getByRole('button', { name: 'Reorder row' })
    ).toBeVisible();
  });
});

describe('AdminCatalogForm scoped CMS defaults', () => {
  it('defaults new page blocks to the scoped page', () => {
    render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.cms_page_blocks}
        dynamicSelectOptions={{
          pageId: [{ label: '/about About', value: 'page-1' }],
        }}
        formAction={noopFormAction}
        headingKey="new_heading"
        row={{ pageId: 'page-1' }}
      />
    );

    expect(screen.getByLabelText('Page')).toHaveValue('page-1');
  });

  it('defaults new menu items to the scoped menu', () => {
    render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.cms_menu_items}
        dynamicSelectOptions={{
          linkedPageId: [{ label: 'No linked page', value: '' }],
          menuId: [{ label: 'Header (header)', value: 'menu-1' }],
          parentId: [{ label: 'No parent', value: '' }],
        }}
        formAction={noopFormAction}
        headingKey="new_heading"
        row={{ menuId: 'menu-1' }}
      />
    );

    expect(screen.getByLabelText('Menu')).toHaveValue('menu-1');
    expect(screen.queryByLabelText('Display order')).toBeNull();
  });

  it('omits display order from menu item edit forms', () => {
    render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.cms_menu_items}
        dynamicSelectOptions={{
          linkedPageId: [{ label: 'No linked page', value: '' }],
          menuId: [{ label: 'Header (header)', value: 'menu-1' }],
          parentId: [{ label: 'No parent', value: '' }],
        }}
        formAction={noopFormAction}
        headingKey="edit_heading"
        row={{
          displayOrder: 3,
          id: 'item-1',
          isExternal: false,
          isVisible: true,
          label: 'About',
          menuId: 'menu-1',
          parentId: '',
          url: '/about',
        }}
      />
    );

    expect(screen.getByLabelText('Menu')).toHaveValue('menu-1');
    expect(screen.queryByLabelText('Display order')).toBeNull();
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
