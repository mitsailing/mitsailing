import { Field, Label } from '@headlessui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { RegistrationBooleanSwitch } from '@/components/mit-sailing/events/RegistrationBooleanSwitch';

function renderSwitch(props?: { required?: boolean }) {
  render(
    <form data-testid="switch-form">
      <Field>
        <RegistrationBooleanSwitch
          aria-labelledby="agreement-label"
          id="agreement"
          name="swimAgreementAccepted"
          required={props?.required}
        />
        <Label id="agreement-label">Swim agreement</Label>
      </Field>
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
  it('omits value when unchecked', () => {
    renderSwitch();

    expect(getFormValue('swimAgreementAccepted')).toBeNull();
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

  it('marks the backing checkbox as required', () => {
    renderSwitch({ required: true });

    const backingCheckbox = document.querySelector(
      'input[name="swimAgreementAccepted"]'
    );

    expect(backingCheckbox).toBeInstanceOf(HTMLInputElement);
    expect(backingCheckbox).toHaveAttribute('required');
    expect(backingCheckbox).toHaveAttribute('aria-required', 'true');
    expect(backingCheckbox).toHaveAttribute(
      'aria-labelledby',
      'agreement-label'
    );
  });
});
