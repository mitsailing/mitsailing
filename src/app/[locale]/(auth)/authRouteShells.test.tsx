import { render, screen, within } from '@testing-library/react';
import React from 'react';
import type { MockedFunction } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listUserRatingAssignmentRows } from '@/libs/mit-sailing/sailingRatingQueries';
import type { UserRatingAssignmentRow } from '@/libs/mit-sailing/sailingRatingQueries';
import ForgotPasswordPage, {
  generateMetadata as generateForgotPasswordMetadata,
} from './(center)/forgot-password/page';
import CenteredLayout from './(center)/layout';
import SignInContinuePage from './(center)/login/continue/page';
import SignInPage, {
  generateMetadata as generateSignInMetadata,
} from './(center)/login/page';
import ResetPasswordPage, {
  generateMetadata as generateResetPasswordMetadata,
} from './(center)/reset-password/page';
import SignUpPage, {
  generateMetadata as generateSignUpMetadata,
} from './(center)/signup/page';
import UnlockAccountPage from './(center)/unlock-account/page';
import VerifyEmailPage from './(center)/verify-email/page';
import AuthLayout from './layout';
import ProfileDeletePage, {
  generateMetadata as generateProfileDeleteMetadata,
} from './profile/delete/page';
import ProfileLayout from './profile/layout';
import ProfileNewsletterPage, {
  generateMetadata as generateProfileNewsletterMetadata,
} from './profile/newsletter/page';
import ProfilePage, {
  generateMetadata as generateProfileMetadata,
} from './profile/page';
import ProfilePasswordPage, {
  generateMetadata as generateProfilePasswordMetadata,
} from './profile/password/page';
import ProfileRatingsPage, {
  generateMetadata as generateProfileRatingsMetadata,
} from './profile/ratings/page';
import ProfileSecurityPage, {
  generateMetadata as generateProfileSecurityMetadata,
} from './profile/security/page';

type ListUserRatingAssignmentRowsFn = (
  userId: string,
  options?: { includeDeprecated?: boolean; client?: unknown }
) => Promise<UserRatingAssignmentRow[]>;

/**
 * Builds a {@link UserRatingAssignmentRow} for route-shell tests; production rows
 * always include public rating fields plus assignment metadata.
 *
 * @param row - Required `id` and `name`, plus any optional fields to override defaults.
 * @returns A fully populated assignment row for the profile ratings page tests.
 */
function userRatingAssignmentRowFixture(
  row: Pick<UserRatingAssignmentRow, 'id' | 'name'> &
    Partial<Omit<UserRatingAssignmentRow, 'id' | 'name'>>
): UserRatingAssignmentRow {
  return {
    slug: row.slug ?? row.id,
    shortName: row.shortName ?? null,
    description: row.description ?? '',
    category: row.category ?? null,
    level: row.level ?? null,
    windCondition: row.windCondition ?? null,
    guideUrl: row.guideUrl ?? null,
    grantableClasses: row.grantableClasses ?? [],
    unlockedBoats: row.unlockedBoats ?? [],
    isDeprecated: row.isDeprecated ?? false,
    issuedAt: row.issuedAt ?? null,
    issuedByName: row.issuedByName ?? null,
    eligibility: row.eligibility ?? { eligible: true },
    id: row.id,
    name: row.name,
  };
}

const routeMocks = vi.hoisted(() => ({
  connection: vi.fn(),
  findUnique: vi.fn(),
  getFormatter: vi.fn(),
  getExistingSubscriberPreferenceStateForUser: vi.fn(),
  getPublicNewsletterLists: vi.fn(),
  getTranslations: vi.fn(),
  listUserRatingAssignmentRows:
    vi.fn() as MockedFunction<ListUserRatingAssignmentRowsFn>,
  loggerWarn: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  redirectIfAuthenticated: vi.fn(),
  requireCurrentUser: vi.fn(),
  setRequestLocale: vi.fn(),
  updateProfileNewsletterPreferencesAction: vi.fn(),
}));

type Translator = ((key: string) => string) & {
  rich: (key: string) => string;
};

function createTranslator(namespace: string): Translator {
  return Object.assign((key: string) => `${namespace}.${key}`, {
    rich: (key: string) => `${namespace}.${key}`,
  });
}

vi.mock('next-intl/server', () => ({
  getFormatter: routeMocks.getFormatter,
  getTranslations: routeMocks.getTranslations,
  setRequestLocale: routeMocks.setRequestLocale,
}));

vi.mock('next/navigation', () => ({
  redirect: routeMocks.redirect,
}));

