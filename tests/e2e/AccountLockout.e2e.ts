import { faker } from '@faker-js/faker';
import { expect, test } from '@playwright/test';
import { prisma } from '../../src/libs/DB';
import {
  deleteAllMessages,
  extractLinkFromMessage,
  findLatestMessageTo,
} from '../helpers/mailpit';

/**
 * End-to-end test for the Devise-Lockable-style account-lock flow.
 *
 * Scenario under test:
 *   1. User registers and has their email verified out-of-band.
 *   2. They fail sign-in MAX_FAILED_ATTEMPTS times in a row; the account
 *      locks and a lockout email is sent.
 *   3. Clicking the unlock link in the email clears the failed-attempt
 *      rows and lands on /sign-in?unlocked=1.
 *   4. A subsequent sign-in with the correct password succeeds.
 *
 * This is the key integration test for the auth hardening work because it
 * covers the three moving parts at once: before-middleware (lockout),
 * sendAccountLockedEmail + SMTP transport (email dispatch), and
 * /api/unlock-account (token verification + state cleanup).
 */

test.afterAll(async () => {
  await prisma.$disconnect();
});

const swallow = (error: unknown): null => {
  if (process.env.DEBUG_CLEANUP) {
    console.warn(error);
  }
  return null;
};

async function cleanupByEmail(email: string) {
  await prisma.failedLoginAttempt
    .deleteMany({ where: { email } })
    .catch(swallow);
  await prisma.user.delete({ where: { email } }).catch(swallow);
}

async function markEmailVerified(email: string) {
  await prisma.user.update({
    where: { email },
    data: { emailVerified: true },
  });
}

test.describe('Account lockout', () => {
  test('locks after repeated failures, sends unlock email, unlocks via link', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';

    await deleteAllMessages();

    await page.goto('/sign-up');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(
      page.getByText(
        'Check your email to confirm your address before signing in.'
      )
    ).toBeVisible();

    await markEmailVerified(email);
    await deleteAllMessages();

    // Five wrong-password attempts in a row. The sixth attempt — or even
    // the fifth, depending on whether the count is checked before or
    // after — trips the lockout. We loop to a generous max instead of
    // hard-coding so a future tweak to MAX_FAILED_ATTEMPTS doesn't
    // silently defeat this test.
    const MAX_ATTEMPTS = 6;
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      await page.goto('/sign-in');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill('definitely-not-the-password');
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByRole('alert')).toBeVisible();
    }

    // The lockout email arrives via Mailpit. Pattern matches the
    // absolute URL our email template renders.
    const lockoutMessage = await findLatestMessageTo(email);
    expect(lockoutMessage.Subject).toMatch(/lock/i);

    const unlockUrl = extractLinkFromMessage(
      lockoutMessage,
      /https?:\/\/[^\s"'<>]+\/api\/unlock-account\?token=[^\s"'<>]+/
    );

    // Follow the unlock link. The API route redirects to /sign-in?unlocked=1.
    await page.goto(unlockUrl);
    await expect(page).toHaveURL(/\/sign-in\?.*unlocked=1/);
    await expect(
      page.getByText('Your account is unlocked. You can sign in.')
    ).toBeVisible();

    // The failed-attempt rows must be gone so lockout doesn't immediately
    // retrip when the user signs in.
    const remaining = await prisma.failedLoginAttempt.count({
      where: { email },
    });
    expect(remaining).toBe(0);

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    await cleanupByEmail(email);
  });
});
