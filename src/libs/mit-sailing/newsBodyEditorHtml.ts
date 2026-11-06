const NEWS_MARKUP_RE = /<\s*\/?\s*(?:a|b|br|em|i|p|strong)\b/iu;

function escapeNewsText(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function breaksInText(text: string, previous: string, next: string): string {
  if (!text.includes('\n')) {
    return text;
  }
  if (text.trim() === '') {
    return '';
  }
  let value = text;
  const previousOpensElement =
    previous.startsWith('<') &&
    !previous.startsWith('</') &&
    !/^<br\b/iu.test(previous);
  if (previousOpensElement) {
    value = value.replace(/^\n+/u, '');
  }
  if (next.startsWith('</')) {
    value = value.replace(/\n+$/u, '');
  }
  return value.replaceAll('\n', '<br>');
}

/**
 * Turns a stored news body into HTML whose line breaks survive TipTap.
 * Plain-text newlines become `<br>` hard breaks. Existing tags stay intact.
 *
 * @param raw - Stored body, legacy plain text or news HTML
 * @returns Editor HTML
 */
export function newsBodyEditorHtml(raw: string): string {
  const normalized = raw.replaceAll(/\r\n?/gu, '\n');
  if (normalized.trim() === '') {
    return '<p></p>';
  }
  if (!NEWS_MARKUP_RE.test(normalized)) {
    return `<p>${escapeNewsText(normalized).replaceAll('\n', '<br>')}</p>`;
  }
  const parts = normalized.split(/(<[^>]*>)/u);
  return parts
    .map((part, index) =>
      part.startsWith('<')
        ? part
        : breaksInText(part, parts[index - 1] ?? '', parts[index + 1] ?? '')
    )
    .join('');
}
