/**
 * Mailpit helper used by Playwright tests.
 *
 * Mailpit captures outbound SMTP during local + CI runs (see
 * compose.override.yaml). Its HTTP API is stable enough that we can assert
 * against it directly — much better than mocking Resend in every test,
 * because it also exercises the SMTP driver in `sendTransactional.ts` that
 * staging uses in production-like shape.
 *
 * Test strategy: at the start of every spec that cares about mail content,
 * `await deleteAllMessages()`. Then after the action under test, poll
 * `findLatestMessageTo(email)` or `findLatestMessageToMatching(...)` until
 * it returns. That way parallel Playwright workers don't cross-contaminate:
 * each worker's unique email address scopes the read.
 */

import { setTimeout as sleep } from 'node:timers/promises';

const MAILPIT_BASE_URL = process.env.MAILPIT_API_URL ?? 'http://127.0.0.1:8025';

type MailpitSummary = {
  ID: string;
  To: { Address: string }[];
  Subject: string;
};

type MailpitListResponse = {
  messages: MailpitSummary[];
};

type MailpitMessage = {
  ID: string;
  Subject: string;
  To: { Address: string }[];
  HTML: string;
  Text: string;
};

type MailpitMessagePredicate = (message: MailpitMessage) => boolean;

/**
 * Thin wrapper around the Mailpit REST API that throws on non-2xx.
 * @param path - API path beginning with `/`.
 * @param init - Optional fetch init (method, headers).
 * @returns The raw fetch Response on success.
 */
async function mailpitFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(`${MAILPIT_BASE_URL}${path}`, init);
  if (!response.ok) {
    throw new Error(
      `Mailpit ${init?.method ?? 'GET'} ${path} returned ${response.status}`
    );
  }
  return response;
}

/** Wipe the Mailpit inbox between tests. */
export async function deleteAllMessages(): Promise<void> {
  await mailpitFetch('/api/v1/messages', { method: 'DELETE' });
}

/**
 * Poll Mailpit until a matching message addressed to `email` lands.
 *
 * @param params - Recipient, matcher, timeout, and error description.
 * @returns The most recent matching Mailpit message for `email`.
 */
export async function findLatestMessageToMatching(params: {
  description: string;
  email: string;
  matches: MailpitMessagePredicate;
  timeoutMs?: number;
}): Promise<MailpitMessage> {
  const timeoutMs = params.timeoutMs ?? 30_000;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      // Mailpit's search-by-query endpoint accepts Gmail-style filters.
      // `to:` is case-insensitive and matches the envelope recipient.
      const listResponse = await mailpitFetch(
        `/api/v1/search?query=${encodeURIComponent(`to:${params.email}`)}&limit=10`
      );
      // Mailpit's API is well-known and the test helper is the narrowest
      // possible consumer, so we accept the cast rather than pulling in a
      // runtime validator for two shapes.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Mailpit response shape is fixed in tests
      const list = (await listResponse.json()) as MailpitListResponse;

      if (!Array.isArray(list.messages)) {
        throw new TypeError('Mailpit response missing messages array.');
      }

      for (const summary of list.messages) {
        const detailResponse = await mailpitFetch(
          `/api/v1/message/${summary.ID}`
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- same as list JSON above
        const message = (await detailResponse.json()) as MailpitMessage;
        if (params.matches(message)) {
          return message;
        }
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }

  let lastErrorMessage = 'no polling errors';
  if (lastError instanceof Error) {
    lastErrorMessage = lastError.message;
  } else if (lastError !== undefined) {
    lastErrorMessage = JSON.stringify(lastError);
  }
  throw new Error(
    `No Mailpit ${params.description} to ${params.email} within ${timeoutMs}ms (last error: ${lastErrorMessage})`
  );
}

/**
 * Poll Mailpit until a message addressed to `email` lands (or the deadline
 * elapses). Returns the fully-rendered message so callers can pluck
 * verification codes and unlock URLs out of it.
 *
 * @param email - Recipient address to filter on.
 * @param timeoutMs - How long to wait before failing. Defaults to 30s —
 *                    comfortably longer than the worst-case SMTP handoff
 *                    from the app container to Mailpit on CI runners.
 * @returns The most recent Mailpit message for `email`.
 */
export async function findLatestMessageTo(
  email: string,
  timeoutMs = 30_000
): Promise<MailpitMessage> {
  const message = await findLatestMessageToMatching({
    description: 'message',
    email,
    matches: () => true,
    timeoutMs,
  });
  return message;
}

/**
 * Poll Mailpit until a message to `email` includes `text` in HTML or plain text.
 *
 * @param email - Recipient address to filter on.
 * @param text - Unique text expected in the message body.
 * @param timeoutMs - How long to wait before failing.
 * @returns The newest matching message.
 */
export async function findLatestMessageToContaining(
  email: string,
  text: string,
  timeoutMs = 15_000
): Promise<MailpitMessage> {
  const message = await findLatestMessageToMatching({
    description: `message containing ${text}`,
    email,
    matches: (candidate) =>
      candidate.HTML.includes(text) || candidate.Text.includes(text),
    timeoutMs,
  });
  return message;
}

/**
 * Pull the first link that matches `pattern` out of a Mailpit message body.
 * Uses the HTML body first, falls back to Text so plain-text tests still
 * work. `pattern` typically looks like /\/api\/unlock-account\?token=[^"'<\s]+/.
 *
 * @param message - Message returned by `findLatestMessageTo`.
 * @param pattern - RegExp that must include the URL-shaped capture.
 * @returns The first URL in the message body matching `pattern`.
 */
export function extractLinkFromMessage(
  message: MailpitMessage,
  pattern: RegExp
): string {
  const match = message.HTML.match(pattern) ?? message.Text.match(pattern);
  if (!match) {
    throw new Error(
      `No link matching ${pattern} found in message ${message.ID} (subject: "${message.Subject}")`
    );
  }
  return match[0];
}

/**
 * Pull the first 6-digit OTP out of a Mailpit message body.
 * Prefers Text to avoid HTML markup and encoded characters, then falls back to HTML.
 *
 * @param message - Message returned by `findLatestMessageTo`.
 * @returns The first 6-digit verification code in the message body.
 */
export function extractCodeFromMessage(message: MailpitMessage): string {
  const match =
    message.Text.match(/\b\d{6}\b/) ?? message.HTML.match(/\b\d{6}\b/);
  if (!match) {
    throw new Error(
      `No 6-digit code found in message ${message.ID} (subject: "${message.Subject}")`
    );
  }
  return match[0];
}
