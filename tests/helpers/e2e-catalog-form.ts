import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Reads the redirect target from a Server Action response.
 *
 * @param response - Playwright response from the action POST
 * @param baseUrl - URL used to resolve relative redirect targets
 * @returns Parsed redirect URL when present
 */
function catalogActionRedirectUrl(
  response: Awaited<ReturnType<Page['waitForResponse']>>,
  baseUrl: string
): URL | null {
  const actionRedirect = response.headers()['x-action-redirect'];
  if (actionRedirect) {
    const target = actionRedirect.split(';')[0]?.trim();
    if (target) {
      return new URL(target, baseUrl);
    }
  }

  const { location } = response.headers();
  if (location) {
    return new URL(location, baseUrl);
  }

  return null;
}

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

  const redirectUrl = catalogActionRedirectUrl(response, page.url());
  if (redirectUrl) {
    expect(
      redirectUrl.searchParams.has('error'),
      `catalog save redirected with error=${redirectUrl.searchParams.get('error')}`
    ).toBe(false);
    expect(redirectUrl.searchParams.getAll('fieldError')).toHaveLength(0);
  }
}
