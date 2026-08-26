import { render, screen } from '@testing-library/react';
import type * as ReactDom from 'react-dom';
import { describe, expect, it, vi } from 'vitest';
import { FormSubmitTimeoutContext } from '@/components/ui/form-submit-timeout-context';
import { SubmitButton } from '@/components/ui/submit-button';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const saveAction = vi.fn(async () => {});
const sendAction = vi.fn(async () => {});

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof ReactDom>('react-dom');
  return {
    ...actual,
    useFormStatus: vi.fn(() => ({
      pending: false,
      action: null,
      data: null,
      method: null,
    })),
  };
});

function pendingFormStatus(
  action: NonNullable<ReactDom.FormStatus['action']>
): ReactDom.FormStatus {
  return {
    pending: true,
    action,
    data: new FormData(),
    method: 'post',
  };
}

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

  it('shows pending only for the matching formAction', async () => {
    const { useFormStatus } = await import('react-dom');

    vi.mocked(useFormStatus).mockReturnValue(pendingFormStatus(sendAction));

    render(
      <form action={saveAction}>
        <SubmitButton formAction={saveAction} pendingKind="saving">
          Save
        </SubmitButton>
        <SubmitButton formAction={sendAction} pendingKind="sending">
          Send
        </SubmitButton>
      </form>
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'pending_sending' })
    ).toBeDisabled();
  });

  it('re-enables submit when the form submit timed out', async () => {
    const { useFormStatus } = await import('react-dom');

    vi.mocked(useFormStatus).mockReturnValue(pendingFormStatus(async () => {}));

    render(
      <FormSubmitTimeoutContext.Provider value={true}>
        <form action={async () => {}}>
          <SubmitButton pendingLabel="Saving...">Save</SubmitButton>
        </form>
      </FormSubmitTimeoutContext.Provider>
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute(
      'aria-busy'
    );
  });
});
