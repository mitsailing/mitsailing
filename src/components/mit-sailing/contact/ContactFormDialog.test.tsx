import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContactFormDialog } from '@/components/mit-sailing/contact/ContactFormDialog';

function renderDialog() {
  return render(
    <ContactFormDialog currentYear={2026} formAction={vi.fn(async () => {})} />
  );
}

describe('ContactFormDialog', () => {
  it('opens modal form with selected topic from action card', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(
      screen.getByRole('button', { name: 'Contact about a visit' })
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Visit the Pavilion',
    });
    expect(within(dialog).getByLabelText('Topic')).toHaveValue(
      'Visit the Pavilion'
    );
  });

  it('closes modal form with escape', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(
      screen.getByRole('button', { name: 'Contact about reservations' })
    );
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
