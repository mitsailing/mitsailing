import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SubmitButton } from '@/components/ui/submit-button';

describe('SubmitButton', () => {
  it('renders normal submit state', () => {
    render(<SubmitButton pendingLabel="Saving...">Save</SubmitButton>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).not.toHaveAttribute('aria-busy');
  });

  it('renders pending state with spinner and description', () => {
    render(
      <SubmitButton pending pendingLabel="Saving...">
        Save
      </SubmitButton>
    );

    const button = screen.getByRole('button', { name: 'Saving...' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('title', 'Saving...');
    expect(button).toHaveAccessibleDescription('Saving...');
    expect(button.querySelector('.animate-spin')).not.toBeNull();
  });

  it('preserves disabled state', () => {
    render(
      <SubmitButton disabled pendingLabel="Saving...">
        Save
      </SubmitButton>
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('preserves explicit button type', () => {
    render(
      <SubmitButton pendingLabel="Saving..." type="button">
        Save
      </SubmitButton>
    );

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute(
      'type',
      'button'
    );
  });
});
