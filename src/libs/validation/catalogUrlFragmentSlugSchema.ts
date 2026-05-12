import * as z from 'zod';

/**
 * Lowercase kebab-case ASCII slug used for catalog rows, CMS pages, and URL
 * `#` fragments; rejects spaces and reserved URL characters.
 */
export const catalogUrlFragmentSlugSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
