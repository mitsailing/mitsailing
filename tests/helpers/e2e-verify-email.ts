import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { extractLinkFromMessage, findLatestMessageTo } from './mailpit';

/**
 * Opens the verification link from Mailpit and waits until the browser leaves
 * the auth API callback path.
 *
 * @param page - Playwright page used to open the link.
 * @param email - Recipient address that should have received the email.
 */
export async function verifyEmailWithLatestLink(page: Page, email: string) {
  const message = await findLatestMessageTo(email);
  expect(message.Subject).toMatch(/confirm/i);

  const verifyUrl = extractLinkFromMessage(
    message,
    /https?:\/\/[^\s"'<>]+verify-email[^\s"'<>]*/i
  );
  await page.goto(verifyUrl);
}
