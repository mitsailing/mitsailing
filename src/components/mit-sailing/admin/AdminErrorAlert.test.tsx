import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminErrorAlert, AdminSuccessAlert } from './AdminErrorAlert';

describe('AdminErrorAlert', () => {
  it('renders assertive alert live region with full message semantics', () => {
    render(<AdminErrorAlert>Save failed.</AdminErrorAlert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Save failed.');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveAttribute('aria-atomic', 'true');
    expect(alert).toHaveAttribute('aria-relevant', 'all');
  });
});

describe('AdminSuccessAlert', () => {
  it('renders polite status live region with full message semantics', () => {
    render(<AdminSuccessAlert>Event saved.</AdminSuccessAlert>);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Event saved.');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(status).toHaveAttribute('aria-relevant', 'all');
  });
});
