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
import ProfileAccountPage, {
  generateMetadata as generateProfileAccountMetadata,
} from './profile/account/page';
import ProfileDeletePage, {
  generateMetadata as generateProfileDeleteMetadata,
} from './profile/delete/page';
import ProfileLayout from './profile/layout';
import ProfileIndexPage from './profile/page';
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
  findUnique: vi.fn(),
  getTranslations: vi.fn(),
  listUserRatingAssignmentRows:
    vi.fn() as MockedFunction<ListUserRatingAssignmentRowsFn>,
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  redirectIfAuthenticated: vi.fn(),
  requireCurrentUser: vi.fn(),
  setRequestLocale: vi.fn(),
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
  getTranslations: routeMocks.getTranslations,
  setRequestLocale: routeMocks.setRequestLocale,
}));

vi.mock('next/navigation', () => ({
  redirect: routeMocks.redirect,
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

vi.mock('@/libs/mit-sailing/sailingRatingQueries', () => ({
  listUserRatingAssignmentRows: routeMocks.listUserRatingAssignmentRows,
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
    passwordHeading: string;
  }) => (
    <form
      aria-label="reset-password-form"
      data-callback-url={props.callbackUrl}
      data-initial-email={props.initialEmail}
      data-initial-resend-locked={String(props.initialResendLocked)}
      data-password-heading={props.passwordHeading}
    />
  ),
}));

vi.mock('./(center)/signup/SignUpForm', () => ({
  SignUpForm: (props: { callbackUrl: string }) => (
    <form aria-label="sign-up-form" data-callback-url={props.callbackUrl} />
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
    initialName: string | null;
    initialThemePreference: string;
    initialUnconfirmedEmail: string | null;
  }) => (
    <section
      aria-label="profile-account-client"
      data-email={props.initialEmail}
      data-name={props.initialName ?? ''}
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

function routeProps(searchParams: Record<string, string | undefined> = {}) {
  return {
    params: Promise.resolve({ locale: 'en' }),
    searchParams: Promise.resolve(searchParams),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.getTranslations.mockImplementation(
    async (props: { namespace: string }) => {
      await Promise.resolve();
      return createTranslator(props.namespace);
    }
  );
  routeMocks.redirectIfAuthenticated.mockImplementation(async () => {
    await Promise.resolve();
  });
  routeMocks.requireCurrentUser.mockResolvedValue({
    email: 'sailor@example.com',
    id: 'user-1',
    name: 'Sailor',
  });
  routeMocks.findUnique.mockResolvedValue({
    themePreference: 'DARK',
    unconfirmedEmail: 'pending@example.com',
  });
  vi.mocked(listUserRatingAssignmentRows).mockResolvedValue(
    [] satisfies UserRatingAssignmentRow[]
  );
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
          callbackUrl: '/profile/account',
          error: 'unlock_invalid',
        })
      )
    );

    expect(routeMocks.redirectIfAuthenticated).toHaveBeenCalledWith(
      'en',
      '/profile/account'
    );
    expect(
      screen.getByRole('heading', { name: 'SignInPage.heading' })
    ).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'SignInPage.unlock_invalid_error'
    );
    expect(screen.getByRole('form', { name: 'sign-in-form' })).toHaveAttribute(
      'data-callback-url',
      '/profile/account'
    );
    expect(
      screen.getByRole('link', { name: 'SignInPage.sign_up_link' })
    ).toHaveAttribute('href', '/signup?callbackUrl=%2Fprofile%2Faccount');
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

  it('sign-up metadata uses localized copy', async () => {
    await expect(generateSignUpMetadata(routeProps())).resolves.toEqual({
      description: 'SignUpPage.meta_description',
      title: 'SignUpPage.meta_title',
    });
  });

  it('sign-up page passes callback links through the shell', async () => {
    render(await SignUpPage(routeProps({ callbackUrl: '/fleet' })));

    expect(routeMocks.redirectIfAuthenticated).toHaveBeenCalledWith(
      'en',
      '/fleet'
    );
    expect(
      screen.getByRole('heading', { name: 'SignUpPage.heading' })
    ).toBeVisible();
    expect(screen.getByRole('form', { name: 'sign-up-form' })).toHaveAttribute(
      'data-callback-url',
      '/fleet'
    );
    expect(
      screen.getByRole('link', { name: 'SignUpPage.sign_in_link' })
    ).toHaveAttribute('href', '/login?callbackUrl=%2Ffleet');
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

  it('reset-password page defaults missing search params', async () => {
    render(await ResetPasswordPage(routeProps()));

    expect(
      screen.getByRole('form', { name: 'reset-password-form' })
    ).toHaveAttribute('data-initial-email', '');
    expect(
      screen.getByRole('form', { name: 'reset-password-form' })
    ).toHaveAttribute('data-initial-resend-locked', 'false');
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
      '/profile/account'
    );
    expect(screen.getByText('Profile child')).toBeVisible();
  });

  it('profile index redirects to account settings', async () => {
    await expect(
      ProfileIndexPage({ params: Promise.resolve({ locale: 'en' }) })
    ).rejects.toThrow('NEXT_REDIRECT:/profile/account');

    expect(routeMocks.redirect).toHaveBeenCalledWith('/profile/account');
  });

  it('profile account metadata uses localized copy', async () => {
    await expect(generateProfileAccountMetadata(routeProps())).resolves.toEqual(
      {
        description: 'UserProfilePage.account_meta_description',
        title: 'UserProfilePage.account_meta_title',
      }
    );
  });

  it('profile account page forwards current user and database fields', async () => {
    render(
      await ProfileAccountPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(routeMocks.requireCurrentUser).toHaveBeenCalledWith(
      'en',
      '/profile/account'
    );
    expect(routeMocks.findUnique).toHaveBeenCalledWith({
      select: { themePreference: true, unconfirmedEmail: true },
      where: { id: 'user-1' },
    });
    expect(
      screen.getByRole('region', { name: 'profile-account-client' })
    ).toHaveAttribute('data-theme', 'DARK');
    expect(
      screen.getByRole('region', { name: 'profile-account-client' })
    ).toHaveAttribute('data-unconfirmed-email', 'pending@example.com');
  });

  it('profile account page defaults nullable account fields', async () => {
    routeMocks.requireCurrentUser.mockResolvedValue({
      email: null,
      id: 'user-1',
      name: null,
    });
    routeMocks.findUnique.mockResolvedValue(null);

    render(
      await ProfileAccountPage({
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
      '/profile/account'
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
      '/profile/account'
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
      '/profile/account'
    );
    expect(
      screen.getByRole('region', { name: 'profile-delete-account-client' })
    ).toHaveAttribute('data-sign-in-href', '/login');
  });
});
