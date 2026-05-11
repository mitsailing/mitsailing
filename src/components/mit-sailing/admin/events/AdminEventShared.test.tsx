import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminEventField } from '@/components/mit-sailing/admin/events/AdminEventShared';

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

    expect(hint).toHaveAttribute('id', 'event-name-hint');
    expect(input).toHaveAttribute('aria-describedby', 'event-name-hint');
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
