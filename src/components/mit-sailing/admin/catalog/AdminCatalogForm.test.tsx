import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminCatalogForm } from '@/components/mit-sailing/admin/catalog/AdminCatalogForm';
import { catalogResourceDefinitions } from '@/libs/admin/catalog/catalogDefinitions';

describe('AdminCatalogForm', () => {
  it('submits event category fields through the focused form branch', async () => {
    const formAction = vi.fn(async (_formData: FormData) => {
      await Promise.resolve();
    });
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
    const formAction = vi.fn(async (_formData: FormData) => {
      await Promise.resolve();
    });
    const user = userEvent.setup();
    render(
      <AdminCatalogForm
        definition={catalogResourceDefinitions.event_categories}
        formAction={formAction}
        headingKey="edit_heading"
        row={{ id: 'cat-1', isVisible: true, name: 'Regattas' }}
      />
    );

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

  it('blocks invalid event category submissions before the action', async () => {
    const formAction = vi.fn(async (_formData: FormData) => {
      await Promise.resolve();
    });
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
