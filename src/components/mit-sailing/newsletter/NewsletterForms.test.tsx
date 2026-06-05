import { render, screen } from '@testing-library/react';
import type * as ReactModule from 'react';
import type * as ReactDomModule from 'react-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NewsletterOneClickResubscribeForm,
  NewsletterPreferenceForm,
} from '@/components/mit-sailing/newsletter/NewsletterPreferenceForm';
import { NewsletterSignupForm } from '@/components/mit-sailing/newsletter/NewsletterSignupForm';

type MockActionState = {
  error?: string;
  fieldErrors?: { email?: string };
  formError?: string;
  ok: boolean | null;
};
type MockActionReducer = (
  previousState: MockActionState,
  formData: FormData
) => Promise<MockActionState>;

const actionStateMock = vi.hoisted(() => ({
  formAction: vi.fn(),
  reducer: null as MockActionReducer | null,
  state: { ok: false } as MockActionState,
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    useActionState: vi.fn((reducer: MockActionReducer) => {
      actionStateMock.reducer = reducer;
      return [actionStateMock.state, actionStateMock.formAction];
    }),
  };
});

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactDomModule>();
  return {
    ...actual,
    useFormStatus: () => ({ pending: false }),
  };
});

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      lists_label: 'Newsletter lists',
      preferences_error: 'Could not save newsletter preferences.',
      signup_company: 'Company',
      signup_email: 'Email',
      signup_error_email_invalid: 'Enter a valid email address.',
      signup_error_email_required: 'Enter your email address.',
      signup_error_rate_limited: 'Too many signup attempts.',
      signup_name: 'Name',
      signup_privacy: 'You can unsubscribe.',
      signup_submit: 'Subscribe',
      signup_submit_pending: 'Subscribing',
      signup_success: 'You are subscribed.',
    };
    return messages[key] ?? key;
  },
}));

vi.mock('@/libs/newsletter/newsletterActions', () => ({
  submitNewsletterSignupAction: vi.fn(),
}));

const newsletterLists = [
  {
    description: 'General updates',
    id: 'list-general',
    name: 'General',
    slug: 'general',
  },
];

const preferenceLists = [
  {
    description: 'General updates',
    id: 'list-general',
    name: 'General',
    subscribed: true,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  actionStateMock.reducer = null;
  actionStateMock.state = { ok: false };
});

