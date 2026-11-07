const NAMED_NEWS_HTML_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: '\u00A0',
  quot: '"',
};

/** Maximum Unicode scalar value U+10FFFF (inclusive). */
const MAX_UNICODE_SCALAR = 1_114_111;
/** High surrogate code unit range start (non-scalars). */
const SURROGATE_MIN = 55_296;
/** High surrogate code unit range end (non-scalars). */
const SURROGATE_MAX = 57_343;

function characterFromCodePoint(code: number, fallback: string): string {
  if (
    !Number.isInteger(code) ||
    code < 0 ||
    code > MAX_UNICODE_SCALAR ||
    (code >= SURROGATE_MIN && code <= SURROGATE_MAX)
  ) {
    return fallback;
  }
  return String.fromCodePoint(code);
}

function decodeNewsHtmlEntity(entity: string, rawBody: string): string {
  const body = rawBody.toLowerCase();
  if (body.startsWith('#x')) {
    return characterFromCodePoint(Number.parseInt(body.slice(2), 16), entity);
  }
  if (body.startsWith('#')) {
    return characterFromCodePoint(Number.parseInt(body.slice(1), 10), entity);
  }
  return NAMED_NEWS_HTML_ENTITIES[body] ?? entity;
}

function decodeNewsHtmlEntities(text: string): string {
  return text.replaceAll(
    /&(#x[\da-f]+|#\d+|[a-z]+);/giu,
    (entity, body: string) => decodeNewsHtmlEntity(entity, body)
  );
}

/**
 * Strips angle-bracket tags, decodes HTML entities, and collapses whitespace.
 * Entities are decoded after tags are removed, so escaped markup stays literal text.
 *
 * @param htmlish - Stored body markup (sanitized subset)
 * @returns Plain text for banner fingerprints and admin catalog lists
 */
export function plainTextFromNewsHtmlish(htmlish: string): string {
  return decodeNewsHtmlEntities(htmlish.replaceAll(/<[^>]*>/g, ' '))
    .replaceAll(/\s+/g, ' ')
    .trim();
}
