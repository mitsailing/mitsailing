import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  AdminEventField,
  AdminEventReadOnlyNotice,
} from '@/components/mit-sailing/admin/events/AdminEventShared';

function adminEventsReadOnlyNoticeTranslation(key: string) {
  if (key === 'read_only_notice_title') {
    return 'Read-only access';
  }
  if (key === 'read_only_notice_body') {
    return 'You can review this event but cannot edit it.';
  }
  return key;
}

describe('AdminEventField', () => {
  it('links hint copy to the field control', () => {
    render(
      <AdminEventField
        hint="Shown to screen readers on focus."
        htmlFor="event-name"
        label="Event name"
      >
        {(controlProps) => <input id="event-name" {...controlProps} />}
      </AdminEventField>
    );

    const input = screen.getByLabelText('Event name');
    const hint = screen.getByText('Shown to screen readers on focus.');

    expect(hint.id).toBeTruthy();
    expect(input).toHaveAttribute('aria-describedby', hint.id);
  });

  it('merges aria-describedby when the control is a React element', () => {
    render(
      <AdminEventField hint="Extra guidance." htmlFor="event-slug" label="Slug">
        <input aria-describedby="prior-help" id="event-slug" />
      </AdminEventField>
    );

    const input = screen.getByLabelText('Slug');
    const hint = screen.getByText('Extra guidance.');

    expect(input.getAttribute('aria-describedby')).toBe(
      `prior-help ${hint.id}`
    );
  });

  it('passes undefined descriptions without a hint', () => {
    render(
      <AdminEventField htmlFor="event-capacity" label="Capacity">
        {(controlProps) => <input id="event-capacity" {...controlProps} />}
      </AdminEventField>
    );

    expect(screen.getByLabelText('Capacity')).not.toHaveAttribute(
      'aria-describedby'
    );
  });
});

describe('AdminEventReadOnlyNotice', () => {
  it('renders read-only title and body copy', () => {
    render(
      <AdminEventReadOnlyNotice t={adminEventsReadOnlyNoticeTranslation} />
    );

    expect(screen.getByText('Read-only access')).toBeInTheDocument();
    expect(
      screen.getByText('You can review this event but cannot edit it.')
    ).toBeInTheDocument();
  });
});