describe('NewsletterSignupForm', () => {
  it('marks email invalid when validation fails', () => {
    actionStateMock.state = {
      fieldErrors: { email: 'invalid_email' },
      ok: false,
    };

    render(<NewsletterSignupForm lists={newsletterLists} locale="en" />);

    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-describedby',
      'newsletter-email-error'
    );
    expect(screen.getByRole('alert')).toHaveAttribute(
      'id',
      'newsletter-email-error'
    );
  });

  it('describes the form with submit validation errors', () => {
    actionStateMock.state = { formError: 'rate_limited', ok: false };

    const view = render(
      <NewsletterSignupForm lists={newsletterLists} locale="en" />
    );

    expect(view.container.querySelector('form')).toHaveAttribute(
      'aria-describedby',
      'newsletter-signup-error'
    );
    expect(screen.getByRole('alert')).toHaveAttribute(
      'id',
      'newsletter-signup-error'
    );
  });

  it('hides signup fields after success', () => {
    actionStateMock.state = { ok: true };

    render(<NewsletterSignupForm lists={newsletterLists} locale="en" />);

    expect(screen.getByText('You are subscribed.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });
});

describe('NewsletterPreferenceForm', () => {
  it('describes preference errors when saving fails', () => {
    actionStateMock.state = { error: 'unauthorized', ok: false };

    const view = render(
      <NewsletterPreferenceForm
        action={vi.fn()}
        errorLabel="Could not save newsletter preferences."
        legendLabel="Newsletter lists"
        lists={preferenceLists}
        submitLabel="Save preferences"
        successLabel="Newsletter preferences saved."
      />
    );

    expect(view.container.querySelector('fieldset')).toHaveAttribute(
      'aria-describedby',
      'newsletter-preference-error'
    );
    expect(screen.getByRole('alert')).toHaveAttribute(
      'id',
      'newsletter-preference-error'
    );
  });

  it('renders checked lists with accessible descriptions', () => {
    actionStateMock.state = { ok: null };
    const action = vi.fn().mockResolvedValue({ ok: true });

    render(
      <NewsletterPreferenceForm
        action={action}
        errorLabel="Could not save newsletter preferences."
        legendLabel="Newsletter lists"
        lists={preferenceLists}
        submitLabel="Save preferences"
        successLabel="Newsletter preferences saved."
      />
    );

    expect(screen.getByLabelText('General')).toBeChecked();
    expect(screen.getByLabelText('General')).toHaveAccessibleDescription(
      'General updates'
    );
    expect(
      screen.getByRole('button', { name: 'Save preferences' })
    ).toBeEnabled();
  });

  it('passes preference submissions to the provided action', async () => {
    actionStateMock.state = { ok: null };
    const action = vi.fn().mockResolvedValue({ ok: true });
    const formData = new FormData();

    render(
      <NewsletterPreferenceForm
        action={action}
        errorLabel="Could not save newsletter preferences."
        legendLabel="Newsletter lists"
        lists={preferenceLists}
        submitLabel="Save preferences"
        successLabel="Newsletter preferences saved."
      />
    );

    await expect(
      actionStateMock.reducer?.({ ok: null }, formData)
    ).resolves.toEqual({ ok: true });
    expect(action).toHaveBeenCalledWith(formData);
  });

  it('shows the saved message after preference updates succeed', () => {
    actionStateMock.state = { ok: true };

    render(
      <NewsletterPreferenceForm
        action={vi.fn()}
        errorLabel="Could not save newsletter preferences."
        legendLabel="Newsletter lists"
        lists={preferenceLists}
        submitLabel="Save preferences"
        successLabel="Newsletter preferences saved."
      />
    );

    expect(
      screen.getByText('Newsletter preferences saved.')
    ).toBeInTheDocument();
  });
});

describe('NewsletterOneClickResubscribeForm', () => {
  it('posts every selected list id for one-click resubscribe', () => {
    actionStateMock.state = { ok: null };

    const view = render(
      <NewsletterOneClickResubscribeForm
        action={vi.fn()}
        errorLabel="Could not resubscribe."
        listIds={['general', 'racing']}
        submitLabel="Resubscribe"
        successLabel="Resubscribed."
      />
    );

    expect(screen.getByRole('button', { name: 'Resubscribe' })).toBeEnabled();
    expect(
      [...view.container.querySelectorAll('input[name="listId"]')].map(
        (input) => input.getAttribute('value')
      )
    ).toEqual(['general', 'racing']);
  });

  it('passes one-click resubscribe submissions to the provided action', async () => {
    actionStateMock.state = { ok: null };
    const action = vi.fn().mockResolvedValue({ ok: true });
    const formData = new FormData();

    render(
      <NewsletterOneClickResubscribeForm
        action={action}
        errorLabel="Could not resubscribe."
        listIds={['general']}
        submitLabel="Resubscribe"
        successLabel="Resubscribed."
      />
    );

    await expect(
      actionStateMock.reducer?.({ ok: null }, formData)
    ).resolves.toEqual({ ok: true });
    expect(action).toHaveBeenCalledWith(formData);
  });

  it('shows resubscribe success and error states', () => {
    actionStateMock.state = { ok: true };

    const view = render(
      <NewsletterOneClickResubscribeForm
        action={vi.fn()}
        errorLabel="Could not resubscribe."
        listIds={['general']}
        submitLabel="Resubscribe"
        successLabel="Resubscribed."
      />
    );

    expect(screen.getByText('Resubscribed.')).toBeInTheDocument();

    actionStateMock.state = { ok: false };
    view.rerender(
      <NewsletterOneClickResubscribeForm
        action={vi.fn()}
        errorLabel="Could not resubscribe."
        listIds={['general']}
        submitLabel="Resubscribe"
        successLabel="Resubscribed."
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not resubscribe.'
    );
  });
});
