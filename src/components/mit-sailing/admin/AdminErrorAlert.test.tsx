import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminErrorAlert } from './AdminErrorAlert';

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
