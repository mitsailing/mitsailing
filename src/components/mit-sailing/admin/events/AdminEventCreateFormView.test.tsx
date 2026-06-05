import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import messages from '@/locales/en.json';
import { AdminEventCreateFormView } from './AdminEventCreateFormView';

const mocks = vi.hoisted(() => ({
  AdminRichTextEditor: vi.fn(
    (props: {
      defaultValue: string;
      fieldId: string;
      fieldKey: string;
      label: string;
    }) => (
      <div data-testid={`rich-editor-${props.fieldKey}`}>
        <label htmlFor={props.fieldId}>{props.label}</label>
        <input
          data-field-id={props.fieldId}
          name={props.fieldKey}
          type="hidden"
          value={props.defaultValue}
        />
      </div>
    )
  ),
}));

vi.mock('@/components/mit-sailing/admin/catalog/AdminRichTextEditor', () => ({
  AdminRichTextEditor: mocks.AdminRichTextEditor,
}));

vi.mock('@/libs/admin/events/eventAdminActions', () => ({
  createAdminEventAction: vi.fn(),
}));

type AdminEventCreateFormViewProps = React.ComponentProps<
  typeof AdminEventCreateFormView
>;

const t = createTranslator({
  locale: 'en',
  messages,
  namespace: 'AdminEvents',
});

const tCommon = createTranslator({
  locale: 'en',
  messages,
  namespace: 'Common',
});

function renderView(props: Partial<AdminEventCreateFormViewProps> = {}) {
  return render(
    <AdminEventCreateFormView
      categories={[{ id: 'category-1', name: 'Clinic' }]}
      errorCode={null}
      locale="en"
      t={t}
      tCommon={tCommon}
      {...props}
    />
  );
}

describe('AdminEventCreateFormView', () => {
  it('does not render a slug textbox', () => {
    const view = renderView();

    expect(screen.queryByLabelText('Slug')).toBeNull();
    expect(view.container.querySelector('input[name="slug"]')).toBeNull();
  });

  it('requires an initial event date', () => {
    renderView();

    expect(screen.getByLabelText('Starts')).toBeRequired();
    expect(screen.getByLabelText('Ends')).toBeRequired();
  });

  it('creates event descriptions with the rich text editor', () => {
    const view = renderView();

    expect(screen.getByTestId('rich-editor-description')).toBeVisible();
    expect(
      view.container.querySelector('input[name="description"][type="hidden"]')
    ).toHaveValue('');
    expect(
      view.container.querySelector('textarea[name="description"]')
    ).toBeNull();
  });
});
