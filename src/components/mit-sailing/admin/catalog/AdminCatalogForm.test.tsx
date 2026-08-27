import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminCatalogForm } from '@/components/mit-sailing/admin/catalog/AdminCatalogForm';
import { catalogResourceDefinitions } from '@/libs/admin/catalog/catalogDefinitions';

describe('AdminCatalogForm', () => {
  it('submits event category fields through the focused form branch', async () => {
    const formAction = vi.fn<(formData: FormData) => Promise<void>>(
      async () => {
        await Promise.resolve();
      }
    );
    const user = userEvent.setup();
    render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.event_categories}
        formAction={formAction}
        headingKey="new_heading"
      />
    );

    await user.type(screen.getByLabelText('Name'), 'Regattas');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(formAction).toHaveBeenCalled();
    });
    const formData = formAction.mock.calls[0]?.[0];
    expect(formData).toBeInstanceOf(FormData);
    if (!(formData instanceof FormData)) {
      throw new Error('Expected form data');
    }
    expect(formData.get('name')).toBe('Regattas');
    expect(formData.getAll('isVisible')).toEqual(['false']);
  });

  it('keeps event category server field errors on the matching input', () => {
    render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.event_categories}
        fieldErrors={{ name: 'Check the fields.' }}
        formAction={async () => {
          await Promise.resolve();
        }}
        headingKey="new_heading"
      />
    );

    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription(
      'Check the fields.'
    );
  });

  it('offers a secondary save-and-continue submit on edit forms', async () => {
    const formAction = vi.fn<(formData: FormData) => Promise<void>>(
      async () => {
        await Promise.resolve();
      }
    );
    const user = userEvent.setup();
    render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.event_categories}
        formAction={formAction}
        headingKey="edit_heading"
        row={{ id: 'cat-1', isVisible: true, name: 'Regattas' }}
      />
    );

    expect(
      screen.getAllByRole('button').map((button) => button.textContent)
    ).toEqual(['Save', 'Save and continue editing']);
    await user.click(
      screen.getByRole('button', { name: 'Save and continue editing' })
    );

    await waitFor(() => {
      expect(formAction).toHaveBeenCalled();
    });
    const formData = formAction.mock.calls[0]?.[0];
    expect(formData).toBeInstanceOf(FormData);
    if (!(formData instanceof FormData)) {
      throw new Error('Expected form data');
    }
    expect(formData.get('redirectTo')).toBe('edit');
  });

  it('keeps generic edit form primary save as the implicit submit action', () => {
    render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.donation_funds}
        formAction={async () => {
          await Promise.resolve();
        }}
        headingKey="edit_heading"
        row={{
          description: 'Supports junior sailing.',
          displayOrder: 1,
          fundId: 'SAIL',
          id: 'fund-1',
          isVisible: true,
          name: 'Sailing Fund',
          url: 'https://example.com/donate',
        }}
      />
    );

    expect(
      screen.getAllByRole('button').map((button) => button.textContent)
    ).toEqual(['Save', 'Save and continue editing']);
  });

  it('blocks invalid event category submissions before the action', async () => {
    const formAction = vi.fn<(formData: FormData) => Promise<void>>(
      async () => {
        await Promise.resolve();
      }
    );
    const user = userEvent.setup();
    render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.event_categories}
        formAction={formAction}
        headingKey="new_heading"
      />
    );

    await user.type(screen.getByLabelText('Name'), '   ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(formAction).not.toHaveBeenCalled();
  });
});
