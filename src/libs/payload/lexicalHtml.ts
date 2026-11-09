import 'server-only';
import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html';
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';

/**
 * Narrows unknown Payload richText values to Lexical editor state.
 *
 * @param value - Raw richText field from Payload
 * @returns True when value looks like a Lexical document
 */
export function isLexicalEditorState(
  value: unknown
): value is SerializedEditorState {
  return typeof value === 'object' && value !== null && 'root' in value;
}

/**
 * Converts Payload Lexical rich text to HTML for views that sanitize HTML.
 *
 * @param data - Lexical editor state from a Payload richText field
 * @returns HTML string, or empty string when data is missing
 */
export function lexicalToHtml(data: unknown): string {
  if (!isLexicalEditorState(data)) {
    return '';
  }
  return convertLexicalToHTML({
    data,
    disableContainer: true,
  });
}
