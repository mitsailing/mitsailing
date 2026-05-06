import path from 'node:path';
import { Env } from '@/libs/Env';

/**
 * Resolves the validated upload root to an absolute path for prefix checks.
 *
 * @returns Absolute filesystem path of the upload root
 */
export function resolveUploadBaseDir(): string {
  const raw = Env.UPLOAD_DIR;
  return path.isAbsolute(raw)
    ? path.resolve(raw)
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), raw);
}