vi.mock('next/server', () => ({
  connection: routeMocks.connection,
}));

vi.mock('@/libs/auth/dal', () => ({
  redirectIfAuthenticated: routeMocks.redirectIfAuthenticated,
  requireCurrentUser: routeMocks.requireCurrentUser,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    user: {
      findUnique: routeMocks.findUnique,
    },
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    warn: routeMocks.loggerWarn,
  },
}));

vi.mock('@/libs/mit-sailing/sailingRatingQueries', () => ({
  listUserRatingAssignmentRows: routeMocks.listUserRatingAssignmentRows,
}));

vi.mock('@/libs/newsletter/newsletterActions', () => ({
  updateProfileNewsletterPreferencesAction:
    routeMocks.updateProfileNewsletterPreferencesAction,
}));

vi.mock('@/libs/newsletter/newsletterSubscriptions', () => ({
  getExistingSubscriberPreferenceStateForUser:
    routeMocks.getExistingSubscriberPreferenceStateForUser,
  getPublicNewsletterLists: routeMocks.getPublicNewsletterLists,
}));

vi.mock('@/components/mit-sailing/site/AuthCenterBrandMark', () => ({
  AuthCenterBrandMark: () => <div data-testid="auth-center-brand" />,
}));

vi.mock('@/components/auth/profile/ProfileSettingsChrome', () => ({
  ProfileSettingsChrome: (props: {
    children: React.ReactNode;
    locale: string;
    loginCallbackUrl: string;
  }) => (
    <section
      data-callback-url={props.loginCallbackUrl}
      data-locale={props.locale}
      data-testid="profile-settings-chrome"
    >
      {props.children}
    </section>
  ),
}));

vi.mock('./(center)/forgot-password/ForgotPasswordForm', () => ({
  ForgotPasswordForm: (props: {
    callbackUrl: string;
    initialEmail: string;
  }) => (
    <form
      aria-label="forgot-password-form"
      data-callback-url={props.callbackUrl}
      data-initial-email={props.initialEmail}
    />
  ),
}));

vi.mock('./(center)/login/SignInForm', () => ({
  SignInForm: (props: { callbackUrl: string }) => (
    <form aria-label="sign-in-form" data-callback-url={props.callbackUrl} />
  ),
}));

vi.mock('./(center)/reset-password/ResetPasswordForm', () => ({
  ResetPasswordForm: (props: {
    callbackUrl: string;
    initialEmail: string;
    initialResendLocked: boolean;
    mode: 'create-password' | 'reset-password';
    passwordHeading: string;
  }) => (
    <form
      aria-label="reset-password-form"
      data-callback-url={props.callbackUrl}
      data-initial-email={props.initialEmail}
      data-initial-resend-locked={String(props.initialResendLocked)}
      data-mode={props.mode}
      data-password-heading={props.passwordHeading}
    />
  ),
}));

vi.mock('./(center)/signup/SignUpForm', () => ({
  SignUpForm: (props: { callbackUrl: string; initialEmail?: string }) => (
    <form
      aria-label="sign-up-form"
      data-callback-url={props.callbackUrl}
      data-initial-email={props.initialEmail ?? ''}
    />
  ),
}));

vi.mock('./(center)/verify-email/VerifyEmailForm', () => ({
  VerifyEmailForm: (props: {
    callbackUrl: string;
    initialEmail: string;
    initialResendLocked: boolean;
  }) => (
    <form
      aria-label="verify-email-form"
      data-callback-url={props.callbackUrl}
      data-initial-email={props.initialEmail}
      data-initial-resend-locked={String(props.initialResendLocked)}
    />
  ),
}));

vi.mock('./profile/ProfileAccountClient', () => ({
  ProfileAccountClient: (props: {
    initialEmail: string;
    initialEmailDeliverabilityStatus: string;
    initialEmergencyContactName: string;
    initialEmergencyContactPhone: string;
    initialFirstName: string;
    initialLastName: string;
    initialMitClassYear: string | null;
    initialMitId: string | null;
    initialMitIdentityLocked: boolean;
    initialName: string | null;
    initialPhone: string;
    initialSailingAffiliation: string | null;
    initialSailingCardSummary: { status: string };
    initialThemePreference: string;
    initialUnconfirmedEmail: string | null;
    locale: string;
  }) => (
    <section
      aria-label="profile-account-client"
      data-email={props.initialEmail}
      data-email-deliverability={props.initialEmailDeliverabilityStatus}
      data-emergency-contact-name={props.initialEmergencyContactName}
      data-emergency-contact-phone={props.initialEmergencyContactPhone}
      data-first-name={props.initialFirstName}
      data-last-name={props.initialLastName}
      data-locale={props.locale}
      data-locked-identity={String(props.initialMitIdentityLocked)}
      data-mit-class-year={props.initialMitClassYear ?? ''}
      data-mit-id={props.initialMitId ?? ''}
      data-name={props.initialName ?? ''}
      data-phone={props.initialPhone}
      data-sailing-affiliation={props.initialSailingAffiliation ?? ''}
      data-sailing-card-status={props.initialSailingCardSummary.status}
      data-theme={props.initialThemePreference}
      data-unconfirmed-email={props.initialUnconfirmedEmail ?? ''}
    />
  ),
}));

