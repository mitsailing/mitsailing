import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AdminFacetedFilter } from './AdminFacetedFilter';

beforeAll(() => {
  class ResizeObserverMock {
    observe() {
      return this;
    }

    unobserve() {
      return this;
    }

    disconnect() {
      return this;
    }
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  Element.prototype.scrollIntoView = vi.fn();
});

const options = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

describe('AdminFacetedFilter', () => {
  it('uses compact h-8 dashed trigger', () => {
    render(
      <AdminFacetedFilter
        defaultValue="all"
        label="Status"
        onSelect={vi.fn()}
        options={options}
        value="all"
      />
    );

    const trigger = screen.getByRole('button', { name: /Status/i });
    expect(trigger).toHaveClass('h-8', 'border-dashed');
  });

  it('closes popover after option select', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <AdminFacetedFilter
        defaultValue="all"
        label="Status"
        onSelect={onSelect}
        options={options}
        value="all"
      />
    );

    await user.click(screen.getByRole('button', { name: /Status/i }));
    expect(await screen.findByRole('option', { name: 'Active' })).toBeVisible();

    await user.click(screen.getByRole('option', { name: 'Active' }));

    expect(onSelect).toHaveBeenCalledWith('active');
    await waitFor(() => {
      expect(
        screen.queryByRole('option', { name: 'Active' })
      ).not.toBeInTheDocument();
    });
  });
});
