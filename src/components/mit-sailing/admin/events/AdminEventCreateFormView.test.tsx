import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import messages from '@/locales/en.json';
import { AdminEventCreateFormView } from './AdminEventCreateFormView';

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
});
