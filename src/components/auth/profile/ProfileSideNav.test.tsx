import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { setComponentTestPathname } from '@/test/component';
import { ProfileSideNav } from './ProfileSideNav';

describe('ProfileSideNav', () => {
  beforeEach(() => {
    setComponentTestPathname('/profile/account/');
  });

  it('profile owner sees profile settings navigation with the current page marked', () => {
    render(<ProfileSideNav />);

    const nav = screen.getByRole('navigation', { name: 'Profile settings' });

    expect(nav).toBeVisible();
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'Password' })).toHaveAttribute(
      'href',
      '/profile/password/'
    );
    expect(screen.getByRole('link', { name: 'Delete account' })).toBeVisible();
  });

  it('profile owner sees a nested password page marked in the rail', () => {
    setComponentTestPathname('/profile/password/change/');

    render(<ProfileSideNav />);

    expect(screen.getByRole('link', { name: 'Password' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'Account' })).not.toHaveAttribute(
      'aria-current'
    );
  });
});
