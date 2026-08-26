import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Submits an admin catalog form and waits for the Server Action round trip to
 * finish before the test asserts on the resulting page.
 *
 * The response status is deliberately not part of the predicate: Next.js
 * answers JS-driven Server Action redirects with 200 and `x-action-redirect`,
 * and only uses 303 for no-JS form posts.
 *
 * @param page - Current Playwright page
 * @param options - Optional submit behavior
 */
export async function submitCatalogSave(
  page: Page,
  options?: { continueEditing?: boolean }
): Promise<void> {
  const { pathname } = new URL(page.url());
  const save = page.getByRole('button', {
    name: options?.continueEditing ? 'Save and continue editing' : 'Save',
    exact: true,
  });
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === pathname
  );

  await save.click();
  const response = await saved;

  expect(
    response.status(),
    `catalog save action failed at ${pathname}`
  ).toBeLessThan(400);
}
