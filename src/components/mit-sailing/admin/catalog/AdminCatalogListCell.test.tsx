import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminCatalogListCell } from './AdminCatalogListCell';

describe('AdminCatalogListCell', () => {
  it('renders safe url values as links', () => {
    render(
      <AdminCatalogListCell
        field="url"
        kind="url"
        row={{ id: '1', url: 'https://example.com/member' }}
      />
    );

    expect(
      screen.getByRole('link', { name: 'https://example.com/member' })
    ).toHaveAttribute('href', 'https://example.com/member');
  });

  it('renders internal url values with app links', () => {
    render(
      <AdminCatalogListCell
        field="url"
        kind="url"
        row={{ id: '1', url: '/classes' }}
      />
    );

    expect(screen.getByRole('link', { name: '/classes' })).toHaveAttribute(
      'href',
      '/classes'
    );
  });

  it('renders unsafe url values as plain text', () => {
    const unsafeHref = ['java', 'script:alert(1)'].join('');

    render(
      <AdminCatalogListCell
        field="url"
        kind="url"
        row={{ id: '1', url: unsafeHref }}
      />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(unsafeHref)).toBeInTheDocument();
  });
});