vi.mock('./profile/ProfileDeleteAccountClient', () => ({
  ProfileDeleteAccountClient: (props: { signInHref: string }) => (
    <section
      aria-label="profile-delete-account-client"
      data-sign-in-href={props.signInHref}
    />
  ),
}));

vi.mock('./profile/ProfilePasswordClient', () => ({
  ProfilePasswordClient: () => <section aria-label="profile-password-client" />,
}));

vi.mock('./profile/ProfileSecurityClient', () => ({
  ProfileSecurityClient: () => <section aria-label="profile-security-client" />,
}));

vi.mock('@/components/mit-sailing/newsletter/NewsletterPreferenceForm', () => ({
  NewsletterPreferenceForm: (props: {
    errorLabel: string;
    lists: {
      description: string | null;
      id: string;
      name: string;
      subscribed: boolean;
    }[];
    successLabel: string;
    submitLabel: string;
  }) => (
    <section
      aria-label="newsletter-preference-form"
      data-error-label={props.errorLabel}
      data-success-label={props.successLabel}
    >
      <ul>
        {props.lists.map((list) => (
          <li
            data-description={list.description ?? ''}
            data-list-id={list.id}
            data-subscribed={String(list.subscribed)}
            key={list.id}
          >
            {list.name}
          </li>
        ))}
      </ul>
      <button type="button">{props.submitLabel}</button>
    </section>
  ),
}));

function routeProps(
  searchParams: Record<string, string | string[] | undefined> = {}
) {
  return {
    params: Promise.resolve({ locale: 'en' }),
    searchParams: Promise.resolve(searchParams),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.getFormatter.mockImplementation(async () => {
    await Promise.resolve();
    return {
      dateTime: (date: Date, options?: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          ...options,
        }).format(date),
    };
  });
  routeMocks.getTranslations.mockImplementation(
    async (props: { namespace: string }) => {
      await Promise.resolve();
      return createTranslator(props.namespace);
    }
  );
  routeMocks.redirectIfAuthenticated.mockImplementation(async () => {
    await Promise.resolve();
  });
  routeMocks.connection.mockImplementation(async () => {
    await Promise.resolve();
  });
  routeMocks.requireCurrentUser.mockResolvedValue({
    email: 'sailor@example.com',
    id: 'user-1',
    name: 'Sailor',
  });
  routeMocks.findUnique.mockResolvedValue({
    emailBouncedAt: new Date('2026-01-01T12:00:00Z'),
    emailSuppressedAt: null,
    emailSuppressionReason: null,
    emergencyContactName: 'Safety Person',
    emergencyContactPhone: '+16175550199',
    firstName: 'Sail',
    lastName: 'Or',
    legalAgreementAcceptances: [],
    mitClassYear: null,
    mitDataWarehouseVerifiedAt: null,
    mitId: null,
    phone: '+16175550100',
    sailingAffiliation: 'OTHER_NON_STUDENT',
    sailingCardExpiresOn: null,
    sailingCardIssuedAt: null,
    sailingCardNumber: null,
    sailingCardRequests: [],
    sailingCardSwimAgreementInitialedAt: null,
    sailingCardSwimAgreementInitials: null,
    sailingCardYear: null,
    themePreference: 'DARK',
    unconfirmedEmail: 'pending@example.com',
  });
  vi.mocked(listUserRatingAssignmentRows).mockResolvedValue(
    [] satisfies UserRatingAssignmentRow[]
  );
  routeMocks.getPublicNewsletterLists.mockResolvedValue([
    {
      description: 'Weekly race updates',
      id: 'list-racing',
      name: 'Racing',
    },
    {
      description: 'Harbor operations',
      id: 'list-harbor',
      name: 'Harbor',
    },
  ]);
  routeMocks.getExistingSubscriberPreferenceStateForUser.mockResolvedValue({
    subscriptions: [
      {
        listId: 'list-racing',
        status: 'subscribed',
      },
      {
        listId: 'list-harbor',
        status: 'unsubscribed',
      },
    ],
  });
});

