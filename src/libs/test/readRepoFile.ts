import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

export function readRepoFile(filePath: string): string {
  const repoRoot = process.cwd();
  const resolvedPath = resolve(repoRoot, filePath);
  const relativePath = relative(repoRoot, resolvedPath);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error(`Repository file path escapes the repo root: ${filePath}`);
  }
  return readFileSync(resolvedPath, 'utf8');
}
