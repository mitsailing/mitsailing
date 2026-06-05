import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export async function submitEmailPasswordSignIn(props: {
  readonly email: string;
  readonly page: Page;
  readonly password: string;
  readonly path?: string;
}): Promise<void> {
  await props.page.goto(props.path ?? '/login');
  await props.page.getByLabel('Email').fill(props.email);
  await props.page.getByRole('button', { name: 'Continue' }).click();
  await expect(
    props.page.getByLabel('Password', { exact: true })
  ).toBeVisible();
  await props.page.getByLabel('Password', { exact: true }).fill(props.password);
  await props.page.getByRole('button', { name: 'Sign in' }).click();
}
