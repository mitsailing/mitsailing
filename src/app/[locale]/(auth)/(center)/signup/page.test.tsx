import { render, screen } from '@testing-library/react';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type SignUpFormProps = {
  readonly callbackUrl: string;
  readonly initialEmail?: string;
};

const mocks = vi.hoisted(() => ({
  SignUpForm: vi.fn((props: SignUpFormProps) => (
    <section
      data-callback-url={props.callbackUrl}
      data-initial-email={props.initialEmail ?? ''}
      data-testid="sign-up-form"
    />
  )),
  getTranslations: vi.fn(),
  redirectIfAuthenticated: vi.fn(),
  setRequestLocale: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('@/libs/auth/dal', () => ({
  redirectIfAuthenticated: mocks.redirectIfAuthenticated,
}));

vi.mock('@/libs/I18nNavigation', () => ({
  Link: (props: {
    readonly children: React.ReactNode;
    readonly className?: string;
    readonly href: string;
  }) => (
    <a className={props.className} href={props.href}>
      {props.children}
    </a>
  ),
}));

vi.mock('./SignUpForm', () => ({
  SignUpForm: mocks.SignUpForm,
}));

function signUpPageProps(searchParams: {
  readonly callbackUrl?: string | string[];
  readonly email?: string | string[];
}) {
  return {
    params: Promise.resolve({ locale: 'en' }),
    searchParams: Promise.resolve(searchParams),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTranslations.mockResolvedValue((key: string) => key);
});

describe('SignUpPage', () => {
  it('passes event callbacks through onboarding before sign-up', async () => {
    const { default: SignUpPage } = await import('./page');

    render(
      await SignUpPage(
        signUpPageProps({
          callbackUrl: ['/events/frostbite/register'],
          email: [' Sailor@MIT.EDU '],
        })
      )
    );

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.redirectIfAuthenticated).toHaveBeenCalledWith(
      'en',
      '/onboarding?callbackUrl=%2Fevents%2Ffrostbite%2Fregister'
    );
    expect(screen.getByTestId('sign-up-form')).toHaveAttribute(
      'data-callback-url',
      '/onboarding?callbackUrl=%2Fevents%2Ffrostbite%2Fregister'
    );
    expect(screen.getByTestId('sign-up-form')).toHaveAttribute(
      'data-initial-email',
      ' Sailor@MIT.EDU '
    );
    expect(screen.getByRole('link', { name: 'sign_in_link' })).toHaveAttribute(
      'href',
      '/login?callbackUrl=%2Fonboarding%3FcallbackUrl%3D%252Fevents%252Ffrostbite%252Fregister'
    );
  });

  it('drops unsafe callbacks before sign-up redirects', async () => {
    const { default: SignUpPage } = await import('./page');

    render(
      await SignUpPage(
        signUpPageProps({
          callbackUrl: 'https://evil.example/phish',
          email: 'sailor@mit.edu',
        })
      )
    );

    expect(mocks.redirectIfAuthenticated).toHaveBeenCalledWith(
      'en',
      '/onboarding'
    );
    expect(screen.getByTestId('sign-up-form')).toHaveAttribute(
      'data-callback-url',
      '/onboarding'
    );
    expect(screen.getByRole('link', { name: 'sign_in_link' })).toHaveAttribute(
      'href',
      '/login?callbackUrl=%2Fonboarding'
    );
  });

  it('uses translated sign-up metadata', async () => {
    const { generateMetadata } = await import('./page');

    await expect(generateMetadata(signUpPageProps({}))).resolves.toEqual({
      description: 'meta_description',
      title: 'meta_title',
    });
    expect(mocks.getTranslations).toHaveBeenCalledWith({
      locale: 'en',
      namespace: 'SignUpPage',
    });
  });
});
