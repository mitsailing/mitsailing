import { describe, expect, it } from 'vitest';
import {
  decodeHtmlEntities,
  extractLinkFromMessage,
} from '../../../tests/helpers/mailpit';

describe('decodeHtmlEntities', () => {
  it('decode callbackURL in an html verification href', () => {
    const encoded =
      'https://example.test/api/auth/verify-email?token=abc&amp;callbackURL=%2Fonboarding';

    expect(decodeHtmlEntities(encoded)).toBe(
      'https://example.test/api/auth/verify-email?token=abc&callbackURL=%2Fonboarding'
    );
    expect(
      extractLinkFromMessage(
        {
          HTML: `<a href="${encoded}">Confirm</a>`,
          ID: 'message-1',
          Subject: 'Confirm your email',
          Text: '',
          To: [],
        },
        /https?:\/\/[^\s"'<>]+verify-email[^\s"'<>]*/i
      )
    ).toBe(
      'https://example.test/api/auth/verify-email?token=abc&callbackURL=%2Fonboarding'
    );
  });
});
