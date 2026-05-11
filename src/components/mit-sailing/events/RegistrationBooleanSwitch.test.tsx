import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { RegistrationBooleanSwitch } from '@/components/mit-sailing/events/RegistrationBooleanSwitch';

function renderSwitch() {
  render(
    <form data-testid="switch-form">
      <RegistrationBooleanSwitch
        aria-labelledby="agreement-label"
        id="agreement"
        name="swimAgreementAccepted"
      />
      <label htmlFor="agreement" id="agreement-label">
        Swim agreement
      </label>
    </form>
  );
}

function getFormValue(name: string) {
  const form = screen.getByTestId('switch-form');

  if (!(form instanceof HTMLFormElement)) {
    throw new Error('Expected switch form to be a form element.');
  }

  return new FormData(form).get(name);
}

describe('RegistrationBooleanSwitch', () => {
  it('submits false when unchecked', () => {
    renderSwitch();

    expect(getFormValue('swimAgreementAccepted')).toBe('false');
  });

  it('submits true when checked', async () => {
    const user = userEvent.setup();
    renderSwitch();

    await user.click(screen.getByRole('switch', { name: 'Swim agreement' }));

    expect(
      screen.getByRole('switch', { name: 'Swim agreement' })
    ).toBeChecked();
    expect(getFormValue('swimAgreementAccepted')).toBe('true');
  });

  it('toggles from external label', async () => {
    const user = userEvent.setup();
    renderSwitch();

    await user.click(screen.getByText('Swim agreement'));

    expect(
      screen.getByRole('switch', { name: 'Swim agreement' })
    ).toBeChecked();
    expect(getFormValue('swimAgreementAccepted')).toBe('true');
  });
});
