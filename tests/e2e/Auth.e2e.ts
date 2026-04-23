import { faker } from '@faker-js/faker';
import { expect, test } from '@playwright/test';
import { prisma } from '../../src/libs/DB';

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

test.describe('Auth', () => {
  test('registers, verifies, and signs in with Better Auth credentials', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';

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

    const credentialAccount = await prisma.account.findFirst({
      where: { user: { email }, providerId: 'credential' },
    });

    expect(credentialAccount?.password?.startsWith('$argon2id$')).toBe(true);

    await markEmailVerified(email);

    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();

    await cleanupByEmail(email);
  });

  test('rejects invalid credentials', async ({ page }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;

    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('wrong-password-123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toHaveText(
      'Invalid email or password.'
    );
  });

  test('surfaces an explicit error when signing up with an existing email', async ({
    page,
  }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';

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

    await page.goto('/sign-up');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'That email is already in the system.'
    );

    await cleanupByEmail(email);
  });

  test('blocks sign-in for unverified accounts', async ({ page }) => {
    const email = `qa-${faker.string.alphanumeric(10).toLowerCase()}@example.com`;
    const password = 'Correct-Horse-Battery-Staple';

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

    await page.goto('/sign-in');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toContainText(
      'Verify your email before signing in.'
    );

    await cleanupByEmail(email);
  });
});
