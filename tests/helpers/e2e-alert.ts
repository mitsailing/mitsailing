import type { Page } from '@playwright/test';

/**
 * Real page alerts only; Next.js sets `role="alert"` on the route announcer.
 *
 * @param page - Playwright page under test
 * @returns Locator for visible form alerts, excluding the Next.js route announcer
 */
export function formAlert(page: Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}
