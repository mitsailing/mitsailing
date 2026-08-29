import { render, screen } from '@testing-library/react';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AdminWorkspaceLayout } from './AdminWorkspaceLayout';

const siteSidebarLayoutMock = vi.fn(
  (props: {
    children: React.ReactNode;
    sidebar: React.ReactNode;
    stretch?: boolean;
  }) => (
    <div data-stretch={String(Boolean(props.stretch))} data-testid="layout">
      {props.sidebar}
      {props.children}
    </div>
  )
);

vi.mock('@/components/mit-sailing/SiteSidebarLayout', () => ({
  SiteSidebarLayout: (props: {
    children: React.ReactNode;
    sidebar: React.ReactNode;
    stretch?: boolean;
  }) => siteSidebarLayoutMock(props),
}));

describe('AdminWorkspaceLayout', () => {
  it('does not stretch sidebar to main column height', () => {
    render(
      <AdminWorkspaceLayout sidebar={<nav>Admin nav</nav>}>
        <main>Users table</main>
      </AdminWorkspaceLayout>
    );

    expect(siteSidebarLayoutMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ stretch: true })
    );
    expect(siteSidebarLayoutMock.mock.calls[0]?.[0]).not.toHaveProperty(
      'stretch'
    );
    expect(screen.getByTestId('layout')).toHaveAttribute(
      'data-stretch',
      'false'
    );
    expect(screen.getByText('Admin nav')).toBeInTheDocument();
    expect(screen.getByText('Users table')).toBeInTheDocument();
  });
});
