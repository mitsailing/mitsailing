import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ActionForm, FormActions } from '@/components/ui/action-form';
import { SubmitButton } from '@/components/ui/submit-button';
import {
  collectInvalidFormControls,
  getFormControlLabel,
} from '@/libs/forms/formValidationSummary';

describe('formValidationSummary', () => {
  it('collects invalid required controls with labels', () => {
    render(
      <form aria-label="Test form">
        <label htmlFor="name-field">Name</label>
        <input id="name-field" name="name" required type="text" />
      </form>
    );
    const form = screen.getByRole('form', { name: 'Test form' });
    if (!(form instanceof HTMLFormElement)) {
      throw new TypeError('expected HTMLFormElement');
    }
    const input = screen.getByLabelText('Name');
    expect(input).toBeInvalid();

    const entries = collectInvalidFormControls(form);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      controlId: 'name-field',
      label: 'Name',
    });
  });

  it('reads aria-label when no associated label exists', () => {
    render(
      <input
        aria-label="Phone number"
        id="phone-field"
        name="phone"
        type="tel"
      />
    );
    const input = screen.getByLabelText('Phone number');
    if (!(input instanceof HTMLInputElement)) {
      throw new TypeError('expected HTMLInputElement');
    }
    expect(getFormControlLabel(input)).toBe('Phone number');
  });
});

describe('ActionForm', () => {
  it('shows validation summary when required field is empty', async () => {
    const user = userEvent.setup();

    render(
      <ActionForm action="/test" formId="test-form">
        <label htmlFor="name-field">Name</label>
        <input id="name-field" name="name" required type="text" />
        <FormActions>
          <SubmitButton pendingLabel="Saving...">Save</SubmitButton>
        </FormActions>
      </ActionForm>
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Fix the following errors'
    );
    expect(screen.getByRole('button', { name: /Name:/u })).toBeVisible();
  });

  it('renders form-level server error', () => {
    render(
      <ActionForm action="/test" formError="Could not save." formId="test-form">
        <FormActions>
          <SubmitButton pendingLabel="Saving...">Save</SubmitButton>
        </FormActions>
      </ActionForm>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not save.');
  });
});