describe('auth route shells', () => {
  it('auth layout sets the request locale and returns children', async () => {
    render(
      await AuthLayout({
        children: <p>Auth child</p>,
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(routeMocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(screen.getByText('Auth child')).toBeVisible();
  });

  it('center layout sets the request locale and renders the auth chrome', async () => {
    render(
      await CenteredLayout({
        children: <p>Center child</p>,
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(routeMocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(screen.getByTestId('auth-center-brand')).toBeInTheDocument();
    expect(screen.getByText('Center child')).toBeVisible();
    expect(screen.getByRole('main').parentElement).toHaveClass(
      'justify-start',
      'py-8',
      'sm:justify-center'
    );
  });

  it('sign-in metadata uses localized copy', async () => {
    await expect(generateSignInMetadata(routeProps())).resolves.toEqual({
      description: 'SignInPage.meta_description',
      title: 'SignInPage.meta_title',
    });
  });

  it('sign-in page passes a safe callback and renders invalid unlock error', async () => {
    render(
      await SignInPage(
        routeProps({
          callbackUrl: '/profile',
          error: 'unlock_invalid',
        })
      )
    );

    expect(routeMocks.redirectIfAuthenticated).toHaveBeenCalledWith(
      'en',
      '/profile'
    );
    expect(
      screen.getByRole('heading', { name: 'SignInPage.heading' })
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'SignInPage.unlock_invalid_error'
    );
    expect(screen.getByRole('form', { name: 'sign-in-form' })).toHaveAttribute(
      'data-callback-url',
      '/profile'
    );
    expect(
      screen.getByRole('link', { name: 'SignInPage.sign_up_link' })
    ).toHaveAttribute('href', '/signup?callbackUrl=%2Fprofile');
  });

  it('sign-in page renders unlocked banner without an error', async () => {
    render(await SignInPage(routeProps({ unlocked: '1' })));

    expect(screen.getByText('SignInPage.unlocked_banner')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sign-in page falls back to locale home callback', async () => {
    render(await SignInPage(routeProps()));

    expect(routeMocks.redirectIfAuthenticated).toHaveBeenCalledWith('en', '/');
    expect(
      screen.queryByText('SignInPage.unlocked_banner')
    ).not.toBeInTheDocument();
  });

  it('sign-in continuation applies yearly onboarding before callback', async () => {
    await expect(
      SignInContinuePage(routeProps({ callbackUrl: '/fleet' }))
    ).rejects.toThrow('NEXT_REDIRECT:/fleet');

    expect(routeMocks.requireCurrentUser).toHaveBeenCalledWith('en', '/fleet');
    expect(routeMocks.redirect).toHaveBeenCalledWith('/fleet');
  });

  it('sign-in continuation uses the first duplicate callback value', async () => {
    await expect(
      SignInContinuePage(routeProps({ callbackUrl: ['/fleet', '/events'] }))
    ).rejects.toThrow('NEXT_REDIRECT:/fleet');

    expect(routeMocks.requireCurrentUser).toHaveBeenCalledWith('en', '/fleet');
    expect(routeMocks.redirect).toHaveBeenCalledWith('/fleet');
  });

  it('sign-up metadata uses localized copy', async () => {
    await expect(generateSignUpMetadata(routeProps())).resolves.toEqual({
      description: 'SignUpPage.meta_description',
      title: 'SignUpPage.meta_title',
    });
  });

  it('sign-up page keeps an inbound callback through onboarding', async () => {
    render(await SignUpPage(routeProps({ callbackUrl: '/fleet' })));

    expect(routeMocks.redirectIfAuthenticated).toHaveBeenCalledWith(
      'en',
      '/onboarding?callbackUrl=%2Ffleet'
    );
    expect(
      screen.getByRole('heading', { name: 'SignUpPage.heading' })
    ).toBeVisible();
    expect(screen.getByRole('form', { name: 'sign-up-form' })).toHaveAttribute(
      'data-callback-url',
      '/onboarding?callbackUrl=%2Ffleet'
    );
    expect(
      screen.getByRole('link', { name: 'SignUpPage.sign_in_link' })
    ).toHaveAttribute(
      'href',
      '/login?callbackUrl=%2Fonboarding%3FcallbackUrl%3D%252Ffleet'
    );
  });

  it('sign-up page uses the first duplicate inbound callback', async () => {
    render(
      await SignUpPage(routeProps({ callbackUrl: ['/fleet', '/events'] }))
    );

    expect(screen.getByRole('form', { name: 'sign-up-form' })).toHaveAttribute(
      'data-callback-url',
      '/onboarding?callbackUrl=%2Ffleet'
    );
  });

  it('sign-up page forwards inbound email', async () => {
    render(await SignUpPage(routeProps({ email: 'sailor@example.com' })));

    expect(screen.getByRole('form', { name: 'sign-up-form' })).toHaveAttribute(
      'data-initial-email',
      'sailor@example.com'
    );
  });

  it('sign-up page uses the first duplicate inbound email', async () => {
    render(
      await SignUpPage(
        routeProps({ email: ['first@example.com', 'second@example.com'] })
      )
    );

    expect(screen.getByRole('form', { name: 'sign-up-form' })).toHaveAttribute(
      'data-initial-email',
      'first@example.com'
    );
  });

  it('sign-up page defaults new sailors to onboarding', async () => {
    render(await SignUpPage(routeProps()));

    expect(routeMocks.redirectIfAuthenticated).toHaveBeenCalledWith(
      'en',
      '/onboarding'
    );
    expect(screen.getByRole('form', { name: 'sign-up-form' })).toHaveAttribute(
      'data-callback-url',
      '/onboarding'
    );
    expect(
      screen.getByRole('link', { name: 'SignUpPage.sign_in_link' })
    ).toHaveAttribute('href', '/login?callbackUrl=%2Fonboarding');
  });

  it('forgot-password metadata uses localized copy', async () => {
    await expect(generateForgotPasswordMetadata(routeProps())).resolves.toEqual(
      {
        description: 'ForgotPasswordPage.meta_description',
        title: 'ForgotPasswordPage.meta_title',
      }
    );
  });

  it('forgot-password page passes callback and initial email', async () => {
    render(
      await ForgotPasswordPage(
        routeProps({ callbackUrl: '/profile', email: 'sailor@example.com' })
      )
    );

    expect(routeMocks.redirectIfAuthenticated).toHaveBeenCalledWith(
      'en',
      '/profile'
    );
    expect(
      screen.getByRole('form', { name: 'forgot-password-form' })
    ).toHaveAttribute('data-initial-email', 'sailor@example.com');
    expect(
      screen.getByRole('link', { name: 'ForgotPasswordPage.back_sign_in' })
    ).toHaveAttribute('href', '/login?callbackUrl=%2Fprofile');
  });

  it('forgot-password page defaults an empty initial email', async () => {
    render(await ForgotPasswordPage(routeProps()));

    expect(
      screen.getByRole('form', { name: 'forgot-password-form' })
    ).toHaveAttribute('data-initial-email', '');
  });

  it('reset-password metadata uses localized copy', async () => {
    await expect(generateResetPasswordMetadata(routeProps())).resolves.toEqual({
      description: 'ResetPasswordPage.meta_description',
      title: 'ResetPasswordPage.meta_title',
    });
  });

  it('reset-password page forwards resend lock state', async () => {
    render(
      await ResetPasswordPage(
        routeProps({
          callbackUrl: '/profile',
          codeSent: '1',
          email: 'sailor@example.com',
        })
      )
    );

    expect(
      screen.getByRole('form', { name: 'reset-password-form' })
    ).toHaveAttribute('data-initial-resend-locked', 'true');
    expect(
      screen.getByRole('form', { name: 'reset-password-form' })
    ).toHaveAttribute(
      'data-password-heading',
      'ResetPasswordPage.password_heading'
    );
  });

  it('reset-password page forwards create-password mode', async () => {
    render(
      await ResetPasswordPage(
        routeProps({
          email: 'legacy@example.com',
          mode: 'create-password',
        })
      )
    );

    expect(
      screen.getByRole('form', { name: 'reset-password-form' })
    ).toHaveAttribute('data-mode', 'create-password');
  });

  it('reset-password page defaults missing search params', async () => {
    render(await ResetPasswordPage(routeProps()));

    expect(
      screen.getByRole('form', { name: 'reset-password-form' })
    ).toHaveAttribute('data-initial-email', '');
    expect(
      screen.getByRole('form', { name: 'reset-password-form' })
    ).toHaveAttribute('data-initial-resend-locked', 'false');
    expect(
      screen.getByRole('form', { name: 'reset-password-form' })
    ).toHaveAttribute('data-mode', 'reset-password');
  });

  it('verify-email page forwards resend lock state', async () => {
    render(
      await VerifyEmailPage(
        routeProps({
          callbackUrl: '/profile',
          codeSent: '1',
          email: 'sailor@example.com',
        })
      )
    );

    expect(
      screen.getByRole('form', { name: 'verify-email-form' })
    ).toHaveAttribute('data-initial-email', 'sailor@example.com');
    expect(
      screen.getByRole('form', { name: 'verify-email-form' })
    ).toHaveAttribute('data-initial-resend-locked', 'true');
  });

  it('verify-email page defaults missing search params', async () => {
    render(await VerifyEmailPage(routeProps()));

    expect(
      screen.getByRole('form', { name: 'verify-email-form' })
    ).toHaveAttribute('data-initial-email', '');
    expect(
      screen.getByRole('form', { name: 'verify-email-form' })
    ).toHaveAttribute('data-initial-resend-locked', 'false');
  });

  it('unlock-account page renders localized guidance', async () => {
    render(
      await UnlockAccountPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(routeMocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(
      screen.getByRole('heading', { name: 'UnlockAccountPage.heading' })
    ).toBeVisible();
    expect(screen.getByText('UnlockAccountPage.body')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'UnlockAccountPage.back_sign_in' })
    ).toHaveAttribute('href', '/login');
  });

  it('profile layout wraps children in the settings shell', async () => {
    render(
      await ProfileLayout({
        children: <p>Profile child</p>,
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(screen.getByTestId('profile-settings-chrome')).toHaveAttribute(
      'data-callback-url',
      '/profile'
    );
    expect(screen.getByText('Profile child')).toBeVisible();
  });

  it('profile metadata uses localized copy', async () => {
    await expect(generateProfileMetadata(routeProps())).resolves.toEqual({
      description: 'UserProfilePage.account_meta_description',
      title: 'UserProfilePage.account_meta_title',
    });
  });

  const profilePageFindUniqueArgs = {
    select: {
      emailBouncedAt: true,
      emailSuppressedAt: true,
      emailSuppressionReason: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      firstName: true,
      lastName: true,
      mitClassYear: true,
      mitDataWarehouseVerifiedAt: true,
      mitId: true,
      phone: true,
      sailingAffiliation: true,
      sailingCardExpiresOn: true,
      sailingCardIssuedAt: true,
      sailingCardNumber: true,
      sailingCardRequests: {
        orderBy: { requestedAt: 'desc' },
        select: {
          cardType: true,
          cardYear: true,
          requestedAt: true,
          status: true,
        },
        take: 1,
      },
      sailingCardSwimAgreementInitialedAt: true,
      sailingCardSwimAgreementInitials: true,
      sailingCardYear: true,
      legalAgreementAcceptances: {
        orderBy: { acceptedAt: 'desc' },
        select: {
          acceptedAt: true,
          agreementHash: true,
          agreementVersion: true,
        },
        take: 1,
      },
      themePreference: true,
      unconfirmedEmail: true,
    },
    where: { id: 'user-1' },
  } as const;

  it('profile page forwards current user and database fields', async () => {
    render(
      await ProfilePage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(routeMocks.requireCurrentUser).toHaveBeenCalledWith(
      'en',
      '/profile'
    );
    expect(routeMocks.findUnique).toHaveBeenCalledWith(
      profilePageFindUniqueArgs
    );
    expect(
      screen.getByRole('region', { name: 'profile-account-client' })
    ).toHaveAttribute('data-theme', 'DARK');
    expect(
      screen.getByRole('region', { name: 'profile-account-client' })
    ).toHaveAttribute('data-email-deliverability', 'bounced');
    expect(
      screen.getByRole('region', { name: 'profile-account-client' })
    ).toHaveAttribute('data-unconfirmed-email', 'pending@example.com');
  });

  it('profile page defaults nullable account fields', async () => {
    routeMocks.requireCurrentUser.mockResolvedValue({
      email: null,
      id: 'user-1',
      name: null,
    });
    routeMocks.findUnique.mockResolvedValue({
      emailBouncedAt: null,
      emailSuppressedAt: null,
      emailSuppressionReason: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      firstName: null,
      lastName: null,
      legalAgreementAcceptances: [],
      mitClassYear: null,
      mitDataWarehouseVerifiedAt: null,
      mitId: null,
      phone: null,
      sailingAffiliation: null,
      sailingCardExpiresOn: null,
      sailingCardIssuedAt: null,
      sailingCardNumber: null,
      sailingCardRequests: [],
      sailingCardSwimAgreementInitialedAt: null,
      sailingCardSwimAgreementInitials: null,
      sailingCardYear: null,
      themePreference: null,
      unconfirmedEmail: null,
    });

    render(
      await ProfilePage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(
      screen.getByRole('region', { name: 'profile-account-client' })
    ).toHaveAttribute('data-email', '');
    expect(
      screen.getByRole('region', { name: 'profile-account-client' })
    ).toHaveAttribute('data-theme', 'SYSTEM');
  });

  it('profile page prefers suppressed deliverability state', async () => {
    routeMocks.findUnique.mockResolvedValue({
      emailBouncedAt: new Date('2026-01-01T12:00:00Z'),
      emailSuppressedAt: new Date('2026-01-01T12:00:00Z'),
      emailSuppressionReason: 'complained',
      emergencyContactName: null,
      emergencyContactPhone: null,
      firstName: null,
      lastName: null,
      legalAgreementAcceptances: [],
      mitClassYear: null,
      mitDataWarehouseVerifiedAt: null,
      mitId: null,
      phone: null,
      sailingAffiliation: null,
      sailingCardExpiresOn: null,
      sailingCardIssuedAt: null,
      sailingCardNumber: null,
      sailingCardRequests: [],
      sailingCardSwimAgreementInitialedAt: null,
      sailingCardSwimAgreementInitials: null,
      sailingCardYear: null,
      themePreference: 'DARK',
      unconfirmedEmail: null,
    });

    render(
      await ProfilePage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(
      screen.getByRole('region', { name: 'profile-account-client' })
    ).toHaveAttribute('data-email-deliverability', 'suppressed');
  });

  it('profile page reports missing database users', async () => {
    routeMocks.findUnique.mockResolvedValue(null);

    await expect(
      ProfilePage({
        params: Promise.resolve({ locale: 'en' }),
      })
    ).rejects.toThrow('Missing db user after auth');

    expect(routeMocks.loggerWarn).toHaveBeenCalledWith(
      'Missing database user after profile auth',
      {
        email: 'sailor@example.com',
        userId: 'user-1',
      }
    );
  });

  it('profile newsletter metadata uses localized copy', async () => {
    await expect(
      generateProfileNewsletterMetadata(routeProps())
    ).resolves.toEqual({
      description: 'UserProfilePage.newsletter_meta_description',
      title: 'UserProfilePage.newsletter_meta_title',
    });
  });

  it('profile newsletter page renders current preferences', async () => {
    render(
      await ProfileNewsletterPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(routeMocks.connection).toHaveBeenCalled();
    expect(routeMocks.requireCurrentUser).toHaveBeenCalledWith(
      'en',
      '/profile/newsletter'
    );
    expect(
      routeMocks.getExistingSubscriberPreferenceStateForUser
    ).toHaveBeenCalledWith('user-1');
    expect(
      screen.getByRole('heading', {
        name: 'UserProfilePage.newsletter_page_heading',
      })
    ).toBeVisible();

    const form = screen.getByRole('region', {
      name: 'newsletter-preference-form',
    });
    expect(form).toHaveAttribute(
      'data-error-label',
      'UserProfilePage.newsletter_preferences_error'
    );
    expect(form).toHaveAttribute(
      'data-success-label',
      'UserProfilePage.newsletter_preferences_saved'
    );
    expect(within(form).getByText('Racing')).toHaveAttribute(
      'data-subscribed',
      'true'
    );
    expect(within(form).getByText('Harbor')).toHaveAttribute(
      'data-subscribed',
      'false'
    );
    expect(
      within(form).getByRole('button', {
        name: 'UserProfilePage.newsletter_submit',
      })
    ).toBeVisible();
  });

  it('profile newsletter page defaults missing subscriber preferences', async () => {
    routeMocks.getExistingSubscriberPreferenceStateForUser.mockResolvedValue(
      null
    );

    render(
      await ProfileNewsletterPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    const form = screen.getByRole('region', {
      name: 'newsletter-preference-form',
    });
    expect(within(form).getByText('Racing')).toHaveAttribute(
      'data-subscribed',
      'false'
    );
    expect(within(form).getByText('Harbor')).toHaveAttribute(
      'data-subscribed',
      'false'
    );
  });

  it('profile password metadata uses localized copy', async () => {
    await expect(
      generateProfilePasswordMetadata(routeProps())
    ).resolves.toEqual({
      description: 'UserProfilePage.password_meta_description',
      title: 'UserProfilePage.password_meta_title',
    });
  });

  it('profile password page verifies the current user', async () => {
    render(
      await ProfilePasswordPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(routeMocks.requireCurrentUser).toHaveBeenCalledWith(
      'en',
      '/profile'
    );
    expect(
      screen.getByRole('region', { name: 'profile-password-client' })
    ).toBeVisible();
  });

  it('profile ratings metadata uses localized copy', async () => {
    await expect(generateProfileRatingsMetadata(routeProps())).resolves.toEqual(
      {
        description: 'UserProfilePage.ratings_meta_description',
        title: 'UserProfilePage.ratings_meta_title',
      }
    );
  });

  it('profile ratings page renders active rating assignments', async () => {
    vi.mocked(listUserRatingAssignmentRows).mockResolvedValue([
      userRatingAssignmentRowFixture({
        id: 'keelboat',
        issuedAt: new Date('2026-04-15T12:00:00Z'),
        issuedByName: 'Instructor One',
        name: 'Keelboat',
        unlockedBoats: [
          {
            id: 'boat-tech-dinghy',
            name: 'Tech dinghy',
            slug: 'tech-dinghy',
          },
        ],
      }),
      userRatingAssignmentRowFixture({
        id: 'club-420',
        issuedAt: new Date('2026-04-16T12:00:00Z'),
        name: 'Club 420',
      }),
      userRatingAssignmentRowFixture({
        id: 'tech',
        name: 'Tech dinghy',
      }),
    ]);

    render(
      await ProfileRatingsPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(routeMocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(routeMocks.requireCurrentUser).toHaveBeenCalledWith(
      'en',
      '/profile/ratings'
    );
    expect(listUserRatingAssignmentRows).toBe(
      routeMocks.listUserRatingAssignmentRows
    );
    expect(vi.mocked(listUserRatingAssignmentRows)).toHaveBeenCalledWith(
      'user-1',
      { includeDeprecated: false }
    );
    expect(
      screen.getByRole('heading', {
        name: 'UserProfilePage.ratings_page_heading',
      })
    ).toBeVisible();

    const ratingsTable = screen.getByRole('table');
    const inTable = within(ratingsTable);
    expect(
      inTable.getByRole('columnheader', {
        name: 'UserProfilePage.ratings_column_rating',
      })
    ).toBeVisible();
    expect(
      inTable.getByRole('columnheader', {
        name: 'UserProfilePage.ratings_column_assignment',
      })
    ).toBeVisible();
    expect(inTable.getByRole('rowheader', { name: 'Keelboat' })).toBeVisible();
    expect(inTable.getByRole('rowheader', { name: 'Club 420' })).toBeVisible();
    expect(
      inTable.getByRole('rowheader', { name: 'Tech dinghy' })
    ).toBeVisible();
    expect(
      inTable.getByText('UserProfilePage.ratings_issued_by')
    ).toBeVisible();
    expect(
      inTable.getByText('UserProfilePage.ratings_issued_on')
    ).toBeVisible();
    expect(
      inTable.getByText('UserProfilePage.ratings_no_issue_date')
    ).toBeVisible();
    expect(inTable.getByRole('link', { name: 'Tech dinghy' })).toHaveAttribute(
      'href',
      '/fleet/tech-dinghy'
    );
  });

  it('profile ratings page renders empty state', async () => {
    render(
      await ProfileRatingsPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    const ratingsTable = screen.getByRole('table');
    expect(
      within(ratingsTable).getByText('UserProfilePage.ratings_empty_state')
    ).toBeVisible();
  });

  it('profile security metadata uses localized copy', async () => {
    await expect(
      generateProfileSecurityMetadata(routeProps())
    ).resolves.toEqual({
      description: 'UserProfilePage.security_meta_description',
      title: 'UserProfilePage.security_meta_title',
    });
  });

  it('profile security page verifies the current user', async () => {
    render(
      await ProfileSecurityPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(routeMocks.requireCurrentUser).toHaveBeenCalledWith(
      'en',
      '/profile'
    );
    expect(
      screen.getByRole('region', { name: 'profile-security-client' })
    ).toBeVisible();
  });

  it('profile delete metadata uses localized copy', async () => {
    await expect(generateProfileDeleteMetadata(routeProps())).resolves.toEqual({
      description: 'UserProfilePage.delete_meta_description',
      title: 'UserProfilePage.delete_meta_title',
    });
  });

  it('profile delete page verifies the current user', async () => {
    render(
      await ProfileDeletePage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(routeMocks.requireCurrentUser).toHaveBeenCalledWith(
      'en',
      '/profile'
    );
    expect(
      screen.getByRole('region', { name: 'profile-delete-account-client' })
    ).toHaveAttribute('data-sign-in-href', '/login');
  });
});
