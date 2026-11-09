import 'server-only';
import configPromise from '@payload-config';
import {
  convertHTMLToLexical,
  defaultEditorConfig,
  sanitizeServerEditorConfig,
} from '@payloadcms/richtext-lexical';
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical';
import { JSDOM } from 'jsdom';

let sanitizedEditorConfigPromise: ReturnType<
  typeof sanitizeServerEditorConfig
> | null = null;

async function sanitizedEditorConfig() {
  if (!sanitizedEditorConfigPromise) {
    const config = await configPromise;
    sanitizedEditorConfigPromise = sanitizeServerEditorConfig(
      defaultEditorConfig,
      config
    );
  }
  return sanitizedEditorConfigPromise;
}

/**
 * Converts HTML into a Payload Lexical editor state for page seeds.
 *
 * @param html - Sanitized HTML fragment
 * @returns Lexical editor state
 */
export async function lexicalFromHtml(
  html: string
): Promise<SerializedEditorState> {
  const editorConfig = await sanitizedEditorConfig();
  return convertHTMLToLexical({
    editorConfig,
    html,
    JSDOM,
  }) as SerializedEditorState;
}
