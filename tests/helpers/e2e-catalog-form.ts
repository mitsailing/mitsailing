import type { Page } from '@playwright/test';

/**
 * Submits an admin catalog form and waits for the Server Action redirect to
 * finish before the test leaves the edit page.
 *
 * @param page - Current Playwright page
 */
export async function submitCatalogSave(page: Page): Promise<void> {
  const { pathname } = new URL(page.url());
  const save = page.getByRole('button', { name: 'Save' });
  const saved = page.waitForResponse((response) => {
    const request = response.request();
    const { pathname: responsePathname } = new URL(response.url());
    return (
      request.method() === 'POST' &&
      response.status() === 303 &&
      responsePathname === pathname
    );
  });

  await save.click();
  await saved;
}
