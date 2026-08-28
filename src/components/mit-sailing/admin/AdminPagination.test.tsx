import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminPagination } from '@/components/mit-sailing/admin/AdminPagination';

const labels = {
  next: 'Next',
  previous: 'Previous',
  summary: 'Page 1 of 2',
};

describe('AdminPagination', () => {
  it('links to the next app-relative page', () => {
    render(
      <AdminPagination
        basePath="/admin/users"
        labels={labels}
        page={1}
        pageSize={20}
        total={40}
      />
    );

    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      '/admin/users?page=2'
    );
  });

  it('does not link when the base path is not app-relative', () => {
    render(
      <AdminPagination
        basePath={['java', 'script:alert(1)'].join('')}
        labels={labels}
        page={1}
        pageSize={20}
        total={40}
      />
    );

    expect(screen.queryByRole('link', { name: 'Next' })).toBeNull();
    expect(screen.getByText('Next')).toBeVisible();
  });
});
