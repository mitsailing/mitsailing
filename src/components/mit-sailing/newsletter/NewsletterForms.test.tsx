import { render, screen } from '@testing-library/react';
import type * as ReactModule from 'react';
import type * as ReactDomModule from 'react-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterPreferenceForm } from '@/components/mit-sailing/newsletter/NewsletterPreferenceForm';
import { NewsletterSignupForm } from '@/components/mit-sailing/newsletter/NewsletterSignupForm';

type MockActionState = {
  error?: string;
  fieldErrors?: { email?: string };
  formError?: string;
  ok: boolean | null;
};

const actionStateMock = vi.hoisted(() => ({
  formAction: vi.fn(),
  state: { ok: false } as MockActionState,
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    useActionState: vi.fn(() => [
      actionStateMock.state,
      actionStateMock.formAction,
    ]),
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
});

describe('NewsletterPreferenceForm', () => {
  it('marks preference group invalid when saving fails', () => {
    actionStateMock.state = { error: 'unauthorized', ok: false };

    const view = render(
      <NewsletterPreferenceForm
        action={vi.fn()}
        errorLabel="Could not save newsletter preferences."
        lists={preferenceLists}
        submitLabel="Save preferences"
        successLabel="Newsletter preferences saved."
      />
    );

    expect(view.container.querySelector('fieldset')).toHaveAttribute(
      'aria-invalid',
      'true'
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
});
